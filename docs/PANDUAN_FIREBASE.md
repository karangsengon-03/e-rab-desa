# 🔥 PANDUAN SETUP FIREBASE — e-RAB Desa v1.0

## Panduan Lengkap dari Nol

---

## LANGKAH 1: Buka Firebase Console

1. Buka browser, kunjungi: **https://console.firebase.google.com**
2. Login dengan akun Google Anda
3. Klik **"Create a project"** atau **"Tambahkan project"**

---

## LANGKAH 2: Buat Project Firebase

1. **Nama project:** `e-rab-desa` (atau nama lain sesuai desa)
2. **Google Analytics:** Klik **"Lanjutkan"** (bisa ON atau OFF, pilih sesuai kebutuhan)
3. Tunggu proses pembuatan project selesai (~30 detik)
4. Klik **"Lanjutkan"**

---

## LANGKAH 3: Aktifkan Authentication

1. Di sidebar kiri, klik **"Build"** → **"Authentication"**
2. Klik **"Get started"**
3. Tab **"Sign-in method"** → Klik **"Email/Password"**
4. Toggle **"Enable"** → ON
5. Klik **"Save"**

### Buat Akun Super Admin Pertama:
1. Klik tab **"Users"**
2. Klik **"Add user"**
3. Masukkan email dan password Anda
4. Klik **"Add user"**
5. **Salin UID** yang muncul (format: `abc123def456...`) — akan dibutuhkan di Langkah 6

---

## LANGKAH 4: Buat Firestore Database

1. Di sidebar kiri, klik **"Build"** → **"Firestore Database"**
2. Klik **"Create database"**
3. Pilih **"Production mode"** (aman, rules akan di-set manual)
4. Pilih region terdekat: **`asia-southeast1`** (Singapore, paling dekat ke Indonesia)
5. Klik **"Enable"**

---

## LANGKAH 5: Set Firestore Security Rules

1. Klik tab **"Rules"** di Firestore
2. **Hapus** semua rules yang ada
3. **Copy-paste** isi file `firestore.rules` dari repository ini
4. Klik **"Publish"**

> ⚠️ **PENTING:** Jangan gunakan rules `allow read, write: if true` — ini berbahaya!

---

## LANGKAH 6: Buat Data Super Admin di Firestore

Setelah database aktif dan Anda sudah punya UID dari Langkah 3:

1. Klik **"Data"** di Firestore
2. Klik **"+ Start collection"**
3. Collection ID: `users` → Klik **"Next"**
4. Document ID: **paste UID Anda** (dari Langkah 3)
5. Tambahkan fields:

| Field | Type | Value |
|-------|------|-------|
| `email` | string | email Anda |
| `nama` | string | nama lengkap Anda |
| `role` | string | `super_admin` |
| `createdAt` | timestamp | (klik Now) |

6. Klik **"Save"**

---

## LANGKAH 7: Dapatkan Firebase Config

1. Di sidebar, klik ikon ⚙️ (gear) → **"Project settings"**
2. Scroll ke bawah ke bagian **"Your apps"**
3. Klik ikon **`</>`** (Web app)
4. Nama app: `e-rab-desa-web` → Klik **"Register app"**
5. **Salin** seluruh `firebaseConfig` object yang muncul

Contoh format:
```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "e-rab-desa.firebaseapp.com",
  projectId: "e-rab-desa",
  storageBucket: "e-rab-desa.firebasestorage.app",
  messagingSenderId: "759808...",
  appId: "1:759808...:web:abc123..."
};
```

> ✅ Config Anda sudah ada di `public/index.html` — **tidak perlu diubah** karena sudah dikonfigurasi.

---

## LANGKAH 8: Seed Master Harga (Otomatis)

Aplikasi akan otomatis mengisi data master harga default saat pertama kali dibuka. Tidak perlu input manual.

---

## LANGKAH 9: Deploy Firestore Indexes (Opsional via CLI)

Jika menggunakan GitHub Actions (otomatis), langkah ini tidak perlu manual.

Jika mau manual via terminal:
```bash
npm install -g firebase-tools
firebase login
firebase deploy --only firestore:indexes --project e-rab-desa
```

---

## LANGKAH 10: Tambah User Lain

Setelah Anda login sebagai Super Admin:
1. Buka menu **"Manajemen User"** di sidebar
2. Minta user lain mendaftar terlebih dahulu melalui Firebase Auth
3. Atau tambahkan manual di **Firebase Console → Authentication → Users**
4. Setelah user pertama kali login, update role-nya di Firestore **users** collection

---

## 🔐 Tentang Keamanan API Key

Firebase API Key di frontend **aman dan by design boleh terlihat publik**. Keamanan sesungguhnya dijaga oleh:
- ✅ Firestore Security Rules (sudah dikonfigurasi)
- ✅ Firebase Authentication (wajib login)
- ✅ Role-based access control

Yang TIDAK boleh dipublikasikan:
- ❌ Service Account JSON (untuk Firebase Admin SDK)
- ❌ Firebase Token (untuk CI/CD)

---

## 🆘 Troubleshooting

| Masalah | Solusi |
|---------|--------|
| Login gagal "User not found" | Pastikan user dibuat di Firebase Auth |
| "Permission denied" di Firestore | Cek apakah Security Rules sudah di-publish |
| Data tidak muncul | Pastikan dokumen `users/{uid}` ada dengan field `role` |
| App tidak bisa install | Pastikan HTTPS (Firebase Hosting sudah HTTPS otomatis) |
| Super Admin tidak bisa akses | Pastikan `role` di Firestore = `super_admin` (bukan `Super Admin`) |

---

*Panduan ini untuk e-RAB Desa v1.0 — Permen PUPR No.8/2023*
