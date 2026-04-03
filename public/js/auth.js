/* ============================================================
   e-RAB Desa v1.0 — auth.js
   Firebase Authentication + Remember User
   ============================================================ */

'use strict';

const Auth = {
  currentUser: null,
  currentUserData: null,
  _unsubscribeAuth: null,

  // ===== INITIALIZE =====
  init() {
    if (!window._firebaseReady) {
      window.addEventListener('firebase-ready', () => this.init(), { once: true });
      return;
    }

    const { auth, onAuthStateChanged, setPersistence, browserLocalPersistence, db, doc, getDoc } = window._firebase;

    // Set persistence to local (survives browser close)
    setPersistence(auth, browserLocalPersistence).catch(console.error);

    // Check for remembered user (show "Lanjutkan" UI fast)
    this._checkRemembered();

    // Auth state observer
    this._unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        this.currentUser = user;
        try {
          // Fetch user data from Firestore
          const snap = await getDoc(doc(db, 'users', user.uid));
          if (snap.exists()) {
            this.currentUserData = { uid: user.uid, ...snap.data() };
          } else {
            // First time: create user doc (only for initial super admin setup)
            this.currentUserData = {
              uid: user.uid,
              email: user.email,
              nama: user.email.split('@')[0],
              role: 'viewer'
            };
          }
          // Save to localStorage for "remember" feature
          this._saveRemembered(user.email, this.currentUserData.nama);
          // Show app
          this._showApp();
        } catch (err) {
          console.error('Error fetching user data:', err);
          this.currentUserData = {
            uid: user.uid,
            email: user.email,
            nama: user.email.split('@')[0],
            role: 'viewer'
          };
          this._showApp();
        }
      } else {
        this.currentUser = null;
        this.currentUserData = null;
        this._showLogin();
      }
    });
  },

  // ===== REMEMBER USER =====
  _checkRemembered() {
    try {
      const remembered = JSON.parse(localStorage.getItem('erab_remember') || 'null');
      if (remembered && remembered.email) {
        // Show "Lanjutkan" panel
        const panel = document.getElementById('remember-panel');
        const loginForm = document.getElementById('login-form');
        const nameEl = document.getElementById('remember-name');
        const emailEl = document.getElementById('remember-email');
        const avatarEl = document.getElementById('remember-avatar');
        if (panel && loginForm) {
          panel.classList.remove('hidden');
          loginForm.classList.add('hidden');
          if (nameEl) nameEl.textContent = remembered.nama || remembered.email;
          if (emailEl) emailEl.textContent = remembered.email;
          if (avatarEl) avatarEl.textContent = Utils.initials(remembered.nama || remembered.email);
        }
      }
    } catch (e) { /* ignore */ }
  },

  _saveRemembered(email, nama) {
    try {
      localStorage.setItem('erab_remember', JSON.stringify({ email, nama }));
    } catch (e) { /* ignore */ }
  },

  _clearRemembered() {
    try { localStorage.removeItem('erab_remember'); } catch (e) { /* ignore */ }
  },

  // ===== LOGIN =====
  async login(email, password) {
    const { auth, signInWithEmailAndPassword } = window._firebase;
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      return { ok: true, user: cred.user };
    } catch (err) {
      return { ok: false, error: this._errMsg(err.code) };
    }
  },

  // Continue with remembered account (Firebase token auto-refreshes)
  async continueSaved() {
    // Firebase already has the session from persistence; onAuthStateChanged will fire
    // If still signed in, it will show app automatically
    // If session expired, show login form
    const { auth } = window._firebase;
    if (auth.currentUser) {
      return { ok: true };
    }
    return { ok: false };
  },

  // ===== LOGOUT =====
  async logout() {
    const { auth, signOut } = window._firebase;
    try {
      this._clearRemembered();
      await signOut(auth);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  },

  // Switch account - clear remember + show login form
  switchAccount() {
    this._clearRemembered();
    const panel = document.getElementById('remember-panel');
    const loginForm = document.getElementById('login-form');
    if (panel) panel.classList.add('hidden');
    if (loginForm) {
      loginForm.classList.remove('hidden');
      setTimeout(() => document.getElementById('login-email')?.focus(), 100);
    }
  },

  // ===== SHOW/HIDE SCREENS =====
  _showApp() {
    document.getElementById('loading-screen')?.classList.add('fade-out');
    setTimeout(() => document.getElementById('loading-screen')?.classList.add('hidden'), 400);

    document.getElementById('login-screen')?.classList.add('fade-out');
    setTimeout(() => {
      document.getElementById('login-screen')?.classList.add('hidden');
      document.getElementById('login-screen')?.classList.remove('fade-out');
    }, 400);

    const app = document.getElementById('app');
    app?.classList.remove('hidden');

    // Update UI with user data
    this._updateUserUI();

    // Initialize app pages
    if (window.App) App.init();
  },

  _showLogin() {
    document.getElementById('loading-screen')?.classList.add('fade-out');
    setTimeout(() => document.getElementById('loading-screen')?.classList.add('hidden'), 400);

    const app = document.getElementById('app');
    if (app) app.classList.add('hidden');

    const loginScreen = document.getElementById('login-screen');
    if (loginScreen) {
      loginScreen.classList.remove('hidden', 'fade-out');
    }

    // Re-check remembered
    this._checkRemembered();
  },

  _updateUserUI() {
    const u = this.currentUserData;
    if (!u) return;

    const nama = u.nama || u.email || '–';
    const initial = Utils.initials(nama);
    const role = Utils.roleLabel(u.role);

    const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setEl('sidebar-name', nama);
    setEl('sidebar-role', role);
    setEl('sidebar-avatar', initial);
    setEl('topbar-avatar', initial);

    // Show/hide admin menus
    const isSuperAdmin = u.role === 'super_admin';
    const isAdmin = u.role === 'admin' || isSuperAdmin;
    document.getElementById('menu-users')?.classList.toggle('hidden', !isSuperAdmin);
  },

  // ===== PERMISSION CHECK =====
  can(action) {
    const role = this.currentUserData?.role;
    if (!role) return false;
    const perms = {
      super_admin: ['all'],
      admin: ['create_project', 'edit_project', 'delete_project', 'export', 'update_harga', 'create_ahsp_custom', 'edit_ahsp_custom', 'lock_rab', 'unlock_rab', 'view'],
      viewer: ['view', 'export']
    };
    const allowed = perms[role] || [];
    return allowed.includes('all') || allowed.includes(action);
  },

  requireRole(minRole, redirectMsg = 'Anda tidak memiliki akses ke fitur ini.') {
    const roleOrder = { viewer: 0, admin: 1, super_admin: 2 };
    const current = roleOrder[this.currentUserData?.role] ?? -1;
    const required = roleOrder[minRole] ?? 99;
    if (current < required) {
      showToast(redirectMsg, 'error');
      return false;
    }
    return true;
  },

  // ===== ERROR MESSAGES =====
  _errMsg(code) {
    const map = {
      'auth/user-not-found': 'Email tidak terdaftar.',
      'auth/wrong-password': 'Password salah.',
      'auth/invalid-email': 'Format email tidak valid.',
      'auth/too-many-requests': 'Terlalu banyak percobaan. Coba lagi nanti.',
      'auth/user-disabled': 'Akun dinonaktifkan. Hubungi administrator.',
      'auth/network-request-failed': 'Gagal terhubung. Periksa koneksi internet.',
      'auth/invalid-credential': 'Email atau password salah.',
    };
    return map[code] || 'Gagal masuk. Periksa email dan password.';
  }
};

