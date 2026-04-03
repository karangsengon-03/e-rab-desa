/* ============================================================
   e-RAB Desa v1.0 — pages.js
   Page renderers for all app sections
   ============================================================ */

'use strict';

const Pages = {

  // ===== DASHBOARD =====
  async renderDashboard(container) {
    container.innerHTML = `<div class="loading-text text-center" style="padding:40px">Memuat dashboard...</div>`;

    const projects = await Projects.loadAll();
    const totalProjects = projects.length;
    const totalLocked = projects.filter(p => p.locked).length;
    const totalDraft = projects.filter(p => p.status === 'draft').length;
    const grandTotal = projects.reduce((s, p) => s + Math.round(p.total_rab || 0), 0);

    const recentProjects = projects.slice(0, 6);
    const logs = await ActivityLog.fetchAllLogs(10);
    const user = Auth.currentUserData;

    const hr = new Date().getHours();
    const greet = hr < 12 ? 'Selamat Pagi' : hr < 15 ? 'Selamat Siang' : hr < 18 ? 'Selamat Sore' : 'Selamat Malam';

    container.innerHTML = `
      <div class="dashboard-header">
        <div class="dashboard-welcome">${greet}, ${Utils.escHtml(user?.nama?.split(' ')[0] || 'Admin')}! 👋</div>
        <div class="dashboard-sub">Berikut ringkasan RAB Desa hari ini — ${new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
      </div>

      <div class="stat-grid">
        <div class="stat-card">
          <div class="stat-icon" style="background:var(--primary-surface);color:var(--primary)">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" stroke="currentColor" stroke-width="2"/></svg>
          </div>
          <div class="stat-info">
            <div class="stat-value">${totalProjects}</div>
            <div class="stat-label">Total Proyek</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style="background:var(--info-surface);color:var(--info)">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke="currentColor" stroke-width="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" stroke-width="2"/></svg>
          </div>
          <div class="stat-info">
            <div class="stat-value">${totalLocked}</div>
            <div class="stat-label">RAB Final/Terkunci</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style="background:var(--warning-surface);color:var(--warning)">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" stroke-width="2"/><line x1="12" y1="16" x2="12.01" y2="16" stroke="currentColor" stroke-width="2"/></svg>
          </div>
          <div class="stat-info">
            <div class="stat-value">${totalDraft}</div>
            <div class="stat-label">Masih Draft</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style="background:var(--success-surface);color:var(--success)">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><line x1="12" y1="1" x2="12" y2="23" stroke="currentColor" stroke-width="2"/><path d="M17 5H9.5a3.5 3.5 0 1 0 0 7h5a3.5 3.5 0 1 1 0 7H6" stroke="currentColor" stroke-width="2"/></svg>
          </div>
          <div class="stat-info">
            <div class="stat-value" style="font-size:1rem">${Utils.formatRp(grandTotal)}</div>
            <div class="stat-label">Total Nilai RAB</div>
          </div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 350px;gap:20px;align-items:start" class="dashboard-grid">
        <div>
          <div class="card">
            <div class="card-header">
              <div class="card-title">Proyek Terbaru</div>
              <a href="#" onclick="navigate('projects')" style="font-size:0.82rem;color:var(--primary);font-weight:600">Lihat semua →</a>
            </div>
            ${recentProjects.length
              ? `<div class="projects-grid" style="grid-template-columns:1fr">${recentProjects.map(p => `
                <div class="project-card" onclick="navigate('rab-detail','${p.id}')">
                  <div class="project-card-header">
                    <div>
                      <div class="project-card-title">${Utils.escHtml(p.nama)}</div>
                      <div style="margin-top:4px">${Utils.statusBadge(p.status)}</div>
                    </div>
                    ${p.locked ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" style="color:var(--info)"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke="currentColor" stroke-width="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" stroke-width="2"/></svg>' : ''}
                  </div>
                  <div class="project-card-meta">
                    <span>📍 ${Utils.escHtml(p.lokasi_desa || '–')}</span>
                    <span>📅 TA ${Utils.escHtml(String(p.tahun_anggaran || '–'))}</span>
                  </div>
                  <div class="project-card-total">${Utils.formatRp(p.total_rab || 0)}</div>
                </div>
              `).join('')}</div>`
              : `<div class="empty-state">
                  <div class="empty-state-title">Belum ada proyek</div>
                  ${Auth.can('create_project') ? `<button class="btn btn-primary btn-sm" onclick="navigate('projects')">Buat Proyek Pertama</button>` : ''}
                </div>`
            }
          </div>
        </div>

        <div class="card">
          <div class="card-title" style="margin-bottom:16px">Aktivitas Terbaru</div>
          ${ActivityLog.renderLogs(logs)}
        </div>
      </div>
    `;

    // Responsive fix for small screens
    const grid = container.querySelector('.dashboard-grid');
    if (grid && window.innerWidth < 900) {
      grid.style.gridTemplateColumns = '1fr';
    }
  },

  // ===== RAB DETAIL PAGE =====
  async renderRABDetail(container, projectId) {
    if (!projectId) { navigate('projects'); return; }

    container.innerHTML = `<div class="loading-text text-center" style="padding:40px">Memuat proyek...</div>`;
    const project = await Projects.load(projectId);
    if (!project) { container.innerHTML = `<div class="empty-state"><div class="empty-state-title">Proyek tidak ditemukan</div></div>`; return; }

    container.innerHTML = `
      <div class="rab-header">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap">
          <div>
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
              <button class="btn btn-ghost btn-sm" onclick="navigate('projects')" style="padding:4px 8px">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><polyline points="15 18 9 12 15 6" stroke="currentColor" stroke-width="2"/></svg>
                Kembali
              </button>
              ${Utils.statusBadge(project.status)}
            </div>
            <h1 style="font-size:1.2rem;font-weight:800;color:var(--text-primary);line-height:1.3">${Utils.escHtml(project.nama)}</h1>
            <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:6px;font-size:0.8rem;color:var(--text-muted)">
              <span>📍 ${Utils.escHtml(project.lokasi_desa || '–')}, ${Utils.escHtml(project.lokasi_kecamatan || '–')}</span>
              <span>📅 TA ${Utils.escHtml(String(project.tahun_anggaran || '–'))}</span>
              <span>💰 ${Utils.escHtml(Utils.sumberDanaLabel(project.sumber_dana))}</span>
              <span>📐 Overhead ${project.overhead_pct || 15}%</span>
              ${project.no_dokumen ? `<span>📄 ${Utils.escHtml(project.no_dokumen)}</span>` : ''}
            </div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${Auth.can('edit_project') && !project.locked ? `
              <button class="btn btn-ghost btn-sm" onclick="Projects.openEditModal && Projects.openEditModal('${projectId}')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="2"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2"/></svg>
                Edit Info
              </button>
            ` : ''}
            <button class="btn btn-ghost btn-sm" onclick="Pages._showLogPanel('${projectId}')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" stroke-width="2"/><polyline points="14 2 14 8 20 8" stroke="currentColor" stroke-width="2"/></svg>
              Log
            </button>
            <button class="btn btn-ghost btn-sm" onclick="navigate('master-harga','${projectId}')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><line x1="12" y1="1" x2="12" y2="23" stroke="currentColor" stroke-width="2"/><path d="M17 5H9.5a3.5 3.5 0 1 0 0 7h5a3.5 3.5 0 1 1 0 7H6" stroke="currentColor" stroke-width="2"/></svg>
              Harga Lokal
            </button>
          </div>
        </div>
      </div>

      <div id="rab-builder-content">
        <div class="loading-text text-center" style="padding:40px">Memuat RAB...</div>
      </div>
    `;

    await RABInput.init(projectId);
  },

  // ===== LOG PANEL =====
  async _showLogPanel(projectId) {
    const logs = await ActivityLog.fetchProjectLogs(projectId, 50);
    openModal({
      title: 'Log Perubahan Proyek',
      size: 'modal-lg',
      body: `<div style="max-height:400px;overflow-y:auto">${ActivityLog.renderLogs(logs)}</div>`,
      footer: `<button class="btn btn-primary" onclick="closeModal()">Tutup</button>`
    });
  },

  // ===== MASTER HARGA PAGE =====
  async renderMasterHarga(container, projectId) {
    container.innerHTML = `<div class="card">
      <div id="master-harga-content"></div>
    </div>`;
    await MasterHarga.renderPage('master-harga-content', projectId || null);
  },

  // ===== AHSP LIBRARY PAGE =====
  async renderAHSPLibrary(container) {
    container.innerHTML = `<div class="card"><div id="ahsp-library-content"></div></div>`;
    await AHSP.renderPage('ahsp-library-content');
  },

  // ===== SETTINGS PAGE =====
  async renderSettings(container) {
    const user = Auth.currentUserData;
    container.innerHTML = `
      <div style="max-width:640px">
        <div class="card" style="margin-bottom:16px">
          <div class="card-title" style="margin-bottom:16px">👤 Profil Akun</div>
          <div class="form-group" style="margin-bottom:12px">
            <label class="lbl">Nama Lengkap</label>
            <input type="text" class="inp" id="set-nama" value="${Utils.escHtml(user?.nama || '')}">
          </div>
          <div class="form-group" style="margin-bottom:12px">
            <label class="lbl">Email</label>
            <input type="text" class="inp" value="${Utils.escHtml(user?.email || '')}" disabled>
          </div>
          <div class="form-group" style="margin-bottom:16px">
            <label class="lbl">Role</label>
            <input type="text" class="inp" value="${Utils.roleLabel(user?.role)}" disabled>
          </div>
          <button class="btn btn-primary" onclick="Pages._saveProfile()">Simpan Profil</button>
        </div>

        <div class="card" style="margin-bottom:16px">
          <div class="card-title" style="margin-bottom:16px">🎨 Tampilan</div>
          <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid var(--border)">
            <div>
              <div style="font-weight:600;font-size:0.9rem">Mode Gelap</div>
              <div style="font-size:0.78rem;color:var(--text-muted)">Aktifkan tema gelap untuk tampilan malam</div>
            </div>
            <button class="btn btn-ghost" id="theme-toggle-settings" onclick="toggleTheme()" style="min-width:60px">
              ${document.documentElement.getAttribute('data-theme') === 'dark' ? '☀️ Terang' : '🌙 Gelap'}
            </button>
          </div>
        </div>

        <div class="card" style="margin-bottom:16px">
          <div class="card-title" style="margin-bottom:16px">💾 Backup & Restore</div>
          <div style="font-size:0.875rem;color:var(--text-secondary);margin-bottom:14px">
            Export semua data proyek RAB sebagai file JSON backup untuk keperluan arsip atau migrasi.
          </div>
          <button class="btn btn-secondary" onclick="Pages._exportBackup()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            Export Backup JSON
          </button>
        </div>

        ${Auth.can('update_harga') ? `
        <div class="card">
          <div class="card-title" style="margin-bottom:4px">⚙️ Master Harga Global</div>
          <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:14px">Harga default yang berlaku untuk semua proyek</div>
          <button class="btn btn-primary" onclick="navigate('master-harga')">Kelola Master Harga</button>
        </div>
        ` : ''}
      </div>
    `;
  },

  async _saveProfile() {
    const nama = document.getElementById('set-nama')?.value?.trim();
    if (!nama) { showToast('Nama wajib diisi', 'error'); return; }
    const { db, doc, updateDoc, serverTimestamp } = window._firebase;
    try {
      await updateDoc(doc(db, 'users', Auth.currentUser.uid), { nama, updatedAt: serverTimestamp() });
      Auth.currentUserData.nama = nama;
      Auth._updateUserUI();
      Auth._saveRemembered(Auth.currentUser.email, nama);
      showToast('Profil disimpan', 'success');
    } catch (err) {
      showToast('Gagal simpan: ' + err.message, 'error');
    }
  },

  async _exportBackup() {
    showToast('Menyiapkan backup...', 'info');
    const projects = await Projects.loadAll();
    const masterHarga = MasterHarga._globalHarga;
    const backup = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      exportedBy: Auth.currentUserData?.email,
      projects,
      masterHarga
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `e-rab-desa-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Backup berhasil diunduh', 'success');
    ActivityLog.log({ type: 'export', entity: 'backup', entityName: 'Full backup JSON' });
  },

  // ===== USERS PAGE =====
  async renderUsers(container) {
    if (!Auth.can('all') && Auth.currentUserData?.role !== 'super_admin') {
      container.innerHTML = `<div class="empty-state"><div class="empty-state-title">Akses ditolak</div></div>`;
      return;
    }
    container.innerHTML = `<div class="loading-text text-center" style="padding:40px">Memuat data user...</div>`;

    const { db, collection, getDocs } = window._firebase;
    const snap = await getDocs(collection(db, 'users'));
    const users = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    container.innerHTML = `
      <div class="card-header">
        <div class="card-title">Manajemen User</div>
        <button class="btn btn-primary btn-sm" onclick="Pages._openAddUserModal()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          Tambah User
        </button>
      </div>
      <div class="card">
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Nama</th><th>Email</th><th>Role</th><th>Status</th><th class="text-center">Aksi</th></tr></thead>
            <tbody>
              ${users.map(u => `<tr>
                <td style="font-weight:600">${Utils.escHtml(u.nama || '–')}</td>
                <td>${Utils.escHtml(u.email || '–')}</td>
                <td>${Utils.statusBadge(u.role === 'super_admin' ? 'final' : u.role === 'admin' ? 'review' : 'draft')} <span style="font-size:0.82rem;margin-left:4px">${Utils.roleLabel(u.role)}</span></td>
                <td><span class="badge ${u.disabled ? 'badge-danger' : 'badge-success'}">${u.disabled ? 'Nonaktif' : 'Aktif'}</span></td>
                <td class="td-actions">
                  <button class="btn btn-ghost btn-icon btn-sm" onclick="Pages._openEditUserModal('${u.id}')" title="Edit">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="2"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2"/></svg>
                  </button>
                </td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  _openAddUserModal() {
    openModal({
      title: 'Tambah User Baru',
      body: `
        <div class="form-group" style="margin-bottom:12px">
          <label class="lbl lbl-req">Nama Lengkap</label>
          <input type="text" class="inp" id="u-nama" placeholder="Nama pengguna">
        </div>
        <div class="form-group" style="margin-bottom:12px">
          <label class="lbl lbl-req">Email</label>
          <input type="email" class="inp" id="u-email" placeholder="email@domain.com">
        </div>
        <div class="form-group" style="margin-bottom:12px">
          <label class="lbl lbl-req">Role</label>
          <select class="sel" id="u-role">
            <option value="viewer">Viewer (hanya lihat & export)</option>
            <option value="admin">Admin (edit proyek & harga)</option>
            <option value="super_admin">Super Admin (semua akses)</option>
          </select>
        </div>
        <div style="background:var(--info-surface);border-radius:var(--radius-sm);padding:10px 14px;font-size:0.8rem;color:var(--info)">
          ℹ️ User harus mendaftar sendiri melalui Firebase Authentication. Tambahkan data user ini setelah mereka mendaftar dengan email tersebut.
        </div>
      `,
      footer: `
        <button class="btn btn-ghost" onclick="closeModal()">Batal</button>
        <button class="btn btn-primary" onclick="Pages._doAddUser()">Tambah</button>
      `
    });
  },

  async _doAddUser() {
    const nama = document.getElementById('u-nama')?.value?.trim();
    const email = document.getElementById('u-email')?.value?.trim();
    const role = document.getElementById('u-role')?.value;
    if (!nama || !email) { showToast('Nama dan email wajib diisi', 'error'); return; }

    // Note: we can't create Firebase Auth user from client SDK without Admin SDK
    // We pre-create the Firestore user record; actual auth created when they sign up
    showToast('Catatan: User perlu mendaftar dengan email ini terlebih dahulu, lalu data role akan tersedia.', 'info');
    closeModal();
  },

  _openEditUserModal(userId) {
    // For role changes
    openModal({
      title: 'Edit Role User',
      body: `
        <div class="form-group">
          <label class="lbl lbl-req">Role Baru</label>
          <select class="sel" id="u-edit-role">
            <option value="viewer">Viewer</option>
            <option value="admin">Admin</option>
            <option value="super_admin">Super Admin</option>
          </select>
        </div>
      `,
      footer: `
        <button class="btn btn-ghost" onclick="closeModal()">Batal</button>
        <button class="btn btn-primary" onclick="Pages._doEditUserRole('${userId}')">Simpan</button>
      `
    });
  },

  async _doEditUserRole(userId) {
    const role = document.getElementById('u-edit-role')?.value;
    const { db, doc, updateDoc, serverTimestamp } = window._firebase;
    try {
      await updateDoc(doc(db, 'users', userId), { role, updatedAt: serverTimestamp() });
      closeModal();
      showToast('Role diperbarui', 'success');
      ActivityLog.log({ type: ActivityLog.TYPES.USER_EDIT, entity: 'user', entityId: userId, entityName: 'User', newValue: role });
      await this.renderUsers(document.getElementById('page-content'));
    } catch (err) {
      showToast('Gagal update role: ' + err.message, 'error');
    }
  },

  // ===== RAB PREVIEW CONTENT (used by export + preview modal) =====
  _renderRABPreviewContent(project, calc) {
    const now = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    return `
      <div style="font-family:var(--font-sans);font-size:0.875rem;line-height:1.6">
        <!-- Header -->
        <div style="text-align:center;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid var(--primary)">
          <div style="font-size:1.1rem;font-weight:800;color:var(--primary)">RENCANA ANGGARAN BIAYA (RAB)</div>
          <div style="font-size:1rem;font-weight:700;margin-top:4px">${Utils.escHtml(project.nama || '')}</div>
          <div style="margin-top:6px;color:var(--text-secondary)">
            ${Utils.escHtml(project.lokasi_desa || '')}${project.lokasi_kecamatan ? ', ' + Utils.escHtml(project.lokasi_kecamatan) : ''}${project.lokasi_kabupaten ? ', ' + Utils.escHtml(project.lokasi_kabupaten) : ''}
          </div>
          <div style="margin-top:4px;color:var(--text-secondary)">Tahun Anggaran: ${project.tahun_anggaran || '–'} | Sumber Dana: ${Utils.sumberDanaLabel(project.sumber_dana)}</div>
          ${project.no_dokumen ? `<div style="margin-top:4px;color:var(--text-muted)">No. Dokumen: ${Utils.escHtml(project.no_dokumen)}</div>` : ''}
        </div>

        <!-- Rekapitulasi -->
        <div style="margin-bottom:24px">
          <div style="font-weight:700;font-size:0.9rem;margin-bottom:8px;color:var(--primary)">I. REKAPITULASI RAB</div>
          <table style="width:100%;border-collapse:collapse;font-size:0.82rem">
            <thead>
              <tr style="background:var(--primary);color:#fff">
                <th style="padding:8px 12px;text-align:left;width:40px">No</th>
                <th style="padding:8px 12px;text-align:left">Uraian Pekerjaan</th>
                <th style="padding:8px 12px;text-align:right">Jumlah (Rp)</th>
              </tr>
            </thead>
            <tbody>
              ${calc.sections.map((sec, i) => `
                <tr style="border-bottom:1px solid var(--border)">
                  <td style="padding:8px 12px">${i + 1}</td>
                  <td style="padding:8px 12px;font-weight:600">${Utils.escHtml(sec.nama)}</td>
                  <td style="padding:8px 12px;text-align:right;font-family:var(--font-mono)">${Utils.formatRp(sec.total)}</td>
                </tr>
              `).join('')}
              <tr style="background:var(--primary-surface);font-weight:700;border-top:2px solid var(--primary)">
                <td colspan="2" style="padding:10px 12px">JUMLAH TOTAL</td>
                <td style="padding:10px 12px;text-align:right;font-family:var(--font-mono);font-size:1rem;color:var(--primary)">${Utils.formatRp(calc.grandTotal)}</td>
              </tr>
            </tbody>
          </table>
          <div style="margin-top:8px;font-style:italic;font-size:0.8rem">Terbilang: ${Utils.terbilang(calc.grandTotal)}</div>
        </div>

        <!-- Per Section Detail -->
        ${calc.sections.map((sec, si) => `
          <div style="margin-bottom:20px">
            <div style="font-weight:700;font-size:0.9rem;margin-bottom:8px;color:var(--primary)">
              ${si + 1}. ${Utils.escHtml(sec.nama)}
            </div>
            <table style="width:100%;border-collapse:collapse;font-size:0.8rem">
              <thead>
                <tr style="background:var(--bg-hover)">
                  <th style="padding:6px 10px;text-align:left;width:30px">No</th>
                  <th style="padding:6px 10px;text-align:left">Uraian Pekerjaan</th>
                  <th style="padding:6px 10px;text-align:right;width:80px">Sat</th>
                  <th style="padding:6px 10px;text-align:right;width:90px">Volume</th>
                  <th style="padding:6px 10px;text-align:right;width:110px">Harga Sat (Rp)</th>
                  <th style="padding:6px 10px;text-align:right;width:120px">Jumlah (Rp)</th>
                </tr>
              </thead>
              <tbody>
                ${sec.items.map((item, ii) => `
                  <tr style="border-bottom:1px solid var(--border)">
                    <td style="padding:6px 10px">${ii + 1}</td>
                    <td style="padding:6px 10px">
                      <div style="font-weight:500">${Utils.escHtml(item.nama_tampil || item.ahsp?.nama || '')}</div>
                      ${item.ahsp?.mutu_fc ? `<div style="font-size:0.7rem;color:var(--text-muted)">f'c ${item.ahsp.mutu_fc} MPa / K-${item.ahsp.mutu_k || Utils.fcToK(item.ahsp.mutu_fc)}</div>` : ''}
                      ${item.keterangan ? `<div style="font-size:0.72rem;color:var(--text-muted);font-style:italic">${Utils.escHtml(item.keterangan)}</div>` : ''}
                    </td>
                    <td style="padding:6px 10px;text-align:right">${Utils.escHtml(item.display_satuan || item.ahsp?.satuan || '')}</td>
                    <td style="padding:6px 10px;text-align:right;font-family:var(--font-mono)">${Utils.formatNum(item.display_volume || 0, 3)}</td>
                    <td style="padding:6px 10px;text-align:right;font-family:var(--font-mono)">${Utils.formatRp(item.hsp || 0)}</td>
                    <td style="padding:6px 10px;text-align:right;font-family:var(--font-mono);font-weight:600">${Utils.formatRp(item.jumlah || 0)}</td>
                  </tr>
                `).join('')}
                <tr style="background:var(--primary-surface);font-weight:700">
                  <td colspan="5" style="padding:8px 10px">Jumlah ${Utils.escHtml(sec.nama)}</td>
                  <td style="padding:8px 10px;text-align:right;font-family:var(--font-mono)">${Utils.formatRp(sec.total)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        `).join('')}

        <div style="margin-top:24px;font-size:0.78rem;color:var(--text-muted);border-top:1px solid var(--border);padding-top:12px">
          Dicetak: ${now} | e-RAB Desa v1.0 | Berdasarkan Permen PUPR No.8/2023
        </div>
      </div>
    `;
  }
};

window.Pages = Pages;
