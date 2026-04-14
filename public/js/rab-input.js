/* ============================================================
   e-RAB Desa v1.2 — rab-input.js
   RAB input: sections, items, STA + Input Ukuran (m/cm) + Sample
   Update sesuai permintaan: sample kecuali kanstin, toggle m/cm, dual semen
   ============================================================ */

'use strict';

const RABInput = {
  _projectId: null,
  _project: null,
  _sections: [],
  _dimUnit: 'm',           // 'm' atau 'cm'
  _allAHSP: null,
  _unsubscribe: null,
  _calcTimeout: null,
  _editingAhspId: null,

  async init(projectId) {
    this._projectId = projectId;
    this._project = await Projects.load(projectId);
    if (!this._project) { showToast('Proyek tidak ditemukan', 'error'); return; }

    await AHSP.getAll();
    this._allAHSP = AHSP._allItems || [];

    await MasterHarga.loadGlobal();
    await MasterHarga.loadProjectOverrides(projectId);

    await this._loadSections();
    await this._render();
  },

  async _loadSections() {
    if (!window._firebaseReady) {
      console.warn('Firebase belum siap saat _loadSections dipanggil');
      this._sections = [];
      return;
    }
    const { db, collection, query, orderBy, getDocs } = window._firebase;
    try {
      const q = query(collection(db, 'projects', this._projectId, 'sections'), orderBy('urutan', 'asc'));
      const snap = await getDocs(q);
      this._sections = [];
      for (const d of snap.docs) {
        const sec = { id: d.id, ...d.data() };
        const itemSnap = await getDocs(query(
          collection(db, 'projects', this._projectId, 'sections', d.id, 'items'),
          orderBy('urutan', 'asc')
        ));
        sec.items = itemSnap.docs.map(id => ({ id: id.id, ...id.data() }));
        this._sections.push(sec);
      }
    } catch (err) {
      console.error('Load sections error:', err);
      this._sections = [];
    }
  },

  async _render() {
    const container = document.getElementById('rab-builder-content');
    if (!container) return;
    const locked = this._project?.locked;
    const overheadPct = this._project?.overhead_pct ?? 15;
    const calc = await Kalkulasi.calcFullRAB(this._projectId, this._sections, overheadPct);
    // Ambil admin dari this._project langsung - tidak perlu Firestore call lagi
    const adm = this._project?.administrasi_kegiatan || { mode: 'pct', pct: 3, items: this._defaultAdminItems() };
    const subtotalFisik = calc.grandTotal;
    const admTotal = this.calcAdminTotal(adm, subtotalFisik);
    const grandTotalInclAdmin = subtotalFisik + admTotal;

    container.innerHTML = `
      ${locked ? `<div class="lock-banner">RAB ini sudah dikunci sebagai dokumen final.</div>` : ''}

      <div class="rab-info-bar">
        <div class="rab-info-item">
          <span class="rab-info-label">Subtotal Fisik</span>
          <span class="rab-info-value">${Utils.formatRp(subtotalFisik)}</span>
        </div>
        <div class="rab-info-item">
          <span class="rab-info-label">Administrasi</span>
          <span class="rab-info-value" style="color:var(--warning)">${Utils.formatRp(admTotal)}</span>
        </div>
        <div class="rab-info-item">
          <span class="rab-info-label">Total RAB</span>
          <span class="rab-info-value" id="grand-total-display" style="color:var(--primary)">${Utils.formatRp(grandTotalInclAdmin)}</span>
        </div>
        <div class="rab-info-item">
          <span class="rab-info-label">Overhead</span>
          <span class="rab-info-value">${this._project?.overhead_pct ?? 15}%</span>
        </div>
        <div style="margin-left:auto;display:flex;gap:6px;flex-wrap:wrap">
          ${!locked && Auth.can('edit_project') ? `<button class="btn btn-ghost btn-sm" onclick="RABInput.openAdminKegiatanModal(${subtotalFisik})">⚙️ Administrasi</button>` : ''}
          <button class="btn btn-secondary btn-sm" onclick="RABInput.openPreview()">👁 Preview</button>
          <button class="btn btn-accent btn-sm" onclick="ExportPDF.generate('${this._projectId}')">📄 PDF</button>
          <button class="btn btn-primary btn-sm" onclick="ExportExcel.generate('${this._projectId}')">📊 Excel</button>
        </div>
      </div>

      <div id="sections-container">
        ${calc.sections.map((sec, si) => this._renderSection(sec, si, locked)).join('')}
      </div>

      ${!locked && Auth.can('edit_project') ? `
        <button class="btn btn-secondary" style="width:100%;margin-top:12px" onclick="RABInput.openAddSectionModal()">
          Tambah Bagian Pekerjaan
        </button>` : ''}
    `;

    clearTimeout(this._calcTimeout);
    this._calcTimeout = setTimeout(() => Projects.updateTotal(this._projectId, grandTotalInclAdmin), 800);
  },

  _renderSection(sec, si, locked) {
    return `
      <div class="rab-section" id="section-${sec.id}">
        <div class="rab-section-header">
          <div class="rab-section-title" style="flex:1;min-width:0">
            <div class="rab-section-num">${si + 1}</div>
            ${Utils.escHtml(sec.nama)}
          </div>
          <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
            <div class="rab-section-total">${Utils.formatRp(sec.total || 0)}</div>
            ${!locked && Auth.can('edit_project') ? `
              <button class="btn btn-ghost btn-icon btn-sm" onclick="RABInput.openEditSectionModal('${sec.id}','${Utils.escHtml(sec.nama).replace(/'/g,"\\'")}',event)" title="Edit bagian" style="color:var(--text-muted)">✏️</button>
              <button class="btn btn-ghost btn-icon btn-sm" onclick="RABInput.confirmDeleteSection('${sec.id}','${Utils.escHtml(sec.nama).replace(/'/g,"\\'")}',event)" title="Hapus bagian" style="color:var(--danger)">🗑️</button>
            ` : ''}
          </div>
        </div>
        <div class="rab-section-body">
          ${sec.items?.map((item, ii) => this._renderItem(item, sec.id, ii, locked)).join('') || ''}
          ${!locked && Auth.can('edit_project') ? `
            <button class="btn btn-ghost btn-sm" style="width:100%;margin-top:8px;border:1.5px dashed var(--border)" onclick="RABInput.openAddItemModal('${sec.id}')">
              Tambah Item Pekerjaan
            </button>` : ''}
        </div>
      </div>
    `;
  },

  _renderItem(item, secId, itemIdx, locked) {
    const ahsp = item.ahsp || {};
    const isLangsung = item.mode === 'langsung';
    const satuan = isLangsung ? (item.display_satuan || 'buah') : (ahsp.satuan || item.display_satuan || '');
    const volDisplay = item.display_volume !== undefined
      ? `${Utils.formatNum(item.display_volume, isLangsung ? 0 : 3)} ${satuan}`
      : '–';

    return `
      <div class="rab-item-row">
        <div class="rab-item-header">
          <div style="flex:1;min-width:0">
            <div class="rab-item-code">${Utils.escHtml(item.nomor || (itemIdx+1)+'.')} · ${Utils.escHtml(ahsp.kode || item.kode_custom || '')}</div>
            <div class="rab-item-title">${Utils.escHtml(item.nama_tampil || ahsp.nama || '–')}</div>
          </div>
          ${!locked && Auth.can('edit_project') ? `
            <div style="display:flex;gap:4px;flex-shrink:0">
              <button class="btn btn-ghost btn-icon btn-sm" onclick="RABInput.openEditItemModal('${secId}','${item.id}')" title="Edit item">✏️</button>
              <button class="btn btn-ghost btn-icon btn-sm" onclick="RABInput.confirmDeleteItem('${secId}','${item.id}')" title="Hapus item" style="color:var(--danger)">🗑️</button>
            </div>` : ''}
        </div>

        <div style="font-size:0.85rem;color:var(--text-secondary);margin:8px 0">
          Volume: <strong>${volDisplay}</strong>
        </div>

        <div style="display:flex;justify-content:space-between;margin-top:8px">
          <div>HSP: <strong>${Utils.formatRp(item.hsp || 0)}</strong></div>
          <div class="rab-item-total">${Utils.formatRp(item.jumlah || 0)}</div>
        </div>
      </div>
    `;
  },

  // ==================== MODAL INPUT UKURAN ====================
  async openAddItemModal(secId) {
    // Group AHSP by kelompok untuk kemudahan pilih
    const groups = {};
    const groupLabels = {
      umum: '🏗️ Pekerjaan Umum',
      paving: '🧱 Paving Block',
      beton: '🛣️ Rabat Beton',
      aspal: '🚧 Aspal',
      drainase: '💧 Drainase',
      tpt: '🏔️ Tembok Penahan',
      gedung: '🏠 Gedung/Balai',
      air_bersih: '🚰 Air Bersih'
    };
    this._allAHSP.forEach(a => {
      const grp = a.kelompok_id || 'umum';
      if (!groups[grp]) groups[grp] = [];
      groups[grp].push(a);
    });

    const ahspList = Object.entries(groups).map(([grp, items]) => {
      const label = groupLabels[grp] || grp;
      const opts = items.map(a => {
        // Fix i: keterangan istilah HANYA di dropdown input, tidak di dokumen
        const ket = window.AHSPLabels ? AHSPLabels.getAHSP(a.id) : '';
        const displayNama = ket ? `${a.nama} — ${ket}` : a.nama;
        return `<option value="${a.id}" title="${Utils.escHtml(ket)}">${a.kode || ''} — ${Utils.escHtml(displayNama)}</option>`;
      }).join('');
      return `<optgroup label="${label}">${opts}</optgroup>`;
    }).join('');

    openModal({
      title: 'Tambah Item Pekerjaan',
      size: 'modal-lg',
      body: `
        <!-- Tab: AHSP vs Input Langsung -->
        <div style="display:flex;gap:6px;margin-bottom:14px;border-bottom:1.5px solid var(--border);padding-bottom:10px">
          <button id="tab-ahsp" class="btn btn-primary btn-sm" onclick="RABInput._switchItemTab('ahsp')">📋 Pilih AHSP</button>
          <button id="tab-langsung" class="btn btn-ghost btn-sm" onclick="RABInput._switchItemTab('langsung')">✏️ Input Langsung</button>
          <span style="margin-left:auto;font-size:0.75rem;color:var(--text-muted);align-self:center">
            Input Langsung untuk pembelian alat/barang tanpa analisa AHSP
          </span>
        </div>

        <!-- Panel AHSP -->
        <div id="panel-ahsp">
          <div class="form-group">
            <label class="lbl lbl-req">Pilih AHSP</label>
            <input type="text" class="inp" id="ahsp-search" placeholder="🔍 Ketik nama/kode AHSP..."
              oninput="RABInput._filterAHSP(this.value)" style="margin-bottom:6px">
            <select class="sel" id="item-ahsp" onchange="RABInput._onAHSPSelect(this)" size="6"
              style="height:auto;min-height:120px">${ahspList}</select>
            <div id="ahsp-sel-info" style="font-size:0.78rem;color:var(--primary);margin-top:4px;font-weight:600"></div>
          </div>
        </div>

        <!-- Panel Input Langsung -->
        <div id="panel-langsung" style="display:none">
          <div style="background:var(--info-surface,#e3f2fd);border-radius:8px;padding:10px 12px;margin-bottom:12px;font-size:0.82rem">
            ℹ️ Untuk pembelian alat, bahan, atau barang tanpa analisa AHSP. Nilai langsung masuk ke total RAB dan Bab V Rekapitulasi.
          </div>
          <div class="form-group">
            <label class="lbl lbl-req">Nama Item / Uraian</label>
            <input type="text" class="inp" id="lang-nama" placeholder="Contoh: Cangkul, Gancu, Ember, ATK...">
          </div>
          <div class="form-row form-row-3">
            <div class="form-group">
              <label class="lbl lbl-req">Jumlah / Volume</label>
              <input type="number" class="inp" id="lang-vol" step="1" min="0" value="1" oninput="RABInput._calcLangsungPreview()">
            </div>
            <div class="form-group">
              <label class="lbl lbl-req">Satuan</label>
              <select class="sel" id="lang-sat">
                <option value="buah">buah</option>
                <option value="set">set</option>
                <option value="ls">ls (lumpsum)</option>
                <option value="kg">kg</option>
                <option value="m³">m³</option>
                <option value="m²">m²</option>
                <option value="m'">m'</option>
                <option value="liter">liter</option>
                <option value="roll">roll</option>
                <option value="lembar">lembar</option>
                <option value="unit">unit</option>
              </select>
            </div>
            <div class="form-group">
              <label class="lbl lbl-req">Harga Satuan (Rp)</label>
              <div class="inp-group">
                <span class="inp-group-addon">Rp</span>
                <input type="number" class="inp" id="lang-harga" step="1000" min="0" oninput="RABInput._calcLangsungPreview()">
              </div>
            </div>
          </div>
          <div class="form-group">
            <label class="lbl">Kategori</label>
            <select class="sel" id="lang-kat">
              <option value="alat">Alat & Peralatan</option>
              <option value="bahan">Bahan & Material</option>
              <option value="lainnya">Lainnya</option>
            </select>
          </div>
          <div id="lang-preview" style="margin-top:8px;background:#e8f5e9;border-radius:8px;padding:10px 14px;font-size:0.9rem;display:none">
            Total: <strong id="lang-preview-total" style="color:var(--primary)">–</strong>
          </div>
        </div>

        <!-- Toggle Opsi Input Dimensi -->
        <div style="margin:12px 0;background:#f0f4f1;padding:10px;border-radius:8px">
          <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
            <button onclick="RABInput._switchDimMode('langsung')" id="btn-dim-langsung" class="btn btn-sm btn-primary">📐 Opsi 1: Ukuran Langsung</button>
            <button onclick="RABInput._switchDimMode('sta')" id="btn-dim-sta" class="btn btn-sm btn-ghost">📍 Opsi 2: Per STA</button>
            <div style="margin-left:auto;display:flex;gap:6px">
              <button onclick="RABInput._toggleDimUnit('m')" id="btn-unit-m" class="btn btn-sm ${this._dimUnit==='m'?'btn-primary':'btn-ghost'}">m</button>
              <button onclick="RABInput._toggleDimUnit('cm')" id="btn-unit-cm" class="btn btn-sm ${this._dimUnit==='cm'?'btn-primary':'btn-ghost'}">cm</button>
              <span id="unit-note" style="color:#555;font-size:0.8rem;align-self:center">disimpan dalam meter</span>
            </div>
          </div>

          <!-- Opsi 1: Langsung -->
          <div id="panel-dim-langsung">
            <div class="form-row form-row-3">
              <div class="form-group"><label class="lbl">Panjang</label><input type="number" class="inp" id="dim-panjang" step="0.01" oninput="RABInput._calcPreview()"></div>
              <div class="form-group"><label class="lbl">Lebar</label><input type="number" class="inp" id="dim-lebar" step="0.01" oninput="RABInput._calcPreview()"></div>
              <div class="form-group"><label class="lbl">Tebal/Tinggi/Dalam</label><input type="number" class="inp" id="dim-tinggi" step="0.001" oninput="RABInput._calcPreview()"></div>
            </div>
            <div id="sample-container" style="margin-top:6px"></div>
            <div class="form-group" style="margin-top:8px">
              <label class="lbl">Volume Manual (opsional, jika tidak pakai P×L×T)</label>
              <input type="number" class="inp" id="dim-vol-manual" step="0.001" oninput="RABInput._calcPreview()">
            </div>
          </div>

          <!-- Opsi 2: Per STA -->
          <div id="panel-dim-sta" style="display:none">
            <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:8px">
              Tambah baris per segmen STA. Volume dihitung otomatis dari penjumlahan semua STA.
            </div>
            <table style="width:100%;border-collapse:collapse;font-size:0.82rem" id="sta-table">
              <thead>
                <tr style="background:var(--bg-hover)">
                  <th style="padding:5px 8px;text-align:left;width:90px">STA Dari</th>
                  <th style="padding:5px 8px;text-align:left;width:90px">STA Ke</th>
                  <th style="padding:5px 8px;text-align:right;width:70px">Panjang</th>
                  <th style="padding:5px 8px;text-align:right;width:70px">Lebar</th>
                  <th style="padding:5px 8px;text-align:right;width:70px">Tebal</th>
                  <th style="padding:5px 8px;text-align:right;width:80px">Vol (m³)</th>
                  <th style="padding:5px 8px;width:30px"></th>
                </tr>
              </thead>
              <tbody id="sta-rows-body"></tbody>
            </table>
            <div style="display:flex;gap:8px;margin-top:6px;align-items:center">
              <button class="btn btn-ghost btn-sm" style="border:1.5px dashed var(--border)" onclick="RABInput._staAddRow()">+ Tambah Segmen STA</button>
              <div style="font-size:0.78rem;color:var(--text-muted)">
                Format STA: <strong>0+000</strong> (standar SNI) atau bebas (misal: 0-100)
              </div>
            </div>
            <div id="sta-total-preview" style="margin-top:6px;font-size:0.85rem;color:var(--primary);font-weight:600;text-align:right"></div>
          </div>
        </div>

        <div id="item-preview" style="margin-top:8px;background:#e8f5e9;border-radius:8px;padding:10px 14px;font-size:0.9rem;display:none">
          Volume: <strong id="prev-vol">–</strong> | HSP: <strong id="prev-hsp">–</strong> | Total: <strong id="prev-total" style="color:#1B5E20">–</strong>
        </div>
      `,
      footer: `
        <button class="btn btn-ghost" onclick="closeModal()">Batal</button>
        <button class="btn btn-primary" id="btn-add-item-ok" onclick="RABInput._doAddItemDispatch('${secId}')">Tambah Item</button>
      `
    });

    RABInput._addItemTab = 'ahsp';
    RABInput._staCurrentRows = [];
    RABInput._currentDimMode = 'langsung';
    setTimeout(() => {
      this._renderSampleUkuran();
      RABInput._staRerenderRows();
    }, 100);
  },

  _switchItemTab(tab) {
    RABInput._addItemTab = tab;
    document.getElementById('tab-ahsp')?.classList.toggle('btn-primary', tab === 'ahsp');
    document.getElementById('tab-ahsp')?.classList.toggle('btn-ghost', tab !== 'ahsp');
    document.getElementById('tab-langsung')?.classList.toggle('btn-primary', tab === 'langsung');
    document.getElementById('tab-langsung')?.classList.toggle('btn-ghost', tab !== 'langsung');
    document.getElementById('panel-ahsp').style.display = tab === 'ahsp' ? '' : 'none';
    document.getElementById('panel-langsung').style.display = tab === 'langsung' ? '' : 'none';
    const dimPanel = document.querySelector('#panel-ahsp ~ div[style*="background:#f0f4f1"]');
    if (dimPanel) dimPanel.style.display = tab === 'ahsp' ? '' : 'none';
  },

  _calcLangsungPreview() {
    const vol = parseFloat(document.getElementById('lang-vol')?.value) || 0;
    const harga = parseFloat(document.getElementById('lang-harga')?.value) || 0;
    const total = Math.round(vol * harga);
    const el = document.getElementById('lang-preview');
    const telEl = document.getElementById('lang-preview-total');
    if (el) el.style.display = total > 0 ? '' : 'none';
    if (telEl) telEl.textContent = Utils.formatRp(total);
  },

  async _doAddItemDispatch(secId) {
    if (RABInput._addItemTab === 'langsung') {
      return RABInput._doAddItemLangsung(secId);
    }
    return RABInput._doAddItem(secId);
  },

  async _doAddItemLangsung(secId) {
    const nama = document.getElementById('lang-nama')?.value?.trim();
    if (!nama) { showToast('Nama item wajib diisi', 'error'); return; }
    const vol = parseFloat(document.getElementById('lang-vol')?.value) || 0;
    const satuan = document.getElementById('lang-sat')?.value || 'buah';
    const harga = parseFloat(document.getElementById('lang-harga')?.value) || 0;
    const kategori = document.getElementById('lang-kat')?.value || 'alat';
    if (vol <= 0) { showToast('Jumlah harus lebih dari 0', 'error'); return; }
    if (harga <= 0) { showToast('Harga satuan harus diisi', 'error'); return; }

    const { db, collection, addDoc, serverTimestamp } = window._firebase;
    try {
      await addDoc(collection(db, 'projects', this._projectId, 'sections', secId, 'items'), {
        mode: 'langsung',           // flag: bukan dari AHSP
        ahsp_id: null,
        nama_tampil: nama,
        kode_custom: kategori === 'alat' ? 'ALAT' : kategori === 'bahan' ? 'BHN' : 'OTH',
        kategori_langsung: kategori,
        jenis_satuan: 'manual',
        display_satuan: satuan,
        volume_manual: vol,
        panjang: 0, lebar: 0, tinggi: 0,
        harga_satuan_langsung: Math.round(harga),
        urutan: (this._sections.find(s => s.id === secId)?.items?.length || 0) + 1,
        createdAt: serverTimestamp()
      });
      closeModal();
      await this._loadSections();
      await this._render();
      showToast('Item berhasil ditambahkan', 'success');
    } catch (err) {
      showToast('Gagal tambah item: ' + err.message, 'error');
    }
  },

  _filterAHSP(keyword) {
    const sel = document.getElementById('item-ahsp');
    if (!sel) return;
    const kw = keyword.toLowerCase().trim();
    const allAHSP = this._allAHSP || [];

    // Clear dan rebuild options dengan filter
    const groups = {};
    const groupLabels = {
      umum: '🏗️ Pekerjaan Umum', paving: '🧱 Paving Block',
      beton: '🛣️ Rabat Beton', aspal: '🚧 Aspal',
      drainase: '💧 Drainase', tpt: '🏔️ Tembok Penahan',
      gedung: '🏠 Gedung/Balai', air_bersih: '🚰 Air Bersih'
    };
    allAHSP.forEach(a => {
      const ket = window.AHSPLabels ? AHSPLabels.getAHSP(a.id) : '';
      const fullText = (a.nama + ' ' + (a.kode||'') + ' ' + ket).toLowerCase();
      if (kw && !fullText.includes(kw)) return;
      const grp = a.kelompok_id || 'umum';
      if (!groups[grp]) groups[grp] = [];
      groups[grp].push(a);
    });

    sel.innerHTML = Object.entries(groups).map(([grp, items]) => {
      const label = groupLabels[grp] || grp;
      const opts = items.map(a => {
        const ket = window.AHSPLabels ? AHSPLabels.getAHSP(a.id) : '';
        const displayNama = ket ? `${a.nama} — ${ket}` : a.nama;
        return `<option value="${a.id}" title="${Utils.escHtml(ket)}">${a.kode||''} — ${Utils.escHtml(displayNama)}</option>`;
      }).join('');
      return `<optgroup label="${label}">${opts}</optgroup>`;
    }).join('');
  },

  _onAHSPSelect(sel) {
    const id = sel.value;
    const ahsp = this._allAHSP?.find(a => a.id === id);
    const infoEl = document.getElementById('ahsp-sel-info');
    if (infoEl && ahsp) {
      const ket = window.AHSPLabels ? AHSPLabels.getAHSP(id) : '';
      infoEl.innerHTML = `✓ <strong>${Utils.escHtml(ahsp.nama)}</strong> | Satuan: <strong>${ahsp.satuan}</strong>`
        + (ket ? `<br><span style="color:var(--text-muted);font-weight:400;font-size:0.75rem">ℹ️ ${Utils.escHtml(ket)}</span>` : '');
    }
    this._renderSampleUkuran();
    this._calcPreview();
  },

  // ==================== STA METHODS ====================
  _switchDimMode(mode) {
    RABInput._currentDimMode = mode;
    const btnL = document.getElementById('btn-dim-langsung');
    const btnS = document.getElementById('btn-dim-sta');
    const panL = document.getElementById('panel-dim-langsung');
    const panS = document.getElementById('panel-dim-sta');
    if (btnL) { btnL.classList.toggle('btn-primary', mode==='langsung'); btnL.classList.toggle('btn-ghost', mode!=='langsung'); }
    if (btnS) { btnS.classList.toggle('btn-primary', mode==='sta'); btnS.classList.toggle('btn-ghost', mode!=='sta'); }
    if (panL) panL.style.display = mode==='langsung' ? '' : 'none';
    if (panS) panS.style.display = mode==='sta' ? '' : 'none';
    RABInput._calcPreview();
  },

  _staCalcRowVol(row) {
    const p = parseFloat(row.panjang) || 0;
    const l = parseFloat(row.lebar) || 0;
    const t = parseFloat(row.tinggi) || 0;
    return parseFloat((p * l * t).toFixed(4));
  },

  _staTotalVol() {
    return (RABInput._staCurrentRows || []).reduce((s, r) => s + RABInput._staCalcRowVol(r), 0);
  },

  _staRerenderRows() {
    const tbody = document.getElementById('sta-rows-body');
    const totalEl = document.getElementById('sta-total-preview');
    if (!tbody) return;

    tbody.innerHTML = (RABInput._staCurrentRows || []).map((r, idx) => `
      <tr style="border-bottom:1px solid var(--border)">
        <td style="padding:4px 6px">
          <input type="text" class="inp inp-sm" value="${Utils.escHtml(r.sta_dari||'')}"
            id="sta-dari-${idx}" placeholder="0+000" style="width:85px"
            oninput="RABInput._staUpdateRow(${idx})">
        </td>
        <td style="padding:4px 6px">
          <input type="text" class="inp inp-sm" value="${Utils.escHtml(r.sta_ke||'')}"
            id="sta-ke-${idx}" placeholder="0+100" style="width:85px"
            oninput="RABInput._staUpdateRow(${idx})">
        </td>
        <td style="padding:4px 6px">
          <input type="number" class="inp inp-sm" value="${r.panjang||''}"
            id="sta-p-${idx}" step="0.01" placeholder="m" style="width:65px"
            oninput="RABInput._staUpdateRow(${idx})">
        </td>
        <td style="padding:4px 6px">
          <input type="number" class="inp inp-sm" value="${r.lebar||''}"
            id="sta-l-${idx}" step="0.01" placeholder="m" style="width:65px"
            oninput="RABInput._staUpdateRow(${idx})">
        </td>
        <td style="padding:4px 6px">
          <input type="number" class="inp inp-sm" value="${r.tinggi||''}"
            id="sta-t-${idx}" step="0.001" placeholder="m" style="width:65px"
            oninput="RABInput._staUpdateRow(${idx})">
        </td>
        <td style="padding:4px 6px;text-align:right;font-family:monospace;font-size:0.8rem;color:var(--primary)">
          ${Utils.formatNum(RABInput._staCalcRowVol(r), 3)}
        </td>
        <td style="padding:4px 6px;text-align:center">
          <button class="btn btn-ghost btn-icon btn-sm" onclick="RABInput._staRemoveRow(${idx})" style="color:var(--danger)">×</button>
        </td>
      </tr>`).join('');

    const total = RABInput._staTotalVol();
    if (totalEl) totalEl.textContent = `Total Volume STA: ${Utils.formatNum(total, 3)} m³`;
    RABInput._calcPreview();
  },

  _staAddRow() {
    // Isi otomatis STA dari berdasarkan STA ke baris sebelumnya
    const rows = RABInput._staCurrentRows || [];
    const prevRow = rows[rows.length - 1];
    RABInput._staCurrentRows.push({
      sta_dari: prevRow?.sta_ke || '0+000',
      sta_ke: '',
      panjang: prevRow?.panjang || '',
      lebar: prevRow?.lebar || '',
      tinggi: prevRow?.tinggi || ''
    });
    RABInput._staRerenderRows();
  },

  _staRemoveRow(idx) {
    RABInput._staCurrentRows.splice(idx, 1);
    RABInput._staRerenderRows();
  },

  _staUpdateRow(idx) {
    const rows = RABInput._staCurrentRows;
    if (!rows[idx]) return;
    rows[idx].sta_dari = document.getElementById('sta-dari-'+idx)?.value || '';
    rows[idx].sta_ke   = document.getElementById('sta-ke-'+idx)?.value || '';
    rows[idx].panjang  = parseFloat(document.getElementById('sta-p-'+idx)?.value) || 0;
    rows[idx].lebar    = parseFloat(document.getElementById('sta-l-'+idx)?.value) || 0;
    rows[idx].tinggi   = parseFloat(document.getElementById('sta-t-'+idx)?.value) || 0;
    // Update vol di baris ini saja tanpa re-render full (supaya focus tidak hilang)
    const volCell = document.querySelector(`#sta-rows-body tr:nth-child(${idx+1}) td:nth-child(6)`);
    if (volCell) volCell.textContent = Utils.formatNum(RABInput._staCalcRowVol(rows[idx]), 3);
    const totalEl = document.getElementById('sta-total-preview');
    if (totalEl) totalEl.textContent = `Total Volume STA: ${Utils.formatNum(RABInput._staTotalVol(), 3)} m³`;
    RABInput._calcPreview();
  },

  // ==================== STA METHODS END ====================

  _toggleDimUnit(unit) {
    this._dimUnit = unit;
    const noteText = unit === 'm' ? 'Nilai disimpan dalam meter' : 'Input cm → otomatis dikonversi ke meter';
    // Handle modal tambah item
    const btnM   = document.getElementById('btn-unit-m');
    const btnCM  = document.getElementById('btn-unit-cm');
    const note   = document.getElementById('unit-note');
    if (btnM)  { btnM.classList.toggle('btn-primary', unit==='m');  btnM.classList.toggle('btn-ghost', unit==='cm'); }
    if (btnCM) { btnCM.classList.toggle('btn-primary', unit==='cm'); btnCM.classList.toggle('btn-ghost', unit==='m'); }
    if (note)  note.textContent = noteText;
    // Handle modal edit item
    const btnME  = document.getElementById('btn-unit-m-edit');
    const btnCME = document.getElementById('btn-unit-cm-edit');
    const noteE  = document.getElementById('unit-note-edit');
    if (btnME)  { btnME.classList.toggle('btn-primary', unit==='m');  btnME.classList.toggle('btn-ghost', unit==='cm'); }
    if (btnCME) { btnCME.classList.toggle('btn-primary', unit==='cm'); btnCME.classList.toggle('btn-ghost', unit==='m'); }
    if (noteE)  noteE.textContent = noteText;
    this._calcPreview();
  },

  _renderSampleUkuran() {
    const container = document.getElementById('sample-container');
    const ahspId = document.getElementById('item-ahsp')?.value;
    const ahsp = this._allAHSP.find(a => a.id === ahspId);

    if (!ahsp || ahsp.nama.toLowerCase().includes('kanstin')) {
      container.innerHTML = `<small style="color:#666">Tidak ada sample ukuran untuk Kanstin — input manual saja</small>`;
      return;
    }

    const samples = [
      {label:"Drainase biasa", p:1.0, l:0.4, t:0.4},
      {label:"Rabat beton", p:1.0, l:2.0, t:0.15},
      {label:"Pasangan batu kali", p:1.0, l:1.0, t:0.4},
      {label:"Plesteran 1:4", p:1.0, l:1.0, t:0.015},
      {label:"Galian tanah", p:1.0, l:1.0, t:0.4}
    ];

    let html = `<small style="color:#666;display:block;margin-bottom:6px">Sample ukuran cepat:</small><div style="display:flex;gap:6px;flex-wrap:wrap">`;
    samples.forEach(s => {
      html += `<button onclick="RABInput._applySample(${s.p},${s.l},${s.t});" class="btn btn-ghost btn-sm">${s.label}</button>`;
    });
    html += `</div>`;
    container.innerHTML = html;
  },

  _applySample(p, l, t) {
    const factor = this._dimUnit === 'cm' ? 100 : 1;
    document.getElementById('dim-panjang').value = (p * factor).toFixed(2);
    document.getElementById('dim-lebar').value = (l * factor).toFixed(2);
    document.getElementById('dim-tinggi').value = (t * factor).toFixed(3);
    this._calcPreview();
  },

  _toDimM(val) {
    const n = parseFloat(val) || 0;
    return this._dimUnit === 'cm' ? n / 100 : n;
  },

  async _calcPreview() {
    const prevEl = document.getElementById('item-preview');
    if (!prevEl) return;
    const ahspId = document.getElementById('item-ahsp')?.value || this._editingAhspId;
    if (!ahspId) { prevEl.style.display = 'none'; return; }

    const ahspItem = await AHSP.getById(ahspId);
    if (!ahspItem) { prevEl.style.display = 'none'; return; }

    const hspData = Kalkulasi.calcItemHSP(ahspItem, this._projectId, this._project?.overhead_pct ?? 15);

    let volume = 0;
    if (RABInput._currentDimMode === 'sta') {
      volume = RABInput._staTotalVol();
    } else {
      const p = this._toDimM(document.getElementById('dim-panjang')?.value);
      const l = this._toDimM(document.getElementById('dim-lebar')?.value);
      const t = this._toDimM(document.getElementById('dim-tinggi')?.value);
      const vm = parseFloat(document.getElementById('dim-vol-manual')?.value) || 0;
      volume = vm > 0 ? vm : (p * l * t);
    }
    const displayVol = ahspItem.satuan === 'ton' ? Utils.m3ToTon(volume) : volume;
    const total = Kalkulasi.calcLineTotal(displayVol, hspData?.hsp || 0);

    prevEl.style.display = 'block';
    document.getElementById('prev-vol').textContent = `${Utils.formatNum(displayVol, 3)} ${ahspItem.satuan}`;
    document.getElementById('prev-hsp').textContent = Utils.formatRp(hspData?.hsp || 0);
    document.getElementById('prev-total').textContent = Utils.formatRp(total);
  },

  async _doAddItem(secId) {
    const ahspId = document.getElementById('item-ahsp')?.value;
    if (!ahspId) { showToast('Pilih AHSP dulu', 'error'); return; }

    const ahspItem = await AHSP.getById(ahspId);
    const dimMode = RABInput._currentDimMode || 'langsung';
    const staRows = RABInput._staCurrentRows || [];

    let p = 0, l = 0, t = 0, volume_manual = 0;
    if (dimMode === 'sta') {
      if (staRows.length === 0) { showToast('Tambahkan minimal 1 segmen STA', 'error'); return; }
    } else {
      p = this._toDimM(document.getElementById('dim-panjang')?.value);
      l = this._toDimM(document.getElementById('dim-lebar')?.value);
      t = this._toDimM(document.getElementById('dim-tinggi')?.value);
      volume_manual = parseFloat(document.getElementById('dim-vol-manual')?.value) || 0;
    }

    const itemData = {
      ahsp_id: ahspId,
      nama_tampil: ahspItem?.nama || '',
      jenis_satuan: ahspItem?.satuan === 'm³' ? 'volume' : 'area',
      sta_mode: dimMode,
      sta_rows: dimMode === 'sta' ? staRows : [],
      panjang: p, lebar: l, tinggi: t,
      volume_manual: volume_manual,
      urutan: (this._sections.find(s => s.id === secId)?.items?.length || 0) + 1
    };

    const { db, collection, addDoc, serverTimestamp } = window._firebase;
    try {
      await addDoc(collection(db, 'projects', this._projectId, 'sections', secId, 'items'), {
        ...itemData,
        createdAt: serverTimestamp()
      });
      closeModal();
      await this._loadSections();
      await this._render();
      showToast('Item berhasil ditambahkan', 'success');
    } catch (err) {
      showToast('Gagal tambah item: ' + err.message, 'error');
    }
  },

  // openEditItemModal dan fungsi lain bisa ditambahkan nanti jika perlu
  // Untuk sekarang cukup ini dulu agar tidak terlalu panjang

   // ==================== EDIT ITEM MODAL ====================
  async openEditItemModal(secId, itemId) {
    const sec = this._sections.find(s => s.id === secId);
    const item = sec?.items?.find(i => i.id === itemId);
    if (!item) return;

    const ahspItem = await AHSP.getById(item.ahsp_id);

    openModal({
      title: 'Edit Item Pekerjaan',
      size: 'modal-lg',
      body: `
        <div style="background:var(--bg-hover);padding:12px;border-radius:8px;margin-bottom:14px">
          <strong>${Utils.escHtml(ahspItem?.nama || '')}</strong>
        </div>

        <!-- Toggle Opsi Input Dimensi -->
        <div style="margin:12px 0;background:#f0f4f1;padding:10px;border-radius:8px">
          <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
            <button onclick="RABInput._switchDimMode('langsung')" id="btn-dim-langsung" class="btn btn-sm ${!item.sta_mode||item.sta_mode==='langsung'?'btn-primary':'btn-ghost'}">📐 Opsi 1: Ukuran Langsung</button>
            <button onclick="RABInput._switchDimMode('sta')" id="btn-dim-sta" class="btn btn-sm ${item.sta_mode==='sta'?'btn-primary':'btn-ghost'}">📍 Opsi 2: Per STA</button>
            <div style="margin-left:auto;display:flex;gap:6px">
              <button onclick="RABInput._toggleDimUnit('m')" id="btn-unit-m-edit" class="btn btn-sm ${this._dimUnit==='m'?'btn-primary':'btn-ghost'}">m</button>
              <button onclick="RABInput._toggleDimUnit('cm')" id="btn-unit-cm-edit" class="btn btn-sm ${this._dimUnit==='cm'?'btn-primary':'btn-ghost'}">cm</button>
              <span id="unit-note-edit" style="color:#555;font-size:0.8rem;align-self:center">disimpan dalam meter</span>
            </div>
          </div>

          <!-- Opsi 1: Langsung -->
          <div id="panel-dim-langsung" style="${item.sta_mode==='sta'?'display:none':''}">
            <div class="form-row form-row-3">
              <div class="form-group"><label class="lbl">Panjang</label><input type="number" class="inp" id="dim-panjang" value="${item.panjang||''}" step="0.01" oninput="RABInput._calcPreview()"></div>
              <div class="form-group"><label class="lbl">Lebar</label><input type="number" class="inp" id="dim-lebar" value="${item.lebar||''}" step="0.01" oninput="RABInput._calcPreview()"></div>
              <div class="form-group"><label class="lbl">Tebal/Tinggi/Dalam</label><input type="number" class="inp" id="dim-tinggi" value="${item.tinggi||''}" step="0.001" oninput="RABInput._calcPreview()"></div>
            </div>
            <div class="form-group" style="margin-top:8px">
              <label class="lbl">Volume Manual (opsional)</label>
              <input type="number" class="inp" id="dim-vol-manual" value="${item.volume_manual||''}" step="0.001" oninput="RABInput._calcPreview()">
            </div>
          </div>

          <!-- Opsi 2: Per STA -->
          <div id="panel-dim-sta" style="${item.sta_mode==='sta'?'':'display:none'}">
            <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:8px">
              Tambah/edit baris per segmen STA. Volume dihitung otomatis dari penjumlahan semua STA.
            </div>
            <table style="width:100%;border-collapse:collapse;font-size:0.82rem" id="sta-table">
              <thead>
                <tr style="background:var(--bg-hover)">
                  <th style="padding:5px 8px;text-align:left;width:90px">STA Dari</th>
                  <th style="padding:5px 8px;text-align:left;width:90px">STA Ke</th>
                  <th style="padding:5px 8px;text-align:right;width:70px">Panjang</th>
                  <th style="padding:5px 8px;text-align:right;width:70px">Lebar</th>
                  <th style="padding:5px 8px;text-align:right;width:70px">Tebal</th>
                  <th style="padding:5px 8px;text-align:right;width:80px">Vol (m³)</th>
                  <th style="padding:5px 8px;width:30px"></th>
                </tr>
              </thead>
              <tbody id="sta-rows-body"></tbody>
            </table>
            <div style="display:flex;gap:8px;margin-top:6px;align-items:center">
              <button class="btn btn-ghost btn-sm" style="border:1.5px dashed var(--border)" onclick="RABInput._staAddRow()">+ Tambah Segmen STA</button>
              <div style="font-size:0.78rem;color:var(--text-muted)">Format: <strong>0+000</strong> (standar SNI) atau bebas</div>
            </div>
            <div id="sta-total-preview" style="margin-top:6px;font-size:0.85rem;color:var(--primary);font-weight:600;text-align:right"></div>
          </div>
        </div>

        <div id="item-preview" style="margin-top:8px;background:#e8f5e9;border-radius:8px;padding:10px 14px;font-size:0.9rem;display:none">
          Volume: <strong id="prev-vol">–</strong> | HSP: <strong id="prev-hsp">–</strong> | Total: <strong id="prev-total" style="color:#1B5E20">–</strong>
        </div>
      `,
      footer: `
        <button class="btn btn-ghost" onclick="closeModal()">Batal</button>
        <button class="btn btn-primary" onclick="RABInput._doEditItem('${secId}','${itemId}','${item.ahsp_id}')">Simpan Perubahan</button>
      `
    });

    this._editingAhspId = item.ahsp_id;
    // Inisialisasi STA rows dari data item yang ada
    RABInput._staCurrentRows = (item.sta_rows || []).map(r => ({...r}));
    RABInput._currentDimMode = item.sta_mode || 'langsung';

    setTimeout(() => {
      RABInput._staRerenderRows();
      RABInput._calcPreview();
    }, 100);
  },

  _renderSampleUkuranEdit() {
    const container = document.getElementById('sample-container-edit');
    if (!container) return;

    const ahspId = this._editingAhspId;
    const ahsp = this._allAHSP.find(a => a.id === ahspId);

    if (!ahsp || ahsp.nama.toLowerCase().includes('kanstin')) {
      container.innerHTML = `<small style="color:#666">Tidak ada sample untuk Kanstin — input manual saja</small>`;
      return;
    }

    const samples = [
      {label:"Drainase biasa", p:1.0, l:0.4, t:0.4},
      {label:"Rabat beton", p:1.0, l:2.0, t:0.15},
      {label:"Pasangan batu kali", p:1.0, l:1.0, t:0.4},
      {label:"Plesteran", p:1.0, l:1.0, t:0.015},
      {label:"Galian tanah", p:1.0, l:1.0, t:0.4}
    ];

    let html = `<small style="color:#666;display:block;margin-bottom:6px">Sample ukuran cepat:</small><div style="display:flex;gap:6px;flex-wrap:wrap">`;
    samples.forEach(s => {
      html += `<button onclick="RABInput._applySample(${s.p},${s.l},${s.t});" class="btn btn-ghost btn-sm">${s.label}</button>`;
    });
    html += `</div>`;
    container.innerHTML = html;
  },
  async _doEditItem(secId, itemId, ahspId) {
    const dimMode = RABInput._currentDimMode || 'langsung';
    const staRows = RABInput._staCurrentRows || [];
    let p = 0, l = 0, t = 0, volume_manual = 0;

    if (dimMode === 'sta') {
      if (staRows.length === 0) { showToast('Tambahkan minimal 1 segmen STA', 'error'); return; }
    } else {
      p = this._toDimM(document.getElementById('dim-panjang')?.value);
      l = this._toDimM(document.getElementById('dim-lebar')?.value);
      t = this._toDimM(document.getElementById('dim-tinggi')?.value);
      volume_manual = parseFloat(document.getElementById('dim-vol-manual')?.value) || 0;
    }

    const { db, doc, updateDoc, serverTimestamp } = window._firebase;
    try {
      await updateDoc(doc(db, 'projects', this._projectId, 'sections', secId, 'items', itemId), {
        sta_mode: dimMode,
        sta_rows: dimMode === 'sta' ? staRows : [],
        panjang: p, lebar: l, tinggi: t,
        volume_manual: volume_manual,
        updatedAt: serverTimestamp()
      });
      closeModal();
      await this._loadSections();
      await this._render();
      showToast('Item berhasil diperbarui', 'success');
    } catch (err) {
      showToast('Gagal update item: ' + err.message, 'error');
    }
  },

  confirmDeleteItem(secId, itemId) {
    openModal({
      title: 'Hapus Item Pekerjaan',
      body: '<p style="color:var(--text-secondary)">Yakin ingin menghapus item ini? Tindakan tidak dapat dibatalkan.</p>',
      footer: `
        <button class="btn btn-ghost" onclick="closeModal()">Batal</button>
        <button class="btn btn-danger" onclick="RABInput._doDeleteItem('${secId}','${itemId}')">Ya, Hapus</button>
      `
    });
  },

  async _doDeleteItem(secId, itemId) {
    const { db, doc, deleteDoc } = window._firebase;
    try {
      await deleteDoc(doc(db, 'projects', this._projectId, 'sections', secId, 'items', itemId));
      closeModal();
      await this._loadSections();
      await this._render();
      showToast('Item berhasil dihapus', 'success');
    } catch (err) {
      showToast('Gagal hapus item: ' + err.message, 'error');
    }
  }
