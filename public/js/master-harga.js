/* ============================================================
   e-RAB Desa v1.0 — master-harga.js
   Master price management: Global + per-project override
   2 options: (A) all-in price, (B) base price + transport cost
   ============================================================ */

'use strict';

const MasterHarga = {
  _data: null,        // loaded AHSP default data
  _globalHarga: null, // from Firestore 'master_harga' doc
  _projectOverrides: {}, // projectId → { kode: overrideObj }
  _activeTab: 'upah',
  _activeProjectId: null,

  // ===== LOAD DEFAULT FROM JSON =====
  async loadDefault() {
    if (this._data) return this._data;
    try {
      const res = await fetch('data/ahsp-data.json');
      this._data = await res.json();
      return this._data;
    } catch (err) {
      console.error('Failed to load AHSP data:', err);
      return null;
    }
  },

  // ===== LOAD GLOBAL FROM FIRESTORE =====
  async loadGlobal() {
    if (!window._firebaseReady) return null;
    const { db, doc, getDoc } = window._firebase;
    try {
      const snap = await getDoc(doc(db, 'master_harga', 'global'));
      if (snap.exists()) {
        this._globalHarga = snap.data();
        return this._globalHarga;
      }
      // First time: seed from JSON default
      await this.seedFromDefault();
      return this._globalHarga;
    } catch (err) {
      console.error('Load global harga error:', err);
      return null;
    }
  },

  // ===== SEED GLOBAL FROM JSON =====
  async seedFromDefault() {
    const data = await this.loadDefault();
    if (!data) return;
    const { db, doc, setDoc, serverTimestamp } = window._firebase;

    const harga = { upah: {}, bahan: {}, alat: {}, updatedAt: serverTimestamp() };
    data.master_harga_default.upah.forEach(i => { harga.upah[i.kode] = { ...i }; });
    data.master_harga_default.bahan.forEach(i => { harga.bahan[i.kode] = { ...i }; });
    data.master_harga_default.alat.forEach(i => { harga.alat[i.kode] = { ...i }; });

    await setDoc(doc(db, 'master_harga', 'global'), harga);
    this._globalHarga = harga;
  },

  // ===== GET EFFECTIVE PRICE FOR A COMPONENT =====
  // Returns effective harga considering project override
  getHarga(kode, projectId = null) {
    // Check project override first
    if (projectId && this._projectOverrides[projectId]) {
      const ov = this._projectOverrides[projectId][kode];
      if (ov) {
        // Option A: all-in price
        if (ov.mode === 'allin') return Math.round(ov.harga_allin || 0);
        // Option B: base + transport
        if (ov.mode === 'transport') return Math.round((ov.harga_base || 0) + (ov.harga_transport || 0));
      }
    }

    // Fall back to global
    if (this._globalHarga) {
      for (const cat of ['upah', 'bahan', 'alat']) {
        if (this._globalHarga[cat]?.[kode]) {
          return Math.round(this._globalHarga[cat][kode].harga || 0);
        }
      }
    }
    return 0;
  },

  // ===== GET ITEM INFO =====
  getItem(kode) {
    if (this._globalHarga) {
      for (const cat of ['upah', 'bahan', 'alat']) {
        if (this._globalHarga[cat]?.[kode]) {
          return { ...this._globalHarga[cat][kode], kategori: cat };
        }
      }
    }
    // fallback from default data
    if (this._data?.master_harga_default) {
      for (const cat of ['upah', 'bahan', 'alat']) {
        const found = this._data.master_harga_default[cat]?.find(i => i.kode === kode);
        if (found) return { ...found, kategori: cat };
      }
    }
    return null;
  },

  // ===== LOAD PROJECT OVERRIDES =====
  async loadProjectOverrides(projectId) {
    if (!projectId || !window._firebaseReady) return {};
    const { db, doc, getDoc } = window._firebase;
    try {
      const snap = await getDoc(doc(db, 'projects', projectId, 'settings', 'harga_override'));
      if (snap.exists()) {
        this._projectOverrides[projectId] = snap.data().items || {};
      } else {
        this._projectOverrides[projectId] = {};
      }
      return this._projectOverrides[projectId];
    } catch (err) {
      console.warn('Load override error:', err);
      this._projectOverrides[projectId] = {};
      return {};
    }
  },

  // ===== SAVE PROJECT OVERRIDE =====
  async saveProjectOverride(projectId, kode, overrideData) {
    if (!projectId || !window._firebaseReady) return;
    if (!Auth.can('edit_project')) { showToast('Tidak ada izin', 'error'); return; }
    const { db, doc, setDoc, serverTimestamp } = window._firebase;

    if (!this._projectOverrides[projectId]) this._projectOverrides[projectId] = {};
    this._projectOverrides[projectId][kode] = overrideData;

    try {
      await setDoc(doc(db, 'projects', projectId, 'settings', 'harga_override'), {
        items: this._projectOverrides[projectId],
        updatedAt: serverTimestamp(),
        updatedBy: Auth.currentUser?.uid
      }, { merge: true });

      ActivityLog.hargaUpdate(kode,
        `global: ${Utils.formatRp(this.getHarga(kode))}`,
        `override: ${JSON.stringify(overrideData)}`
      );
      showToast('Override harga disimpan', 'success');
    } catch (err) {
      showToast('Gagal menyimpan override: ' + err.message, 'error');
    }
  },

  // ===== REMOVE PROJECT OVERRIDE =====
  async removeProjectOverride(projectId, kode) {
    if (!projectId || !window._firebaseReady) return;
    if (!this._projectOverrides[projectId]) return;
    delete this._projectOverrides[projectId][kode];

    const { db, doc, setDoc, serverTimestamp } = window._firebase;
    try {
      await setDoc(doc(db, 'projects', projectId, 'settings', 'harga_override'), {
        items: this._projectOverrides[projectId],
        updatedAt: serverTimestamp(),
        updatedBy: Auth.currentUser?.uid
      }, { merge: true });
      showToast('Override dihapus, kembali ke harga global', 'info');
    } catch (err) {
      showToast('Gagal hapus override', 'error');
    }
  },

  // ===== UPDATE GLOBAL PRICE =====
  async updateGlobal(kode, kategori, newHarga, catatan = '') {
    if (!Auth.can('update_harga')) { showToast('Tidak ada izin untuk mengubah harga', 'error'); return false; }
    if (!window._firebaseReady) return false;

    const oldHarga = this._globalHarga?.[kategori]?.[kode]?.harga || 0;
    const { db, doc, updateDoc, serverTimestamp } = window._firebase;

    try {
      // Update in memory
      if (!this._globalHarga[kategori]) this._globalHarga[kategori] = {};
      if (!this._globalHarga[kategori][kode]) this._globalHarga[kategori][kode] = { kode };
      this._globalHarga[kategori][kode].harga = Math.round(newHarga);
      if (catatan) this._globalHarga[kategori][kode].catatan = catatan;

      // Update Firestore
      await updateDoc(doc(db, 'master_harga', 'global'), {
        [`${kategori}.${kode}.harga`]: Math.round(newHarga),
        [`${kategori}.${kode}.catatan`]: catatan || '',
        updatedAt: serverTimestamp(),
        updatedBy: Auth.currentUser?.uid
      });

      ActivityLog.hargaUpdate(kode, oldHarga, Math.round(newHarga));
      return true;
    } catch (err) {
      showToast('Gagal update harga: ' + err.message, 'error');
      return false;
    }
  },

  // ===== RENDER MASTER HARGA PAGE =====
  async renderPage(containerId, projectId = null) {
    const container = document.getElementById(containerId);
    if (!container) return;

    this._activeProjectId = projectId;
    container.innerHTML = `<div class="loading-text text-center" style="padding:40px">Memuat harga...</div>`;

    await this.loadGlobal();
    if (projectId) await this.loadProjectOverrides(projectId);

    const isProject = !!projectId;
    const canEdit = Auth.can('update_harga') || (isProject && Auth.can('edit_project'));

    container.innerHTML = `
      <div class="card-header">
        <div>
          <div class="card-title">${isProject ? 'Harga Lokal Proyek' : 'Master Harga Global'}</div>
          <div class="card-subtitle">${isProject ? 'Override harga untuk proyek ini. Kosong = pakai harga global.' : 'Harga dasar berlaku untuk semua proyek.'}</div>
        </div>
        ${canEdit && !isProject ? `<button class="btn btn-primary btn-sm" onclick="MasterHarga.openAddModal()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          Tambah Bahan/Alat
        </button>` : ''}
      </div>

      <div class="harga-tabs" id="harga-tabs">
        <div class="harga-tab active" onclick="MasterHarga.switchTab('upah',this)">👷 Upah Tenaga</div>
        <div class="harga-tab" onclick="MasterHarga.switchTab('bahan',this)">🧱 Bahan & Material</div>
        <div class="harga-tab" onclick="MasterHarga.switchTab('alat',this)">⚙️ Sewa Alat</div>
      </div>

      <div class="search-bar">
        <div class="search-input-wrap">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2"/><line x1="21" y1="21" x2="16.65" y2="16.65" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          <input type="text" class="search-inp" id="harga-search" placeholder="Cari nama atau kode bahan..." oninput="MasterHarga.filterTable(this.value)">
        </div>
      </div>

      <div id="harga-table-wrap" class="table-wrap">
        ${this._renderTable('upah', projectId, canEdit)}
      </div>
    `;
    this._activeTab = 'upah';
  },

  switchTab(tab, el) {
    this._activeTab = tab;
    document.querySelectorAll('.harga-tab').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
    const wrap = document.getElementById('harga-table-wrap');
    if (wrap) wrap.innerHTML = this._renderTable(tab, this._activeProjectId, Auth.can('update_harga') || Auth.can('edit_project'));
    const search = document.getElementById('harga-search');
    if (search) search.value = '';
  },

  filterTable(q) {
    const rows = document.querySelectorAll('#harga-table-body tr');
    const ql = q.toLowerCase();
    rows.forEach(row => {
      const text = row.textContent.toLowerCase();
      row.style.display = text.includes(ql) ? '' : 'none';
    });
  },

  _renderTable(kategori, projectId, canEdit) {
    const data = this._globalHarga?.[kategori] || {};
    const items = Object.values(data).sort((a, b) => (a.kode || '').localeCompare(b.kode || ''));
    const overrides = (projectId && this._projectOverrides[projectId]) || {};

    const rows = items.map(item => {
      const override = projectId ? overrides[item.kode] : null;
      const effectiveHarga = this.getHarga(item.kode, projectId);
      const hasOverride = !!override;

      return `<tr>
        <td><code style="font-size:0.72rem;font-family:var(--font-mono);color:var(--text-muted)">${Utils.escHtml(item.kode)}</code></td>
        <td style="font-weight:500">${Utils.escHtml(item.nama)}</td>
        <td>${Utils.escHtml(item.satuan)}</td>
        <td class="td-num">
          ${hasOverride
            ? `<span style="color:var(--warning);font-weight:600">${Utils.formatRp(effectiveHarga)}</span>
               <br><small style="color:var(--text-muted);text-decoration:line-through;font-size:0.72rem">${Utils.formatRp(this.getHarga(item.kode))}</small>`
            : `<span style="font-weight:600">${Utils.formatRp(effectiveHarga)}</span>`
          }
        </td>
        <td style="font-size:0.78rem;color:var(--text-muted);max-width:180px">${Utils.escHtml(item.catatan || '')}</td>
        <td class="td-actions">
          ${hasOverride ? `<span class="badge badge-warning" style="margin-right:4px">Override</span>` : ''}
          ${canEdit ? `
            <button class="btn btn-ghost btn-icon btn-sm" onclick="MasterHarga.openEditModal('${Utils.escHtml(item.kode)}','${kategori}','${projectId || ''}')" title="Edit harga">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="2"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2"/></svg>
            </button>
            ${hasOverride ? `<button class="btn btn-ghost btn-icon btn-sm" onclick="MasterHarga.removeProjectOverride('${projectId}','${Utils.escHtml(item.kode)}')" title="Hapus override">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><polyline points="3 6 5 6 21 6" stroke="currentColor" stroke-width="2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" stroke="currentColor" stroke-width="2"/></svg>
            </button>` : ''}
          ` : ''}
        </td>
      </tr>`;
    }).join('');

    return `<table class="table">
      <thead>
        <tr>
          <th>Kode</th>
          <th>Nama</th>
          <th>Satuan</th>
          <th class="text-right">Harga (Rp)</th>
          <th>Catatan</th>
          <th class="text-center">Aksi</th>
        </tr>
      </thead>
      <tbody id="harga-table-body">${rows || '<tr><td colspan="6" class="text-center text-muted" style="padding:24px">Belum ada data</td></tr>'}</tbody>
    </table>`;
  },

  // ===== EDIT MODAL =====
  openEditModal(kode, kategori, projectId) {
    const item = this.getItem(kode);
    if (!item) return;
    const isProject = !!projectId && projectId !== '';
    const override = isProject ? this._projectOverrides[projectId]?.[kode] : null;
    const currentHarga = Math.round(item.harga || 0);

    const modeA = override?.mode === 'allin' ? 'checked' : (!override ? 'checked' : '');
    const modeB = override?.mode === 'transport' ? 'checked' : '';
    const hargaAllin = override?.harga_allin || currentHarga;
    const hargaBase = override?.harga_base || currentHarga;
    const hargaTransport = override?.harga_transport || 0;
    const catatan = override?.catatan || item.catatan || '';

    openModal({
      title: `Edit Harga: ${item.nama}`,
      size: 'modal-lg',
      body: `
        <div style="margin-bottom:16px">
          <div class="flex gap-3" style="flex-wrap:wrap;margin-bottom:12px">
            <span class="badge badge-primary">${kode}</span>
            <span class="badge badge-muted">${item.satuan}</span>
            <span class="badge badge-muted">${Utils.roleLabel(kategori === 'upah' ? 'Tenaga Kerja' : kategori === 'bahan' ? 'Bahan' : 'Alat')}</span>
          </div>
          <div style="background:var(--bg-hover);border-radius:var(--radius-sm);padding:10px 14px;font-size:0.85rem;color:var(--text-secondary)">
            Harga global saat ini: <strong style="color:var(--text-primary)">${Utils.formatRp(currentHarga)} / ${item.satuan}</strong>
            ${isProject ? '<br><span style="color:var(--text-muted);font-size:0.78rem">Harga ini akan jadi override untuk proyek ini saja.</span>' : ''}
          </div>
        </div>

        ${isProject ? `
        <div class="form-group" style="margin-bottom:16px">
          <label class="lbl">Mode Penetapan Harga</label>
          <div style="display:flex;flex-direction:column;gap:10px">
            <label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;padding:10px 12px;border:1.5px solid var(--border);border-radius:var(--radius-sm);transition:border-color 0.2s" id="mode-a-wrap">
              <input type="radio" name="harga-mode" value="allin" ${modeA} onchange="MasterHarga._toggleModeFields('allin')" style="margin-top:2px">
              <div>
                <div style="font-weight:600;font-size:0.875rem">Opsi A — Harga Langsung (All-in)</div>
                <div style="font-size:0.78rem;color:var(--text-muted)">Masukkan harga sudah termasuk ongkos kirim, PPN, PPh22, dll.</div>
              </div>
            </label>
            <label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;padding:10px 12px;border:1.5px solid var(--border);border-radius:var(--radius-sm);transition:border-color 0.2s" id="mode-b-wrap">
              <input type="radio" name="harga-mode" value="transport" ${modeB} onchange="MasterHarga._toggleModeFields('transport')" style="margin-top:2px">
              <div>
                <div style="font-weight:600;font-size:0.875rem">Opsi B — Harga Dasar + Biaya Angkut Terpisah</div>
                <div style="font-size:0.78rem;color:var(--text-muted)">Transparan untuk audit: harga bahan + biaya angkut dicatat terpisah.</div>
              </div>
            </label>
          </div>
        </div>` : ''}

        <div id="field-allin" style="display:${modeB ? 'none' : 'block'}">
          <div class="form-group">
            <label class="lbl lbl-req">Harga per ${item.satuan} (Rp)</label>
            <div class="inp-group">
              <span class="inp-group-addon">Rp</span>
              <input type="number" class="inp" id="harga-input-allin" value="${hargaAllin}" min="0" step="100" placeholder="Masukkan harga">
              <span class="inp-group-addon">/ ${Utils.escHtml(item.satuan)}</span>
            </div>
            <div class="field-hint">Sudah termasuk PPN + PPh22 jika ada</div>
          </div>
        </div>

        <div id="field-transport" style="display:${modeB ? 'block' : 'none'}">
          <div class="form-row form-row-2" style="margin-bottom:12px">
            <div class="form-group">
              <label class="lbl lbl-req">Harga Dasar / ${item.satuan} (Rp)</label>
              <div class="inp-group">
                <span class="inp-group-addon">Rp</span>
                <input type="number" class="inp" id="harga-input-base" value="${hargaBase}" min="0" step="100" oninput="MasterHarga._calcTransportTotal()">
              </div>
            </div>
            <div class="form-group">
              <label class="lbl lbl-req">Biaya Angkut / ${item.satuan} (Rp)</label>
              <div class="inp-group">
                <span class="inp-group-addon">Rp</span>
                <input type="number" class="inp" id="harga-input-transport" value="${hargaTransport}" min="0" step="100" oninput="MasterHarga._calcTransportTotal()">
              </div>
              <div class="field-hint">Misal: jarak 3-5 km, kendaraan pick-up</div>
            </div>
          </div>
          <div style="background:var(--primary-surface);border:1px solid var(--primary-border);border-radius:var(--radius-sm);padding:10px 14px;font-size:0.875rem">
            Total harga pakai: <strong id="transport-total" style="color:var(--primary)">${Utils.formatRp(hargaBase + hargaTransport)}</strong>
          </div>
        </div>

        <div class="form-group" style="margin-top:14px">
          <label class="lbl">Catatan (opsional)</label>
          <input type="text" class="inp" id="harga-catatan" value="${Utils.escHtml(catatan)}" placeholder="Misal: harga sudah termasuk PPN 11% + PPh22 1.5%">
        </div>
      `,
      footer: `
        <button class="btn btn-ghost" onclick="closeModal()">Batal</button>
        <button class="btn btn-primary" onclick="MasterHarga._saveEdit('${kode}','${kategori}','${projectId || ''}')">Simpan</button>
      `
    });
  },

  _toggleModeFields(mode) {
    document.getElementById('field-allin').style.display = mode === 'allin' ? 'block' : 'none';
    document.getElementById('field-transport').style.display = mode === 'transport' ? 'block' : 'none';
  },

  _calcTransportTotal() {
    const base = parseFloat(document.getElementById('harga-input-base')?.value) || 0;
    const transport = parseFloat(document.getElementById('harga-input-transport')?.value) || 0;
    const total = document.getElementById('transport-total');
    if (total) total.textContent = Utils.formatRp(base + transport);
  },

  async _saveEdit(kode, kategori, projectId) {
    const isProject = !!projectId && projectId !== '';
    const catatan = document.getElementById('harga-catatan')?.value || '';

    if (isProject) {
      const mode = document.querySelector('input[name="harga-mode"]:checked')?.value || 'allin';
      let overrideData = { mode, catatan };

      if (mode === 'allin') {
        const h = parseFloat(document.getElementById('harga-input-allin')?.value) || 0;
        if (h <= 0) { showToast('Harga harus lebih dari 0', 'error'); return; }
        overrideData.harga_allin = Math.round(h);
      } else {
        const base = parseFloat(document.getElementById('harga-input-base')?.value) || 0;
        const transport = parseFloat(document.getElementById('harga-input-transport')?.value) || 0;
        if (base <= 0) { showToast('Harga dasar harus lebih dari 0', 'error'); return; }
        overrideData.harga_base = Math.round(base);
        overrideData.harga_transport = Math.round(transport);
      }
      await this.saveProjectOverride(projectId, kode, overrideData);
    } else {
      const h = parseFloat(document.getElementById('harga-input-allin')?.value) || 0;
      if (h <= 0) { showToast('Harga harus lebih dari 0', 'error'); return; }
      const ok = await this.updateGlobal(kode, kategori, Math.round(h), catatan);
      if (!ok) return;
      showToast('Harga global diperbarui', 'success');
    }

    closeModal();
    // Re-render table
    const wrap = document.getElementById('harga-table-wrap');
    if (wrap) wrap.innerHTML = this._renderTable(this._activeTab, this._activeProjectId, true);
  },

  openAddModal() {
    openModal({
      title: 'Tambah Item Harga',
      body: `
        <div class="form-row form-row-2">
          <div class="form-group">
            <label class="lbl lbl-req">Kode</label>
            <input type="text" class="inp" id="new-kode" placeholder="M.XX.00 / E.XX" style="text-transform:uppercase">
          </div>
          <div class="form-group">
            <label class="lbl lbl-req">Kategori</label>
            <select class="sel" id="new-kategori">
              <option value="bahan">Bahan & Material</option>
              <option value="alat">Sewa Alat</option>
              <option value="upah">Upah Tenaga</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="lbl lbl-req">Nama</label>
          <input type="text" class="inp" id="new-nama" placeholder="Nama bahan/alat/tenaga">
        </div>
        <div class="form-row form-row-2">
          <div class="form-group">
            <label class="lbl lbl-req">Satuan</label>
            <input type="text" class="inp" id="new-satuan" placeholder="m³, kg, OH, Jam, dll">
          </div>
          <div class="form-group">
            <label class="lbl lbl-req">Harga (Rp)</label>
            <div class="inp-group">
              <span class="inp-group-addon">Rp</span>
              <input type="number" class="inp" id="new-harga" min="0" step="100" placeholder="0">
            </div>
          </div>
        </div>
        <div class="form-group">
          <label class="lbl">Catatan</label>
          <input type="text" class="inp" id="new-catatan" placeholder="Keterangan tambahan...">
        </div>
      `,
      footer: `
        <button class="btn btn-ghost" onclick="closeModal()">Batal</button>
        <button class="btn btn-primary" onclick="MasterHarga._saveNew()">Tambah</button>
      `
    });
  },

  async _saveNew() {
    const kode = (document.getElementById('new-kode')?.value || '').trim().toUpperCase();
    const kategori = document.getElementById('new-kategori')?.value;
    const nama = (document.getElementById('new-nama')?.value || '').trim();
    const satuan = (document.getElementById('new-satuan')?.value || '').trim();
    const harga = parseFloat(document.getElementById('new-harga')?.value) || 0;
    const catatan = (document.getElementById('new-catatan')?.value || '').trim();

    if (!kode || !nama || !satuan) { showToast('Kode, nama, dan satuan wajib diisi', 'error'); return; }
    if (this._globalHarga?.[kategori]?.[kode]) { showToast('Kode sudah ada', 'error'); return; }

    const { db, doc, updateDoc, serverTimestamp } = window._firebase;
    const newItem = { kode, nama, satuan, harga: Math.round(harga), catatan };

    try {
      if (!this._globalHarga[kategori]) this._globalHarga[kategori] = {};
      this._globalHarga[kategori][kode] = newItem;

      await updateDoc(doc(db, 'master_harga', 'global'), {
        [`${kategori}.${kode}`]: newItem,
        updatedAt: serverTimestamp()
      });

      ActivityLog.create('master_harga', kode, nama, `Tambah ${kategori} baru`);
      showToast('Item berhasil ditambahkan', 'success');
      closeModal();
      const wrap = document.getElementById('harga-table-wrap');
      if (wrap) wrap.innerHTML = this._renderTable(kategori, null, true);
    } catch (err) {
      showToast('Gagal menambah: ' + err.message, 'error');
    }
  }
};

window.MasterHarga = MasterHarga;
