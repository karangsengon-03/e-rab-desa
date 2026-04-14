/* ============================================================
   e-RAB Desa v1.2 — export-pdf.js
   PDF Export: Bab I Rekap, II AHSP, III HSP×Vol, IV STA, V Kebutuhan+Admin
   ============================================================ */

'use strict';

const ExportPDF = {

  async generate(projectId) {
    showToast('Menyiapkan dokumen PDF...', 'info');

    const project = await Projects.load(projectId);
    if (!project) { showToast('Proyek tidak ditemukan', 'error'); return; }

    await AHSP.getAll();
    await MasterHarga.loadGlobal();
    await MasterHarga.loadProjectOverrides(projectId);

    const sections = await this._getProjectSections(projectId);
    const calc = await Kalkulasi.calcFullRAB(projectId, sections);

    // Load administrasi kegiatan
    const adm = project.administrasi_kegiatan || {
      mode: 'pct', pct: 3, items: []
    };
    const subtotalFisik = calc.grandTotal;
    const admTotal = adm.mode === 'pct'
      ? Math.round(subtotalFisik * (Number(adm.pct) || 3) / 100)
      : (adm.items || []).reduce((s, i) => s + (Number(i.nilai) || 0), 0);
    const grandTotal = subtotalFisik + admTotal;

    const html = this._buildPDFHTML(project, calc, adm, admTotal, grandTotal);
    this._printHTML(html);
    showToast('Dokumen PDF siap. Gunakan Ctrl+P → Simpan sebagai PDF.', 'success', 6000);

    if (window.ActivityLog) ActivityLog.export('PDF', project.nama, projectId);
  },

  async _getProjectSections(projectId) {
    if (RABInput._projectId === projectId && RABInput._sections?.length) {
      return RABInput._sections;
    }
    const { db, collection, query, orderBy, getDocs } = window._firebase;
    const q = query(collection(db, 'projects', projectId, 'sections'), orderBy('urutan', 'asc'));
    const snap = await getDocs(q);
    const sections = [];
    for (const d of snap.docs) {
      const sec = { id: d.id, ...d.data() };
      const itemSnap = await getDocs(query(
        collection(db, 'projects', projectId, 'sections', d.id, 'items'),
        orderBy('urutan', 'asc')
      ));
      sec.items = itemSnap.docs.map(id => ({ id: id.id, ...id.data() }));
      sections.push(sec);
    }
    return sections;
  },

  _rp(n) { return 'Rp ' + Math.round(Number(n) || 0).toLocaleString('id-ID'); },
  _num(n, d = 3) { return Number(n).toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d }); },

  _buildPDFHTML(project, calc, adm, admTotal, grandTotal) {
    const now = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    const overhead = project.overhead_pct ?? 15;
    const subtotalFisik = calc.grandTotal;

    // ========== BAB I: REKAPITULASI ==========
    const babI = `
      <div class="bab">
        <div class="bab-title">I. REKAPITULASI RENCANA ANGGARAN BIAYA</div>
        <table>
          <thead><tr><th style="width:40px">No</th><th>Uraian Pekerjaan</th><th style="width:180px">Jumlah (Rp)</th></tr></thead>
          <tbody>
            ${calc.sections.map((sec, i) => `
              <tr><td>${i + 1}</td><td>${sec.nama}</td><td class="num">${this._rp(sec.total)}</td></tr>
            `).join('')}
            <tr class="subtotal-row">
              <td colspan="2">Subtotal Pekerjaan Fisik</td>
              <td class="num">${this._rp(subtotalFisik)}</td>
            </tr>
            ${admTotal > 0 ? `
            <tr>
              <td>—</td>
              <td>Administrasi Kegiatan</td>
              <td class="num">${this._rp(admTotal)}</td>
            </tr>` : ''}
            <tr class="total-row">
              <td colspan="2">GRAND TOTAL RAB</td>
              <td class="num">${this._rp(grandTotal)}</td>
            </tr>
          </tbody>
        </table>
        <p class="terbilang">Terbilang: ${Utils.terbilang(grandTotal)}</p>
      </div>`;

    // ========== BAB II: AHSP + BAB III: HSP×Volume per section ==========
    const babII_III = calc.sections.map((sec, si) => {
      // AHSP breakdown per item
      const ahspPerItem = sec.items.map((item, ii) => {
        if (!item.breakdown || !item.ahsp) return '';
        const bd = item.breakdown;
        const vol = item.display_volume || 0;
        const sat = item.display_satuan || item.ahsp?.satuan || '';

        const compRows = (comps, label) => {
          if (!comps?.length) return '';
          // Fix e: filter koefisien 0
          const vis = comps.filter(c => c.koefisien > 0 && c.hsd > 0);
          if (!vis.length) return '';
          return `
            <tr class="comp-header"><td colspan="5">${label}</td></tr>
            ${vis.map(c => {
              const kebutuhan = parseFloat((c.koefisien * vol).toFixed(4));
              const fmt = Kalkulasi.formatKebutuhan(c.kode, c.satuan, kebutuhan);
              return `<tr>
                <td style="font-family:monospace;font-size:8pt;color:#555">${c.kode}</td>
                <td>${c.nama}</td>
                <td class="num">${this._num(c.koefisien, 4)}</td>
                <td>${c.satuan}</td>
                <td class="num">${this._rp(c.hsd)}</td>
              </tr>`;
            }).join('')}`;
        };

        return `
          <div class="ahsp-block">
            <div class="ahsp-block-title">
              ${ii + 1}. ${item.ahsp.kode} — ${item.ahsp.nama}
              &nbsp;|&nbsp; Satuan: ${sat}
              &nbsp;|&nbsp; Overhead: ${overhead}%
            </div>
            <table style="font-size:8pt">
              <thead><tr>
                <th style="width:70px">Kode</th>
                <th>Komponen</th>
                <th style="width:80px">Koefisien</th>
                <th style="width:50px">Sat</th>
                <th style="width:110px">HSD (Rp)</th>
              </tr></thead>
              <tbody>
                ${compRows(bd.upah, 'A. Upah Tenaga Kerja')}
                <tr class="subtotal-row"><td colspan="4">Jumlah A (Upah)</td><td class="num">${this._rp(bd.totalUpah)}</td></tr>
                ${compRows(bd.bahan, 'B. Bahan & Material')}
                <tr class="subtotal-row"><td colspan="4">Jumlah B (Bahan)</td><td class="num">${this._rp(bd.totalBahan)}</td></tr>
                ${compRows(bd.alat, 'C. Alat & Peralatan')}
                <tr class="subtotal-row"><td colspan="4">Jumlah C (Alat)</td><td class="num">${this._rp(bd.totalAlat)}</td></tr>
                <tr class="subtotal-row"><td colspan="4">D. Biaya Langsung (A+B+C)</td><td class="num">${this._rp(bd.biayaLangsung)}</td></tr>
                ${overhead > 0 ? `<tr><td colspan="4">E. Overhead & Profit ${overhead}% × D</td><td class="num">${this._rp(bd.overhead)}</td></tr>` : ''}
                <tr class="total-row"><td colspan="4">${overhead > 0 ? 'F.' : 'E.'} HSP per ${sat} ${overhead > 0 ? '(D+E)' : '(=D)'}</td><td class="num">${this._rp(bd.hsp)}</td></tr>
              </tbody>
            </table>
          </div>`;
      }).join('');

      // HSP × Volume per item (Bab III)
      const volRows = sec.items.map((item, ii) => {
        const hasSTA = (item.sta_mode==='sta'||item.sta_mode==='subrows') && item.sta_rows?.length;
        const staDetail = hasSTA
          ? `<table style="width:100%;border-collapse:collapse;font-size:7.5pt;margin-top:3pt">
              <thead><tr style="background:#e8f5e9">
                <th style="padding:2pt 4pt;text-align:left">STA Dari</th>
                <th style="padding:2pt 4pt;text-align:left">STA Ke</th>
                <th style="padding:2pt 4pt;text-align:right">P (m)</th>
                <th style="padding:2pt 4pt;text-align:right">L (m)</th>
                <th style="padding:2pt 4pt;text-align:right">T (m)</th>
                <th style="padding:2pt 4pt;text-align:right">Vol (m³)</th>
              </tr></thead>
              <tbody>
                ${item.sta_rows.map(r => {
                  const v = parseFloat(((r.panjang||0)*(r.lebar||0)*(r.tinggi||0)).toFixed(3));
                  return '<tr style="border-bottom:0.5pt solid #ddd">'
                    + '<td style="padding:2pt 4pt">' + (r.sta_dari||'') + '</td>'
                    + '<td style="padding:2pt 4pt">' + (r.sta_ke||'') + '</td>'
                    + '<td style="padding:2pt 4pt;text-align:right">' + this._num(r.panjang||0,2) + '</td>'
                    + '<td style="padding:2pt 4pt;text-align:right">' + this._num(r.lebar||0,2) + '</td>'
                    + '<td style="padding:2pt 4pt;text-align:right">' + this._num(r.tinggi||0,3) + '</td>'
                    + '<td style="padding:2pt 4pt;text-align:right;font-weight:700">' + this._num(v,3) + '</td>'
                    + '</tr>';
                }).join('')}
                <tr style="background:#e8f5e9;font-weight:700">
                  <td colspan="5" style="padding:2pt 4pt;text-align:right">Total</td>
                  <td style="padding:2pt 4pt;text-align:right">
                    ${this._num(item.sta_rows.reduce((s,r)=>s+parseFloat(((r.panjang||0)*(r.lebar||0)*(r.tinggi||0)).toFixed(3)),0),3)}
                  </td>
                </tr>
              </tbody>
            </table>`
          : '';
        return `
          <tr>
            <td>${ii + 1}</td>
            <td>${item.nama_tampil || item.ahsp?.nama || ''}
              ${item.ahsp?.kode ? `<div style="font-size:7.5pt;color:#777">[${item.ahsp.kode}]</div>` : ''}
              ${staDetail}
            </td>
            <td class="num">${this._num(item.display_volume || 0, 3)}</td>
            <td>${item.display_satuan || item.ahsp?.satuan || ''}</td>
            <td class="num">${this._rp(item.hsp)}</td>
            <td class="num">${this._rp(item.jumlah)}</td>
          </tr>`;
      }).join('');

      return `
        <div class="bab">
          <div class="bab-title">II.${si + 1}. AHSP — ${sec.nama}</div>
          ${ahspPerItem || '<p style="color:#777;font-size:9pt">Tidak ada AHSP terlampir</p>'}

          <div class="bab-title" style="margin-top:14pt">III.${si + 1}. HSP × VOLUME — ${sec.nama}</div>
          <table>
            <thead><tr>
              <th style="width:30px">No</th>
              <th>Uraian Pekerjaan</th>
              <th style="width:70px">Volume</th>
              <th style="width:50px">Sat</th>
              <th style="width:110px">HSP/Sat (Rp)</th>
              <th style="width:120px">Jumlah (Rp)</th>
            </tr></thead>
            <tbody>
              ${volRows}
              <tr class="total-row">
                <td colspan="5">Jumlah ${sec.nama}</td>
                <td class="num">${this._rp(sec.total)}</td>
              </tr>
            </tbody>
          </table>
        </div>`;
    }).join('');

    // ========== BAB V: REKAP KEBUTUHAN + ADMIN ==========
    const matRekap = Kalkulasi.buildMaterialRekap(calc);

    const renderMatCat = (items, label) => {
      // Fix e: filter nilai 0
      const vis = items.filter(i => i.totalRp > 0 || (i.totalKebutuhanRaw || 0) > 0);
      if (!vis.length) return '';
      return `
        <tr class="comp-header"><td colspan="6">${label}</td></tr>
        ${vis.map(i => {
          const fmt = Kalkulasi.formatKebutuhan(i.kode, i.satuan, i.totalKebutuhanRaw || i.totalKebutuhan || 0);
          // Fix g: HSD semen per sak
          const hsdVal = fmt.isSemen ? this._rp(i.hsd * 40) : this._rp(i.hsd);
          const namaStr = i.nama + (fmt.isSemen ? ' (per sak 40 kg)' : '');
          return `<tr>
            <td style="font-family:monospace;font-size:8pt;color:#555">${i.kode}</td>
            <td>${namaStr}</td>
            <td class="num">${fmt.display}</td>
            <td>${fmt.satuan}</td>
            <td class="num">${hsdVal}</td>
            <td class="num">${this._rp(i.totalRp)}</td>
          </tr>`;
        }).join('')}`;
    };

    const admItemRows = (adm.items || []).map(it => `
      <tr>
        <td style="font-family:monospace;font-size:8pt;color:#555">ADM</td>
        <td>${it.nama}</td>
        <td class="num">1</td>
        <td>${it.satuan || 'ls'}</td>
        <td class="num">${this._rp(it.nilai)}</td>
        <td class="num">${this._rp(it.nilai)}</td>
      </tr>`).join('');

    const babV = `
      <div class="bab">
        <div class="bab-title">V. REKAPITULASI KEBUTUHAN BAHAN, UPAH, SEWA ALAT & ADMINISTRASI</div>
        <table style="font-size:8.5pt">
          <thead><tr>
            <th style="width:70px">Kode</th>
            <th>Nama</th>
            <th style="width:100px">Kebutuhan</th>
            <th style="width:50px">Sat</th>
            <th style="width:110px">HSD (Rp)</th>
            <th style="width:120px">Total (Rp)</th>
          </tr></thead>
          <tbody>
            ${renderMatCat(matRekap.upah, 'A. Upah Tenaga Kerja')}
            <tr class="subtotal-row"><td colspan="5">Sub-Total A (Upah)</td><td class="num">${this._rp(matRekap.totalUpah)}</td></tr>
            ${renderMatCat(matRekap.bahan, 'B. Bahan & Material')}
            <tr class="subtotal-row"><td colspan="5">Sub-Total B (Bahan)</td><td class="num">${this._rp(matRekap.totalBahan)}</td></tr>
            ${renderMatCat(matRekap.alat, 'C. Sewa Alat & Peralatan')}
            <tr class="subtotal-row"><td colspan="5">Sub-Total C (Alat)</td><td class="num">${this._rp(matRekap.totalAlat)}</td></tr>
            ${admTotal > 0 ? `
            <tr class="comp-header"><td colspan="6">D. Administrasi Kegiatan</td></tr>
            ${admItemRows || `<tr><td colspan="5">${adm.mode === 'pct' ? (adm.pct||3) + '% dari subtotal fisik' : 'Administrasi'}</td><td class="num">${this._rp(admTotal)}</td></tr>`}
            <tr class="subtotal-row"><td colspan="5">Sub-Total D (Administrasi)</td><td class="num">${this._rp(admTotal)}</td></tr>
            ` : ''}
            <tr class="total-row"><td colspan="5">GRAND TOTAL RAB (A+B+C+D)</td><td class="num">${this._rp(grandTotal)}</td></tr>
          </tbody>
        </table>
        <p class="terbilang">Terbilang: ${Utils.terbilang(grandTotal)}</p>
      </div>`;

    return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<title>RAB — ${project.nama || 'Dokumen'}</title>
<style>
  @page { margin: 15mm 15mm 15mm 20mm; size: A4; }
  body { font-family: Arial, sans-serif; font-size: 9.5pt; color: #000; }
  h1 { font-size: 13pt; margin: 0; }
  h2 { font-size: 11pt; margin: 4pt 0 0; }
  .header { text-align: center; border-bottom: 2px solid #1B5E20; padding-bottom: 10pt; margin-bottom: 16pt; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4pt; font-size: 9pt; margin-bottom: 8pt; }
  .bab { margin-bottom: 20pt; page-break-inside: avoid; }
  .bab-title { font-size: 10pt; font-weight: bold; color: #1B5E20; border-left: 3pt solid #1B5E20; padding-left: 6pt; margin-bottom: 6pt; margin-top: 10pt; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 8pt; }
  th { background: #1B5E20; color: #fff; padding: 5pt 6pt; font-size: 8.5pt; text-align: left; border: 0.5pt solid #1B5E20; }
  td { padding: 4pt 6pt; border: 0.5pt solid #ccc; font-size: 8.5pt; vertical-align: top; }
  .num { text-align: right; font-family: 'Courier New', monospace; }
  .total-row td { background: #1B5E20; color: #fff; font-weight: bold; }
  .subtotal-row td { background: #e8f5e9; font-weight: bold; }
  .comp-header td { background: #E3F2FD; font-weight: bold; font-size: 8pt; color: #1565C0; }
  .terbilang { font-style: italic; font-size: 9pt; margin: 4pt 0 0; }
  .ahsp-block { border: 0.5pt solid #ddd; border-radius: 2pt; padding: 6pt; margin-bottom: 8pt; page-break-inside: avoid; }
  .ahsp-block-title { font-weight: bold; font-size: 9pt; color: #1B5E20; margin-bottom: 4pt; }
  @media print { .bab { page-break-before: auto; } }
</style>
</head>
<body>
  <div class="header">
    <h1>RENCANA ANGGARAN BIAYA (RAB)</h1>
    <h2>${project.nama || ''}</h2>
    <div class="info-grid" style="margin-top:8pt;text-align:left">
      <div>Lokasi: ${[project.lokasi_desa, project.lokasi_kecamatan, project.lokasi_kabupaten].filter(Boolean).join(', ') || '–'}</div>
      <div>Tahun Anggaran: ${project.tahun_anggaran || '–'}</div>
      <div>Sumber Dana: ${Utils.sumberDanaLabel(project.sumber_dana)}</div>
      <div>Overhead & Profit: ${overhead}%</div>
      ${project.no_dokumen ? `<div>No. Dokumen: ${project.no_dokumen}</div>` : ''}
    </div>
  </div>

  ${babI}
  ${babII_III}
  ${babV}

  <div style="margin-top:20pt;font-size:8pt;color:#666;border-top:1pt solid #ccc;padding-top:8pt">
    Dicetak: ${now} &nbsp;|&nbsp; e-RAB Desa v1.2 &nbsp;|&nbsp; Berdasarkan Permen PUPR No.8/2023
  </div>
</body>
</html>`;
  },

  _printHTML(html) {
    const win = window.open('', '_blank');
    if (!win) {
      showToast('Pop-up diblokir. Izinkan pop-up untuk export PDF.', 'error');
      return;
    }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 800);
  }
};

window.ExportPDF = ExportPDF;
