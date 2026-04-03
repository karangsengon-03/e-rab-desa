/* ============================================================
   e-RAB Desa v1.0 — rab-input.js
   RAB input module: sections, items, STA rows
   ============================================================ */

'use strict';

const RABInput = {
  _projectId: null,
  _project: null,
  _sections: [],
  _allAHSP: null,
  _unsubscribe: null,
  _calcTimeout: null,

  // ===== INITIALIZE =====
  async init(projectId) {
    this._projectId = projectId;
    this._project = await Projects.load(projectId);
    if (!this._project) { showToast('Proyek tidak ditemukan', 'error'); return; }

    await AHSP.getAll();
    this._allAHSP = AHSP._allItems || [];
    await MasterHarga.loadGlobal();
    await MasterHarga.loadProjectOverrides(projectId);

    await this._loadSections();
    this._render();
  },

  // ===== LOAD SECTIONS FROM FIRESTORE =====
  async _loadSections() {
    if (!window._firebaseReady) return;
    const { db, collection, query, orderBy, getDocs } = window._firebase;
    try {
      const q = query(collection(db, 'projects', this._projectId, 'sections'), orderBy('urutan', 'asc'));
      const snap = await getDocs(q);
      this._sections = [];
      for (const d of snap.docs) {
        const sec = { id: d.id, ...d.data() };
        // Load items for each section
        const itemSnap = await getDocs(query(collection(db, 'projects', this._projectId, 'sections', d.id, 'items'), orderBy('urutan', 'asc')));
        sec.items = itemSnap.docs.map(id => ({ id: id.id, ...id.data() }));
        this._sections.push(sec);
      }
    } catch (err) {
      console.error('Load sections error:', err);
    }
  },

  // ===== RENDER FULL RAB BUILDER =====
  async _render() {
    const container = document.getElementById('rab-builder-content');
    if (!container) return;

    const locked = this._project?.locked;
    const overhead = this._project?.overhead_pct || 15;

    // Calculate totals
    const calc = await Kalkulasi.calcFullRAB(this._projectId, this._sections);

    container.innerHTML = `
      ${locked ? `<div class="lock-banner">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke="currentColor" stroke-width="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" stroke-width="2"/></svg>
        RAB ini sudah dikunci sebagai dokumen final. Tidak dapat diubah.
        ${Auth.can('unlock_rab') ? `<button class="btn btn-ghost btn-sm" style="margin-left:auto;color:var(--warning)" onclick="Projects.openUnlockModal('${this._projectId}','${Utils.escHtml(this._project.nama)}')">Buka Kunci</button>` : ''}
      </div>` : ''}

      <div class="rab-info-bar">
        <div class="rab-info-item">
          <span class="rab-info-label">Total RAB</span>
          <span class="rab-info-value" id="grand-total-display" style="color:var(--primary);font-size:1.1rem">${Utils.formatRp(calc.grandTotal)}</span>
        </div>
        <div class="rab-info-item">
          <span class="rab-info-label">Overhead</span>
          <span class="rab-info-value">${overhead}%</span>
        </div>
        <div class="rab-info-item">
          <span class="rab-info-label">Bagian Pekerjaan</span>
          <span class="rab-info-value">${this._sections.length} bagian</span>
        </div>
        <div class="rab-info-item">
          <span class="rab-info-label">Total Item</span>
          <span class="rab-info-value">${this._sections.reduce((s, sec) => s + (sec.items?.length || 0), 0)} item</span>
        </div>
        <div style="margin-left:auto;display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <button class="btn btn-secondary btn-sm" onclick="RABInput.openPreview()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/></svg>
            Preview
          </button>
          <div style="position:relative">
            <button class="btn btn-accent btn-sm" onclick="this.nextElementSibling.classList.toggle('hidden')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
              Export
            </button>
            <div class="hidden" style="position:absolute;right:0;top:36px;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);box-shadow:var(--shadow-lg);z-index:50;min-width:160px;overflow:hidden">
              <button class="btn btn-ghost" style="width:100%;justify-content:flex-start;border-radius:0;border-bottom:1px solid var(--border)" onclick="ExportPDF.generate('${this._projectId}');this.parentElement.classList.add('hidden')">
                📄 Export PDF
              </button>
              <button class="btn btn-ghost" style="width:100%;justify-content:flex-start;border-radius:0" onclick="ExportExcel.generate('${this._projectId}');this.parentElement.classList.add('hidden')">
                📊 Export Excel
              </button>
            </div>
          </div>
          ${!locked && Auth.can('lock_rab') ? `<button class="btn btn-primary btn-sm" onclick="Projects.openLockModal('${this._projectId}','${Utils.escHtml(this._project.nama)}')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke="currentColor" stroke-width="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" stroke-width="2"/></svg>
            Kunci RAB
          </button>` : ''}
        </div>
      </div>

      <div id="sections-container">
        ${calc.sections.map((sec, si) => this._renderSection(sec, si, locked)).join('')}
      </div>

      ${!locked && Auth.can('edit_project') ? `
        <button class="btn btn-secondary" style="width:100%;margin-top:12px" onclick="RABInput.openAddSectionModal()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          Tambah Bagian Pekerjaan
        </button>
      ` : ''}

      <div class="card" style="margin-top:24px">
        <div class="card-header">
          <div class="card-title">Rekapitulasi RAB</div>
        </div>
        ${this._renderRekap(calc)}
      </div>
    `;

    // Update project total in Firestore (debounced)
    clearTimeout(this._calcTimeout);
    this._calcTimeout = setTimeout(() => {
      Projects.updateTotal(this._projectId, calc.grandTotal);
    }, 1000);
  },

  // ===== RENDER SECTION =====
  _renderSection(sec, si, locked) {
    const staMode = this._project?.sta_mode || 'subrows';
    return `
      <div class="rab-section" id="section-${sec.id}">
        <div class="rab-section-header">
          <div class="rab-section-title">
            <div class="rab-section-num">${si + 1}</div>
            ${Utils.escHtml(sec.nama)}
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <div class="rab-section-total">${Utils.formatRp(sec.total || 0)}</div>
            ${!locked && Auth.can('edit_project') ? `
              <button class="btn btn-ghost btn-icon btn-sm" onclick="RABInput.openEditSectionModal('${sec.id}')" title="Edit bagian">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="2"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2"/></svg>
              </button>
              <button class="btn btn-ghost btn-icon btn-sm" onclick="RABInput.confirmDeleteSection('${sec.id}')" title="Hapus bagian">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><polyline points="3 6 5 6 21 6" stroke="currentColor" stroke-width="2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" stroke="currentColor" stroke-width="2"/></svg>
              </button>
            ` : ''}
          </div>
        </div>
        <div class="rab-section-body">
          ${sec.items?.map((item, ii) => this._renderItem(item, sec.id, ii, locked, staMode)).join('') || ''}
          ${!locked && Auth.can('edit_project') ? `
            <button class="btn btn-ghost btn-sm" style="width:100%;margin-top:8px;border:1.5px dashed var(--border)" onclick="RABInput.openAddItemModal('${sec.id}')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
              Tambah Item Pekerjaan
            </button>
          ` : ''}
        </div>
      </div>
    `;
  },

  // ===== RENDER ITEM =====
  _renderItem(item, secId, itemIdx, locked, staMode) {
    const ahsp = item.ahsp;
    const isTon = ahsp?.satuan === 'ton';

    const volDisplay = item.display_volume !== undefined
      ? (isTon ? `${Utils.formatNum(item.display_volume, 3)} ton (= ${Utils.formatNum(item.volume_calc, 3)} m³ × 2,25)` : `${Utils.formatNum(item.display_volume, 3)} ${ahsp?.satuan || ''}`)
      : '–';

    return `
      <div class="rab-item-row" id="item-${item.id}">
        <div class="rab-item-header">
          <div>
            <div class="rab-item-code">${Utils.escHtml(item.nomor || (itemIdx + 1) + '.')} · ${Utils.escHtml(ahsp?.kode || item.ahsp_id || '')}</div>
            <div class="rab-item-title">${Utils.escHtml(item.nama_tampil || ahsp?.nama || '–')}</div>
            ${ahsp?.mutu_fc ? `<span class="badge badge-primary" style="margin-top:4px">f'c ${ahsp.mutu_fc} MPa / K-${ahsp.mutu_k || Utils.fcToK(ahsp.mutu_fc)}</span>` : ''}
          </div>
          <div style="display:flex;gap:4px;align-items:flex-start">
            ${!locked && Auth.can('edit_project') ? `
              <button class="btn btn-ghost btn-icon btn-sm" onclick="RABInput.openEditItemModal('${secId}','${item.id}')" title="Edit item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="2"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2"/></svg>
              </button>
              <button class="btn btn-ghost btn-icon btn-sm" onclick="RABInput.confirmDeleteItem('${secId}','${item.id}')" title="Hapus item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><polyline points="3 6 5 6 21 6" stroke="currentColor" stroke-width="2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" stroke="currentColor" stroke-width="2"/></svg>
              </button>
            ` : ''}
          </div>
        </div>

        ${item.keterangan ? `<div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:8px">📝 ${Utils.escHtml(item.keterangan)}</div>` : ''}

        ${item.sta_mode === 'subrows' && item.sta_rows?.length
          ? this._renderSTASubrows(item, locked)
          : this._renderDimensions(item, locked)}

        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;padding-top:10px;border-top:1px dashed var(--border)">
          <div style="font-size:0.78rem;color:var(--text-muted)">
            Volume: <strong>${volDisplay}</strong> ×
            HSP: <strong>${Utils.formatRp(item.hsp || 0)}</strong>
          </div>
          <div class="rab-item-total">${Utils.formatRp(item.jumlah || 0)}</div>
        </div>

        ${item.breakdown ? `
          <details style="margin-top:8px">
            <summary style="font-size:0.75rem;color:var(--text-muted);cursor:pointer">🔍 Lihat analisa AHSP</summary>
            ${this._renderBreakdown(item.breakdown)}
          </details>
        ` : ''}
      </div>
    `;
  },

  _renderDimensions(item, locked) {
    const dims = [];
    if (item.panjang) dims.push(`P = ${item.panjang} m`);
    if (item.lebar) dims.push(`L = ${item.lebar} m`);
    if (item.tinggi) dims.push(`T/D = ${item.tinggi} m`);
    if (item.volume_manual > 0) dims.push(`Vol manual = ${item.volume_manual}`);
    return `<div style="font-size:0.8rem;color:var(--text-secondary);display:flex;gap:12px;flex-wrap:wrap">${dims.map(d => `<span>📐 ${d}</span>`).join('')}</div>`;
  },

  _renderSTASubrows(item, locked) {
    if (!item.sta_rows?.length) return '';
    return `
      <div class="sta-rows">
        <div style="font-size:0.72rem;font-weight:700;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.05em">Detail STA</div>
        <div class="table-wrap" style="border:none">
          <table class="table" style="min-width:450px;font-size:0.8rem">
            <thead><tr>
              <th>STA Awal</th><th>STA Akhir</th><th>P (m)</th><th>L (m)</th><th>T/D (m)</th><th>Volume</th>
            </tr></thead>
            <tbody>
              ${item.sta_rows.map(row => {
                const p = Number(row.panjang) || 0, l = Number(row.lebar) || 0, t = Number(row.tinggi) || 0;
                const vol = p * l * t;
                return `<tr>
                  <td class="mono" style="font-size:0.78rem">${Utils.escHtml(row.sta_awal || '')}</td>
                  <td class="mono" style="font-size:0.78rem">${Utils.escHtml(row.sta_akhir || '')}</td>
                  <td class="td-num">${p}</td>
                  <td class="td-num">${l}</td>
                  <td class="td-num">${t}</td>
                  <td class="td-num">${Utils.formatNum(vol, 3)}</td>
                </tr>`;
              }).join('')}
              <tr style="background:var(--primary-surface);font-weight:700">
                <td colspan="5">Total Volume</td>
                <td class="td-num">${Utils.formatNum(Kalkulasi.calcSTAVolume(item.sta_rows, item.jenis_satuan), 3)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  _renderBreakdown(bd) {
    if (!bd) return '';
    const rows = (comps, label) => {
      if (!comps?.length) return '';
      return `<div style="margin-bottom:6px">
        <div class="ahsp-section-title">${label}</div>
        ${comps.map(c => `<div class="ahsp-row">
          <span class="ahsp-row-name">${Utils.escHtml(c.nama)} <code style="font-size:0.7rem;color:var(--text-muted)">(${Utils.escHtml(c.kode)})</code></span>
          <span class="ahsp-row-koef">${Utils.formatKoef(c.koefisien)} ${Utils.escHtml(c.satuan)}</span>
          <span class="ahsp-row-harga">${Utils.formatRp(c.jumlah)}</span>
        </div>`).join('')}
      </div>`;
    };
    return `<div class="ahsp-breakdown">
      ${rows(bd.upah, 'A. Upah')}
      ${rows(bd.bahan, 'B. Bahan')}
      ${rows(bd.alat, 'C. Alat')}
      <div class="ahsp-subtotal"><span>Biaya Langsung</span><span>${Utils.formatRp(bd.biayaLangsung)}</span></div>
      <div class="ahsp-subtotal"><span>Overhead ${bd.overheadPct}%</span><span>${Utils.formatRp(bd.overhead)}</span></div>
      <div class="ahsp-subtotal ahsp-total"><span>HSP</span><span>${Utils.formatRp(bd.hsp)}</span></div>
    </div>`;
  },

  _renderRekap(calc) {
    const rekap = Kalkulasi.buildRekap(calc.sections);
    return `
      <div class="rekap-table-wrap">
        <table class="rekap-table">
          <thead><tr><th>No</th><th>Uraian Pekerjaan</th><th class="text-right">Jumlah (Rp)</th></tr></thead>
          <tbody>
            ${rekap.rows.map(r => `<tr>
              <td>${r.no}</td>
              <td>${Utils.escHtml(r.nama)}</td>
              <td class="td-rp">${Utils.formatRp(r.total)}</td>
            </tr>`).join('')}
          </tbody>
          <tfoot>
            <tr class="rekap-subtotal"><td colspan="2" style="font-weight:700">JUMLAH TOTAL</td><td class="td-rp">${Utils.formatRp(rekap.subtotal)}</td></tr>
            <tr class="rekap-total"><td colspan="2">TOTAL BIAYA KEGIATAN</td><td class="td-rp">${Utils.formatRp(rekap.subtotal)}</td></tr>
          </tfoot>
        </table>
      </div>
      <div style="margin-top:12px;font-size:0.8rem;color:var(--text-muted)">
        Terbilang: <em>${Utils.terbilang(rekap.subtotal)}</em>
      </div>
    `;
  },

  // ===== ADD/EDIT SECTION =====
  openAddSectionModal() {
    openModal({
      title: 'Tambah Bagian Pekerjaan',
      body: `
        <div class="form-group">
          <label class="lbl lbl-req">Nama Bagian</label>
          <input type="text" class="inp" id="sec-nama" placeholder="Contoh: I. PEKERJAAN PERSIAPAN">
          <div class="field-hint">Gunakan angka Romawi untuk urutan: I. II. III. dst.</div>
        </div>
      `,
      footer: `
        <button class="btn btn-ghost" onclick="closeModal()">Batal</button>
        <button class="btn btn-primary" onclick="RABInput._doAddSection()">Tambah</button>
      `
    });
  },

  async _doAddSection() {
    const nama = document.getElementById('sec-nama')?.value?.trim();
    if (!nama) { showToast('Nama bagian wajib diisi', 'error'); return; }

    const { db, collection, addDoc, serverTimestamp } = window._firebase;
    try {
      const ref = await addDoc(collection(db, 'projects', this._projectId, 'sections'), {
        nama, urutan: this._sections.length + 1,
        createdAt: serverTimestamp()
      });
      closeModal();
      ActivityLog.create('section', ref.id, nama, '', this._projectId);
      await this._loadSections();
      this._render();
    } catch (err) {
      showToast('Gagal tambah bagian: ' + err.message, 'error');
    }
  },

  openEditSectionModal(secId) {
    const sec = this._sections.find(s => s.id === secId);
    if (!sec) return;
    openModal({
      title: 'Edit Bagian Pekerjaan',
      body: `
        <div class="form-group">
          <label class="lbl lbl-req">Nama Bagian</label>
          <input type="text" class="inp" id="sec-edit-nama" value="${Utils.escHtml(sec.nama)}">
        </div>
      `,
      footer: `
        <button class="btn btn-ghost" onclick="closeModal()">Batal</button>
        <button class="btn btn-primary" onclick="RABInput._doEditSection('${secId}')">Simpan</button>
      `
    });
  },

  async _doEditSection(secId) {
    const nama = document.getElementById('sec-edit-nama')?.value?.trim();
    if (!nama) { showToast('Nama wajib diisi', 'error'); return; }
    const { db, doc, updateDoc, serverTimestamp } = window._firebase;
    try {
      await updateDoc(doc(db, 'projects', this._projectId, 'sections', secId), { nama, updatedAt: serverTimestamp() });
      closeModal();
      await this._loadSections();
      this._render();
    } catch (err) {
      showToast('Gagal update: ' + err.message, 'error');
    }
  },

  confirmDeleteSection(secId) {
    const sec = this._sections.find(s => s.id === secId);
    openModal({
      title: 'Hapus Bagian',
      body: `<p style="color:var(--text-secondary)">Hapus bagian "<strong>${Utils.escHtml(sec?.nama || '')}</strong>" beserta semua itemnya?</p>`,
      footer: `<button class="btn btn-ghost" onclick="closeModal()">Batal</button><button class="btn btn-danger" onclick="RABInput._doDeleteSection('${secId}')">Hapus</button>`
    });
  },

  async _doDeleteSection(secId) {
    const { db, doc, deleteDoc } = window._firebase;
    try {
      const sec = this._sections.find(s => s.id === secId);
      await deleteDoc(doc(db, 'projects', this._projectId, 'sections', secId));
      closeModal();
      ActivityLog.delete('section', secId, sec?.nama || '', this._projectId);
      await this._loadSections();
      this._render();
    } catch (err) {
      showToast('Gagal hapus: ' + err.message, 'error');
    }
  },

  // ===== ADD/EDIT ITEM =====
  openAddItemModal(secId) {
    const staMode = this._project?.sta_mode || 'subrows';
    const ahspOptions = (this._allAHSP || []).map(a =>
      `<option value="${Utils.escHtml(a.id)}">[${Utils.escHtml(a.kode || '')}] ${Utils.escHtml(a.nama)}</option>`
    ).join('');

    openModal({
      title: 'Tambah Item Pekerjaan',
      size: 'modal-lg',
      body: `
        <div class="form-group" style="margin-bottom:12px">
          <label class="lbl lbl-req">Jenis Pekerjaan (AHSP)</label>
          <select class="sel" id="item-ahsp" onchange="RABInput._onAHSPSelect(this)">
            <option value="">-- Pilih jenis pekerjaan --</option>
            ${ahspOptions}
          </select>
        </div>

        <div id="item-ahsp-info" class="hidden" style="background:var(--primary-surface);border:1px solid var(--primary-border);border-radius:var(--radius-sm);padding:10px 14px;margin-bottom:12px;font-size:0.82rem"></div>

        <div class="form-row form-row-2" style="margin-bottom:12px">
          <div class="form-group">
            <label class="lbl">Nama Tampil (opsional)</label>
            <input type="text" class="inp" id="item-nama" placeholder="Kosongkan untuk pakai nama AHSP">
          </div>
          <div class="form-group">
            <label class="lbl">Keterangan</label>
            <input type="text" class="inp" id="item-ket" placeholder="Catatan khusus item ini">
          </div>
        </div>

        <div class="form-group" style="margin-bottom:12px">
          <label class="lbl">Mode Input Dimensi</label>
          <select class="sel" id="item-sta-mode" onchange="RABInput._onSTAModeChange(this.value)">
            <option value="${staMode === 'subrows' ? 'subrows' : 'direct'}" ${staMode === 'subrows' ? 'selected' : ''}>Opsi A: Sub-baris STA (expand per segmen)</option>
            <option value="${staMode === 'rows' ? 'rows' : 'direct'}" ${staMode !== 'subrows' ? 'selected' : ''}>Opsi B: Input langsung (tanpa STA)</option>
          </select>
        </div>

        <div id="dims-direct" class="${staMode === 'subrows' ? 'hidden' : ''}">
          <div class="form-row form-row-3" style="margin-bottom:8px">
            <div class="form-group">
              <label class="lbl">Panjang (m)</label>
              <input type="number" class="inp" id="dim-panjang" min="0" step="0.01" placeholder="0.00" oninput="RABInput._calcPreview()">
            </div>
            <div class="form-group">
              <label class="lbl">Lebar (m)</label>
              <input type="number" class="inp" id="dim-lebar" min="0" step="0.01" placeholder="0.00" oninput="RABInput._calcPreview()">
            </div>
            <div class="form-group">
              <label class="lbl">Tebal/Tinggi/Dalam (m)</label>
              <input type="number" class="inp" id="dim-tinggi" min="0" step="0.001" placeholder="0.000" oninput="RABInput._calcPreview()">
            </div>
          </div>
          <div class="form-group">
            <label class="lbl">Volume Manual (isi jika tidak pakai P×L×T)</label>
            <input type="number" class="inp" id="dim-vol-manual" min="0" step="0.001" placeholder="0.000" oninput="RABInput._calcPreview()">
          </div>
        </div>

        <div id="dims-sta" class="${staMode === 'subrows' ? '' : 'hidden'}">
          <div id="sta-rows-container">
            ${this._renderSTAInputRows([{}])}
          </div>
          <button type="button" class="btn btn-ghost btn-sm" style="margin-top:8px" onclick="RABInput._addSTARow()">+ Tambah Baris STA</button>
        </div>

        <div id="item-preview" style="margin-top:12px;background:var(--bg-hover);border-radius:var(--radius-sm);padding:10px 14px;font-size:0.85rem;display:none">
          Volume: <strong id="prev-vol">–</strong> | HSP: <strong id="prev-hsp">–</strong> | Total: <strong id="prev-total" style="color:var(--primary)">–</strong>
        </div>
      `,
      footer: `
        <button class="btn btn-ghost" onclick="closeModal()">Batal</button>
        <button class="btn btn-primary" onclick="RABInput._doAddItem('${secId}')">Tambah Item</button>
      `
    });
  },

  _renderSTAInputRows(rows) {
    return `<div class="table-wrap"><table class="table" style="min-width:480px;font-size:0.82rem">
      <thead><tr><th>STA Awal</th><th>STA Akhir</th><th>P (m)</th><th>L (m)</th><th>T/D (m)</th><th></th></tr></thead>
      <tbody id="sta-input-body">
        ${rows.map((r, i) => `<tr>
          <td><input type="text" class="inp" data-sta-field="sta_awal" data-i="${i}" value="${Utils.escHtml(r.sta_awal || '')}" placeholder="0+000" style="font-family:var(--font-mono)"></td>
          <td><input type="text" class="inp" data-sta-field="sta_akhir" data-i="${i}" value="${Utils.escHtml(r.sta_akhir || '')}" placeholder="0+050" style="font-family:var(--font-mono)"></td>
          <td><input type="number" class="inp" data-sta-field="panjang" data-i="${i}" value="${r.panjang || ''}" placeholder="0.00" step="0.01" min="0" oninput="RABInput._calcPreview()"></td>
          <td><input type="number" class="inp" data-sta-field="lebar" data-i="${i}" value="${r.lebar || ''}" placeholder="0.00" step="0.01" min="0" oninput="RABInput._calcPreview()"></td>
          <td><input type="number" class="inp" data-sta-field="tinggi" data-i="${i}" value="${r.tinggi || ''}" placeholder="0.000" step="0.001" min="0" oninput="RABInput._calcPreview()"></td>
          <td>${i > 0 ? `<button class="btn btn-ghost btn-icon btn-sm" onclick="this.closest('tr').remove()"><svg width="12" height="12" viewBox="0 0 24 24" fill="none"><line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>` : ''}</td>
        </tr>`).join('')}
      </tbody>
    </table></div>`;
  },

  _addSTARow() {
    const tbody = document.getElementById('sta-input-body');
    if (!tbody) return;
    const i = tbody.querySelectorAll('tr').length;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="text" class="inp" data-sta-field="sta_awal" data-i="${i}" placeholder="0+000" style="font-family:var(--font-mono)"></td>
      <td><input type="text" class="inp" data-sta-field="sta_akhir" data-i="${i}" placeholder="0+050" style="font-family:var(--font-mono)"></td>
      <td><input type="number" class="inp" data-sta-field="panjang" data-i="${i}" placeholder="0.00" step="0.01" min="0" oninput="RABInput._calcPreview()"></td>
      <td><input type="number" class="inp" data-sta-field="lebar" data-i="${i}" placeholder="0.00" step="0.01" min="0" oninput="RABInput._calcPreview()"></td>
      <td><input type="number" class="inp" data-sta-field="tinggi" data-i="${i}" placeholder="0.000" step="0.001" min="0" oninput="RABInput._calcPreview()"></td>
      <td><button class="btn btn-ghost btn-icon btn-sm" onclick="this.closest('tr').remove()"><svg width="12" height="12" viewBox="0 0 24 24" fill="none"><line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button></td>
    `;
    tbody.appendChild(tr);
  },

  _onSTAModeChange(mode) {
    document.getElementById('dims-direct').classList.toggle('hidden', mode === 'subrows');
    document.getElementById('dims-sta').classList.toggle('hidden', mode !== 'subrows');
    this._calcPreview();
  },

  async _onAHSPSelect(sel) {
    const id = sel.value;
    const infoEl = document.getElementById('item-ahsp-info');
    if (!id || !infoEl) { infoEl?.classList.add('hidden'); return; }

    const item = await AHSP.getById(id);
    if (!item) return;

    const hsp = Kalkulasi.calcItemHSP(item, this._projectId, this._project?.overhead_pct || 15);
    infoEl.classList.remove('hidden');
    infoEl.innerHTML = `
      <strong>${Utils.escHtml(item.nama)}</strong> · Satuan: ${Utils.escHtml(item.satuan)}
      ${item.mutu_fc ? ` · <span class="badge badge-primary" style="font-size:0.7rem">f'c ${item.mutu_fc} MPa / K-${item.mutu_k || Utils.fcToK(item.mutu_fc)}</span>` : ''}
      <br>HSP: <strong>${Utils.formatRp(hsp?.hsp || 0)}</strong> / ${Utils.escHtml(item.satuan)}
      ${item.catatan_konversi ? `<br><em style="color:var(--info)">${Utils.escHtml(item.catatan_konversi)}</em>` : ''}
    `;
    this._calcPreview();
  },

  _collectSTARows() {
    const rows = [];
    document.querySelectorAll('#sta-input-body tr').forEach(tr => {
      const sta_awal = tr.querySelector('[data-sta-field="sta_awal"]')?.value || '';
      const sta_akhir = tr.querySelector('[data-sta-field="sta_akhir"]')?.value || '';
      const panjang = parseFloat(tr.querySelector('[data-sta-field="panjang"]')?.value) || 0;
      const lebar = parseFloat(tr.querySelector('[data-sta-field="lebar"]')?.value) || 0;
      const tinggi = parseFloat(tr.querySelector('[data-sta-field="tinggi"]')?.value) || 0;
      rows.push({ sta_awal, sta_akhir, panjang, lebar, tinggi });
    });
    return rows;
  },

  _getJenisSatuan(satuan) {
    if (satuan === 'm³') return 'volume';
    if (satuan === 'm²') return 'area';
    if (satuan === 'ton') return 'berat';
    if (satuan === "m'" || satuan === "m'") return 'panjang';
    return 'volume';
  },

  async _doAddItem(secId) {
    const ahspId = document.getElementById('item-ahsp')?.value;
    if (!ahspId) { showToast('Pilih jenis pekerjaan terlebih dahulu', 'error'); return; }

    const ahspItem = await AHSP.getById(ahspId);
    const staMode = document.getElementById('item-sta-mode')?.value || 'direct';
    const namaInput = document.getElementById('item-nama')?.value?.trim();
    const ket = document.getElementById('item-ket')?.value?.trim();

    let itemData = {
      ahsp_id: ahspId,
      nama_tampil: namaInput || ahspItem?.nama || '',
      keterangan: ket,
      sta_mode: staMode,
      jenis_satuan: this._getJenisSatuan(ahspItem?.satuan || 'm³'),
      urutan: (this._sections.find(s => s.id === secId)?.items?.length || 0) + 1
    };

    if (staMode === 'subrows') {
      itemData.sta_rows = this._collectSTARows();
    } else {
      itemData.panjang = parseFloat(document.getElementById('dim-panjang')?.value) || 0;
      itemData.lebar = parseFloat(document.getElementById('dim-lebar')?.value) || 0;
      itemData.tinggi = parseFloat(document.getElementById('dim-tinggi')?.value) || 0;
      itemData.volume_manual = parseFloat(document.getElementById('dim-vol-manual')?.value) || 0;
    }

    const { db, collection, addDoc, serverTimestamp } = window._firebase;
    try {
      await addDoc(collection(db, 'projects', this._projectId, 'sections', secId, 'items'), {
        ...itemData,
        createdAt: serverTimestamp()
      });
      closeModal();
      ActivityLog.create('rab_item', ahspId, itemData.nama_tampil, '', this._projectId);
      await this._loadSections();
      this._render();
    } catch (err) {
      showToast('Gagal tambah item: ' + err.message, 'error');
    }
  },

  // ===== EDIT ITEM =====
  async openEditItemModal(secId, itemId) {
    const sec = this._sections.find(s => s.id === secId);
    const item = sec?.items?.find(i => i.id === itemId);
    if (!item) return;
    const ahspItem = await AHSP.getById(item.ahsp_id);
    const staMode = item.sta_mode || 'direct';
    openModal({
      title: 'Edit Item Pekerjaan',
      size: 'modal-lg',
      body: `
        <div style="background:var(--bg-hover);border-radius:var(--radius-sm);padding:10px 14px;margin-bottom:14px;font-size:0.875rem">
          <strong>${Utils.escHtml(ahspItem?.nama || item.ahsp_id)}</strong>
          ${ahspItem?.satuan ? ` · ${Utils.escHtml(ahspItem.satuan)}` : ''}
        </div>
        <div class="form-row form-row-2" style="margin-bottom:12px">
          <div class="form-group">
            <label class="lbl">Nama Tampil</label>
            <input type="text" class="inp" id="edit-item-nama" value="${Utils.escHtml(item.nama_tampil || '')}" placeholder="Kosongkan untuk pakai nama AHSP">
          </div>
          <div class="form-group">
            <label class="lbl">Keterangan</label>
            <input type="text" class="inp" id="edit-item-ket" value="${Utils.escHtml(item.keterangan || '')}" placeholder="Catatan khusus">
          </div>
        </div>
        <div class="form-group" style="margin-bottom:12px">
          <label class="lbl">Mode Input</label>
          <select class="sel" id="edit-item-sta-mode" onchange="RABInput._onSTAModeChange(this.value)">
            <option value="subrows" ${staMode === 'subrows' ? 'selected' : ''}>Opsi A: Sub-baris STA</option>
            <option value="direct" ${staMode !== 'subrows' ? 'selected' : ''}>Opsi B: Input langsung</option>
          </select>
        </div>
        <div id="dims-direct" class="${staMode === 'subrows' ? 'hidden' : ''}">
          <div class="form-row form-row-3" style="margin-bottom:8px">
            <div class="form-group"><label class="lbl">Panjang (m)</label><input type="number" class="inp" id="dim-panjang" value="${item.panjang || ''}" min="0" step="0.01" oninput="RABInput._calcPreview()"></div>
            <div class="form-group"><label class="lbl">Lebar (m)</label><input type="number" class="inp" id="dim-lebar" value="${item.lebar || ''}" min="0" step="0.01" oninput="RABInput._calcPreview()"></div>
            <div class="form-group"><label class="lbl">Tebal/Tinggi/Dalam (m)</label><input type="number" class="inp" id="dim-tinggi" value="${item.tinggi || ''}" min="0" step="0.001" oninput="RABInput._calcPreview()"></div>
          </div>
          <div class="form-group"><label class="lbl">Volume Manual</label><input type="number" class="inp" id="dim-vol-manual" value="${item.volume_manual || ''}" min="0" step="0.001" oninput="RABInput._calcPreview()"></div>
        </div>
        <div id="dims-sta" class="${staMode === 'subrows' ? '' : 'hidden'}">
          <div id="sta-rows-container">${this._renderSTAInputRows(item.sta_rows || [{}])}</div>
          <button type="button" class="btn btn-ghost btn-sm" style="margin-top:8px" onclick="RABInput._addSTARow()">+ Tambah Baris STA</button>
        </div>
        <div id="item-preview" style="margin-top:12px;background:var(--bg-hover);border-radius:var(--radius-sm);padding:10px 14px;font-size:0.85rem;display:none">
          Volume: <strong id="prev-vol">–</strong> | HSP: <strong id="prev-hsp">–</strong> | Total: <strong id="prev-total" style="color:var(--primary)">–</strong>
        </div>
      `,
      footer: `
        <button class="btn btn-ghost" onclick="closeModal()">Batal</button>
        <button class="btn btn-primary" onclick="RABInput._doEditItem('${secId}','${itemId}','${item.ahsp_id}')">Simpan</button>
      `
    });
    // Store ahsp_id for preview calc
    this._editingAhspId = item.ahsp_id;
    setTimeout(() => this._calcPreview(), 200);
  },

  async _doEditItem(secId, itemId, ahspId) {
    const nama = document.getElementById('edit-item-nama')?.value?.trim();
    const ket = document.getElementById('edit-item-ket')?.value?.trim();
    const staMode = document.getElementById('edit-item-sta-mode')?.value || 'direct';
    const ahspItem = await AHSP.getById(ahspId);
    let updateData = { nama_tampil: nama, keterangan: ket, sta_mode: staMode, jenis_satuan: RABInput._getJenisSatuan(ahspItem?.satuan || 'm³') };
    if (staMode === 'subrows') {
      updateData.sta_rows = this._collectSTARows();
    } else {
      updateData.panjang = parseFloat(document.getElementById('dim-panjang')?.value) || 0;
      updateData.lebar = parseFloat(document.getElementById('dim-lebar')?.value) || 0;
      updateData.tinggi = parseFloat(document.getElementById('dim-tinggi')?.value) || 0;
      updateData.volume_manual = parseFloat(document.getElementById('dim-vol-manual')?.value) || 0;
    }
    const { db, doc, updateDoc, serverTimestamp } = window._firebase;
    try {
      await updateDoc(doc(db, 'projects', this._projectId, 'sections', secId, 'items', itemId), { ...updateData, updatedAt: serverTimestamp() });
      closeModal();
      ActivityLog.edit('rab_item', itemId, nama || '', {}, updateData, this._projectId);
      await this._loadSections();
      this._render();
    } catch (err) { showToast('Gagal update item: ' + err.message, 'error'); }
  },

  // Override _calcPreview to support edit modal
  async _calcPreview() {
    const prevEl = document.getElementById('item-preview');
    if (!prevEl) return;
    const ahspId = document.getElementById('item-ahsp')?.value || this._editingAhspId;
    if (!ahspId) { prevEl.style.display = 'none'; return; }
    const ahspItem = await AHSP.getById(ahspId);
    if (!ahspItem) { prevEl.style.display = 'none'; return; }
    const hsp = Kalkulasi.calcItemHSP(ahspItem, this._projectId, this._project?.overhead_pct || 15);
    const staMode = document.getElementById('item-sta-mode')?.value || document.getElementById('edit-item-sta-mode')?.value || 'direct';
    let volume = 0;
    if (staMode === 'subrows') {
      volume = Kalkulasi.calcSTAVolume(this._collectSTARows(), this._getJenisSatuan(ahspItem.satuan));
    } else {
      const p = parseFloat(document.getElementById('dim-panjang')?.value) || 0;
      const l = parseFloat(document.getElementById('dim-lebar')?.value) || 0;
      const t = parseFloat(document.getElementById('dim-tinggi')?.value) || 0;
      const vm = parseFloat(document.getElementById('dim-vol-manual')?.value) || 0;
      volume = vm > 0 ? vm : p * l * t;
    }
    let displayVol = ahspItem.satuan === 'ton' ? Utils.m3ToTon(volume) : volume;
    const total = Kalkulasi.calcLineTotal(displayVol, hsp?.hsp || 0);
    prevEl.style.display = 'block';
    document.getElementById('prev-vol').textContent = `${Utils.formatNum(displayVol, 3)} ${ahspItem.satuan}`;
    document.getElementById('prev-hsp').textContent = Utils.formatRp(hsp?.hsp || 0);
    document.getElementById('prev-total').textContent = Utils.formatRp(total);
  },

  confirmDeleteItem(secId, itemId) {
    const sec = this._sections.find(s => s.id === secId);
    const item = sec?.items?.find(i => i.id === itemId);
    openModal({
      title: 'Hapus Item',
      body: `<p style="color:var(--text-secondary)">Hapus item "<strong>${Utils.escHtml(item?.nama_tampil || '')}</strong>"?</p>`,
      footer: `<button class="btn btn-ghost" onclick="closeModal()">Batal</button><button class="btn btn-danger" onclick="RABInput._doDeleteItem('${secId}','${itemId}')">Hapus</button>`
    });
  },

  async _doDeleteItem(secId, itemId) {
    const { db, doc, deleteDoc } = window._firebase;
    try {
      await deleteDoc(doc(db, 'projects', this._projectId, 'sections', secId, 'items', itemId));
      closeModal();
      ActivityLog.delete('rab_item', itemId, '', this._projectId);
      await this._loadSections();
      this._render();
    } catch (err) {
      showToast('Gagal hapus item: ' + err.message, 'error');
    }
  },

  // ===== PREVIEW =====
  async openPreview() {
    const calc = await Kalkulasi.calcFullRAB(this._projectId, this._sections);
    openModal({
      title: 'Preview RAB — ' + Utils.escHtml(this._project?.nama || ''),
      size: 'modal-full',
      body: Pages._renderRABPreviewContent(this._project, calc),
      footer: `
        <button class="btn btn-ghost" onclick="closeModal()">Tutup</button>
        <button class="btn btn-accent" onclick="ExportPDF.generate('${this._projectId}');closeModal()">Export PDF</button>
        <button class="btn btn-primary" onclick="ExportExcel.generate('${this._projectId}');closeModal()">Export Excel</button>
      `
    });
  }
};

window.RABInput = RABInput;
