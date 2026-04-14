/* ============================================================
   e-RAB Desa v1.2 — export-excel.js
   Excel Export: Sheet I Rekap, II AHSP, III HSP×Vol, IV STA, V Kebutuhan+Admin
   ============================================================ */

'use strict';

const ExportExcel = {

  async generate(projectId) {
    showToast('Menyiapkan file Excel...', 'info');

    if (!window.XLSX) await this._loadXLSX();

    const project = await Projects.load(projectId);
    if (!project) { showToast('Proyek tidak ditemukan', 'error'); return; }

    await AHSP.getAll();
    await MasterHarga.loadGlobal();
    await MasterHarga.loadProjectOverrides(projectId);

    const sections = await ExportPDF._getProjectSections(projectId);
    const calc = await Kalkulasi.calcFullRAB(projectId, sections);

    // Administrasi kegiatan
    const adm = project.administrasi_kegiatan || { mode: 'pct', pct: 3, items: [] };
    const subtotalFisik = calc.grandTotal;
    const admTotal = adm.mode === 'pct'
      ? Math.round(subtotalFisik * (Number(adm.pct) || 3) / 100)
      : (adm.items || []).reduce((s, i) => s + (Number(i.nilai) || 0), 0);
    const grandTotal = subtotalFisik + admTotal;

    const wb = XLSX.utils.book_new();
    const overhead = project.overhead_pct ?? 15;

    this._sheetCover(wb, project, grandTotal, admTotal, subtotalFisik);
    this._sheetRekap(wb, project, calc, adm, admTotal, grandTotal);
    this._sheetAHSP(wb, project, calc, overhead);
    this._sheetHSPVol(wb, project, calc);
    this._sheetSTA(wb, project, calc);
    this._sheetKebutuhan(wb, project, calc, adm, admTotal, grandTotal);

    const safeName = (project.nama || 'RAB').replace(/[\/\\:*?"<>|]/g, '-');
    const filename = `RAB-${safeName}-${project.tahun_anggaran || new Date().getFullYear()}.xlsx`;
    XLSX.writeFile(wb, filename);

    showToast('File Excel berhasil diunduh!', 'success');
    if (window.ActivityLog) ActivityLog.export('Excel', project.nama, projectId);
  },

  async _loadXLSX() {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
      s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  },

  _rp(n) { return Math.round(Number(n) || 0); },
  _num(n, d = 3) { return parseFloat(Number(n).toFixed(d)); },

  // Append sheet helper
  _addSheet(wb, rows, name) {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const safeName = name.slice(0, 31).replace(/[\\\/:*?[\]]/g, '-');
    XLSX.utils.book_append_sheet(wb, ws, safeName);
    return ws;
  },

  // ========== COVER ==========
  _sheetCover(wb, project, grandTotal, admTotal, subtotalFisik) {
    const rows = [
      ['RENCANA ANGGARAN BIAYA (RAB)'],
      ['e-RAB Desa v1.2 | Berdasarkan Permen PUPR No.8/2023'],
      [''],
      ['Nama Kegiatan', project.nama || ''],
      ['Lokasi', [project.lokasi_desa, project.lokasi_kecamatan, project.lokasi_kabupaten].filter(Boolean).join(', ')],
      ['Tahun Anggaran', project.tahun_anggaran || ''],
      ['Sumber Dana', Utils.sumberDanaLabel(project.sumber_dana)],
      ['Overhead & Profit', (project.overhead_pct ?? 15) + '%'],
      ['No. Dokumen', project.no_dokumen || ''],
      [''],
      ['Subtotal Pekerjaan Fisik (Rp)', this._rp(subtotalFisik)],
      ['Administrasi Kegiatan (Rp)', this._rp(admTotal)],
      ['GRAND TOTAL RAB (Rp)', this._rp(grandTotal)],
      ['Terbilang', Utils.terbilang(grandTotal)],
      [''],
      ['Dicetak', new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })]
    ];
    this._addSheet(wb, rows, 'Cover');
  },

  // ========== SHEET I: REKAPITULASI ==========
  _sheetRekap(wb, project, calc, adm, admTotal, grandTotal) {
    const rows = [
      ['I. REKAPITULASI RENCANA ANGGARAN BIAYA'],
      [project.nama || ''],
      [''],
      ['No', 'Uraian Pekerjaan', 'Jumlah (Rp)']
    ];

    calc.sections.forEach((sec, i) => {
      rows.push([i + 1, sec.nama, this._rp(sec.total)]);
    });

    rows.push(['', '', '']);
    rows.push(['', 'Subtotal Pekerjaan Fisik', this._rp(calc.grandTotal)]);

    if (admTotal > 0) {
      rows.push(['—', 'Administrasi Kegiatan', this._rp(admTotal)]);
    }

    rows.push(['', 'GRAND TOTAL RAB', this._rp(grandTotal)]);
    rows.push(['', 'Terbilang:', Utils.terbilang(grandTotal)]);

    this._addSheet(wb, rows, 'I. Rekapitulasi');
  },

  // ========== SHEET II: AHSP (Koefisien × HSD) ==========
  _sheetAHSP(wb, project, calc, overhead) {
    const rows = [
      ['II. ANALISA HARGA SATUAN PEKERJAAN (AHSP)'],
      [project.nama || ''],
      ['Overhead & Profit: ' + overhead + '%'],
      ['']
    ];

    calc.sections.forEach((sec, si) => {
      rows.push([`${si + 1}. ${sec.nama}`]);
      rows.push(['']);

      sec.items.forEach((item, ii) => {
        if (!item.breakdown || !item.ahsp) return;
        const bd = item.breakdown;
        const sat = item.display_satuan || item.ahsp?.satuan || '';

        rows.push([`${ii + 1}. ${item.ahsp.kode} — ${item.ahsp.nama}`]);
        rows.push(['Satuan Analisa:', sat, '', 'Overhead:', overhead + '%']);
        rows.push(['']);
        rows.push(['Kode', 'Komponen', 'Koefisien', 'Satuan', 'HSD (Rp)', 'Jumlah (Rp)']);

        // Fix e: filter komponen koefisien 0
        const filtComp = (comps) => (comps||[]).filter(c => c.koefisien > 0 && c.hsd > 0);
        // Upah
        if (filtComp(bd.upah).length) {
          rows.push(['A. Upah Tenaga Kerja', '', '', '', '', '']);
          filtComp(bd.upah).forEach(c => {
            rows.push([c.kode, c.nama, this._num(c.koefisien, 4), c.satuan, this._rp(c.hsd), this._rp(c.koefisien * c.hsd)]);
          });
          rows.push(['', 'Jumlah A (Upah)', '', '', '', this._rp(bd.totalUpah)]);
        }
        // Bahan
        if (filtComp(bd.bahan).length) {
          rows.push(['B. Bahan & Material', '', '', '', '', '']);
          filtComp(bd.bahan).forEach(c => {
            rows.push([c.kode, c.nama, this._num(c.koefisien, 4), c.satuan, this._rp(c.hsd), this._rp(c.koefisien * c.hsd)]);
          });
          rows.push(['', 'Jumlah B (Bahan)', '', '', '', this._rp(bd.totalBahan)]);
        }
        // Alat
        if (filtComp(bd.alat).length) {
          rows.push(['C. Alat & Peralatan', '', '', '', '', '']);
          filtComp(bd.alat).forEach(c => {
            rows.push([c.kode, c.nama, this._num(c.koefisien, 4), c.satuan, this._rp(c.hsd), this._rp(c.koefisien * c.hsd)]);
          });
          rows.push(['', 'Jumlah C (Alat)', '', '', '', this._rp(bd.totalAlat)]);
        }

        rows.push(['', 'D. Biaya Langsung (A+B+C)', '', '', '', this._rp(bd.biayaLangsung)]);
        if (overhead > 0) rows.push(['', `E. Overhead & Profit ${overhead}% × D`, '', '', '', this._rp(bd.overhead)]);
        rows.push(['', `F. HSP per ${sat} (D+E)`, '', '', '', this._rp(bd.hsp)]);
        rows.push(['']);
      });

      rows.push(['']);
    });

    this._addSheet(wb, rows, 'II. AHSP');
  },

  // ========== SHEET III: HSP × VOLUME ==========
  _sheetHSPVol(wb, project, calc) {
    const rows = [
      ['III. VOLUME × HSP PER PEKERJAAN'],
      [project.nama || ''],
      [''],
      ['No', 'Uraian Pekerjaan', 'Kode AHSP', 'Volume', 'Satuan', 'HSP/Sat (Rp)', 'Jumlah (Rp)']
    ];

    let grandRow = 0;
    calc.sections.forEach((sec, si) => {
      rows.push([`${si + 1}. ${sec.nama}`, '', '', '', '', '', '']);
      sec.items.forEach((item, ii) => {
        rows.push([
          `  ${ii + 1}`,
          item.nama_tampil || item.ahsp?.nama || '',
          item.ahsp?.kode || '',
          this._num(item.display_volume || 0, 3),
          item.display_satuan || item.ahsp?.satuan || '',
          this._rp(item.hsp),
          this._rp(item.jumlah)
        ]);
        // Baris STA detail
        const hasSTA = (item.sta_mode==='sta'||item.sta_mode==='subrows') && item.sta_rows?.length;
        if (hasSTA) {
          rows.push(['', '  Breakdown STA:', 'STA Dari', 'STA Ke', 'P(m)', 'L(m)', 'T(m)', 'Vol(m³)']);
          item.sta_rows.forEach(r => {
            const v = parseFloat(((r.panjang||0)*(r.lebar||0)*(r.tinggi||0)).toFixed(3));
            rows.push(['', '', r.sta_dari||'', r.sta_ke||'',
              this._num(r.panjang||0,2), this._num(r.lebar||0,2), this._num(r.tinggi||0,3), v]);
          });
          const totVol = item.sta_rows.reduce((s,r)=>s+parseFloat(((r.panjang||0)*(r.lebar||0)*(r.tinggi||0)).toFixed(3)),0);
          rows.push(['','','','','','','Total STA:', this._num(totVol,3)]);
        }
      });
      rows.push(['', `Subtotal ${sec.nama}`, '', '', '', '', this._rp(sec.total)]);
      rows.push(['']);
    });

    rows.push(['', 'GRAND TOTAL PEKERJAAN FISIK', '', '', '', '', this._rp(calc.grandTotal)]);
    this._addSheet(wb, rows, 'III. HSP x Volume');
  },

  // ========== SHEET IV: BREAKDOWN STA ==========
  _sheetSTA(wb, project, calc) {
    const staItems = [];
    calc.sections.forEach(sec => {
      sec.items.forEach(item => {
        if ((item.sta_mode === 'sta' || item.sta_mode === 'subrows') && item.sta_rows?.length) {
          staItems.push({ sec, item });
        }
      });
    });

    const rows = [
      ['IV. BREAKDOWN PER STA (STATION)'],
      [project.nama || ''],
      ['']
    ];

    if (!staItems.length) {
      rows.push(['Tidak ada item pekerjaan dengan input per STA pada proyek ini.']);
      this._addSheet(wb, rows, 'IV. STA');
      return;
    }

    rows.push(['Bagian', 'Uraian Pekerjaan', 'STA Dari', 'STA Ke', 'Panjang (m)', 'Lebar (m)', 'Tebal (m)', 'Volume (m³)']);

    staItems.forEach(({ sec, item }) => {
      item.sta_rows.forEach((r, ri) => {
        const vol = (Number(r.panjang) || 0) * (Number(r.lebar) || 0) * (Number(r.tinggi) || 0);
        rows.push([
          ri === 0 ? sec.nama : '',
          ri === 0 ? (item.nama_tampil || item.ahsp?.nama || '') : '',
          r.sta_dari || '',
          r.sta_ke || '',
          this._num(r.panjang || 0, 2),
          this._num(r.lebar || 0, 2),
          this._num(r.tinggi || 0, 3),
          this._num(vol, 4)
        ]);
      });
      rows.push([
        '', 'Total Volume ' + (item.nama_tampil || ''), '', '', '', '', '',
        this._num(item.display_volume || 0, 4)
      ]);
      rows.push(['']);
    });

    this._addSheet(wb, rows, 'IV. STA');
  },

  // ========== SHEET V: REKAP KEBUTUHAN + ADMIN ==========
  _sheetKebutuhan(wb, project, calc, adm, admTotal, grandTotal) {
    const mr = Kalkulasi.buildMaterialRekap(calc);

    const rows = [
      ['V. REKAPITULASI KEBUTUHAN BAHAN, UPAH, SEWA ALAT & ADMINISTRASI'],
      [project.nama || ''],
      ['Akumulasi seluruh kebutuhan dari semua item pekerjaan'],
      [''],
      ['Kode', 'Nama', 'Total Kebutuhan', 'Satuan', 'HSD (Rp)', 'Total (Rp)']
    ];

    const addCat = (items, label) => {
      // Fix e: filter nilai 0
      const vis = items.filter(i => i.totalRp > 0 || (i.totalKebutuhanRaw || 0) > 0);
      if (!vis.length) return;
      rows.push([label, '', '', '', '', '']);
      vis.forEach(i => {
        const fmt = Kalkulasi.formatKebutuhan(i.kode, i.satuan, i.totalKebutuhanRaw || i.totalKebutuhan || 0);
        // Fix g: HSD semen per sak
        const hsdVal = fmt.isSemen ? this._rp(i.hsd * 40) : this._rp(i.hsd);
        rows.push([
          i.kode,
          i.nama + (fmt.isSemen ? ' (per sak 40 kg)' : ''),
          fmt.nilai,
          fmt.satuan,
          hsdVal,
          this._rp(i.totalRp)
        ]);
      });
      rows.push(['']);
    };

    addCat(mr.upah,  'A. Upah Tenaga Kerja');
    rows.push(['', 'Sub-Total A (Upah)', '', '', '', this._rp(mr.totalUpah)]);
    rows.push(['']);

    addCat(mr.bahan, 'B. Bahan & Material');
    rows.push(['', 'Sub-Total B (Bahan)', '', '', '', this._rp(mr.totalBahan)]);
    rows.push(['']);

    addCat(mr.alat,  'C. Sewa Alat & Peralatan');
    rows.push(['', 'Sub-Total C (Alat)', '', '', '', this._rp(mr.totalAlat)]);
    rows.push(['']);

    rows.push(['', 'Sub-Total Fisik (A+B+C)', '', '', '', this._rp(mr.grandTotal)]);
    rows.push(['']);

    // Administrasi Kegiatan
    if (admTotal > 0) {
      rows.push(['D. Administrasi Kegiatan', '', '', '', '', '']);
      if (adm.mode === 'pct') {
        rows.push(['ADM', `${adm.pct || 3}% dari Subtotal Fisik`, 1, 'ls', this._rp(admTotal), this._rp(admTotal)]);
      } else {
        (adm.items || []).forEach(it => {
          rows.push(['ADM', it.nama, 1, it.satuan || 'ls', this._rp(it.nilai), this._rp(it.nilai)]);
        });
      }
      rows.push(['', 'Sub-Total D (Administrasi)', '', '', '', this._rp(admTotal)]);
      rows.push(['']);
    }

    rows.push(['', 'GRAND TOTAL RAB (A+B+C+D)', '', '', '', this._rp(grandTotal)]);
    rows.push(['', 'Terbilang:', Utils.terbilang(grandTotal), '', '', '']);

    this._addSheet(wb, rows, 'V. Kebutuhan+Admin');
  }
};

window.ExportExcel = ExportExcel;
