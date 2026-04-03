# 🐙 PANDUAN DEPLOY VIA GITHUB — e-RAB Desa v1.0

## GitHub + Firebase Hosting Auto-Deploy

---

## LANGKAH 1: Buat Repository GitHub

1. Buka **https://github.com** → Login
2. Klik **"New repository"** (tombol hijau di kanan atas)
3. Repository name: `e-rab-desa`
4. Visibility: **Private** (disarankan untuk keamanan data desa)
5. Klik **"Create repository"**

---

## LANGKAH 2: Upload Project ke GitHub

### Cara A: Via GitHub Desktop (Mudah)
1. Download GitHub Desktop: https://desktop.github.com
2. Klik **"Clone a repository"** → pilih repo baru Anda
3. Copy semua file project ke folder tersebut
4. Klik **"Commit to main"**
5. Klik **"Push origin"**

### Cara B: Via Terminal
```bash
# Di folder project e-rab-desa:
git init
git add .
git commit -m "Initial commit: e-RAB Desa v1.0"
git remote add origin https://github.com/USERNAME/e-rab-desa.git
git branch -M main
git push -u origin main
```

---

## LANGKAH 3: Setup GitHub Secrets

Secrets diperlukan agar GitHub Actions bisa deploy ke Firebase.

1. Di repository GitHub → klik **"Settings"**
2. Sidebar kiri → **"Secrets and variables"** → **"Actions"**
3. Klik **"New repository secret"**

### Secret yang Dibutuhkan:

#### Secret 1: FIREBASE_SERVICE_ACCOUNT_E_RAB_DESA
Ini Service Account JSON dari Firebase:
1. Buka Firebase Console → Project Settings → Service Accounts
2. Klik **"Generate new private key"**
3. Download file JSON
4. Copy isi file JSON tersebut (seluruhnya)
5. Paste sebagai nilai secret `FIREBASE_SERVICE_ACCOUNT_E_RAB_DESA`

#### Secret 2: FIREBASE_TOKEN (Opsional, untuk deploy rules)
```bash
# Di terminal lokal (dengan Firebase CLI terinstall):
npm install -g firebase-tools
firebase login:ci
# Copy token yang muncul → paste sebagai FIREBASE_TOKEN
```

---

## LANGKAH 4: Setup GitHub Actions

File workflow sudah ada di `.github/workflows/firebase-deploy.yml`.

GitHub Actions akan **otomatis deploy** setiap kali ada push ke branch `main`.

---

## LANGKAH 5: Test Deploy Pertama

1. Di GitHub Desktop / terminal, buat perubahan kecil (misal: update komentar di README)
2. Commit dan Push ke `main`
3. Buka tab **"Actions"** di repository GitHub
4. Lihat workflow berjalan (kuning = loading, hijau = berhasil, merah = error)
5. Setelah berhasil, buka: **https://e-rab-desa.web.app**

---

## Alur Deploy Selanjutnya (Update Apps)

Setiap kali ada update pada aplikasi:

```
Edit file di komputer
       ↓
Commit di GitHub Desktop / git commit
       ↓
Push ke GitHub (main branch)
       ↓
GitHub Actions otomatis berjalan (~2-3 menit)
       ↓
Firebase Hosting diperbarui otomatis
       ↓
User yang buka apps mendapat notifikasi update
dan apps refresh otomatis (tanpa clear cache, tanpa uninstall)
```

---

## Versi Aplikasi

| Jenis Update | Versi | Contoh |
|---|---|---|
| Perbaikan bug kecil, typo | `1.0.X` | 1.0.1, 1.0.2 |
| Fitur baru minor | `1.X.0` | 1.1.0, 1.2.0 |
| Perubahan besar / redesign | `X.0.0` | 2.0.0, 3.0.0 |

Update versi dilakukan di:
- `sw.js` → `const CACHE_VERSION`
- `index.html` → `<title>` dan `.login-version`
- `manifest.json` → `"version"`

---

## URL Akses Aplikasi

| Lingkungan | URL |
|---|---|
| Production | https://e-rab-desa.web.app |
| Alternatif | https://e-rab-desa.firebaseapp.com |
| Preview PR | https://e-rab-desa--pr-X-HASH.web.app |

---

## 🆘 Troubleshooting Deploy

| Masalah | Solusi |
|---------|--------|
| Action gagal "Service account not found" | Periksa secret `FIREBASE_SERVICE_ACCOUNT_E_RAB_DESA` |
| Deploy berhasil tapi web tidak update | Tunggu ~5 menit atau hard refresh (Ctrl+Shift+R) |
| Error "Hosting deploy failed" | Cek tab Actions untuk detail error |
| App masih versi lama setelah deploy | Clear cache browser SEKALI, setelah itu otomatis |

---

*Panduan ini untuk e-RAB Desa v1.0 — Deploy via GitHub Actions ke Firebase Hosting*
