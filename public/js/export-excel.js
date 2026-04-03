/* ============================================================
   e-RAB Desa v1.0 — export-excel.js
   Excel export using SheetJS (xlsx)
   Sheets: Cover, Rekapitulasi, RAB per Bagian, AHSP Detail, HSD
   ============================================================ */

'use strict';

const ExportExcel = {

  async generate(projectId) {
    showToast('Menyiapkan file Excel...', 'info');

    // Load SheetJS dynamically
    if (!window.XLSX) {
      await this._loadXLSX();
    }

    const project = await Projects.load(projectId);
    if (!project) { showToast('Proyek tidak ditemukan', 'error'); return; }

    await AHSP.getAll();
    await MasterHarga.loadGlobal();
    await MasterHarga.loadProjectOverrides(projectId);

    const sections = await ExportPDF._getProjectSections(projectId);
    const calc = await Kalkulasi.calcFullRAB(projectId, sections);

    const wb = XLSX.utils.book_new();

    // Sheet 1: Cover / Info Proyek
    this._addCoverSheet(wb, project, calc);

    // Sheet 2: Rekapitulasi
    this._addRekapSheet(wb, project, calc);

    // Sheet 3+: RAB per Bagian
    calc.sections.forEach((sec, i) => {
      this._addSectionSheet(wb, project, sec, i + 1, calc);
    });

    // Sheet N-1: AHSP Detail
    this._addAHSPSheet(wb, calc);

    // Sheet N: HSD
    this._addHSDSheet(wb, projectId);

    // Save file
    const filename = `RAB-${(project.nama || 'Dokumen').replace(/[\/\\:*?"<>|]/g, '-')}-${project.tahun_anggaran || new Date().getFullYear()}.xlsx`;
    XLSX.writeFile(wb, filename);
    showToast('File Excel berhasil diunduh!', 'success');
    ActivityLog.export('excel', project.nama, projectId);
  },

  async _loadXLSX() {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  },

  // ===== HELPERS =====
  _rp(n) { return Math.round(Number(n) || 0); },

  _cell(v, t = 's', numFmt = '') {
    const c = { v, t };
    if (numFmt) c.z = numFmt;
    return c;
  },

  _numCell(v) {
    return { v: this._rp(v), t: 'n', z: '#,##0' };
  },

  _headerRow(headers) {
    return headers.map(h => ({ v: h, t: 's' }));
  },

  _applyStyles(ws, range) {
    // SheetJS CE doesn't support cell styling - we use column widths instead
    // Styling requires SheetJS Pro; we maximize readability via structure
  },

  _setColWidths(ws, widths) {
    ws['!cols'] = widths.map(w => ({ wch: w }));
  },

  // ===== SHEET 1: COVER =====
  _addCoverSheet(wb, project, calc) {
    const now = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    const data = [
      ['RENCANA ANGGARAN BIAYA (RAB)'],
      [''],
      ['Nama Kegiatan', project.nama || ''],
      ['Lokasi', [project.lokasi_desa, project.lokasi_kecamatan, project.lokasi_kabupaten, project.lokasi_provinsi].filter(Boolean).join(', ')],
      ['Tahun Anggaran', project.tahun_anggaran || ''],
      ['Sumber Dana', Utils.sumberDanaLabel(project.sumber_dana)],
      ['No. Dokumen', project.no_dokumen || '-'],
      ['Overhead', `${project.overhead_pct || 15}%`],
      ['Status', project.status || 'draft'],
      [''],
      ['TOTAL NILAI RAB', this._rp(calc.grandTotal)],
      ['Terbilang', Utils.terbilang(calc.grandTotal)],
      [''],
      ['Dibuat dengan', 'e-RAB Desa v1.0'],
      ['Berdasarkan', 'Permen PUPR No.8 Tahun 2023'],
      ['Tanggal Cetak', now],
    ];

    const wsData = data.map(row => row.map((cell, ci) => {
      if (ci === 1 && row[0] === 'TOTAL NILAI RAB') return this._numCell(cell);
      return { v: String(cell ?? ''), t: 's' };
    }));

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    this._setColWidths(ws, [30, 60]);
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];
    XLSX.utils.book_append_sheet(wb, ws, 'Informasi Proyek');
  },

  // ===== SHEET 2: REKAPITULASI =====
  _addRekapSheet(wb, project, calc) {
    const rows = [
      ['REKAPITULASI RENCANA ANGGARAN BIAYA'],
      [project.nama || ''],
      [''],
      ['No', 'Uraian Pekerjaan', 'Jumlah Biaya (Rp)'],
    ];

    calc.sections.forEach((sec, i) => {
      rows.push([i + 1, sec.nama, this._rp(sec.total)]);
    });

    rows.push(['', 'JUMLAH TOTAL', this._rp(calc.grandTotal)]);
    rows.push(['', 'Terbilang:', Utils.terbilang(calc.grandTotal)]);

    const wsData = rows.map((row, ri) => row.map((cell, ci) => {
      if (ri >= 4 && ci === 2 && typeof cell === 'number') return this._numCell(cell);
      return { v: String(cell ?? ''), t: 's' };
    }));

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    this._setColWidths(ws, [8, 55, 22]);
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } },
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Rekapitulasi');
  },

  // ===== SHEET PER BAGIAN =====
  _addSectionSheet(wb, project, sec, num, calc) {
    const rows = [
      [`${num}. ${sec.nama}`],
      [project.nama || ''],
      [''],
      ['No', 'Uraian Pekerjaan', 'Kode AHSP', 'Mutu', 'STA / Keterangan', 'Satuan', 'Volume', 'Harga Satuan (Rp)', 'Jumlah (Rp)'],
    ];

    sec.items.forEach((item, ii) => {
      const ahsp = item.ahsp;
      const mutu = ahsp?.mutu_fc ? `f'c ${ahsp.mutu_fc} MPa / K-${ahsp.mutu_k || Utils.fcToK(ahsp.mutu_fc)}` : '';
      const staInfo = item.sta_mode === 'subrows' && item.sta_rows?.length
        ? item.sta_rows.map(r => `${r.sta_awal||''}-${r.sta_akhir||''}: P=${r.panjang}m L=${r.lebar}m T=${r.tinggi}m`).join(' | ')
        : item.keterangan || '';

      rows.push([
        ii + 1,
        item.nama_tampil || ahsp?.nama || '–',
        ahsp?.kode || item.ahsp_id || '',
        mutu,
        staInfo,
        item.display_satuan || ahsp?.satuan || '',
        item.display_volume || 0,
        this._rp(item.hsp),
        this._rp(item.jumlah)
      ]);

      // Add STA detail rows if subrows mode
      if (item.sta_mode === 'subrows' && item.sta_rows?.length > 1) {
        item.sta_rows.forEach((row, ri) => {
          const p = Number(row.panjang)||0, l = Number(row.lebar)||0, t = Number(row.tinggi)||0;
          rows.push([
            `  ${ii+1}.${ri+1}`,
            `  STA ${row.sta_awal||''} – ${row.sta_akhir||''}`,
            '', '', `P=${p} × L=${l} × T=${t}`, ahsp?.satuan || '',
            parseFloat((p*l*t).toFixed(4)), '', ''
          ]);
        });
      }
    });

    rows.push(['', `Jumlah ${sec.nama}`, '', '', '', '', '', '', this._rp(sec.total)]);

    const wsData = rows.map((row, ri) => row.map((cell, ci) => {
      if (ri >= 4 && (ci === 6 || ci === 7 || ci === 8) && typeof cell === 'number') {
        return { v: cell, t: 'n', z: ci === 6 ? '#,##0.000' : '#,##0' };
      }
      return { v: String(cell ?? ''), t: 's' };
    }));

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    this._setColWidths(ws, [6, 40, 14, 18, 35, 8, 12, 16, 18]);
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 8 } },
    ];

    const sheetName = `${num}. ${sec.nama}`.slice(0, 31).replace(/[\\\/\?\*\[\]:]/g, '-');
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  },

  // ===== SHEET AHSP DETAIL =====
  _addAHSPSheet(wb, calc) {
    const rows = [
      ['ANALISA HARGA SATUAN PEKERJAAN (AHSP)'],
      ['Berdasarkan Permen PUPR No.8 Tahun 2023 + Lampiran IV AHSP Bidang Cipta Karya dan Perumahan'],
      [''],
    ];

    const usedAHSP = new Map();
    calc.sections.forEach(sec => {
      sec.items.forEach(item => {
        if (item.ahsp && item.breakdown && !usedAHSP.has(item.ahsp_id)) {
          usedAHSP.set(item.ahsp_id, { ahsp: item.ahsp, breakdown: item.breakdown });
        }
      });
    });

    usedAHSP.forEach(({ ahsp, breakdown: bd }) => {
      const mutu = ahsp.mutu_fc ? ` / K-${ahsp.mutu_k || Utils.fcToK(ahsp.mutu_fc)}` : '';
      rows.push([`${ahsp.kode || ''} — ${ahsp.nama}${mutu} (per ${ahsp.satuan})`]);
      rows.push(['Kel', 'Kode', 'Uraian Komponen', 'Satuan', 'Koefisien', 'HSD (Rp)', 'Jumlah (Rp)']);

      const pushComps = (comps, label) => {
        if (!comps?.length) return;
        rows.push([label, '', '', '', '', '', '']);
        comps.forEach(c => {
          rows.push(['', c.kode, c.nama, c.satuan, c.koefisien, this._rp(c.hsd), this._rp(c.jumlah)]);
        });
      };

      pushComps(bd.upah, 'A. Upah');
      rows.push(['', '', 'Jumlah A (Upah)', '', '', '', this._rp(bd.totalUpah)]);
      pushComps(bd.bahan, 'B. Bahan');
      rows.push(['', '', 'Jumlah B (Bahan)', '', '', '', this._rp(bd.totalBahan)]);
      pushComps(bd.alat, 'C. Alat');
      rows.push(['', '', 'Jumlah C (Alat)', '', '', '', this._rp(bd.totalAlat)]);
      rows.push(['', '', 'D. Biaya Langsung (A+B+C)', '', '', '', this._rp(bd.biayaLangsung)]);
      rows.push(['', '', `E. Overhead ${bd.overheadPct}% × D`, '', '', '', this._rp(bd.overhead)]);
      rows.push(['', '', 'F. HARGA SATUAN PEKERJAAN (D+E)', '', '', '', this._rp(bd.hsp)]);
      rows.push(['']);
    });

    const wsData = rows.map((row, ri) => row.map((cell, ci) => {
      if (ci >= 4 && ci <= 6 && typeof cell === 'number') {
        return { v: cell, t: 'n', z: ci === 4 ? '#,##0.0000' : '#,##0' };
      }
      return { v: String(cell ?? ''), t: 's' };
    }));

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    this._setColWidths(ws, [12, 14, 42, 10, 12, 16, 16]);
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 6 } },
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Analisa AHSP');
  },

  // ===== SHEET HSD =====
  _addHSDSheet(wb, projectId) {
    const gh = MasterHarga._globalHarga;
    if (!gh) return;
    const overrides = MasterHarga._projectOverrides[projectId] || {};

    const rows = [
      ['DAFTAR HARGA SATUAN DASAR (HSD)'],
      [''],
      ['Kode', 'Uraian', 'Satuan', 'Harga (Rp)', 'Override', 'Catatan'],
    ];

    ['upah', 'bahan', 'alat'].forEach(cat => {
      const label = { upah: 'A. UPAH TENAGA KERJA', bahan: 'B. BAHAN & MATERIAL', alat: 'C. SEWA ALAT' };
      rows.push([label[cat], '', '', '', '', '']);
      const items = Object.values(gh[cat] || {}).sort((a, b) => a.kode.localeCompare(b.kode));
      items.forEach(item => {
        const ov = overrides[item.kode];
        const h = MasterHarga.getHarga(item.kode, projectId);
        rows.push([
          item.kode, item.nama, item.satuan,
          this._rp(h),
          ov ? (ov.mode === 'allin' ? `All-in: ${Utils.formatRp(ov.harga_allin)}` : `Base ${Utils.formatRp(ov.harga_base)} + Angkut ${Utils.formatRp(ov.harga_transport)}`) : '-',
          item.catatan || ''
        ]);
      });
    });

    const wsData = rows.map((row, ri) => row.map((cell, ci) => {
      if (ri >= 3 && ci === 3 && typeof cell === 'number') return this._numCell(cell);
      return { v: String(cell ?? ''), t: 's' };
    }));

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    this._setColWidths(ws, [16, 45, 10, 18, 35, 30]);
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }];
    XLSX.utils.book_append_sheet(wb, ws, 'HSD');
  }
};

window.ExportExcel = ExportExcel;
