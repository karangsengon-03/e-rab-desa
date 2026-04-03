/* ============================================================
   e-RAB Desa v1.0 — projects.js
   Project management: CRUD, locking, status
   ============================================================ */

'use strict';

const Projects = {
  _list: [],
  _current: null,
  _unsubscribe: null,

  // ===== LOAD ALL PROJECTS =====
  async loadAll() {
    if (!window._firebaseReady) return [];
    const { db, collection, query, orderBy, getDocs, where } = window._firebase;

    try {
      let q;
      const role = Auth.currentUserData?.role;
      if (role === 'super_admin' || role === 'admin') {
        q = query(collection(db, 'projects'), orderBy('createdAt', 'desc'));
      } else {
        // Viewer: only projects they're member of
        q = query(collection(db, 'projects'), where('members', 'array-contains', Auth.currentUser?.uid), orderBy('createdAt', 'desc'));
      }
      const snap = await getDocs(q);
      this._list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      return this._list;
    } catch (err) {
      console.error('Load projects error:', err);
      return [];
    }
  },

  // ===== LOAD SINGLE PROJECT =====
  async load(id) {
    if (!window._firebaseReady) return null;
    const { db, doc, getDoc } = window._firebase;
    try {
      const snap = await getDoc(doc(db, 'projects', id));
      if (!snap.exists()) return null;
      this._current = { id, ...snap.data() };
      return this._current;
    } catch (err) {
      console.error('Load project error:', err);
      return null;
    }
  },

  // ===== CREATE PROJECT =====
  async create(data) {
    if (!Auth.can('create_project')) { showToast('Tidak ada izin', 'error'); return null; }
    if (!window._firebaseReady) return null;
    const { db, collection, addDoc, serverTimestamp } = window._firebase;

    const project = {
      ...data,
      status: 'draft',
      locked: false,
      overhead_pct: data.overhead_pct || 15,
      total_rab: 0,
      createdBy: Auth.currentUser?.uid,
      createdByName: Auth.currentUserData?.nama || '',
      members: [Auth.currentUser?.uid],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    try {
      const ref = await addDoc(collection(db, 'projects'), project);
      ActivityLog.create('project', ref.id, data.nama, `Proyek baru: ${data.sumber_dana}`);
      showToast('Proyek berhasil dibuat', 'success');
      return ref.id;
    } catch (err) {
      showToast('Gagal membuat proyek: ' + err.message, 'error');
      return null;
    }
  },

  // ===== UPDATE PROJECT =====
  async update(id, data) {
    if (!Auth.can('edit_project')) { showToast('Tidak ada izin', 'error'); return false; }
    const project = await this.load(id);
    if (!project) { showToast('Proyek tidak ditemukan', 'error'); return false; }
    if (project.locked) { showToast('Proyek sudah dikunci. Buka kunci terlebih dahulu.', 'error'); return false; }

    const { db, doc, updateDoc, serverTimestamp } = window._firebase;
    try {
      await updateDoc(doc(db, 'projects', id), {
        ...data,
        updatedAt: serverTimestamp(),
        updatedBy: Auth.currentUser?.uid
      });
      ActivityLog.edit('project', id, data.nama || project.nama, project, data);
      return true;
    } catch (err) {
      showToast('Gagal update proyek: ' + err.message, 'error');
      return false;
    }
  },

  // ===== DELETE PROJECT =====
  async delete(id) {
    if (!Auth.can('delete_project')) { showToast('Tidak ada izin menghapus proyek', 'error'); return false; }
    const project = await this.load(id);
    if (!project) return false;
    if (project.locked) { showToast('Tidak bisa hapus proyek yang sudah dikunci', 'error'); return false; }

    const { db, doc, deleteDoc } = window._firebase;
    try {
      await deleteDoc(doc(db, 'projects', id));
      ActivityLog.delete('project', id, project.nama);
      showToast('Proyek dihapus', 'success');
      this._list = this._list.filter(p => p.id !== id);
      return true;
    } catch (err) {
      showToast('Gagal hapus: ' + err.message, 'error');
      return false;
    }
  },

  // ===== LOCK / UNLOCK =====
  async lock(id) {
    if (!Auth.can('lock_rab')) { showToast('Tidak ada izin', 'error'); return false; }
    const { db, doc, updateDoc, serverTimestamp } = window._firebase;
    try {
      await updateDoc(doc(db, 'projects', id), {
        locked: true, status: 'locked',
        lockedAt: serverTimestamp(),
        lockedBy: Auth.currentUser?.uid
      });
      const project = await this.load(id);
      ActivityLog.lock('project', id, project?.nama || id, id);
      showToast('RAB berhasil dikunci', 'success');
      return true;
    } catch (err) {
      showToast('Gagal kunci: ' + err.message, 'error');
      return false;
    }
  },

  async unlock(id, alasan) {
    if (!Auth.can('unlock_rab')) { showToast('Tidak ada izin membuka kunci', 'error'); return false; }
    if (!alasan?.trim()) { showToast('Alasan buka kunci wajib diisi', 'error'); return false; }

    const { db, doc, updateDoc, serverTimestamp } = window._firebase;
    try {
      await updateDoc(doc(db, 'projects', id), {
        locked: false, status: 'review',
        unlockedAt: serverTimestamp(),
        unlockedBy: Auth.currentUser?.uid,
        unlockReason: alasan
      });
      const project = await this.load(id);
      ActivityLog.unlock('project', id, project?.nama || id, alasan, id);
      showToast('Kunci RAB dibuka: ' + alasan, 'info');
      return true;
    } catch (err) {
      showToast('Gagal buka kunci: ' + err.message, 'error');
      return false;
    }
  },

  // ===== UPDATE TOTAL RAB =====
  async updateTotal(projectId, total) {
    if (!window._firebaseReady) return;
    const { db, doc, updateDoc, serverTimestamp } = window._firebase;
    try {
      await updateDoc(doc(db, 'projects', projectId), {
        total_rab: Math.round(total),
        updatedAt: serverTimestamp()
      });
    } catch (err) { /* silent */ }
  },

  // ===== RENDER PROJECTS LIST PAGE =====
  async renderPage(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `<div class="loading-text text-center" style="padding:40px">Memuat proyek...</div>`;
    const projects = await this.loadAll();

    const canCreate = Auth.can('create_project');

    container.innerHTML = `
      <div class="card-header">
        <div>
          <div class="card-title">Daftar Proyek RAB</div>
          <div class="card-subtitle">${projects.length} proyek ditemukan</div>
        </div>
        ${canCreate ? `<button class="btn btn-primary" onclick="Projects.openCreateModal()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          Buat Proyek Baru
        </button>` : ''}
      </div>

      <div class="search-bar">
        <div class="search-input-wrap">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2"/><line x1="21" y1="21" x2="16.65" y2="16.65" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          <input type="text" class="search-inp" id="proj-search" placeholder="Cari nama proyek atau lokasi..." oninput="Projects._filterList(this.value)">
        </div>
        <select class="sel" id="proj-filter-status" style="width:auto;min-width:140px" onchange="Projects._filterList(document.getElementById('proj-search').value)">
          <option value="">Semua Status</option>
          <option value="draft">Draft</option>
          <option value="review">Review</option>
          <option value="final">Final</option>
          <option value="locked">Dikunci</option>
        </select>
        <select class="sel" id="proj-filter-tahun" style="width:auto;min-width:120px" onchange="Projects._filterList(document.getElementById('proj-search').value)">
          <option value="">Semua Tahun</option>
          ${[...new Set(projects.map(p => p.tahun_anggaran).filter(Boolean))].sort((a,b) => b-a).map(t => `<option value="${t}">${t}</option>`).join('')}
        </select>
      </div>

      <div id="proj-list">
        ${this._renderProjectCards(projects)}
      </div>
    `;
  },

  _filterList(q) {
    const status = document.getElementById('proj-filter-status')?.value || '';
    const tahun = document.getElementById('proj-filter-tahun')?.value || '';
    const fl = q.toLowerCase();
    const filtered = this._list.filter(p => {
      const matchText = !fl || p.nama?.toLowerCase().includes(fl) || p.lokasi_desa?.toLowerCase().includes(fl);
      const matchStatus = !status || p.status === status;
      const matchTahun = !tahun || String(p.tahun_anggaran) === tahun;
      return matchText && matchStatus && matchTahun;
    });
    const el = document.getElementById('proj-list');
    if (el) el.innerHTML = this._renderProjectCards(filtered);
  },

  _renderProjectCards(projects) {
    if (!projects?.length) {
      return `<div class="empty-state">
        <svg class="empty-state-icon" width="40" height="40" viewBox="0 0 24 24" fill="none"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" stroke="currentColor" stroke-width="2"/></svg>
        <div class="empty-state-title">Belum ada proyek</div>
        <div class="empty-state-sub">Klik "Buat Proyek Baru" untuk memulai</div>
      </div>`;
    }

    return `<div class="projects-grid">${projects.map(p => `
      <div class="project-card" onclick="navigate('rab-detail','${p.id}')">
        <div class="project-card-header">
          <div>
            <div class="project-card-title">${Utils.escHtml(p.nama)}</div>
            <div style="margin-top:4px">${Utils.statusBadge(p.status)}</div>
          </div>
          ${p.locked ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" style="color:var(--info);flex-shrink:0"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke="currentColor" stroke-width="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" stroke-width="2"/></svg>' : ''}
        </div>
        <div class="project-card-meta">
          <span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="10" r="3" stroke="currentColor" stroke-width="2"/></svg>
            ${Utils.escHtml(p.lokasi_desa || '–')}, ${Utils.escHtml(p.lokasi_kecamatan || '–')}
          </span>
          <span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke="currentColor" stroke-width="2"/><line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" stroke-width="2"/><line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" stroke-width="2"/><line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" stroke-width="2"/></svg>
            TA ${Utils.escHtml(String(p.tahun_anggaran || '–'))} · ${Utils.escHtml(Utils.sumberDanaLabel(p.sumber_dana))}
          </span>
          <span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="7" r="4" stroke="currentColor" stroke-width="2"/></svg>
            ${Utils.escHtml(p.createdByName || '–')} · ${Utils.timeAgo(p.createdAt)}
          </span>
        </div>
        <div class="project-card-total">
          ${Utils.formatRp(p.total_rab || 0)}
        </div>
      </div>
    `).join('')}</div>`;
  },

  // ===== CREATE MODAL =====
  openCreateModal() {
    const curYear = new Date().getFullYear();
    openModal({
      title: 'Buat Proyek RAB Baru',
      size: 'modal-lg',
      body: `
        <div class="form-group" style="margin-bottom:12px">
          <label class="lbl lbl-req">Nama Kegiatan / Proyek</label>
          <input type="text" class="inp" id="p-nama" placeholder="Contoh: Pembangunan Jalan Rabat Beton RT 04 RW 02">
        </div>
        <div class="form-row form-row-2" style="margin-bottom:12px">
          <div class="form-group">
            <label class="lbl lbl-req">Tahun Anggaran</label>
            <input type="number" class="inp" id="p-tahun" value="${curYear}" min="2020" max="2040">
          </div>
          <div class="form-group">
            <label class="lbl lbl-req">Sumber Dana</label>
            <select class="sel" id="p-sumber">
              <option value="dd">DD (Dana Desa)</option>
              <option value="add">ADD (Alokasi Dana Desa)</option>
              <option value="apbdes">APBDes</option>
              <option value="dak">DAK (Dana Alokasi Khusus)</option>
              <option value="bankeu">Bantuan Keuangan Provinsi/Kab</option>
              <option value="pad">PAD Desa</option>
              <option value="swadaya">Swadaya Masyarakat</option>
              <option value="hibah">Hibah</option>
              <option value="lainnya">Lainnya</option>
            </select>
          </div>
        </div>
        <div style="font-size:0.8rem;font-weight:700;color:var(--text-secondary);margin-bottom:8px;margin-top:4px">📍 Lokasi Kegiatan</div>
        <div class="form-row form-row-2" style="margin-bottom:12px">
          <div class="form-group">
            <label class="lbl lbl-req">Desa</label>
            <input type="text" class="inp" id="p-desa" placeholder="Nama desa">
          </div>
          <div class="form-group">
            <label class="lbl lbl-req">Kecamatan</label>
            <input type="text" class="inp" id="p-kecamatan" placeholder="Nama kecamatan">
          </div>
        </div>
        <div class="form-row form-row-2" style="margin-bottom:12px">
          <div class="form-group">
            <label class="lbl">Kabupaten</label>
            <input type="text" class="inp" id="p-kabupaten" placeholder="Nama kabupaten">
          </div>
          <div class="form-group">
            <label class="lbl">Provinsi</label>
            <input type="text" class="inp" id="p-provinsi" placeholder="Nama provinsi">
          </div>
        </div>
        <div class="form-row form-row-3" style="margin-bottom:12px">
          <div class="form-group">
            <label class="lbl">No. Dokumen</label>
            <input type="text" class="inp" id="p-nodok" placeholder="000/RAB/...">
          </div>
          <div class="form-group">
            <label class="lbl lbl-req">Overhead (%)</label>
            <select class="sel" id="p-overhead">
              <option value="10">10%</option>
              <option value="12">12%</option>
              <option value="15" selected>15% (Default)</option>
            </select>
          </div>
          <div class="form-group">
            <label class="lbl">Mode Tampilan STA</label>
            <select class="sel" id="p-sta-mode">
              <option value="subrows">Opsi A: Sub-baris per item</option>
              <option value="rows">Opsi B: Baris terpisah per STA</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="lbl">Keterangan Tambahan</label>
          <textarea class="txa" id="p-keterangan" placeholder="Catatan atau deskripsi proyek..." rows="2"></textarea>
        </div>
      `,
      footer: `
        <button class="btn btn-ghost" onclick="closeModal()">Batal</button>
        <button class="btn btn-primary" onclick="Projects._doCreate()">Buat Proyek</button>
      `
    });
  },

  async _doCreate() {
    const nama = document.getElementById('p-nama')?.value?.trim();
    const tahun = parseInt(document.getElementById('p-tahun')?.value) || new Date().getFullYear();
    const sumber_dana = document.getElementById('p-sumber')?.value;
    const lokasi_desa = document.getElementById('p-desa')?.value?.trim();
    const lokasi_kecamatan = document.getElementById('p-kecamatan')?.value?.trim();
    const lokasi_kabupaten = document.getElementById('p-kabupaten')?.value?.trim();
    const lokasi_provinsi = document.getElementById('p-provinsi')?.value?.trim();
    const no_dokumen = document.getElementById('p-nodok')?.value?.trim();
    const overhead_pct = parseInt(document.getElementById('p-overhead')?.value) || 15;
    const sta_mode = document.getElementById('p-sta-mode')?.value || 'subrows';
    const keterangan = document.getElementById('p-keterangan')?.value?.trim();

    if (!nama) { showToast('Nama kegiatan wajib diisi', 'error'); return; }
    if (!lokasi_desa) { showToast('Nama desa wajib diisi', 'error'); return; }

    closeModal();
    const id = await this.create({
      nama, tahun_anggaran: tahun, sumber_dana,
      lokasi_desa, lokasi_kecamatan, lokasi_kabupaten, lokasi_provinsi,
      no_dokumen, overhead_pct, sta_mode, keterangan
    });

    if (id) {
      await this.loadAll();
      navigate('rab-detail', id);
    }
  },

  // ===== OPEN LOCK MODAL =====
  openLockModal(id, nama) {
    openModal({
      title: 'Kunci RAB',
      body: `
        <div style="background:var(--warning-surface);border:1px solid rgba(230,81,0,0.2);border-radius:var(--radius);padding:12px 16px;margin-bottom:16px;font-size:0.875rem;color:var(--warning)">
          <strong>⚠️ Perhatian:</strong> Setelah dikunci, semua item RAB tidak dapat diubah. Admin dapat membuka kunci kembali bila diperlukan.
        </div>
        <p style="color:var(--text-secondary);font-size:0.875rem">Proyek: <strong>${Utils.escHtml(nama)}</strong></p>
        <p style="color:var(--text-secondary);font-size:0.875rem;margin-top:8px">Apakah Anda yakin ingin mengunci RAB ini sebagai dokumen final?</p>
      `,
      footer: `
        <button class="btn btn-ghost" onclick="closeModal()">Batal</button>
        <button class="btn btn-primary" onclick="Projects._doLock('${id}')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke="currentColor" stroke-width="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" stroke-width="2"/></svg>
          Kunci RAB
        </button>
      `
    });
  },

  async _doLock(id) {
    closeModal();
    const ok = await this.lock(id);
    if (ok) navigate('rab-detail', id);
  },

  openUnlockModal(id, nama) {
    openModal({
      title: 'Buka Kunci RAB',
      body: `
        <p style="color:var(--text-secondary);margin-bottom:12px;font-size:0.875rem">Proyek: <strong>${Utils.escHtml(nama)}</strong></p>
        <div class="form-group">
          <label class="lbl lbl-req">Alasan Membuka Kunci</label>
          <textarea class="txa" id="unlock-reason" placeholder="Contoh: Revisi harga bahan semen bulan Oktober..." rows="3"></textarea>
          <div class="field-hint">Alasan akan dicatat dalam log perubahan</div>
        </div>
      `,
      footer: `
        <button class="btn btn-ghost" onclick="closeModal()">Batal</button>
        <button class="btn btn-warning" onclick="Projects._doUnlock('${id}')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke="currentColor" stroke-width="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1" stroke="currentColor" stroke-width="2"/></svg>
          Buka Kunci
        </button>
      `
    });
  },

  async _doUnlock(id) {
    const alasan = document.getElementById('unlock-reason')?.value?.trim();
    if (!alasan) { showToast('Alasan wajib diisi', 'error'); return; }
    closeModal();
    const ok = await this.unlock(id, alasan);
    if (ok) navigate('rab-detail', id);
  }
};

window.Projects = Projects;
