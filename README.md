# 🏘️ e-RAB Desa v1.0

**Aplikasi Rencana Anggaran Biaya Pekerjaan Fisik Desa Digital**

Berdasarkan **Permen PUPR No.8 Tahun 2023** + Lampiran IV AHSP Bidang Cipta Karya dan Perumahan

---

## Fitur Utama

- ✅ Input RAB dengan dimensi (P×L×T) dan STA per segmen
- ✅ Library AHSP standar PUPR (terkunci) + Custom
- ✅ Master harga global + override per proyek (2 opsi: all-in / base+angkut)
- ✅ Kalkulasi otomatis: Upah + Bahan + Alat + Overhead
- ✅ Export PDF (Cover + Rekap + RAB + AHSP + HSD) & Excel
- ✅ Kunci RAB / Finalisasi dengan log perubahan
- ✅ Mode gelap / terang
- ✅ PWA: Install sebagai apps, update otomatis
- ✅ Multi-user dengan 3 level role

## 6 Bidang Pekerjaan Default

1. 🛣️ Jalan Rabat Beton Perdesaan
2. 🧱 Jalan Paving Block Lingkungan
3. 🧱 Tembok Penahan Tanah (TPT)
4. 🌊 Drainase / Saluran Air
5. 🏠 Rehab Gedung Balai/Kantor Desa
6. 🛣️ Jalan Aspal Desa (Lapen + Hotmix AC-BC/AC-WC)

## Stack Teknologi

- **Frontend:** HTML5 + CSS3 + Vanilla JavaScript (no framework)
- **Backend:** Firebase Firestore
- **Auth:** Firebase Authentication
- **Hosting:** Firebase Hosting via GitHub Actions
- **PWA:** Service Worker (Network-first + Auto-update)

## Deploy

Push ke `main` branch → GitHub Actions otomatis deploy ke Firebase Hosting.

URL: **https://e-rab-desa.web.app**

## Dokumentasi

- [Panduan Firebase Setup](docs/PANDUAN_FIREBASE.md)
- [Panduan GitHub Deploy](docs/PANDUAN_GITHUB.md)
- [Panduan Penggunaan](docs/PANDUAN_PENGGUNAAN.md)

---

*Dikembangkan untuk Desa Karangsengon dan desa-desa di seluruh Indonesia*
by Super Admin
