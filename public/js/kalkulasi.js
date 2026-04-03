/* ============================================================
   e-RAB Desa v1.0 — kalkulasi.js
   Core RAB calculation engine
   All monetary values stored as integers (Rupiah, no decimal)
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
      case 'area': return parseFloat((p * l).toFixed(4));       // m²
      case 'panjang': return p;                                   // m'
      case 'berat': return parseFloat((p * l * t * 2.25).toFixed(4)); // ton (aspal)
      case 'buah': return Math.round(p);
      default: return parseFloat((p * l * t).toFixed(4));
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
        case 'area': vol = p * l; break;
        case 'panjang': vol = p; break;
        case 'berat': vol = p * l * t * 2.25; break;
        default: vol = p * l * t;
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

  // ===== CALCULATE SECTION TOTAL =====
  calcSectionTotal(items) {
    return items.reduce((sum, item) => sum + Math.round(item.jumlah || 0), 0);
  },

  // ===== CALCULATE FULL RAB =====
  async calcFullRAB(projectId, sections) {
    if (!sections?.length) return { sections: [], grandTotal: 0 };

    const project = await Projects.load(projectId);
    const overheadPct = project?.overhead_pct || 15;
    await MasterHarga.loadGlobal();
    await MasterHarga.loadProjectOverrides(projectId);

    const result = [];
    let grandTotal = 0;

    for (const section of sections) {
      const calcedItems = [];
      let sectionTotal = 0;

      for (const item of (section.items || [])) {
        const ahspItem = await AHSP.getById(item.ahsp_id);
        if (!ahspItem) {
          calcedItems.push({ ...item, hsp: 0, jumlah: 0, breakdown: null });
          continue;
        }

        const breakdown = this.calcItemHSP(ahspItem, projectId, overheadPct);
        const hsp = breakdown?.hsp || 0;

        // Volume: from STA subrows or direct
        let volume = 0;
        if (item.sta_mode === 'subrows' && item.sta_rows?.length) {
          volume = this.calcSTAVolume(item.sta_rows, item.jenis_satuan);
        } else {
          volume = this.calcVolume(item);
        }

        // For aspal items: convert volume to ton
        let displayVolume = volume;
        let displaySatuan = ahspItem.satuan;
        if (ahspItem.satuan === 'ton' && item.jenis_satuan !== 'ton') {
          // volume is already in m³, need to convert
          displayVolume = Utils.m3ToTon(volume, 2.25);
        }

        const jumlah = this.calcLineTotal(displayVolume, hsp);
        sectionTotal += jumlah;

        calcedItems.push({
          ...item,
          ahsp: ahspItem,
          volume_calc: parseFloat(volume.toFixed(4)),
          display_volume: parseFloat(displayVolume.toFixed(4)),
          display_satuan: displaySatuan,
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

  // ===== FORMAT VOLUME DISPLAY =====
  // Returns human-readable volume with unit
  formatVolume(item, ahspItem) {
    const v = item.display_volume || item.volume_calc || 0;
    const satuan = ahspItem?.satuan || item.satuan_display || '';

    if (satuan === 'ton') {
      const m3 = item.volume_calc || 0;
      return `${Utils.formatNum(v, 3)} ton (= ${Utils.formatNum(m3, 3)} m³)`;
    }
    return `${Utils.formatNum(v, 3)} ${satuan}`;
  },

  // ===== BUILD REKAPITULASI =====
  buildRekap(sections) {
    const rows = sections.map((sec, i) => ({
      no: i + 1,
      nama: sec.nama,
      items: sec.items?.length || 0,
      total: sec.total || 0
    }));
    const subtotal = rows.reduce((s, r) => s + r.total, 0);
    return { rows, subtotal };
  }
};

window.Kalkulasi = Kalkulasi;
