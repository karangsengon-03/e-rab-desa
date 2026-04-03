/* ============================================================
   e-RAB Desa v1.0 — utils.js
   Core utility functions
   ============================================================ */

'use strict';

// ===== CURRENCY FORMATTING (integer-based, no floating point error) =====
const Utils = {

  // Format integer rupiah → "Rp 1.234.567"
  formatRp(val) {
    const num = Math.round(Number(val) || 0);
    return 'Rp ' + num.toLocaleString('id-ID', { maximumFractionDigits: 0 });
  },

  // Format number with thousand separator
  formatNum(val, decimals = 0) {
    const num = Number(val) || 0;
    return num.toLocaleString('id-ID', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  },

  // Format coefficient (4 decimal places, trim trailing zeros after 3rd)
  formatKoef(val) {
    const num = Number(val) || 0;
    // Show up to 4 decimals, but at least as many as needed
    const s = num.toFixed(4);
    return parseFloat(s).toString();
  },

  // Safe multiply avoiding floating point: multiply then round
  multiply(...args) {
    return Math.round(args.reduce((a, b) => a * (Number(b) || 0), 1));
  },

  // Safe add
  add(...args) {
    return Math.round(args.reduce((a, b) => a + Math.round(Number(b) || 0), 0));
  },

  // Parse rupiah string → integer
  parseRp(str) {
    if (typeof str === 'number') return Math.round(str);
    return Math.round(parseFloat(String(str).replace(/[^\d,-]/g, '').replace(',', '.')) || 0);
  },

  // Terbilang (angka → huruf Bahasa Indonesia)
  terbilang(n) {
    const satuan = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan',
      'sepuluh', 'sebelas', 'dua belas', 'tiga belas', 'empat belas', 'lima belas', 'enam belas',
      'tujuh belas', 'delapan belas', 'sembilan belas'];

    function _terbilang(x) {
      if (x < 20) return satuan[x];
      if (x < 100) {
        const s = satuan[Math.floor(x / 10)] + ' puluh';
        return x % 10 === 0 ? s : s + ' ' + satuan[x % 10];
      }
      if (x < 200) return 'seratus' + (x % 100 === 0 ? '' : ' ' + _terbilang(x % 100));
      if (x < 1000) return satuan[Math.floor(x / 100)] + ' ratus' + (x % 100 === 0 ? '' : ' ' + _terbilang(x % 100));
      if (x < 2000) return 'seribu' + (x % 1000 === 0 ? '' : ' ' + _terbilang(x % 1000));
      if (x < 1000000) return _terbilang(Math.floor(x / 1000)) + ' ribu' + (x % 1000 === 0 ? '' : ' ' + _terbilang(x % 1000));
      if (x < 1000000000) return _terbilang(Math.floor(x / 1000000)) + ' juta' + (x % 1000000 === 0 ? '' : ' ' + _terbilang(x % 1000000));
      if (x < 1000000000000) return _terbilang(Math.floor(x / 1000000000)) + ' miliar' + (x % 1000000000 === 0 ? '' : ' ' + _terbilang(x % 1000000000));
      return _terbilang(Math.floor(x / 1000000000000)) + ' triliun' + (x % 1000000000000 === 0 ? '' : ' ' + _terbilang(x % 1000000000000));
    }

    n = Math.round(Math.abs(n));
    if (n === 0) return 'nol rupiah';
    const result = _terbilang(n);
    return result.charAt(0).toUpperCase() + result.slice(1) + ' rupiah';
  },

  // Format date → "12 Jan 2025"
  formatDate(ts) {
    if (!ts) return '–';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  },

  // Format datetime → "12 Jan 2025, 14:30"
  formatDateTime(ts) {
    if (!ts) return '–';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('id-ID', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  },

  // Format time ago → "5 menit yang lalu"
  timeAgo(ts) {
    if (!ts) return '–';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    const diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 60) return 'Baru saja';
    if (diff < 3600) return `${Math.floor(diff / 60)} mnt lalu`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
    if (diff < 604800) return `${Math.floor(diff / 86400)} hari lalu`;
    return this.formatDate(ts);
  },

  // Generate unique ID
  uid(prefix = '') {
    return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  },

  // Deep clone object
  clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  },

  // Debounce
  debounce(fn, delay = 300) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
  },

  // Validate form fields, returns {valid, errors}
  validate(data, rules) {
    const errors = {};
    for (const [field, rule] of Object.entries(rules)) {
      const val = data[field];
      if (rule.required && (!val || String(val).trim() === '')) {
        errors[field] = rule.label + ' wajib diisi';
      } else if (val && rule.min !== undefined && Number(val) < rule.min) {
        errors[field] = rule.label + ` minimal ${rule.min}`;
      } else if (val && rule.max !== undefined && Number(val) > rule.max) {
        errors[field] = rule.label + ` maksimal ${rule.max}`;
      } else if (val && rule.minLen && String(val).length < rule.minLen) {
        errors[field] = rule.label + ` minimal ${rule.minLen} karakter`;
      }
    }
    return { valid: Object.keys(errors).length === 0, errors };
  },

  // Get initials from name
  initials(name) {
    if (!name) return '?';
    return name.trim().split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  },

  // Truncate text
  truncate(str, len = 50) {
    if (!str) return '';
    return str.length > len ? str.slice(0, len) + '…' : str;
  },

  // Escape HTML
  escHtml(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  },

  // Parse STA "0+000" → number
  parseSTA(sta) {
    if (!sta) return 0;
    const s = String(sta).replace(/\s/g, '');
    const parts = s.split('+');
    if (parts.length === 2) return (parseInt(parts[0]) * 1000) + parseInt(parts[1] || 0);
    return parseInt(s) || 0;
  },

  // Format STA number → "0+000"
  formatSTA(num) {
    const n = Math.max(0, Math.round(num));
    const km = Math.floor(n / 1000);
    const m = n % 1000;
    return `${km}+${String(m).padStart(3, '0')}`;
  },

  // Mutu beton K dari f'c (approximate: K = fc * 1.2)
  fcToK(fc) {
    const map = { 7.5: 100, 10: 125, 12: 150, 15: 175, 17: 200, 19: 225, 20: 250, 21: 250, 25: 300, 28: 350, 30: 350, 35: 400 };
    if (map[fc]) return map[fc];
    return Math.round(fc * 1.2 / 25) * 25;
  },

  // Volume calculation based on dimensions
  calcVolume(panjang, lebar, tinggi) {
    return (Number(panjang) || 0) * (Number(lebar) || 0) * (Number(tinggi) || 0);
  },

  // Area calculation
  calcArea(panjang, lebar) {
    return (Number(panjang) || 0) * (Number(lebar) || 0);
  },

  // Aspal: m³ → ton (density 2.25)
  m3ToTon(m3, density = 2.25) {
    return (Number(m3) || 0) * density;
  },

  // Aspal: ton → m³
  tonToM3(ton, density = 2.25) {
    return (Number(ton) || 0) / density;
  },

  // Sanitize number input (prevent negative, allow decimal)
  sanitizeNum(val, allowDecimal = true) {
    let s = String(val).replace(/[^\d.,]/g, '');
    if (!allowDecimal) s = s.replace(/[.,]/g, '');
    return s;
  },

  // Role labels
  roleLabel(role) {
    const map = { super_admin: 'Super Admin', admin: 'Admin', viewer: 'Viewer' };
    return map[role] || role || '–';
  },

  // Status labels & badges
  statusBadge(status) {
    const map = {
      draft: '<span class="badge badge-muted">Draft</span>',
      review: '<span class="badge badge-warning">Review</span>',
      final: '<span class="badge badge-success">Final</span>',
      locked: '<span class="badge badge-info">Dikunci</span>'
    };
    return map[status] || `<span class="badge badge-muted">${status || '–'}</span>`;
  },

  // Sumber dana labels
  sumberDanaLabel(s) {
    const map = {
      apbdes: 'APBDes', add: 'ADD', dd: 'DD (Dana Desa)',
      dak: 'DAK', pad: 'PAD Desa', bankeu: 'Bantuan Keuangan',
      hibah: 'Hibah', swadaya: 'Swadaya Masyarakat', lainnya: 'Lainnya'
    };
    return map[s] || s || '–';
  }
};

window.Utils = Utils;