,
  // ===== EDIT & HAPUS SECTION =====
  openEditSectionModal(secId, currentNama, event) {
    if (event) event.stopPropagation();
    openModal({
      title: 'Edit Nama Bagian',
      body: `
        <div class="form-group">
          <label class="lbl lbl-req">Nama Bagian</label>
          <input type="text" class="inp" id="edit-sec-nama" value="${Utils.escHtml(currentNama)}">
        </div>
      `,
      footer: `
        <button class="btn btn-ghost" onclick="closeModal()">Batal</button>
        <button class="btn btn-primary" onclick="RABInput._doEditSection('${secId}')">Simpan</button>
      `
    });
    setTimeout(() => {
      const inp = document.getElementById('edit-sec-nama');
      if (inp) { inp.focus(); inp.select(); }
    }, 100);
  },

  async _doEditSection(secId) {
    const nama = document.getElementById('edit-sec-nama')?.value?.trim();
    if (!nama) { showToast('Nama bagian wajib diisi', 'error'); return; }
    const { db, doc, updateDoc, serverTimestamp } = window._firebase;
    try {
      await updateDoc(doc(db, 'projects', this._projectId, 'sections', secId), {
        nama, updatedAt: serverTimestamp()
      });
      closeModal();
      await this._loadSections();
      await this._render();
      showToast('Nama bagian diperbarui', 'success');
    } catch (err) {
      showToast('Gagal update: ' + err.message, 'error');
    }
  },

  confirmDeleteSection(secId, secNama, event) {
    if (event) event.stopPropagation();
    openModal({
      title: 'Hapus Bagian Pekerjaan',
      body: `
        <div style="background:var(--danger-surface,#fff5f5);border-radius:8px;padding:12px;margin-bottom:12px;border-left:3px solid var(--danger)">
          <strong>⚠️ Perhatian!</strong> Menghapus bagian ini akan menghapus <strong>semua item pekerjaan</strong> di dalamnya secara permanen.
        </div>
        <p style="color:var(--text-secondary)">Yakin ingin menghapus bagian <strong>"${Utils.escHtml(secNama)}"</strong>?</p>
      `,
      footer: `
        <button class="btn btn-ghost" onclick="closeModal()">Batal</button>
        <button class="btn btn-danger" onclick="RABInput._doDeleteSection('${secId}')">Ya, Hapus Bagian</button>
      `
    });
  },

  async _doDeleteSection(secId) {
    const { db, collection, doc, deleteDoc, getDocs, query } = window._firebase;
    try {
      // Hapus semua items dulu
      const itemsSnap = await getDocs(collection(db, 'projects', this._projectId, 'sections', secId, 'items'));
      for (const d of itemsSnap.docs) {
        await deleteDoc(doc(db, 'projects', this._projectId, 'sections', secId, 'items', d.id));
      }
      // Hapus section
      await deleteDoc(doc(db, 'projects', this._projectId, 'sections', secId));
      closeModal();
      await this._loadSections();
      await this._render();
      showToast('Bagian berhasil dihapus', 'success');
    } catch (err) {
      showToast('Gagal hapus bagian: ' + err.message, 'error');
    }
  },

  // ===== TEMPLATE PROYEK REKOMENDASI =====
  // Setiap template punya: label, icon, sections[]
  // Setiap section punya: nama, ahspIds[] (id dari ahsp-data.json)
  _PROYEK_TEMPLATES: [
    {
      id: 'rabat_beton',
      label: 'Rabat Beton / Jalan Beton',
      icon: '🛣️',
      desc: 'Perkerasan beton jalan desa, rabat, atau halaman',
      sections: [
        { nama: 'Pekerjaan Persiapan', ahspIds: ['U-GAL-01', 'U-URU-01', 'U-PAD-01'] },
        { nama: 'Pekerjaan Beton', ahspIds: ['JB-01', 'JB-02', 'U-BEK-01'] },
        { nama: 'Pekerjaan Drainase', ahspIds: ['DR-01', 'DR-06'] }
      ]
    },
    {
      id: 'paving_block',
      label: 'Jalan Paving Block',
      icon: '🧱',
      desc: 'Jalan lingkungan atau gang dengan paving block',
      sections: [
        { nama: 'Pekerjaan Persiapan', ahspIds: ['U-GAL-01', 'U-URU-01'] },
        { nama: 'Pekerjaan Paving', ahspIds: ['PV-05', 'PV-01', 'PV-06'] },
        { nama: 'Pekerjaan Drainase', ahspIds: ['DR-01', 'DR-06'] }
      ]
    },
    {
      id: 'aspal',
      label: 'Jalan Aspal',
      icon: '🚧',
      desc: 'Hotmix, Lapen, atau overlay aspal jalan desa',
      sections: [
        { nama: 'Pekerjaan Persiapan & Tanah Dasar', ahspIds: ['U-GAL-01', 'U-PAD-02', 'AS-04'] },
        { nama: 'Pekerjaan Aspal', ahspIds: ['AS-03', 'AS-01', 'AS-02'] },
        { nama: 'Pekerjaan Drainase', ahspIds: ['DR-06', 'DR-01'] }
      ]
    },
    {
      id: 'drainase',
      label: 'Drainase / Saluran Air',
      icon: '💧',
      desc: 'Saluran drainase, gorong-gorong, atau irigasi',
      sections: [
        { nama: 'Pekerjaan Galian & Persiapan', ahspIds: ['U-GAL-01', 'U-URU-02'] },
        { nama: 'Pekerjaan Saluran', ahspIds: ['DR-06', 'DR-01', 'DR-02', 'U-PLS-01'] },
        { nama: 'Pekerjaan Bangunan Pelengkap', ahspIds: ['U-BAT-01', 'U-BET-K175'] }
      ]
    },
    {
      id: 'tpt',
      label: 'Tembok Penahan Tanah (TPT)',
      icon: '🏗️',
      desc: 'TPT batu kali atau beton untuk tebing/lereng',
      sections: [
        { nama: 'Pekerjaan Tanah', ahspIds: ['TPT-01', 'TPT-05'] },
        { nama: 'Pekerjaan Pasangan', ahspIds: ['TPT-02', 'TPT-03', 'TPT-04'] }
      ]
    },
    {
      id: 'gedung',
      label: 'Rehab Gedung / Balai Desa',
      icon: '🏠',
      desc: 'Rehabilitasi atau pembangunan gedung balai/kantor desa',
      sections: [
        { nama: 'Pekerjaan Persiapan & Pondasi', ahspIds: ['GD-01', 'GD-02', 'U-GAL-01'] },
        { nama: 'Pekerjaan Struktur Beton', ahspIds: ['GD-03', 'U-BEK-02', 'U-TUL-01'] },
        { nama: 'Pekerjaan Dinding & Plesteran', ahspIds: ['GD-04', 'GD-05', 'GD-06'] },
        { nama: 'Pekerjaan Atap', ahspIds: ['GD-07', 'GD-08'] },
        { nama: 'Pekerjaan Lantai & Finishing', ahspIds: ['GD-09', 'GD-10', 'GD-13'] }
      ]
    },
    {
      id: 'air_bersih',
      label: 'Air Bersih / Pipanisasi',
      icon: '🚰',
      desc: 'Sumur bor, pipanisasi, atau sambungan air bersih',
      sections: [
        { nama: 'Pekerjaan Sumber Air', ahspIds: ['AB-01', 'AB-02'] },
        { nama: 'Pekerjaan Distribusi', ahspIds: ['AB-05', 'AB-04', 'AB-03', 'AB-08'] }
      ]
    },
    {
      id: 'custom',
      label: 'Bagian Kosong (Custom)',
      icon: '✏️',
      desc: 'Buat bagian sendiri tanpa template — input manual',
      sections: []
    }
  ],

  openAddSectionModal() {
    // Render kartu template proyek
    const templateCards = this._PROYEK_TEMPLATES.map(t => `
      <div class="template-card" id="tpl-${t.id}"
        onclick="RABInput._selectTemplate('${t.id}')"
        style="border:2px solid var(--border);border-radius:10px;padding:12px 14px;cursor:pointer;
               margin-bottom:8px;display:flex;align-items:flex-start;gap:12px;transition:all 0.15s">
        <div style="font-size:1.6rem;line-height:1">${t.icon}</div>
        <div style="flex:1">
          <div style="font-weight:700;font-size:0.9rem">${t.label}</div>
          <div style="font-size:0.78rem;color:var(--text-muted);margin-top:2px">${t.desc}</div>
          ${t.sections.length ? `<div style="font-size:0.75rem;color:var(--primary);margin-top:4px">
            ${t.sections.map(s => s.nama).join(' → ')}
          </div>` : ''}
        </div>
        <div id="tpl-check-${t.id}" style="display:none;color:var(--primary);font-size:1.2rem">✓</div>
      </div>`).join('');

    openModal({
      title: 'Tambah Bagian Pekerjaan',
      size: 'modal-lg',
      body: `
        <div style="margin-bottom:14px">
          <div style="font-weight:600;font-size:0.88rem;margin-bottom:8px;color:var(--text-secondary)">
            📋 Pilih template rekomendasi atau buat kosong:
          </div>
          <div style="max-height:320px;overflow-y:auto;padding-right:4px">
            ${templateCards}
          </div>
        </div>

        <div id="sec-custom-wrap" style="display:none;border-top:1.5px solid var(--border);padding-top:14px;margin-top:4px">
          <div class="form-group">
            <label class="lbl lbl-req">Nama Bagian</label>
            <input type="text" class="inp" id="sec-nama" placeholder="Contoh: Pekerjaan Pondasi...">
          </div>
        </div>

        <div id="sec-template-preview" style="display:none;border-top:1.5px solid var(--border);padding-top:14px;margin-top:4px">
          <div style="font-size:0.82rem;color:var(--text-muted);margin-bottom:6px">
            ✅ Akan dibuat <strong id="sec-preview-count">0</strong> bagian dengan AHSP yang sudah terisi otomatis. Bisa diedit/dihapus setelah dibuat.
          </div>
          <div id="sec-preview-list" style="font-size:0.8rem"></div>
        </div>
      `,
      footer: `
        <button class="btn btn-ghost" onclick="closeModal()">Batal</button>
        <button class="btn btn-primary" id="btn-do-add-sec" onclick="RABInput._doAddSection()" disabled>Pilih Template Dulu</button>
      `
    });

    RABInput._selectedTemplate = null;
  },

  _selectTemplate(tplId) {
    // Reset semua kartu
    this._PROYEK_TEMPLATES.forEach(t => {
      const card = document.getElementById('tpl-' + t.id);
      const check = document.getElementById('tpl-check-' + t.id);
      if (card) card.style.borderColor = 'var(--border)';
      if (card) card.style.background = '';
      if (check) check.style.display = 'none';
    });

    // Highlight yang dipilih
    const selCard = document.getElementById('tpl-' + tplId);
    const selCheck = document.getElementById('tpl-check-' + tplId);
    if (selCard) { selCard.style.borderColor = 'var(--primary)'; selCard.style.background = 'var(--primary-surface)'; }
    if (selCheck) selCheck.style.display = '';

    const tpl = this._PROYEK_TEMPLATES.find(t => t.id === tplId);
    this._selectedTemplate = tpl;

    const customWrap = document.getElementById('sec-custom-wrap');
    const previewWrap = document.getElementById('sec-template-preview');
    const btn = document.getElementById('btn-do-add-sec');

    if (tplId === 'custom') {
      // Mode custom: tampilkan input nama
      if (customWrap) customWrap.style.display = '';
      if (previewWrap) previewWrap.style.display = 'none';
      if (btn) { btn.disabled = false; btn.textContent = 'Tambah Bagian'; }
      setTimeout(() => document.getElementById('sec-nama')?.focus(), 100);
    } else {
      // Mode template: tampilkan preview
      if (customWrap) customWrap.style.display = 'none';
      if (previewWrap) previewWrap.style.display = '';

      const count = document.getElementById('sec-preview-count');
      const list  = document.getElementById('sec-preview-list');
      if (count) count.textContent = tpl.sections.length;

      // Render preview daftar bagian + AHSP yang akan dibuat
      const allAHSP = this._allAHSP || [];
      if (list) {
        list.innerHTML = tpl.sections.map((sec, si) => {
          const ahspNames = sec.ahspIds.map(id => {
            const a = allAHSP.find(x => x.id === id);
            return a ? `<span style="background:var(--bg-hover);border-radius:4px;padding:1px 6px;margin:2px;display:inline-block">${a.nama}</span>` : '';
          }).filter(Boolean).join('');
          return `<div style="margin-bottom:8px">
            <div style="font-weight:600;color:var(--primary)">${si+1}. ${sec.nama}</div>
            <div style="margin-top:3px">${ahspNames || '<span style="color:var(--text-muted)">Tidak ada AHSP</span>'}</div>
          </div>`;
        }).join('');
      }

      if (btn) { btn.disabled = false; btn.textContent = `Buat ${tpl.sections.length} Bagian Otomatis`; }
    }
  },

  async _doAddSection() {
    const tpl = this._selectedTemplate;
    if (!tpl) { showToast('Pilih template dulu', 'error'); return; }

    const { db, collection, addDoc, serverTimestamp } = window._firebase;

    try {
      if (tpl.id === 'custom') {
        // Mode custom: satu bagian, nama dari input
        const nama = document.getElementById('sec-nama')?.value?.trim();
        if (!nama) { showToast('Nama bagian wajib diisi', 'error'); return; }
        await addDoc(collection(db, 'projects', this._projectId, 'sections'), {
          nama,
          urutan: this._sections.length + 1,
          createdAt: serverTimestamp()
        });
        showToast('Bagian berhasil ditambahkan', 'success');

      } else {
        // Mode template: buat semua bagian + item AHSP sekaligus
        const allAHSP = this._allAHSP || [];
        let urutan = this._sections.length + 1;

        for (const sec of tpl.sections) {
          // Buat section
          const secRef = await addDoc(collection(db, 'projects', this._projectId, 'sections'), {
            nama: sec.nama,
            urutan: urutan++,
            createdAt: serverTimestamp()
          });

          // Buat items AHSP di dalam section
          let itemUrutan = 1;
          for (const ahspId of sec.ahspIds) {
            const ahspItem = allAHSP.find(x => x.id === ahspId);
            if (!ahspItem) continue;
            await addDoc(collection(db, 'projects', this._projectId, 'sections', secRef.id, 'items'), {
              ahsp_id: ahspId,
              nama_tampil: ahspItem.nama,
              jenis_satuan: ahspItem.satuan === 'm³' ? 'volume' : ahspItem.satuan === 'm²' ? 'area' : ahspItem.satuan === "m'" ? 'panjang' : 'volume',
              panjang: 0, lebar: 0, tinggi: 0,
              volume_manual: 0,
              urutan: itemUrutan++,
              createdAt: serverTimestamp()
            });
          }
        }
        showToast(`${tpl.sections.length} bagian + AHSP berhasil dibuat! Silakan isi volume masing-masing item.`, 'success', 5000);
      }

      closeModal();
      await this._loadSections();
      await this._render();

    } catch (err) {
      showToast('Gagal tambah bagian: ' + err.message, 'error');
    }
  },

  _defaultAdminItems() {
    return [
      { id: 'adm1', nama: 'Honor Tim Perencana/Fasilitator', satuan: 'OB', nilai: 900000 },
      { id: 'adm2', nama: 'Pembuatan Gambar Teknis', satuan: 'paket', nilai: 750000 },
      { id: 'adm3', nama: 'Papan Nama Proyek', satuan: 'buah', nilai: 300000 },
      { id: 'adm4', nama: 'Prasasti Kegiatan', satuan: 'buah', nilai: 350000 }
    ];
  },

  _loadAdminKegiatan() {
    // Gunakan cache this._project - tidak perlu Firestore call
    if (this._project?.administrasi_kegiatan) return this._project.administrasi_kegiatan;
    return { mode: 'pct', pct: 3, items: this._defaultAdminItems() };
  },

  calcAdminTotal(adm, subtotalFisik) {
    if (adm.mode === 'pct') return Math.round((subtotalFisik * (Number(adm.pct)||3)) / 100);
    return adm.items.reduce((s, i) => s + (Number(i.nilai)||0), 0);
  },

  async openAdminKegiatanModal(subtotalFisik) {
    const adm = this._loadAdminKegiatan();
    const renderItemRows = (items) => items.map((it, idx) => `
      <tr>
        <td style="padding:5px 8px"><input type="text" class="inp inp-sm" value="${Utils.escHtml(it.nama)}" id="adm-nama-${idx}" style="width:100%"></td>
        <td style="padding:5px 8px;width:110px">
          <select class="sel sel-sm" id="adm-sat-${idx}" style="width:100%">
            <option value="ls" ${(it.satuan||'ls')==='ls'?'selected':''}>ls (lumpsum)</option>
            <option value="paket" ${it.satuan==='paket'?'selected':''}>paket</option>
            <option value="buah" ${it.satuan==='buah'?'selected':''}>buah</option>
            <option value="lembar" ${it.satuan==='lembar'?'selected':''}>lembar</option>
            <option value="set" ${it.satuan==='set'?'selected':''}>set</option>
            <option value="unit" ${it.satuan==='unit'?'selected':''}>unit</option>
            <option value="buku" ${it.satuan==='buku'?'selected':''}>buku</option>
            <option value="OH" ${it.satuan==='OH'?'selected':''}>OH (Orang/Hari)</option>
            <option value="OB" ${it.satuan==='OB'?'selected':''}>OB (Orang/Bulan)</option>
            <option value="keg" ${it.satuan==='keg'?'selected':''}>keg (kegiatan)</option>
          </select>
        </td>
        <td style="padding:5px 8px;width:140px">
          <div class="inp-group">
            <span class="inp-group-addon" style="font-size:0.75rem">Rp</span>
            <input type="number" class="inp inp-sm" value="${it.nilai}" id="adm-val-${idx}" style="width:100%">
          </div>
        </td>
        <td style="padding:5px 8px;width:40px;text-align:center">
          <button class="btn btn-ghost btn-icon btn-sm" onclick="RABInput._admRemoveRow(${idx})" title="Hapus">🗑️</button>
        </td>
      </tr>`).join('');

    openModal({
      title: 'Administrasi Kegiatan',
      size: 'modal-lg',
      body: `
        <div style="background:#e8f5e9;border-radius:8px;padding:12px;margin-bottom:14px;font-size:0.85rem">
          Subtotal Pekerjaan Fisik: <strong>${Utils.formatRp(subtotalFisik)}</strong>
        </div>

        <div style="display:flex;gap:8px;margin-bottom:14px">
          <button id="adm-btn-pct" class="btn btn-sm ${adm.mode==='pct'?'btn-primary':'btn-ghost'}"
            onclick="RABInput._admSwitchMode('pct')">Persentase (%)</button>
          <button id="adm-btn-nom" class="btn btn-sm ${adm.mode==='nominal'?'btn-primary':'btn-ghost'}"
            onclick="RABInput._admSwitchMode('nominal')">Nominal Tetap</button>
        </div>

        <div id="adm-pct-panel" style="${adm.mode!=='pct'?'display:none':''}">
          <div class="form-group">
            <label class="lbl">Persentase dari Subtotal Fisik</label>
            <div class="inp-group" style="max-width:200px">
              <input type="number" class="inp" id="adm-pct" value="${adm.pct||3}" step="0.5" min="0" max="15">
              <span class="inp-group-addon">%</span>
            </div>
            <div id="adm-pct-preview" style="margin-top:6px;font-size:0.85rem;color:var(--primary);font-weight:600"></div>
          </div>
        </div>

        <div id="adm-nom-panel" style="${adm.mode==='nominal'?'':'display:none'}">
          <div style="font-size:0.82rem;color:var(--text-muted);margin-bottom:8px">
            Edit item dan nilai. Klik + untuk tambah item baru.
          </div>
          <table style="width:100%;border-collapse:collapse" id="adm-items-table">
            <thead><tr style="background:var(--bg-hover)">
              <th style="padding:5px 8px;text-align:left">Uraian</th>
              <th style="padding:5px 8px;text-align:left;width:110px">Satuan</th>
              <th style="padding:5px 8px;text-align:left;width:140px">Nilai (Rp)</th>
              <th style="padding:5px 8px;width:40px"></th>
            </tr></thead>
            <tbody id="adm-items-body">${renderItemRows(adm.items||[])}</tbody>
          </table>
          <button class="btn btn-ghost btn-sm" style="margin-top:8px;width:100%;border:1.5px dashed var(--border)"
            onclick="RABInput._admAddRow()">+ Tambah Item</button>
          <div id="adm-nom-total" style="margin-top:8px;font-size:0.85rem;color:var(--primary);font-weight:600;text-align:right"></div>
        </div>
      `,
      footer: `
        <button class="btn btn-ghost" onclick="closeModal()">Batal</button>
        <button class="btn btn-primary" onclick="RABInput._doSaveAdmin(${subtotalFisik})">Simpan</button>
      `
    });

    // Store current items for modal manipulation
    RABInput._admCurrentItems = (adm.items||[]).map(i=>({...i}));
    RABInput._admCurrentMode = adm.mode;
    setTimeout(() => { RABInput._admUpdatePctPreview(subtotalFisik); RABInput._admUpdateNomTotal(); }, 100);
  },

  _admSwitchMode(mode) {
    RABInput._admCurrentMode = mode;
    document.getElementById('adm-btn-pct')?.classList.toggle('btn-primary', mode==='pct');
    document.getElementById('adm-btn-pct')?.classList.toggle('btn-ghost', mode!=='pct');
    document.getElementById('adm-btn-nom')?.classList.toggle('btn-primary', mode==='nominal');
    document.getElementById('adm-btn-nom')?.classList.toggle('btn-ghost', mode!=='nominal');
    document.getElementById('adm-pct-panel').style.display = mode==='pct' ? '' : 'none';
    document.getElementById('adm-nom-panel').style.display = mode==='nominal' ? '' : 'none';
  },

  _admUpdatePctPreview(subtotalFisik) {
    const pct = parseFloat(document.getElementById('adm-pct')?.value) || 0;
    const total = Math.round(subtotalFisik * pct / 100);
    const el = document.getElementById('adm-pct-preview');
    if (el) el.textContent = `= ${Utils.formatRp(total)}`;
    document.getElementById('adm-pct')?.addEventListener('input', () => RABInput._admUpdatePctPreview(subtotalFisik));
  },

  _admAddRow() {
    RABInput._admCurrentItems.push({ id: 'adm_'+Date.now(), nama: '', satuan: 'ls', nilai: 0 });
    RABInput._admRerenderRows();
  },

  _admRemoveRow(idx) {
    RABInput._admCurrentItems.splice(idx, 1);
    RABInput._admRerenderRows();
  },

  _admRerenderRows() {
    const tbody = document.getElementById('adm-items-body');
    if (!tbody) return;
    tbody.innerHTML = RABInput._admCurrentItems.map((it, idx) => `
      <tr>
        <td style="padding:5px 8px"><input type="text" class="inp inp-sm" value="${Utils.escHtml(it.nama)}" id="adm-nama-${idx}" style="width:100%"></td>
        <td style="padding:5px 8px;width:110px">
          <select class="sel sel-sm" id="adm-sat-${idx}" style="width:100%">
            <option value="ls" ${(it.satuan||'ls')==='ls'?'selected':''}>ls (lumpsum)</option>
            <option value="paket" ${it.satuan==='paket'?'selected':''}>paket</option>
            <option value="buah" ${it.satuan==='buah'?'selected':''}>buah</option>
            <option value="lembar" ${it.satuan==='lembar'?'selected':''}>lembar</option>
            <option value="set" ${it.satuan==='set'?'selected':''}>set</option>
            <option value="unit" ${it.satuan==='unit'?'selected':''}>unit</option>
            <option value="buku" ${it.satuan==='buku'?'selected':''}>buku</option>
            <option value="OH" ${it.satuan==='OH'?'selected':''}>OH (Orang/Hari)</option>
            <option value="OB" ${it.satuan==='OB'?'selected':''}>OB (Orang/Bulan)</option>
            <option value="keg" ${it.satuan==='keg'?'selected':''}>keg (kegiatan)</option>
          </select>
        </td>
        <td style="padding:5px 8px;width:140px">
          <div class="inp-group">
            <span class="inp-group-addon" style="font-size:0.75rem">Rp</span>
            <input type="number" class="inp inp-sm" value="${it.nilai}" id="adm-val-${idx}" oninput="RABInput._admUpdateNomTotal()" style="width:100%">
          </div>
        </td>
        <td style="padding:5px 8px;width:40px;text-align:center">
          <button class="btn btn-ghost btn-icon btn-sm" onclick="RABInput._admRemoveRow(${idx})" title="Hapus">🗑️</button>
        </td>
      </tr>`).join('');
    RABInput._admUpdateNomTotal();
  },

  _admUpdateNomTotal() {
    const items = RABInput._admCurrentItems || [];
    let total = 0;
    items.forEach((_, idx) => {
      total += parseFloat(document.getElementById('adm-val-'+idx)?.value) || 0;
    });
    const el = document.getElementById('adm-nom-total');
    if (el) el.textContent = 'Total: ' + Utils.formatRp(total);
  },

  async _doSaveAdmin(subtotalFisik) {
    const mode = RABInput._admCurrentMode || 'pct';
    const pct = parseFloat(document.getElementById('adm-pct')?.value) || 3;
    const items = (RABInput._admCurrentItems||[]).map((it, idx) => ({
      id: it.id,
      nama: document.getElementById('adm-nama-'+idx)?.value?.trim() || it.nama,
      satuan: document.getElementById('adm-sat-'+idx)?.value || 'ls',
      nilai: parseFloat(document.getElementById('adm-val-'+idx)?.value) || 0
    }));
    const admData = { mode, pct, items };
    const { db, doc, updateDoc, serverTimestamp } = window._firebase;
    try {
      await updateDoc(doc(db, 'projects', this._projectId), {
        administrasi_kegiatan: admData,
        updatedAt: serverTimestamp()
      });
      this._project = await Projects.load(this._projectId);
      closeModal();
      await this._render();
      showToast('Administrasi kegiatan disimpan', 'success');
    } catch (err) {
      showToast('Gagal simpan: ' + err.message, 'error');
    }
  },

  // ==================== PREVIEW ====================
  async openPreview() {
    openModal({
      title: 'Preview RAB',
      size: 'modal-xl',
      body: `<div class="loading-text text-center" style="padding:30px">Memuat preview...</div>`,
      footer: `
        <button class="btn btn-ghost" onclick="closeModal()">Tutup</button>
        <button class="btn btn-accent btn-sm" onclick="ExportPDF.generate('${this._projectId}')">Export PDF</button>
        <button class="btn btn-primary btn-sm" onclick="ExportExcel.generate('${this._projectId}')">Export Excel</button>
      `
    });
    // Render preview content
    await AHSP.getAll();
    await MasterHarga.loadGlobal();
    await MasterHarga.loadProjectOverrides(this._projectId);
    const overheadPct = this._project?.overhead_pct ?? 15;
    const calc = await Kalkulasi.calcFullRAB(this._projectId, this._sections, overheadPct);
    const project = this._project;
    const adm = this._loadAdminKegiatan();
    const subtotalFisik = calc.grandTotal;
    const admTotal = this.calcAdminTotal(adm, subtotalFisik);
    const grandTotal = subtotalFisik + admTotal;
    const previewHtml = Pages._renderRABPreviewContent(project, calc, adm, admTotal, grandTotal);
    const body = document.querySelector('#modal-container .modal-body');
    if (body) body.innerHTML = `<div style="max-height:75vh;overflow-y:auto">${previewHtml}</div>`;
  }
};

window.RABInput = RABInput;