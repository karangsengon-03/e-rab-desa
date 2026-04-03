/* ============================================================
   e-RAB Desa v1.0 — export-pdf.js
   PDF export using browser print API + styled template
   Full package: Cover + Rekap + RAB per item + AHSP + HSD
   ============================================================ */

'use strict';

const ExportPDF = {

  async generate(projectId) {
    showToast('Menyiapkan dokumen PDF...', 'info');
    ActivityLog.export('pdf', '', projectId);

    const project = await Projects.load(projectId);
    if (!project) { showToast('Proyek tidak ditemukan', 'error'); return; }

    await AHSP.getAll();
    await MasterHarga.loadGlobal();
    await MasterHarga.loadProjectOverrides(projectId);

    // Load sections & calc
    await RABInput._loadSections && RABInput._projectId === projectId ? null : await this._loadProjectSections(projectId);
    const sections = await this._getProjectSections(projectId);
    const calc = await Kalkulasi.calcFullRAB(projectId, sections);

    ActivityLog.export('pdf', project.nama, projectId);

    const html = this._buildPDFHTML(project, calc);
    this._printHTML(html, `RAB-${project.nama || 'Dokumen'}`);
    showToast('Dokumen PDF siap. Gunakan Ctrl+P / Print untuk menyimpan.', 'success', 5000);
  },

  async _getProjectSections(projectId) {
    if (RABInput._projectId === projectId && RABInput._sections?.length) {
      return RABInput._sections;
    }
    return await this._loadProjectSections(projectId);
  },

  async _loadProjectSections(projectId) {
    if (!window._firebaseReady) return [];
    const { db, collection, query, orderBy, getDocs } = window._firebase;
    try {
      const q = query(collection(db, 'projects', projectId, 'sections'), orderBy('urutan', 'asc'));
      const snap = await getDocs(q);
      const sections = [];
      for (const d of snap.docs) {
        const sec = { id: d.id, ...d.data() };
        const itemSnap = await getDocs(query(collection(db, 'projects', projectId, 'sections', d.id, 'items'), orderBy('urutan', 'asc')));
        sec.items = itemSnap.docs.map(id => ({ id: id.id, ...id.data() }));
        sections.push(sec);
      }
      return sections;
    } catch (err) {
      console.error(err);
      return [];
    }
  },

  _buildPDFHTML(project, calc) {
    const now = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    const overhead = project.overhead_pct || 15;

    return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<title>RAB - ${project.nama || ''}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Plus Jakarta Sans', Arial, sans-serif; font-size: 10pt; color: #1a1a2e; background: #fff; }
  .page { padding: 20mm 20mm 15mm 25mm; min-height: 297mm; }
  @page { size: A4; margin: 0; }
  @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } .no-print { display: none; } .page-break { page-break-before: always; } }

  h1 { font-size: 14pt; font-weight: 800; }
  h2 { font-size: 11pt; font-weight: 700; color: #1B5E20; margin: 16pt 0 8pt; }
  h3 { font-size: 10pt; font-weight: 700; margin: 12pt 0 6pt; }

  .header { text-align: center; border-bottom: 2px solid #1B5E20; padding-bottom: 12pt; margin-bottom: 16pt; }
  .header h1 { color: #1B5E20; }
  .header .sub { font-size: 10pt; margin-top: 4pt; }
  .header .meta { font-size: 9pt; color: #555; margin-top: 4pt; }

  table { width: 100%; border-collapse: collapse; margin-bottom: 12pt; font-size: 9pt; }
  th { background: #1B5E20; color: #fff; padding: 6pt 8pt; text-align: left; font-weight: 700; }
  td { padding: 5pt 8pt; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
  tr:nth-child(even) td { background: #f9fafb; }
  .td-num { text-align: right; font-family: 'Courier New', monospace; font-size: 8.5pt; }
  .td-center { text-align: center; }

  .subtotal td { background: #e8f5e9 !important; font-weight: 700; }
  .total-row td { background: #1B5E20 !important; color: #fff !important; font-weight: 800; font-size: 10pt; }

  .section-title { background: #2E7D32; color: #fff; padding: 6pt 10pt; font-weight: 700; margin-bottom: 0; }
  .section-table td, .section-table th { font-size: 8.5pt; }

  .ahsp-table { background: #f8fafb; border: 1px solid #e2e8f0; border-radius: 4pt; padding: 8pt; margin: 4pt 0 8pt; }
  .ahsp-table table { margin: 0; font-size: 8pt; }
  .ahsp-table th { background: #e2e8f0; color: #555; }
  .ahsp-subtotal td { background: #e3f2fd !important; font-weight: 700; }
  .ahsp-total td { background: #1565C0 !important; color: #fff !important; font-weight: 800; }

  .hsd-section { margin-top: 20pt; }
  .hsd-section h2 { border-bottom: 1px solid #1B5E20; padding-bottom: 4pt; }

  .terbilang { font-style: italic; font-size: 9pt; color: #555; margin-top: 4pt; border-top: 1px dashed #ccc; padding-top: 6pt; }
  .footer { text-align: center; font-size: 8pt; color: #888; margin-top: 20pt; border-top: 1px solid #eee; padding-top: 8pt; }
  .badge { display: inline-block; padding: 1pt 5pt; border-radius: 3pt; font-size: 7.5pt; font-weight: 700; }
  .badge-green { background: #e8f5e9; color: #1B5E20; }
</style>
</head>
<body>

<!-- ===== HALAMAN 1: COVER & REKAPITULASI ===== -->
<div class="page">
  <div class="header">
    <h1>RENCANA ANGGARAN BIAYA (RAB)</h1>
    <div class="sub"><strong>${project.nama || ''}</strong></div>
    <div class="meta">
      ${project.lokasi_desa || '–'}${project.lokasi_kecamatan ? ', Kec. ' + project.lokasi_kecamatan : ''}${project.lokasi_kabupaten ? ', Kab. ' + project.lokasi_kabupaten : ''}${project.lokasi_provinsi ? ', ' + project.lokasi_provinsi : ''}
    </div>
    <div class="meta">
      Tahun Anggaran: <strong>${project.tahun_anggaran || '–'}</strong> &nbsp;|&nbsp;
      Sumber Dana: <strong>${Utils.sumberDanaLabel(project.sumber_dana)}</strong> &nbsp;|&nbsp;
      Overhead: <strong>${overhead}%</strong>
      ${project.no_dokumen ? `&nbsp;|&nbsp; No. Dokumen: <strong>${project.no_dokumen}</strong>` : ''}
    </div>
  </div>

  <h2>I. REKAPITULASI RENCANA ANGGARAN BIAYA</h2>
  <table>
    <thead><tr>
      <th style="width:40pt">No</th>
      <th>Uraian Pekerjaan</th>
      <th style="width:120pt;text-align:right">Jumlah Biaya (Rp)</th>
    </tr></thead>
    <tbody>
      ${calc.sections.map((sec, i) => `
        <tr>
          <td class="td-center">${i + 1}</td>
          <td><strong>${sec.nama}</strong></td>
          <td class="td-num">${Utils.formatRp(sec.total)}</td>
        </tr>
      `).join('')}
      <tr class="subtotal">
        <td colspan="2">JUMLAH TOTAL BIAYA</td>
        <td class="td-num">${Utils.formatRp(calc.grandTotal)}</td>
      </tr>
      <tr class="total-row">
        <td colspan="2">TOTAL RENCANA ANGGARAN BIAYA</td>
        <td class="td-num">${Utils.formatRp(calc.grandTotal)}</td>
      </tr>
    </tbody>
  </table>
  <div class="terbilang">Terbilang: ${Utils.terbilang(calc.grandTotal)}</div>
</div>

<!-- ===== HALAMAN 2+: RAB PER ITEM DENGAN STA ===== -->
${calc.sections.map((sec, si) => `
<div class="page page-break">
  <h2>II.${si + 1}. ${sec.nama}</h2>

  <table class="section-table">
    <thead><tr>
      <th style="width:30pt">No</th>
      <th>Uraian Pekerjaan</th>
      <th style="width:35pt;text-align:center">Sat</th>
      <th style="width:55pt;text-align:right">Vol</th>
      <th style="width:90pt;text-align:right">Harga Sat (Rp)</th>
      <th style="width:100pt;text-align:right">Jumlah (Rp)</th>
    </tr></thead>
    <tbody>
      ${sec.items.map((item, ii) => `
        <tr>
          <td class="td-center">${ii + 1}</td>
          <td>
            <strong>${item.nama_tampil || item.ahsp?.nama || '–'}</strong>
            ${item.ahsp?.kode ? `<br><span style="font-size:7.5pt;color:#888">[${item.ahsp.kode}]</span>` : ''}
            ${item.ahsp?.mutu_fc ? `<span class="badge badge-green" style="margin-left:4pt">K-${item.ahsp.mutu_k || Utils.fcToK(item.ahsp.mutu_fc)}</span>` : ''}
            ${item.keterangan ? `<br><em style="font-size:8pt;color:#666">${item.keterangan}</em>` : ''}
            ${item.sta_mode === 'subrows' && item.sta_rows?.length ? `
              <br><table style="margin-top:3pt;font-size:7.5pt;background:#f0f4f1">
                <tr style="font-weight:600"><td>STA Awal</td><td>STA Akhir</td><td>P(m)</td><td>L(m)</td><td>T(m)</td><td>Vol</td></tr>
                ${item.sta_rows.map(row => {
                  const p = Number(row.panjang)||0, l = Number(row.lebar)||0, t = Number(row.tinggi)||0;
                  return `<tr><td>${row.sta_awal||''}</td><td>${row.sta_akhir||''}</td><td>${p}</td><td>${l}</td><td>${t}</td><td>${Utils.formatNum(p*l*t,3)}</td></tr>`;
                }).join('')}
              </table>
            ` : ''}
          </td>
          <td class="td-center">${item.display_satuan || item.ahsp?.satuan || ''}</td>
          <td class="td-num">
            ${Utils.formatNum(item.display_volume || 0, 3)}
            ${item.ahsp?.satuan === 'ton' ? `<br><span style="font-size:7pt;color:#888">(${Utils.formatNum(item.volume_calc||0,3)} m³)</span>` : ''}
          </td>
          <td class="td-num">${Utils.formatRp(item.hsp || 0)}</td>
          <td class="td-num"><strong>${Utils.formatRp(item.jumlah || 0)}</strong></td>
        </tr>
      `).join('')}
      <tr class="subtotal">
        <td colspan="5">Jumlah ${sec.nama}</td>
        <td class="td-num">${Utils.formatRp(sec.total)}</td>
      </tr>
    </tbody>
  </table>
</div>
`).join('')}

<!-- ===== HALAMAN: ANALISA HARGA SATUAN PEKERJAAN ===== -->
<div class="page page-break">
  <h2>III. ANALISA HARGA SATUAN PEKERJAAN (AHSP)</h2>
  <p style="font-size:8.5pt;color:#555;margin-bottom:10pt">Berdasarkan Peraturan Menteri PUPR No.8 Tahun 2023 + Lampiran IV AHSP Bidang Cipta Karya dan Perumahan</p>

  ${this._buildAHSPDetailHTML(calc)}
</div>

<!-- ===== HALAMAN: DAFTAR HARGA SATUAN DASAR ===== -->
<div class="page page-break">
  <div class="hsd-section">
    <h2>IV. DAFTAR HARGA SATUAN DASAR (HSD)</h2>
    ${this._buildHSDHTML(project.id)}
  </div>

  <div class="footer">
    Dicetak: ${now} &nbsp;|&nbsp; e-RAB Desa v1.0 &nbsp;|&nbsp;
    Dokumen ini disusun berdasarkan Permen PUPR No.8 Tahun 2023 tentang Pedoman Penyusunan Perkiraan Biaya Pekerjaan Konstruksi
  </div>
</div>

</body>
</html>`;
  },

  _buildAHSPDetailHTML(calc) {
    // Collect unique AHSP items used
    const usedAHSP = new Map();
    calc.sections.forEach(sec => {
      sec.items.forEach(item => {
        if (item.ahsp && item.breakdown && !usedAHSP.has(item.ahsp_id)) {
          usedAHSP.set(item.ahsp_id, { ahsp: item.ahsp, breakdown: item.breakdown });
        }
      });
    });

    if (!usedAHSP.size) return '<p style="color:#888;font-size:8.5pt">Tidak ada data AHSP.</p>';

    const rows = [...usedAHSP.values()].map(({ ahsp, breakdown: bd }) => {
      const renderRows = (comps, label) => {
        if (!comps?.length) return '';
        const rows = comps.map(c => `
          <tr>
            <td>${c.kode}</td><td>${c.nama}</td>
            <td class="td-num">${Utils.formatKoef(c.koefisien)}</td>
            <td class="td-center">${c.satuan}</td>
            <td class="td-num">${Utils.formatRp(c.hsd)}</td>
            <td class="td-num">${Utils.formatRp(c.jumlah)}</td>
          </tr>
        `).join('');
        return `<tr style="background:#e8f5e9"><td colspan="6" style="font-weight:700;font-size:8pt">${label}</td></tr>${rows}`;
      };

      return `
        <h3>${ahsp.nama} ${ahsp.mutu_fc ? `(f'c ${ahsp.mutu_fc} MPa / K-${ahsp.mutu_k || Utils.fcToK(ahsp.mutu_fc)})` : ''} &nbsp; <span style="font-weight:400;font-size:8pt">[${ahsp.kode || ''}] per ${ahsp.satuan}</span></h3>
        <table>
          <thead><tr>
            <th style="width:55pt">Kode</th><th>Uraian</th>
            <th style="width:60pt;text-align:right">Koefisien</th>
            <th style="width:35pt;text-align:center">Sat</th>
            <th style="width:80pt;text-align:right">HSD (Rp)</th>
            <th style="width:80pt;text-align:right">Jumlah (Rp)</th>
          </tr></thead>
          <tbody>
            ${renderRows(bd.upah, 'A. Upah Tenaga Kerja')}
            <tr class="subtotal"><td colspan="5">Jumlah A (Upah)</td><td class="td-num">${Utils.formatRp(bd.totalUpah)}</td></tr>
            ${renderRows(bd.bahan, 'B. Bahan & Material')}
            <tr class="subtotal"><td colspan="5">Jumlah B (Bahan)</td><td class="td-num">${Utils.formatRp(bd.totalBahan)}</td></tr>
            ${renderRows(bd.alat, 'C. Peralatan & Alat')}
            <tr class="subtotal"><td colspan="5">Jumlah C (Alat)</td><td class="td-num">${Utils.formatRp(bd.totalAlat)}</td></tr>
            <tr style="background:#e3f2fd;font-weight:700"><td colspan="5">D. Jumlah Biaya Langsung (A+B+C)</td><td class="td-num">${Utils.formatRp(bd.biayaLangsung)}</td></tr>
            <tr><td colspan="5" style="font-size:8pt">E. Biaya Tidak Langsung (Overhead ${bd.overheadPct}% × D)</td><td class="td-num">${Utils.formatRp(bd.overhead)}</td></tr>
            <tr class="ahsp-total"><td colspan="5">F. HARGA SATUAN PEKERJAAN (D+E)</td><td class="td-num">${Utils.formatRp(bd.hsp)}</td></tr>
          </tbody>
        </table>
      `;
    }).join('');

    return rows;
  },

  _buildHSDHTML(projectId) {
    const gh = MasterHarga._globalHarga;
    if (!gh) return '<p style="color:#888">Data HSD tidak tersedia.</p>';

    const overrides = MasterHarga._projectOverrides[projectId] || {};

    const tableFor = (cat, label) => {
      const items = Object.values(gh[cat] || {}).sort((a, b) => a.kode.localeCompare(b.kode));
      if (!items.length) return '';
      return `<h3>${label}</h3>
        <table>
          <thead><tr>
            <th style="width:70pt">Kode</th>
            <th>Uraian</th>
            <th style="width:40pt;text-align:center">Satuan</th>
            <th style="width:90pt;text-align:right">Harga (Rp)</th>
            <th>Catatan</th>
          </tr></thead>
          <tbody>
            ${items.map(i => {
              const ov = overrides[i.kode];
              const h = MasterHarga.getHarga(i.kode, projectId);
              return `<tr>
                <td style="font-family:monospace;font-size:7.5pt">${i.kode}</td>
                <td>${i.nama}${ov ? ' <strong style="color:#E65100">[Override]</strong>' : ''}</td>
                <td class="td-center">${i.satuan}</td>
                <td class="td-num">${Utils.formatRp(h)}</td>
                <td style="font-size:8pt;color:#777">${i.catatan || ''}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>`;
    };

    return tableFor('upah', 'A. Upah Tenaga Kerja') + tableFor('bahan', 'B. Bahan & Material') + tableFor('alat', 'C. Sewa Alat & Peralatan');
  },

  _printHTML(html, filename) {
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) { showToast('Pop-up diblokir browser. Izinkan pop-up untuk export PDF.', 'error', 5000); return; }
    win.document.write(html);
    win.document.close();
    win.onload = () => { setTimeout(() => win.print(), 500); };
  }
};

window.ExportPDF = ExportPDF;