// ===== GLOBAL HANDLER FUNCTIONS =====
async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email')?.value;
  const password = document.getElementById('login-password')?.value;
  const errEl = document.getElementById('login-error');
  const btnText = document.getElementById('btn-login-text');
  const btnSpinner = document.getElementById('btn-login-spinner');
  const btn = document.getElementById('btn-login');

  if (errEl) errEl.classList.add('hidden');
  if (btn) btn.disabled = true;
  if (btnText) btnText.classList.add('hidden');
  if (btnSpinner) btnSpinner.classList.remove('hidden');

  const result = await Auth.login(email, password);

  if (btn) btn.disabled = false;
  if (btnText) btnText.classList.remove('hidden');
  if (btnSpinner) btnSpinner.classList.add('hidden');

  if (!result.ok && errEl) {
    errEl.textContent = result.error;
    errEl.classList.remove('hidden');
  }
}

async function continueLogin() {
  const btn = document.getElementById('btn-continue');
  if (btn) { btn.disabled = true; btn.textContent = 'Memeriksa...'; }

  // Give Firebase a moment to restore session
  await new Promise(r => setTimeout(r, 500));

  const { auth } = window._firebase;
  if (!auth.currentUser) {
    // Session expired, show login form
    Auth.switchAccount();
  }
  if (btn) { btn.disabled = false; btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> Lanjutkan`; }
}

function switchAccount() {
  Auth.switchAccount();
}

function handleLogout() {
  openModal({
    title: 'Keluar dari Aplikasi',
    body: '<p style="color:var(--text-secondary)">Apakah Anda yakin ingin keluar?</p>',
    footer: `
      <button class="btn btn-ghost" onclick="closeModal()">Batal</button>
      <button class="btn btn-danger" onclick="confirmLogout()">Ya, Keluar</button>
    `
  });
}

async function confirmLogout() {
  closeModal();
  await Auth.logout();
}

function togglePassword() {
  const inp = document.getElementById('login-password');
  if (!inp) return;
  inp.type = inp.type === 'password' ? 'text' : 'password';
}

window.Auth = Auth;
window.handleLogin = handleLogin;
window.continueLogin = continueLogin;
window.switchAccount = switchAccount;
window.handleLogout = handleLogout;
window.confirmLogout = confirmLogout;
window.togglePassword = togglePassword;
