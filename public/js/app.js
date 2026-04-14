/* ============================================================
   e-RAB Desa v1.2 — app.js
   Main application controller: navigation, modal, toast, theme
   ============================================================ */

'use strict';

// ===== NAVIGATION =====
let _currentPage = 'dashboard';
let _currentPageParam = null;

function navigate(page, param = null) {
  _currentPage = page;
  _currentPageParam = param;

  // Update active sidebar link
  document.querySelectorAll('.sidebar-link').forEach(l => {
    l.classList.toggle('active', l.dataset.page === page);
  });

  // Update topbar title
  const titles = {
    dashboard: 'Dashboard',
    projects: 'Proyek RAB',
    'rab-detail': 'Detail RAB',
    'master-harga': 'Master Harga',
    'ahsp-library': 'Library AHSP',
    users: 'Manajemen User',
    settings: 'Pengaturan'
  };
  const titleEl = document.getElementById('topbar-title');
  if (titleEl) titleEl.textContent = titles[page] || page;

  // Close sidebar on mobile
  if (window.innerWidth < 768) closeSidebar();

  // Render page
  const container = document.getElementById('page-content');
  if (!container) return;

  switch (page) {
    case 'dashboard':
      Pages.renderDashboard(container);
      break;
    case 'projects':
      Pages.renderProjects(container);
      break;
    case 'rab-detail':
      Pages.renderRABDetail(container, param);
      break;
    case 'master-harga':
      Pages.renderMasterHarga(container, param);
      break;
    case 'ahsp-library':
      Pages.renderAHSPLibrary(container);
      break;
    case 'users':
      Pages.renderUsers(container);
      break;
    case 'settings':
      Pages.renderSettings(container);
      break;
    default:
      Pages.renderDashboard(container);
  }

  // Scroll to top
  container.scrollTop = 0;
  window.scrollTo(0, 0);
}

// ===== SIDEBAR TOGGLE =====
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (!sidebar) return;
  const isOpen = sidebar.classList.contains('open');
  sidebar.classList.toggle('open', !isOpen);
  overlay?.classList.toggle('hidden', isOpen);
  document.body.style.overflow = isOpen ? '' : 'hidden';
}

function closeSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  sidebar?.classList.remove('open');
  overlay?.classList.add('hidden');
  document.body.style.overflow = '';
}

// ===== MODAL =====
function openModal({ title, body, footer, size = '' }) {
  const overlay = document.getElementById('modal-overlay');
  const container = document.getElementById('modal-container');
  if (!overlay || !container) return;

  container.className = `modal-container ${size}`;
  container.innerHTML = `
    <div class="modal-header">
      <div class="modal-title">${Utils.escHtml(title)}</div>
      <button class="modal-close" onclick="closeModal()" aria-label="Tutup">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      </button>
    </div>
    <div class="modal-body">${body || ''}</div>
    ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
  `;

  overlay.classList.remove('hidden', 'fade-out');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  if (!overlay) return;
  overlay.classList.add('fade-out');
  document.body.style.overflow = '';
  setTimeout(() => {
    overlay.classList.add('hidden');
    overlay.classList.remove('fade-out');
  }, 200);
}

function closeModalOnOverlay(e) {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
}

// ===== TOAST =====
function showToast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const icons = {
    success: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><polyline points="20 6 9 17 4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
    error: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><line x1="15" y1="9" x2="9" y2="15" stroke="currentColor" stroke-width="2"/><line x1="9" y1="9" x2="15" y2="15" stroke="currentColor" stroke-width="2"/></svg>`,
    warning: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke="currentColor" stroke-width="2"/><line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" stroke-width="2"/><line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" stroke-width="2"/></svg>`,
    info: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" stroke-width="2"/><line x1="12" y1="16" x2="12.01" y2="16" stroke="currentColor" stroke-width="2"/></svg>`
  };

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span><span>${Utils.escHtml(message)}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ===== THEME TOGGLE =====
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('erab_theme', theme);

  const sunIcon = document.getElementById('theme-icon-sun');
  const moonIcon = document.getElementById('theme-icon-moon');
  if (theme === 'dark') {
    sunIcon?.classList.remove('hidden');
    moonIcon?.classList.add('hidden');
  } else {
    sunIcon?.classList.add('hidden');
    moonIcon?.classList.remove('hidden');
  }

  // Update settings toggle text if visible
  const settingsBtn = document.getElementById('theme-toggle-settings');
  if (settingsBtn) settingsBtn.textContent = theme === 'dark' ? '☀️ Terang' : '🌙 Gelap';
}

// ===== KEYBOARD SHORTCUTS =====
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

// ===== MAIN APP INIT =====
const App = {
  _initialized: false,

  init() {
    if (this._initialized) return;
    this._initialized = true;

    // Restore theme
    const savedTheme = localStorage.getItem('erab_theme') || 'light';
    applyTheme(savedTheme);

    // Navigate to dashboard
    navigate('dashboard');
  }
};

// ===== STARTUP =====
document.addEventListener('DOMContentLoaded', () => {
  // Wait for Firebase to be ready
  const startAuth = () => {
    if (window._firebaseReady) {
      Auth.init();
    } else {
      window.addEventListener('firebase-ready', () => Auth.init(), { once: true });
    }
  };

  // Give Firebase module a moment to initialize
  setTimeout(startAuth, 100);
});


// ===== SERVICE WORKER AUTO-UPDATE =====
// Jika SW baru mengambil alih (setelah skipWaiting), reload otomatis tanpa hard refresh
if ('serviceWorker' in navigator) {
  let _swRefreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (_swRefreshing) return;
    _swRefreshing = true;
    window.location.reload();
  });
}

// ===== PREVENT ACCIDENTAL NAVIGATION AWAY =====
window.addEventListener('beforeunload', (e) => {
  // Only warn if there are unsaved changes (future: implement dirty state tracking)
});

// Export globals
window.navigate = navigate;
window.toggleSidebar = toggleSidebar;
window.closeSidebar = closeSidebar;
window.openModal = openModal;
window.closeModal = closeModal;
window.closeModalOnOverlay = closeModalOnOverlay;
window.showToast = showToast;
window.toggleTheme = toggleTheme;
window.App = App;
