/* ============================================================
   e-RAB Desa v1.0 — activity-log.js
   Activity logging: who, when, what changed
   ============================================================ */

'use strict';

const ActivityLog = {

  // ===== LOG TYPES =====
  TYPES: {
    CREATE: 'create',
    EDIT: 'edit',
    DELETE: 'delete',
    LOCK: 'lock',
    UNLOCK: 'unlock',
    EXPORT: 'export',
    LOGIN: 'login',
    HARGA_UPDATE: 'harga_update',
    AHSP_CREATE: 'ahsp_create',
    AHSP_EDIT: 'ahsp_edit',
    USER_CREATE: 'user_create',
    USER_EDIT: 'user_edit'
  },

  // ===== WRITE LOG =====
  async log({ type, entity, entityId, entityName, detail, oldValue, newValue, projectId }) {
    if (!window._firebaseReady || !Auth.currentUser) return;

    const { db, addDoc, collection, serverTimestamp } = window._firebase;
    const user = Auth.currentUserData || {};

    try {
      await addDoc(collection(db, 'activity_logs'), {
        type,
        entity: entity || '',
        entityId: entityId || '',
        entityName: entityName || '',
        detail: detail || '',
        oldValue: oldValue !== undefined ? JSON.stringify(oldValue) : null,
        newValue: newValue !== undefined ? JSON.stringify(newValue) : null,
        projectId: projectId || null,
        userId: Auth.currentUser.uid,
        userEmail: user.email || '',
        userName: user.nama || user.email || '',
        userRole: user.role || '',
        createdAt: serverTimestamp()
      });
    } catch (err) {
      console.warn('Log write error:', err);
    }
  },

  // ===== CONVENIENCE METHODS =====
  create(entity, id, name, detail, projectId) {
    return this.log({ type: this.TYPES.CREATE, entity, entityId: id, entityName: name, detail, projectId });
  },

  edit(entity, id, name, oldVal, newVal, projectId) {
    return this.log({ type: this.TYPES.EDIT, entity, entityId: id, entityName: name, oldValue: oldVal, newValue: newVal, projectId });
  },

  delete(entity, id, name, projectId) {
    return this.log({ type: this.TYPES.DELETE, entity, entityId: id, entityName: name, projectId });
  },

  lock(entity, id, name, projectId) {
    return this.log({ type: this.TYPES.LOCK, entity, entityId: id, entityName: name, projectId });
  },

  unlock(entity, id, name, detail, projectId) {
    return this.log({ type: this.TYPES.UNLOCK, entity, entityId: id, entityName: name, detail, projectId });
  },

  export(format, projectName, projectId) {
    return this.log({ type: this.TYPES.EXPORT, entity: 'RAB', entityName: projectName, detail: `Export ${format.toUpperCase()}`, projectId });
  },

  hargaUpdate(kodeBahan, oldHarga, newHarga) {
    return this.log({ type: this.TYPES.HARGA_UPDATE, entity: 'master_harga', entityName: kodeBahan, oldValue: oldHarga, newValue: newHarga });
  },

  // ===== FETCH LOGS =====
  async fetchProjectLogs(projectId, limit = 50) {
    if (!window._firebaseReady) return [];
    const { db, collection, query, where, orderBy, getDocs } = window._firebase;
    try {
      const q = query(
        collection(db, 'activity_logs'),
        where('projectId', '==', projectId),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      return snap.docs.slice(0, limit).map(d => ({ id: d.id, ...d.data() }));
    } catch (err) {
      console.warn('Fetch logs error:', err);
      return [];
    }
  },

  async fetchAllLogs(limit = 100) {
    if (!window._firebaseReady) return [];
    const { db, collection, query, orderBy, getDocs } = window._firebase;
    try {
      const q = query(collection(db, 'activity_logs'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      return snap.docs.slice(0, limit).map(d => ({ id: d.id, ...d.data() }));
    } catch (err) {
      console.warn('Fetch all logs error:', err);
      return [];
    }
  },

  // ===== RENDER LOG LIST =====
  renderLogs(logs) {
    if (!logs || logs.length === 0) {
      return `<div class="empty-state">
        <svg class="empty-state-icon" width="40" height="40" viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" stroke-width="2"/><polyline points="14 2 14 8 20 8" stroke="currentColor" stroke-width="2"/></svg>
        <div class="empty-state-title">Belum ada aktivitas</div>
        <div class="empty-state-sub">Log perubahan akan muncul di sini</div>
      </div>`;
    }

    return logs.map(log => {
      const dotClass = this._dotClass(log.type);
      const label = this._typeLabel(log.type);
      const time = Utils.timeAgo(log.createdAt);
      const icon = this._typeIcon(log.type);

      return `<div class="log-item">
        <div class="log-dot ${dotClass}"></div>
        <div class="log-info">
          <div class="log-action">${icon} ${label}: <strong>${Utils.escHtml(log.entityName || log.entity)}</strong>
            ${log.detail ? `<span class="text-muted" style="font-weight:400"> — ${Utils.escHtml(log.detail)}</span>` : ''}
          </div>
          <div class="log-meta">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style="display:inline;vertical-align:middle"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="7" r="4" stroke="currentColor" stroke-width="2"/></svg>
            ${Utils.escHtml(log.userName || log.userEmail)} (${Utils.escHtml(Utils.roleLabel(log.userRole))})
            &nbsp;·&nbsp;
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style="display:inline;vertical-align:middle"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><polyline points="12 6 12 12 16 14" stroke="currentColor" stroke-width="2"/></svg>
            ${time}
          </div>
          ${log.oldValue && log.newValue ? `
            <details style="margin-top:4px;">
              <summary style="font-size:0.72rem;color:var(--text-muted);cursor:pointer">Lihat perubahan</summary>
              <div style="font-size:0.75rem;margin-top:4px;background:var(--bg-hover);border-radius:4px;padding:6px 10px;">
                <div style="color:var(--danger)">− ${Utils.escHtml(log.oldValue)}</div>
                <div style="color:var(--success)">+ ${Utils.escHtml(log.newValue)}</div>
              </div>
            </details>
          ` : ''}
        </div>
      </div>`;
    }).join('');
  },

  _dotClass(type) {
    const map = {
      create: 'log-dot-create', edit: 'log-dot-edit', delete: 'log-dot-delete',
      lock: 'log-dot-lock', unlock: 'log-dot-lock', export: 'log-dot-create',
      harga_update: 'log-dot-edit', ahsp_create: 'log-dot-create', ahsp_edit: 'log-dot-edit',
      user_create: 'log-dot-create', user_edit: 'log-dot-edit', login: 'log-dot-create'
    };
    return map[type] || 'log-dot-edit';
  },

  _typeLabel(type) {
    const map = {
      create: 'Dibuat', edit: 'Diubah', delete: 'Dihapus',
      lock: 'Dikunci', unlock: 'Dibuka kuncinya', export: 'Diekspor',
      harga_update: 'Harga diperbarui', ahsp_create: 'AHSP dibuat', ahsp_edit: 'AHSP diubah',
      user_create: 'User dibuat', user_edit: 'User diubah', login: 'Login'
    };
    return map[type] || type;
  },

  _typeIcon(type) {
    const map = {
      create: '✨', edit: '✏️', delete: '🗑️', lock: '🔒',
      unlock: '🔓', export: '📤', harga_update: '💰',
      ahsp_create: '📋', ahsp_edit: '📝', user_create: '👤', user_edit: '👥', login: '🔑'
    };
    return map[type] || '📌';
  }
};

window.ActivityLog = ActivityLog;
