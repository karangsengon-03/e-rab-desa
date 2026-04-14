/* ============================================================
   e-RAB Desa v1.2 — master-harga.js
   Master Harga dengan Dual Satuan Semen (kg/sak) yang lebih bersih
   ============================================================ */

'use strict';

const MasterHarga = {
  _data: null,
  _globalUpah:  [],
  _globalBahan: [],
  _globalAlat:  [],
  _loaded: false,
  _projectOverrides: {},
  _activeTab: 'bahan',
  _activeProjectId: null,

  // Load default dari JSON
  async loadDefault() {
    if (this._data) return this._data;
    try {
      const res = await fetch('data/ahsp-data.json');
      this._data = await res.json();
      return this._data;
    } catch (err) {
      console.error('loadDefault error:', err);
      return null;
    }
  },

  // Load global dari Firestore
  async loadGlobal(forceRefresh = false) {
    if (this._loaded && !forceRefresh) return true;
    if (!window._firebaseReady) return false;

    const { db, doc, getDoc } = window._firebase;
    try {
      const snap = await getDoc(doc(db, 'master_harga', 'global'));
      if (snap.exists()) {
        const d = snap.data();
        this._globalUpah  = this._toArray(d.upah);
        this._globalBahan = this._toArray(d.bahan);
        this._globalAlat  = this._toArray(d.alat);
        this._loaded = true;
        return true;
      }
      await this.seedFromDefault();
      return true;
    } catch (err) {
      console.error('loadGlobal error:', err);
      return false;
    }
  },

  _toArray(data) {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    return Object.entries(data).map(([kode, v]) => ({
      kode, 
      nama: v.nama || kode, 
      satuan: v.satuan || '',
      harga: Math.round(v.harga || 0),
      catatan: v.catatan || '',
      harga_per_sak: v.harga_per_sak || null,
      kg_per_sak: v.kg_per_sak || null
    }));
  },

  async seedFromDefault() {
    const data = await this.loadDefault();
    if (!data) return;
    const def = data.master_harga_default;
    this._globalUpah  = def.upah  || [];
    this._globalBahan = def.bahan || [];
    this._globalAlat  = def.alat  || [];

    const { db, doc, setDoc, serverTimestamp } = window._firebase;
    await setDoc(doc(db, 'master_harga', 'global'), {
      upah: this._globalUpah,
      bahan: this._globalBahan,
      alat: this._globalAlat,
      updatedAt: serverTimestamp(),
      seeded: true
    });
    this._loaded = true;
  },

  _getArr(k) {
    if (k === 'upah')  return this._globalUpah;
    if (k === 'bahan') return this._globalBahan;
    if (k === 'alat')  return this._globalAlat;
    return [];
  },

  // Ambil harga efektif
  getHarga(kode, projectId = null) {
    // Project override
    if (projectId && this._projectOverrides[projectId]) {
      const ov = this._projectOverrides[projectId][kode];
      if (ov) {
        if (ov.mode === 'allin') return Math.round(ov.harga_allin || 0);
        if (ov.mode === 'transport') return Math.round((ov.harga_base || 0) + (ov.harga_transport || 0));
      }
    }

    // Global
    for (const arr of [this._globalUpah, this._globalBahan, this._globalAlat]) {
      const it = arr.find(i => i.kode === kode);
      if (it) return Math.round(it.harga || 0);
    }
    return 0;
  },

  getItem(kode) {
    for (const [k, arr] of [['upah', this._globalUpah], ['bahan', this._globalBahan], ['alat', this._globalAlat]]) {
      const it = arr.find(i => i.kode === kode);
      if (it) return { ...it, kategori: k };
    }
    return null;
  },

  // Save ke Firestore
  async _save(kategori) {
    if (!window._firebaseReady) return false;
    const { db, doc, updateDoc, serverTimestamp } = window._firebase;
    try {
      await updateDoc(doc(db, 'master_harga', 'global'), {
        [kategori]: this._getArr(kategori),
        updatedAt: serverTimestamp(),
        updatedBy: Auth.currentUser?.uid
      });
      return true;
    } catch (err) {
      showToast('Gagal simpan: ' + err.message, 'error');
      return false;
    }
  },

  // Update harga global
  async updateGlobal(kode, kategori, newHarga, catatan = '') {
    if (!Auth.can('update_harga')) { showToast('Tidak ada izin', 'error'); return false; }

    const arr = this._getArr(kategori);
    const idx = arr.findIndex(i => i.kode === kode);
    if (idx < 0) return false;

    const oldH = arr[idx].harga;
    arr[idx].harga = Math.round(newHarga);
    if (catatan) arr[idx].catatan = catatan;

    // Khusus semen: simpan juga harga per sak
    if (kode === 'M01a_kg') {
      arr[idx].harga_per_sak = Math.round(newHarga * 40);
      arr[idx].kg_per_sak = 40;
    }

    const ok = await this._save(kategori);
    if (!ok) {
      arr[idx].harga = oldH;
      return false;
    }
    return true;
  },

  // Render tabel harga (sudah diperbaiki tampilan semen)
  _renderTable(kat, projectId, canEdit) {
    const items = this._getArr(kat);
    const ovs = (projectId && this._projectOverrides[projectId]) || {};

    const rows = items.map(it => {
      const ov = projectId ? ovs[it.kode] : null;
      const eff = this.getHarga(it.kode, projectId);
      const isSemen = it.kode === 'M01a_kg';

      let satuanDisplay = it.satuan;
      if (isSemen) satuanDisplay = 'sak (40 kg)';

      return `<tr>
        <td><code>${Utils.escHtml(it.kode)}</code></td>
        <td>${Utils.escHtml(it.nama)}${it.catatan ? `<br><small style="color:var(--text-muted)">${Utils.escHtml(it.catatan)}</small>` : ''}</td>
        <td>${Utils.escHtml(satuanDisplay)}</td>
        <td class="td-num">${Utils.formatRp(eff)}</td>
        <td class="td-actions">
          ${canEdit ? `
            <button class="btn btn-ghost btn-icon btn-sm" onclick="MasterHarga.openEditModal('${Utils.escHtml(it.kode)}','${kat}','${projectId||''}')">✏️</button>
          ` : ''}
        </td>
      </tr>`;
    }).join('');

    return `<table class="table">
      <thead><tr><th>Kode</th><th>Nama</th><th>Satuan</th><th class="text-right">Harga (Rp)</th><th>Aksi</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  },

  // Edit modal khusus semen (dual satuan)
  openEditModal(kode, kat, projectId) {
    const it = this.getItem(kode);
    if (!it) return;

    const isSemen = kode === 'M01a_kg';
    const hargaKg = it.harga || 0;
    const hargaSak = isSemen ? Math.round(hargaKg * 40) : 0;

    openModal({
      title: `Edit Harga: ${Utils.escHtml(it.nama)}`,
      size: 'modal-lg',
      body: `
        <div style="background:var(--bg-hover);padding:12px;border-radius:8px;margin-bottom:16px">
          <strong>${Utils.escHtml(it.nama)}</strong> — Kode: <code>${kode}</code>
        </div>

        ${isSemen ? `
        <div style="background:#e3f2fd;padding:12px;border-radius:8px;margin-bottom:16px">
          <strong>🧱 Semen — Dual Satuan (otomatis convert)</strong><br><br>
          <div class="form-row form-row-2">
            <div class="form-group">
              <label>Harga per kg (Rp)</label>
              <div class="inp-group">
                <span class="inp-group-addon">Rp</span>
                <input type="number" class="inp" id="semen-harga-kg" value="${hargaKg}" oninput="MasterHarga._semenConvert('kg')">
              </div>
            </div>
            <div class="form-group">
              <label>Harga per sak (40 kg)</label>
              <div class="inp-group">
                <span class="inp-group-addon">Rp</span>
                <input type="number" class="inp" id="semen-harga-sak" value="${hargaSak}" oninput="MasterHarga._semenConvert('sak')">
              </div>
            </div>
          </div>
          <small style="color:#555">Isi salah satu, yang lain otomatis terupdate. AHSP pakai satuan kg.</small>
        </div>` : ''}

        <div class="form-group">
          <label class="lbl lbl-req">Harga per ${isSemen ? 'kg' : it.satuan} (Rp)</label>
          <div class="inp-group">
            <span class="inp-group-addon">Rp</span>
            <input type="number" class="inp" id="harga-allin" value="${hargaKg}" ${isSemen ? 'readonly' : ''}>
          </div>
        </div>

        <div class="form-group">
          <label class="lbl">Catatan (opsional)</label>
          <input type="text" class="inp" id="harga-catatan" value="${Utils.escHtml(it.catatan || '')}">
        </div>
      `,
      footer: `
        <button class="btn btn-ghost" onclick="closeModal()">Batal</button>
        <button class="btn btn-primary" onclick="MasterHarga._saveEdit('${Utils.escHtml(kode)}','${kat}','${projectId||''}')">Simpan</button>
      `
    });

    if (isSemen) setTimeout(() => MasterHarga._semenSync(), 100);
  },

  _semenConvert(source) {
    const KG_PER_SAK = 40;
    if (source === 'kg') {
      const kg = parseFloat(document.getElementById('semen-harga-kg')?.value) || 0;
      const sakEl = document.getElementById('semen-harga-sak');
      if (sakEl) sakEl.value = Math.round(kg * KG_PER_SAK);
      const allinEl = document.getElementById('harga-allin');
      if (allinEl) allinEl.value = kg;
    } else {
      const sak = parseFloat(document.getElementById('semen-harga-sak')?.value) || 0;
      const kg = sak / KG_PER_SAK;
      const kgEl = document.getElementById('semen-harga-kg');
      if (kgEl) kgEl.value = kg.toFixed(2);
      const allinEl = document.getElementById('harga-allin');
      if (allinEl) allinEl.value = kg.toFixed(2);
    }
  },

  _semenSync() {
    MasterHarga._semenConvert('kg');
  },

  async _saveEdit(kode, kat, projectId) {
    const isSemen = kode === 'M01a_kg';
    let finalHarga = parseFloat(document.getElementById('harga-allin')?.value) || 0;

    if (isSemen) {
      finalHarga = parseFloat(document.getElementById('semen-harga-kg')?.value) || 0;
    }

    const catatan = document.getElementById('harga-catatan')?.value || '';

    const ok = await this.updateGlobal(kode, kat, finalHarga, catatan);
    if (ok) {
      showToast('Harga berhasil diperbarui', 'success');
      closeModal();
      // Refresh tabel
      const wrap = document.getElementById('harga-table-wrap');
      if (wrap) wrap.innerHTML = this._renderTable(this._activeTab, this._activeProjectId, true);
    }
  },

  // Load project-specific overrides
  async loadProjectOverrides(projectId) {
    if (!projectId || !window._firebaseReady) return;
    if (this._projectOverrides[projectId]) return; // already loaded

    const { db, doc, getDoc } = window._firebase;
    try {
      const snap = await getDoc(doc(db, 'projects', projectId, 'harga_override', 'data'));
      if (snap.exists()) {
        this._projectOverrides[projectId] = snap.data() || {};
      } else {
        this._projectOverrides[projectId] = {};
      }
    } catch (err) {
      console.error('loadProjectOverrides error:', err);
      this._projectOverrides[projectId] = {};
    }
  },

  // Render full Master Harga page
  async renderPage(containerId, projectId) {
    this._activeProjectId = projectId || null;
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `<div class="loading-text text-center" style="padding:40px">Memuat master harga...</div>`;

    await this.loadGlobal();
    if (projectId) await this.loadProjectOverrides(projectId);

    const canEdit = Auth.can('update_harga');
    const tabs = [
      { id: 'bahan', label: '🧱 Bahan & Material' },
      { id: 'upah',  label: '👷 Upah Tenaga Kerja' },
      { id: 'alat',  label: '🔧 Sewa Alat' }
    ];

    container.innerHTML = `
      <div class="card-header" style="margin-bottom:0">
        <div>
          <div class="card-title">Master Harga Satuan Dasar (HSD)</div>
          <div class="card-subtitle">${projectId ? 'Harga per-proyek (override dari global)' : 'Harga global berlaku untuk semua proyek'}</div>
        </div>
      </div>

      <div class="tab-bar" style="margin-bottom:16px;border-bottom:1.5px solid var(--border);display:flex;gap:4px;padding-top:12px">
        ${tabs.map(t => `
          <button class="btn ${this._activeTab === t.id ? 'btn-primary' : 'btn-ghost'} btn-sm"
            id="tab-btn-${t.id}"
            onclick="MasterHarga._switchTab('${t.id}','${containerId}','${projectId||''}')">
            ${t.label}
          </button>`).join('')}
      </div>

      <div id="harga-table-wrap">
        ${this._renderTable(this._activeTab, projectId, canEdit)}
      </div>
    `;
  },

  _switchTab(kat, containerId, projectId) {
    this._activeTab = kat;
    // Update tab button styles
    ['bahan', 'upah', 'alat'].forEach(t => {
      const btn = document.getElementById('tab-btn-' + t);
      if (!btn) return;
      btn.className = `btn ${t === kat ? 'btn-primary' : 'btn-ghost'} btn-sm`;
    });
    const wrap = document.getElementById('harga-table-wrap');
    if (wrap) wrap.innerHTML = this._renderTable(kat, projectId || null, Auth.can('update_harga'));
  }
};

window.MasterHarga = MasterHarga;