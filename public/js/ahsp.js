/* ============================================================
   e-RAB Desa v1.0 — ahsp.js
   AHSP Library: Standard PUPR (locked) + Custom (editable)
   ============================================================ */

'use strict';

const AHSP = {
  _standardData: null,  // from JSON (PUPR standard, locked)
  _customItems: {},     // from Firestore (user custom)
  _allItems: null,      // merged cache

  // ===== LOAD STANDARD FROM JSON =====
  async loadStandard() {
    if (this._standardData) return this._standardData;
    const data = await MasterHarga.loadDefault();
    this._standardData = data;
    return data;
  },

  // ===== LOAD CUSTOM FROM FIRESTORE =====
  async loadCustom() {
    if (!window._firebaseReady) return {};
    const { db, collection, getDocs } = window._firebase;
    try {
      const snap = await getDocs(collection(db, 'ahsp_custom'));
      this._customItems = {};
      snap.forEach(d => { this._customItems[d.id] = { id: d.id, ...d.data() }; });
      return this._customItems;
    } catch (err) {
      console.warn('Load AHSP custom error:', err);
      return {};
    }
  },

  // ===== GET ALL ITEMS (merged) =====
  async getAll() {
    if (this._allItems) return this._allItems;
    await this.loadStandard();
    await this.loadCustom();
    this._allItems = this._buildMerged();
    return this._allItems;
  },

  _buildMerged() {
    const result = [];
    if (this._standardData?.kelompok) {
      this._standardData.kelompok.forEach(kelompok => {
        kelompok.items.forEach(item => {
          result.push({ ...item, kelompok_id: kelompok.id, kelompok_nama: kelompok.nama, kelompok_warna: kelompok.warna, sumber: 'standard', locked: true });
        });
      });
    }
    Object.values(this._customItems).forEach(item => {
      result.push({ ...item, sumber: 'custom', locked: false });
    });
    return result;
  },

  // ===== GET BY ID =====
  async getById(id) {
    const all = await this.getAll();
    return all.find(item => item.id === id) || null;
  },

  // ===== GET BY KELOMPOK =====
  async getByKelompok(kelompokId) {
    const all = await this.getAll();
    return all.filter(item => item.kelompok_id === kelompokId);
  },

  // ===== CALCULATE HSP (Harga Satuan Pekerjaan) =====
  // Returns full breakdown of costs
  calcHSP(ahspItem, projectId = null, overheadPct = 15) {
    if (!ahspItem?.komponen) return null;

    const { upah: upahKomp = [], bahan: bahanKomp = [], alat: alatKomp = [] } = ahspItem.komponen;

    // Calculate each component
    const calcComponents = (komps) => {
      return komps.map(k => {
        const hsdPerSatuan = MasterHarga.getHarga(k.kode, projectId);
        const jumlah = Math.round((Number(k.koefisien) || 0) * hsdPerSatuan);
        return { ...k, hsd: hsdPerSatuan, jumlah };
      });
    };

    const upahDetail = calcComponents(upahKomp);
    const bahanDetail = calcComponents(bahanKomp);
    const alatDetail = calcComponents(alatKomp);

    const totalUpah = upahDetail.reduce((s, i) => s + i.jumlah, 0);
    const totalBahan = bahanDetail.reduce((s, i) => s + i.jumlah, 0);
    const totalAlat = alatDetail.reduce((s, i) => s + i.jumlah, 0);

    const biayaLangsung = totalUpah + totalBahan + totalAlat;
    const overhead = Math.round(biayaLangsung * (overheadPct / 100));
    const hsp = biayaLangsung + overhead;

    return {
      upah: upahDetail, bahan: bahanDetail, alat: alatDetail,
      totalUpah, totalBahan, totalAlat,
      biayaLangsung, overhead, overheadPct, hsp
    };
  },

  // ===== SAVE CUSTOM =====
  async saveCustom(item) {
    if (!Auth.can('create_ahsp_custom') && !Auth.can('edit_ahsp_custom')) {
      showToast('Tidak ada izin mengelola AHSP Custom', 'error');
      return null;
    }
    if (!window._firebaseReady) return null;

    const { db, doc, setDoc, serverTimestamp } = window._firebase;
    const id = item.id || Utils.uid('CUSTOM-');
    const data = {
      ...item,
      id,
      sumber: 'custom',
      locked: false,
      createdBy: Auth.currentUser?.uid,
      updatedBy: Auth.currentUser?.uid,
      updatedAt: serverTimestamp()
    };
    if (!item.id) data.createdAt = serverTimestamp();

    try {
      await setDoc(doc(db, 'ahsp_custom', id), data, { merge: true });
      this._customItems[id] = { ...data };
      this._allItems = null; // invalidate cache
      if (item.id) {
        ActivityLog.log({ type: ActivityLog.TYPES.AHSP_EDIT, entity: 'ahsp_custom', entityId: id, entityName: item.nama });
      } else {
        ActivityLog.log({ type: ActivityLog.TYPES.AHSP_CREATE, entity: 'ahsp_custom', entityId: id, entityName: item.nama });
      }
      return id;
    } catch (err) {
      showToast('Gagal simpan AHSP: ' + err.message, 'error');
      return null;
    }
  },

  // ===== DELETE CUSTOM =====
  async deleteCustom(id) {
    if (!Auth.can('create_ahsp_custom')) { showToast('Tidak ada izin', 'error'); return false; }
    if (!window._firebaseReady) return false;

    const { db, doc, deleteDoc } = window._firebase;
    try {
      const name = this._customItems[id]?.nama || id;
      await deleteDoc(doc(db, 'ahsp_custom', id));
      delete this._customItems[id];
      this._allItems = null;
      ActivityLog.delete('ahsp_custom', id, name);
      showToast('AHSP Custom dihapus', 'success');
      return true;
    } catch (err) {
      showToast('Gagal hapus: ' + err.message, 'error');
      return false;
    }
  },

  // ===== RENDER LIBRARY PAGE =====
  async renderPage(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `<div class="loading-text text-center" style="padding:40px">Memuat library AHSP...</div>`;
    await this.getAll();

    const canManage = Auth.can('create_ahsp_custom');
    const kelompoks = this._standardData?.kelompok || [];

    container.innerHTML = `
      <div class="card-header">
        <div>
          <div class="card-title">Library AHSP</div>
          <div class="card-subtitle">Analisis Harga Satuan Pekerjaan — Permen PUPR No.8/2023 + Lampiran IV</div>
        </div>
        ${canManage ? `<button class="btn btn-primary btn-sm" onclick="AHSP.openCustomModal()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          AHSP Custom
        </button>` : ''}
      </div>

      <div class="search-bar">
        <div class="search-input-wrap">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2"/><line x1="21" y1="21" x2="16.65" y2="16.65" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          <input type="text" class="search-inp" id="ahsp-search" placeholder="Cari nama pekerjaan atau kode..." oninput="AHSP.filterLibrary(this.value)">
        </div>
        <select class="sel" id="ahsp-filter-kelompok" style="width:auto;min-width:160px" onchange="AHSP.filterLibrary(document.getElementById('ahsp-search').value)">
          <option value="">Semua Kelompok</option>
          ${kelompoks.map(k => `<option value="${k.id}">${k.nama}</option>`).join('')}
          <option value="custom">Custom</option>
        </select>
      </div>

      <div id="ahsp-list">
        ${this._renderLibraryList()}
      </div>
    `;
  },

  _renderLibraryList(filter = '', kelompokFilter = '') {
    const all = this._allItems || [];
    const fl = filter.toLowerCase();

    const filtered = all.filter(item => {
      const matchText = !fl || item.nama?.toLowerCase().includes(fl) || item.kode?.toLowerCase().includes(fl);
      const matchKelompok = !kelompokFilter
        || (kelompokFilter === 'custom' && item.sumber === 'custom')
        || item.kelompok_id === kelompokFilter;
      return matchText && matchKelompok;
    });

    if (!filtered.length) {
      return `<div class="empty-state">
        <svg class="empty-state-icon" width="40" height="40" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2"/><line x1="21" y1="21" x2="16.65" y2="16.65" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        <div class="empty-state-title">Tidak ditemukan</div>
        <div class="empty-state-sub">Coba kata kunci lain</div>
      </div>`;
    }

    // Group by kelompok
    const groups = {};
    filtered.forEach(item => {
      const gid = item.sumber === 'custom' ? 'custom' : item.kelompok_id;
      const gname = item.sumber === 'custom' ? 'AHSP Custom' : item.kelompok_nama;
      const gcolor = item.sumber === 'custom' ? '#757575' : item.kelompok_warna;
      if (!groups[gid]) groups[gid] = { nama: gname, warna: gcolor, items: [] };
      groups[gid].items.push(item);
    });

    return Object.entries(groups).map(([gid, group]) => `
      <div class="card" style="margin-bottom:12px">
        <div class="card-header" style="cursor:pointer" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none'">
          <div class="card-title" style="display:flex;align-items:center;gap:8px">
            <span style="width:10px;height:10px;border-radius:50%;background:${group.warna};display:inline-block;flex-shrink:0"></span>
            ${Utils.escHtml(group.nama)}
            <span class="badge badge-muted">${group.items.length} item</span>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style="color:var(--text-muted)"><polyline points="6 9 12 15 18 9" stroke="currentColor" stroke-width="2"/></svg>
        </div>
        <div style="overflow:auto">
          <table class="table" style="min-width:600px">
            <thead><tr>
              <th style="width:110px">Kode</th>
              <th>Uraian Pekerjaan</th>
              <th style="width:70px">Satuan</th>
              <th style="width:80px">Sumber</th>
              <th class="text-center" style="width:120px">Aksi</th>
            </tr></thead>
            <tbody>
              ${group.items.map(item => `
                <tr>
                  <td><code style="font-size:0.72rem;font-family:var(--font-mono);color:var(--text-muted)">${Utils.escHtml(item.kode || '')}</code></td>
                  <td style="font-weight:500">${Utils.escHtml(item.nama)}
                    ${item.mutu_fc ? `<span class="badge badge-primary" style="margin-left:4px">f'c ${item.mutu_fc} MPa / K-${item.mutu_k || Utils.fcToK(item.mutu_fc)}</span>` : ''}
                  </td>
                  <td>${Utils.escHtml(item.satuan)}</td>
                  <td>
                    ${item.locked
                      ? '<span class="badge badge-info">PUPR</span>'
                      : '<span class="badge badge-warning">Custom</span>'}
                  </td>
                  <td class="td-actions">
                    <button class="btn btn-ghost btn-icon btn-sm" onclick="AHSP.showDetail('${item.id}')" title="Lihat detail koefisien">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/></svg>
                    </button>
                    ${!item.locked && Auth.can('edit_ahsp_custom') ? `
                      <button class="btn btn-ghost btn-icon btn-sm" onclick="AHSP.openCustomModal('${item.id}')" title="Edit">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="2"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2"/></svg>
                      </button>
                      <button class="btn btn-ghost btn-icon btn-sm" onclick="AHSP.confirmDelete('${item.id}')" title="Hapus">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><polyline points="3 6 5 6 21 6" stroke="currentColor" stroke-width="2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" stroke="currentColor" stroke-width="2"/></svg>
                      </button>
                    ` : item.locked && Auth.can('create_ahsp_custom') ? `
                      <button class="btn btn-ghost btn-icon btn-sm" onclick="AHSP.cloneAsCustom('${item.id}')" title="Salin sebagai Custom">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" stroke="currentColor" stroke-width="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" stroke-width="2"/></svg>
                      </button>
                    ` : ''}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `).join('');
  },

  filterLibrary(q) {
    const kelompok = document.getElementById('ahsp-filter-kelompok')?.value || '';
    const listEl = document.getElementById('ahsp-list');
    if (listEl) listEl.innerHTML = this._renderLibraryList(q, kelompok);
  },

  // ===== DETAIL MODAL =====
  async showDetail(id) {
    const item = await this.getById(id);
    if (!item) return;

    const hsp = this.calcHSP(item, null, 15);
    if (!hsp) { showToast('Gagal kalkulasi AHSP', 'error'); return; }

    const renderCompRows = (comps, label) => {
      if (!comps?.length) return '';
      const rows = comps.map(c => `
        <tr>
          <td style="font-size:0.8rem"><code style="font-size:0.7rem;color:var(--text-muted)">${Utils.escHtml(c.kode)}</code><br>${Utils.escHtml(c.nama)}</td>
          <td class="td-num">${Utils.formatKoef(c.koefisien)} ${Utils.escHtml(c.satuan)}</td>
          <td class="td-num">${Utils.formatRp(c.hsd)}</td>
          <td class="td-num" style="font-weight:600">${Utils.formatRp(c.jumlah)}</td>
        </tr>
      `).join('');
      return `<tr style="background:var(--bg-hover)"><td colspan="4" style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--text-muted);padding:8px 14px">${label}</td></tr>${rows}`;
    };

    openModal({
      title: 'Detail AHSP',
      size: 'modal-lg',
      body: `
        <div style="margin-bottom:16px">
          <div style="font-size:1rem;font-weight:700;color:var(--text-primary)">${Utils.escHtml(item.nama)}</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">
            <span class="badge badge-muted">${Utils.escHtml(item.kode || '')}</span>
            <span class="badge badge-muted">per ${Utils.escHtml(item.satuan)}</span>
            ${item.mutu_fc ? `<span class="badge badge-primary">f'c ${item.mutu_fc} MPa ≈ K-${item.mutu_k || Utils.fcToK(item.mutu_fc)}</span>` : ''}
            ${item.locked ? '<span class="badge badge-info">Standar PUPR</span>' : '<span class="badge badge-warning">Custom</span>'}
          </div>
          ${item.catatan_konversi ? `<div style="margin-top:8px;background:var(--info-surface);border-radius:var(--radius-sm);padding:8px 12px;font-size:0.78rem;color:var(--info)">${Utils.escHtml(item.catatan_konversi)}</div>` : ''}
        </div>

        <div class="table-wrap" style="margin-bottom:16px">
          <table class="table">
            <thead><tr>
              <th>Komponen</th>
              <th class="text-right">Koefisien</th>
              <th class="text-right">HSD (Rp)</th>
              <th class="text-right">Jumlah (Rp)</th>
            </tr></thead>
            <tbody>
              ${renderCompRows(hsp.upah, 'A. Upah Tenaga Kerja')}
              <tr style="background:var(--primary-surface)"><td colspan="3" style="font-weight:600;font-size:0.82rem">Jumlah A</td><td class="td-num" style="font-weight:700">${Utils.formatRp(hsp.totalUpah)}</td></tr>
              ${renderCompRows(hsp.bahan, 'B. Bahan & Material')}
              <tr style="background:var(--primary-surface)"><td colspan="3" style="font-weight:600;font-size:0.82rem">Jumlah B</td><td class="td-num" style="font-weight:700">${Utils.formatRp(hsp.totalBahan)}</td></tr>
              ${renderCompRows(hsp.alat, 'C. Peralatan & Alat')}
              <tr style="background:var(--primary-surface)"><td colspan="3" style="font-weight:600;font-size:0.82rem">Jumlah C</td><td class="td-num" style="font-weight:700">${Utils.formatRp(hsp.totalAlat)}</td></tr>
              <tr style="background:var(--accent-surface)"><td colspan="3" style="font-weight:700">D. Jumlah Biaya Langsung (A+B+C)</td><td class="td-num" style="font-weight:800">${Utils.formatRp(hsp.biayaLangsung)}</td></tr>
              <tr><td colspan="3" style="font-size:0.82rem;color:var(--text-secondary)">E. Biaya Tidak Langsung (Overhead ${hsp.overheadPct}% × D)</td><td class="td-num">${Utils.formatRp(hsp.overhead)}</td></tr>
              <tr style="background:var(--primary);color:#fff"><td colspan="3" style="font-weight:800">F. HARGA SATUAN PEKERJAAN (D+E)</td><td class="td-num" style="font-weight:800;font-size:1rem">${Utils.formatRp(hsp.hsp)}</td></tr>
            </tbody>
          </table>
        </div>
        <div style="font-size:0.75rem;color:var(--text-muted)">* HSD menggunakan harga master global. Harga dapat berbeda per proyek jika ada override.</div>
      `,
      footer: `<button class="btn btn-primary" onclick="closeModal()">Tutup</button>`
    });
  },

  // ===== CLONE AS CUSTOM =====
  async cloneAsCustom(id) {
    const item = await this.getById(id);
    if (!item) return;
    const clone = Utils.clone(item);
    delete clone.id;
    clone.nama = clone.nama + ' (Custom)';
    clone.sumber = 'custom';
    clone.locked = false;
    this.openCustomModal(null, clone);
  },

  // ===== CUSTOM MODAL =====
  async openCustomModal(editId = null, prefill = null) {
    let existing = null;
    if (editId) {
      existing = await this.getById(editId);
      if (!existing) return;
    }

    const data = prefill || existing || {};
    const kelompoks = this._standardData?.kelompok || [];

    openModal({
      title: editId ? 'Edit AHSP Custom' : 'Buat AHSP Custom',
      size: 'modal-xl',
      body: `
        <div class="form-row form-row-2" style="margin-bottom:12px">
          <div class="form-group">
            <label class="lbl lbl-req">Nama Pekerjaan</label>
            <input type="text" class="inp" id="custom-nama" value="${Utils.escHtml(data.nama || '')}" placeholder="Contoh: Pasangan Batu Kali 1:3">
          </div>
          <div class="form-group">
            <label class="lbl lbl-req">Kode</label>
            <input type="text" class="inp" id="custom-kode" value="${Utils.escHtml(data.kode || '')}" placeholder="CUSTOM-01" style="text-transform:uppercase">
          </div>
        </div>
        <div class="form-row form-row-3" style="margin-bottom:16px">
          <div class="form-group">
            <label class="lbl lbl-req">Satuan</label>
            <input type="text" class="inp" id="custom-satuan" value="${Utils.escHtml(data.satuan || '')}" placeholder="m², m³, m', buah">
          </div>
          <div class="form-group">
            <label class="lbl lbl-req">Kelompok</label>
            <select class="sel" id="custom-kelompok">
              <option value="custom">Custom</option>
              ${kelompoks.map(k => `<option value="${k.id}" ${data.kelompok_id === k.id ? 'selected' : ''}>${k.nama}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="lbl">Catatan</label>
            <input type="text" class="inp" id="custom-catatan" value="${Utils.escHtml(data.catatan || '')}" placeholder="Keterangan tambahan">
          </div>
        </div>

        <div id="custom-components">
          ${this._renderCustomComponents(data.komponen)}
        </div>
      `,
      footer: `
        <button class="btn btn-ghost" onclick="closeModal()">Batal</button>
        <button class="btn btn-primary" onclick="AHSP._saveCustomForm('${editId || ''}')">
          ${editId ? 'Simpan Perubahan' : 'Buat AHSP'}
        </button>
      `
    });
  },

  _renderCustomComponents(komponen) {
    const upah = komponen?.upah || [{}];
    const bahan = komponen?.bahan || [{}];
    const alat = komponen?.alat || [];

    const renderRows = (items, cat) => items.map((item, i) => `
      <tr id="row-${cat}-${i}">
        <td><input type="text" class="inp" data-cat="${cat}" data-field="kode" data-i="${i}" value="${Utils.escHtml(item.kode || '')}" placeholder="L.01/M.xx" style="font-family:var(--font-mono);font-size:0.82rem"></td>
        <td><input type="text" class="inp" data-cat="${cat}" data-field="nama" data-i="${i}" value="${Utils.escHtml(item.nama || '')}" placeholder="Nama komponen"></td>
        <td><input type="text" class="inp" data-cat="${cat}" data-field="satuan" data-i="${i}" value="${Utils.escHtml(item.satuan || '')}" placeholder="OH/m³/kg"></td>
        <td><input type="number" class="inp" data-cat="${cat}" data-field="koefisien" data-i="${i}" value="${item.koefisien || ''}" placeholder="0.000" step="0.0001" min="0"></td>
        <td><button type="button" class="btn btn-ghost btn-icon btn-sm" onclick="AHSP._removeCompRow('${cat}',${i})" title="Hapus">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button></td>
      </tr>
    `).join('');

    const tableFor = (cat, label, icon, items) => `
      <div style="margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <div style="font-size:0.8rem;font-weight:700;color:var(--text-secondary)">${icon} ${label}</div>
          <button type="button" class="btn btn-ghost btn-sm" onclick="AHSP._addCompRow('${cat}')">+ Tambah Baris</button>
        </div>
        <div class="table-wrap">
          <table class="table" style="min-width:500px">
            <thead><tr><th>Kode</th><th>Nama</th><th>Satuan</th><th>Koefisien</th><th></th></tr></thead>
            <tbody id="tbody-${cat}">${renderRows(items, cat)}</tbody>
          </table>
        </div>
      </div>
    `;

    return tableFor('upah', 'A. Upah Tenaga Kerja', '👷', upah)
      + tableFor('bahan', 'B. Bahan & Material', '🧱', bahan)
      + tableFor('alat', 'C. Peralatan & Alat', '⚙️', alat);
  },

  _addCompRow(cat) {
    const tbody = document.getElementById(`tbody-${cat}`);
    if (!tbody) return;
    const i = tbody.querySelectorAll('tr').length;
    const tr = document.createElement('tr');
    tr.id = `row-${cat}-${i}`;
    tr.innerHTML = `
      <td><input type="text" class="inp" data-cat="${cat}" data-field="kode" data-i="${i}" placeholder="Kode" style="font-family:var(--font-mono);font-size:0.82rem"></td>
      <td><input type="text" class="inp" data-cat="${cat}" data-field="nama" data-i="${i}" placeholder="Nama"></td>
      <td><input type="text" class="inp" data-cat="${cat}" data-field="satuan" data-i="${i}" placeholder="Satuan"></td>
      <td><input type="number" class="inp" data-cat="${cat}" data-field="koefisien" data-i="${i}" placeholder="0.000" step="0.0001" min="0"></td>
      <td><button type="button" class="btn btn-ghost btn-icon btn-sm" onclick="AHSP._removeCompRow('${cat}',${i})"><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button></td>
    `;
    tbody.appendChild(tr);
  },

  _removeCompRow(cat, i) {
    document.getElementById(`row-${cat}-${i}`)?.remove();
  },

  _collectCompRows(cat) {
    const rows = [];
    document.querySelectorAll(`#tbody-${cat} tr`).forEach(tr => {
      const kode = tr.querySelector('[data-field="kode"]')?.value?.trim();
      const nama = tr.querySelector('[data-field="nama"]')?.value?.trim();
      const satuan = tr.querySelector('[data-field="satuan"]')?.value?.trim();
      const koefisien = parseFloat(tr.querySelector('[data-field="koefisien"]')?.value) || 0;
      if (kode || nama) rows.push({ kode: kode || '', nama: nama || '', satuan: satuan || '', koefisien });
    });
    return rows;
  },

  async _saveCustomForm(editId) {
    const nama = document.getElementById('custom-nama')?.value?.trim();
    const kode = document.getElementById('custom-kode')?.value?.trim().toUpperCase();
    const satuan = document.getElementById('custom-satuan')?.value?.trim();
    const kelompok_id = document.getElementById('custom-kelompok')?.value || 'custom';
    const catatan = document.getElementById('custom-catatan')?.value?.trim();

    if (!nama || !satuan) { showToast('Nama dan satuan wajib diisi', 'error'); return; }

    const komponen = {
      upah: this._collectCompRows('upah').filter(r => r.kode),
      bahan: this._collectCompRows('bahan').filter(r => r.kode),
      alat: this._collectCompRows('alat').filter(r => r.kode)
    };

    const kelompok = this._standardData?.kelompok?.find(k => k.id === kelompok_id);
    const item = {
      id: editId || undefined,
      nama, kode, satuan, catatan,
      kelompok_id: kelompok_id === 'custom' ? 'custom' : kelompok_id,
      kelompok_nama: kelompok?.nama || 'Custom',
      kelompok_warna: kelompok?.warna || '#757575',
      komponen
    };

    const saved = await this.saveCustom(item);
    if (saved) {
      closeModal();
      showToast(editId ? 'AHSP Custom diperbarui' : 'AHSP Custom dibuat', 'success');
      const listEl = document.getElementById('ahsp-list');
      if (listEl) listEl.innerHTML = this._renderLibraryList();
    }
  },

  confirmDelete(id) {
    openModal({
      title: 'Hapus AHSP Custom',
      body: `<p style="color:var(--text-secondary)">Apakah Anda yakin ingin menghapus AHSP Custom ini? Tindakan ini tidak dapat dibatalkan.</p>`,
      footer: `
        <button class="btn btn-ghost" onclick="closeModal()">Batal</button>
        <button class="btn btn-danger" onclick="AHSP._doDelete('${id}')">Hapus</button>
      `
    });
  },

  async _doDelete(id) {
    closeModal();
    const ok = await this.deleteCustom(id);
    if (ok) {
      const listEl = document.getElementById('ahsp-list');
      if (listEl) listEl.innerHTML = this._renderLibraryList();
    }
  }
};

window.AHSP = AHSP;
