/* ============================================================
   e-RAB Desa v1.2 — kalkulasi.js
   Core RAB calculation engine + Dual Satuan Semen (sak/kg)
   ============================================================ */

'use strict';

const Kalkulasi = {

  // ===== CALCULATE VOLUME FROM DIMENSIONS =====
  calcVolume(item) {
    const { jenis_satuan, panjang, lebar, tinggi, volume_manual } = item;

    if (volume_manual > 0) return Number(volume_manual) || 0;

    const p = Number(panjang) || 0;
    const l = Number(lebar) || 0;
    const t = Number(tinggi) || 0;

    switch (jenis_satuan) {
      case 'volume': return parseFloat((p * l * t).toFixed(4)); // m³
      case 'area':   return parseFloat((p * l).toFixed(4));     // m²
      case 'panjang': return p;                                 // m'
      case 'berat':  return parseFloat((p * l * t * 2.25).toFixed(4)); // ton (aspal)
      case 'buah':   return Math.round(p);
      default:       return parseFloat((p * l * t).toFixed(4));
    }
  },

  // ===== CALC VOLUME FOR STA SUBROWS =====
  calcSTAVolume(staRows, jenis_satuan) {
    let total = 0;
    staRows.forEach(row => {
      const p = Number(row.panjang) || 0;
      const l = Number(row.lebar) || 0;
      const t = Number(row.tinggi) || 0;
      let vol = 0;
      switch (jenis_satuan) {
        case 'volume': vol = p * l * t; break;
        case 'area':   vol = p * l; break;
        case 'panjang': vol = p; break;
        case 'berat':  vol = p * l * t * 2.25; break;
        default:       vol = p * l * t;
      }
      total += vol;
    });
    return parseFloat(total.toFixed(4));
  },

  // ===== CALCULATE SINGLE ITEM HSP =====
  calcItemHSP(ahspItem, projectId, overheadPct) {
    return AHSP.calcHSP(ahspItem, projectId, overheadPct);
  },

  // ===== CALCULATE SINGLE RAB LINE TOTAL =====
  calcLineTotal(volume, hsp) {
    return Math.round(volume * hsp);
  },

  // ===== CALCULATE FULL RAB =====
  async calcFullRAB(projectId, sections, overheadPctOverride = null) {
    if (!sections?.length) return { sections: [], grandTotal: 0 };

    // Gunakan overheadPct dari parameter jika ada, hindari Firestore call extra
    let overheadPct = overheadPctOverride;
    if (overheadPct === null) {
      const project = await Projects.load(projectId);
      overheadPct = project?.overhead_pct ?? 15;
    }
    await MasterHarga.loadGlobal();
    await MasterHarga.loadProjectOverrides(projectId);

    const result = [];
    let grandTotal = 0;

    for (const section of sections) {
      const calcedItems = [];
      let sectionTotal = 0;

      for (const item of (section.items || [])) {
        // === ITEM MODE LANGSUNG (tanpa AHSP) ===
        if (item.mode === 'langsung') {
          const vol = Number(item.volume_manual) || 0;
          const harga = Number(item.harga_satuan_langsung) || 0;
          const jumlah = Math.round(vol * harga);
          sectionTotal += jumlah;
          calcedItems.push({
            ...item,
            ahsp: null,
            volume_calc: vol,
            display_volume: vol,
            display_satuan: item.display_satuan || 'buah',
            hsp: harga,
            jumlah,
            breakdown: null
          });
          continue;
        }

        const ahspItem = await AHSP.getById(item.ahsp_id);
        if (!ahspItem) {
          calcedItems.push({ ...item, hsp: 0, jumlah: 0, breakdown: null });
          continue;
        }

        const breakdown = this.calcItemHSP(ahspItem, projectId, overheadPct);
        const hsp = breakdown?.hsp || 0;

        // Volume calculation
        let volume = 0;
        if ((item.sta_mode === 'sta' || item.sta_mode === 'subrows') && item.sta_rows?.length) {
          volume = this.calcSTAVolume(item.sta_rows, item.jenis_satuan);
        } else {
          volume = this.calcVolume(item);
        }

        const jumlah = this.calcLineTotal(volume, hsp);
        sectionTotal += jumlah;

        calcedItems.push({
          ...item,
          ahsp: ahspItem,
          volume_calc: parseFloat(volume.toFixed(4)),
          display_volume: parseFloat(volume.toFixed(4)),
          display_satuan: ahspItem.satuan,
          hsp,
          jumlah,
          breakdown
        });
      }

      grandTotal += sectionTotal;
      result.push({ ...section, items: calcedItems, total: sectionTotal });
    }

    return { sections: result, grandTotal };
  },

  // ===== FORMAT KEBUTUHAN DENGAN DUAL SATUAN SEMEN =====
  // Semen selalu ditampilkan dalam sak (1 sak = 40 kg)
  formatKebutuhan(kode, satuan, totalKebutuhan) {
    if (kode === 'M01a_kg' || kode.includes('semen')) {
      const sak = Math.ceil(totalKebutuhan / 40);
      // Fix g: HSD semen harus per sak (×40), bukan per kg
      // Caller harus kalikan hsd dengan 40 jika kode semen
      return { 
        display: `${Utils.formatNum(sak, 0)} sak`, 
        satuan: 'sak', 
        nilai: sak,
        rawKg: totalKebutuhan,
        isSemen: true
      };
    }
    if (satuan === 'OH') {
      return { 
        display: `${Utils.formatNum(totalKebutuhan, 2)} OH`, 
        satuan: 'OH', 
        nilai: totalKebutuhan 
      };
    }
    return { 
      display: `${Utils.formatNum(totalKebutuhan, 3)} ${satuan}`, 
      satuan, 
      nilai: totalKebutuhan 
    };
  },

    // ===== BUILD REKAP MATERIAL TOTAL (termasuk alat tambahan) =====
  buildMaterialRekap(calcResult) {
    const map = {}; // kode → data

    calcResult.sections.forEach(sec => {
      sec.items.forEach(item => {
        // Item mode langsung: tidak punya AHSP breakdown, hitung langsung
        if (item.mode === 'langsung') {
          const kat = item.kategori_langsung || 'alat';
          const kode = `LANGSUNG_${item.id || item.nama_tampil}`;
          const vol2 = Number(item.display_volume) || 0;
          const harga2 = Number(item.harga_satuan_langsung) || 0;
          if (!map[kode]) {
            map[kode] = {
              kode: item.kode_custom || 'OTH',
              nama: item.nama_tampil || '',
              satuan: item.display_satuan || 'buah',
              kategori: kat,
              totalKebutuhanRaw: 0,
              hsd: harga2,
              totalRp: 0,
              _isLangsung: true
            };
          }
          map[kode].totalKebutuhanRaw += vol2;
          map[kode].totalRp += Math.round(vol2 * harga2);
          return; // skip ke item berikutnya (forEach pakai return bukan continue)
        }

        if (!item.breakdown || !item.ahsp) return;
        const volume = item.display_volume || item.volume_calc || 0;
        const bd = item.breakdown;

        const processComps = (comps, kategori) => {
          if (!comps?.length) return;
          comps.forEach(c => {
            const kebutuhan = parseFloat((c.koefisien * volume).toFixed(4));
            const totalRp = Math.round(kebutuhan * c.hsd);

            if (!map[c.kode]) {
              map[c.kode] = {
                kode: c.kode,
                nama: c.nama,
                satuan: c.satuan,
                kategori,
                totalKebutuhanRaw: 0,
                hsd: c.hsd,
                totalRp: 0
              };
            }
            map[c.kode].totalKebutuhanRaw += kebutuhan;
            map[c.kode].totalRp += totalRp;
            if (c.hsd > 0) map[c.kode].hsd = c.hsd;
          });
        };

        processComps(bd.upah, 'upah');
        processComps(bd.bahan, 'bahan');
        processComps(bd.alat, 'alat');
      });
    });

    // Tambahan: Ambil semua alat dari Master Harga yang belum masuk (alat kecil)
    const allAlat = MasterHarga._globalAlat || [];
    allAlat.forEach(alat => {
      const kode = alat.kode;
      if (!map[kode]) {
        map[kode] = {
          kode: kode,
          nama: alat.nama,
          satuan: alat.satuan,
          kategori: 'alat',
          totalKebutuhanRaw: 0,
          hsd: alat.harga,
          totalRp: 0
        };
      }
    });

    const all = Object.values(map);
    // Fix e: filter item dengan totalRp = 0 dan totalKebutuhanRaw = 0
    const upah  = all.filter(i => i.kategori === 'upah'  && (i.totalRp > 0 || i.totalKebutuhanRaw > 0)).sort((a,b) => a.kode.localeCompare(b.kode));
    const bahan = all.filter(i => i.kategori === 'bahan' && (i.totalRp > 0 || i.totalKebutuhanRaw > 0)).sort((a,b) => a.kode.localeCompare(b.kode));
    const alat  = all.filter(i => i.kategori === 'alat'  && (i.totalRp > 0 || i.totalKebutuhanRaw > 0)).sort((a,b) => a.kode.localeCompare(b.kode));

    const totalUpah  = upah.reduce((s,i) => s + i.totalRp, 0);
    const totalBahan = bahan.reduce((s,i) => s + i.totalRp, 0);
    const totalAlat  = alat.reduce((s,i) => s + i.totalRp, 0);
    const grandTotal = totalUpah + totalBahan + totalAlat;

    // Format kebutuhan (semen jadi sak)
    upah.forEach(i => i.formatted = this.formatKebutuhan(i.kode, i.satuan, i.totalKebutuhanRaw));
    bahan.forEach(i => i.formatted = this.formatKebutuhan(i.kode, i.satuan, i.totalKebutuhanRaw));
    alat.forEach(i => i.formatted = this.formatKebutuhan(i.kode, i.satuan, i.totalKebutuhanRaw));

    // Tambah alias totalKebutuhan = totalKebutuhanRaw untuk kompatibilitas render
    upah.forEach(i => i.totalKebutuhan = i.totalKebutuhanRaw);
    bahan.forEach(i => i.totalKebutuhan = i.totalKebutuhanRaw);
    alat.forEach(i => i.totalKebutuhan = i.totalKebutuhanRaw);

    return { upah, bahan, alat, totalUpah, totalBahan, totalAlat, grandTotal };
  }
};

window.Kalkulasi = Kalkulasi;