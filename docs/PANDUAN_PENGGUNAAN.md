# 📖 PANDUAN PENGGUNAAN — e-RAB Desa v1.0

## Sistem Rencana Anggaran Biaya Pekerjaan Fisik Desa Digital

---

## 🔑 LOGIN & AKSES

### Login Pertama Kali
1. Buka **https://e-rab-desa.web.app**
2. Masukkan email dan password yang sudah didaftarkan
3. Klik **"Masuk"**

### Login Berikutnya (Remember User)
- Aplikasi akan menampilkan nama dan email terakhir
- Klik **"Lanjutkan"** untuk langsung masuk
- Klik **"Ganti Akun"** untuk login dengan akun berbeda

### Level Akses (Role)
| Role | Hak Akses |
|------|-----------|
| **Super Admin** | Semua fitur, termasuk kelola user |
| **Admin** | Buat/edit proyek, update harga, AHSP custom |
| **Viewer** | Hanya lihat dan export dokumen |

---

## 🏠 DASHBOARD

Halaman utama menampilkan:
- **Kartu statistik:** Total proyek, RAB final, draft, total nilai
- **Proyek terbaru:** Daftar proyek dengan total nilai
- **Aktivitas terbaru:** Log perubahan oleh semua user

---

## 📁 MEMBUAT PROYEK RAB BARU

1. Klik **"Proyek RAB"** di sidebar
2. Klik **"Buat Proyek Baru"** (tombol hijau kanan atas)
3. Isi form:
   - **Nama Kegiatan:** Deskripsi lengkap kegiatan
   - **Tahun Anggaran:** Tahun pelaksanaan
   - **Sumber Dana:** DD, ADD, APBDes, DAK, dll
   - **Lokasi:** Desa, Kecamatan, Kabupaten, Provinsi
   - **No. Dokumen:** Nomor referensi (opsional)
   - **Overhead:** 10% / 12% / 15% (default 15%)
   - **Mode Tampilan STA:** Opsi A (sub-baris) atau B (baris langsung)
4. Klik **"Buat Proyek"**

---

## 📊 INPUT RAB PEKERJAAN

### Menambah Bagian Pekerjaan (Section)
1. Buka proyek → scroll ke bawah
2. Klik **"Tambah Bagian Pekerjaan"**
3. Masukkan nama bagian (misal: `I. PEKERJAAN PERSIAPAN`)
4. Klik **"Tambah"**

### Menambah Item Pekerjaan
1. Di dalam bagian → klik **"Tambah Item Pekerjaan"**
2. Pilih **Jenis Pekerjaan** dari dropdown AHSP
3. Sistem akan tampilkan HSP otomatis
4. Pilih **Mode Input**:
   - **Opsi A:** Input per STA (segmen) — untuk pekerjaan linear
   - **Opsi B:** Input langsung (P × L × T)

### Input Dimensi (Opsi B — Langsung)
| Field | Keterangan |
|-------|-----------|
| Panjang (m) | Panjang pekerjaan |
| Lebar (m) | Lebar pekerjaan |
| Tebal/Tinggi/Dalam (m) | Tebal/tinggi/kedalaman |
| Volume Manual | Isi jika tidak pakai P×L×T |

Volume dihitung otomatis: **P × L × T = Volume**

### Input STA (Opsi A — Per Segmen)
| Field | Keterangan |
|-------|-----------|
| STA Awal | Format: `0+000` |
| STA Akhir | Format: `0+050` |
| Panjang (m) | Panjang segmen ini |
| Lebar (m) | Lebar segmen |
| T/D (m) | Tebal/kedalaman |

Bisa tambah banyak baris STA. Volume total = akumulasi semua baris.

### Catatan Khusus Jalan Aspal (Hotmix)
- Input dalam **m²** (Panjang × Lebar) dan **tebal dalam meter**
- Sistem otomatis konversi ke **ton** (× 2,25 density)
- Tampil: `Volume ton (= X m³ × 2,25)`

### Catatan Mutu Beton
Sistem menampilkan dua notasi sekaligus:
- `f'c 25 MPa / K-300`
- `f'c 10 MPa / K-125`

---

## 💰 MASTER HARGA

### Update Harga Global
1. Klik **"Master Harga"** di sidebar
2. Pilih tab: **Upah Tenaga** / **Bahan & Material** / **Sewa Alat**
3. Klik ikon edit (✏️) di baris yang ingin diubah
4. Masukkan harga baru (sudah include PPN + PPh22)
5. Tambahkan catatan jika perlu
6. Klik **"Simpan"**

### Override Harga Per Proyek
Untuk harga yang berbeda dari harga global di proyek tertentu:
1. Di halaman proyek → klik **"Harga Lokal"** (tombol kanan atas)
2. Edit item yang ingin di-override
3. Pilih mode:
   - **Opsi A:** Masukkan harga all-in langsung
   - **Opsi B:** Harga dasar + biaya angkut terpisah (lebih transparan untuk audit)
4. Klik **"Simpan"**

Override akan tampil dengan label **[Override]** dan warna oranye.

---

## 📚 LIBRARY AHSP

### Lihat Detail Koefisien
1. Klik **"Library AHSP"** di sidebar
2. Klik ikon mata (👁) di item pekerjaan
3. Tampil breakdown: Upah + Bahan + Alat + HSP

### AHSP Custom
Untuk pekerjaan yang tidak ada di library standar:
1. Klik **"AHSP Custom"** (kanan atas)
2. Isi nama, kode, satuan
3. Tambahkan komponen upah, bahan, alat dengan koefisien
4. Klik **"Buat AHSP"**

Atau salin dari AHSP standar:
1. Klik ikon copy di item standar
2. Edit nama dan koefisien sesuai kebutuhan

---

## 🔒 KUNCI RAB (FINALISASI)

Setelah RAB selesai dan siap jadi dokumen final:
1. Buka proyek → klik **"Kunci RAB"** (kanan atas)
2. Konfirmasi penguncian
3. Semua input dinonaktifkan (tidak bisa diubah)
4. Status berubah menjadi **"Dikunci"**

### Buka Kunci (Jika ada revisi)
1. Klik **"Buka Kunci"** (muncul saat RAB terkunci)
2. **Wajib** isi alasan membuka kunci
3. Alasan akan tercatat di log perubahan

---

## 📤 EXPORT DOKUMEN

### Export PDF (Satu Paket Lengkap)
1. Klik **"Export"** → **"Export PDF"**
2. Dokumen terdiri dari:
   - Cover & Info Proyek
   - Rekapitulasi RAB
   - RAB per Bagian (dengan detail STA)
   - Analisa AHSP per item
   - Daftar Harga Satuan Dasar
3. Browser akan membuka halaman cetak
4. Pilih **"Save as PDF"** atau **"Cetak"**

### Export Excel
1. Klik **"Export"** → **"Export Excel"**
2. File `.xlsx` langsung terunduh
3. Berisi sheet: Informasi Proyek, Rekapitulasi, RAB per Bagian, AHSP, HSD

### Preview Sebelum Export
1. Klik **"Preview"** untuk lihat tampilan dokumen sebelum export
2. Dari preview bisa langsung export PDF atau Excel

---

## 📋 LOG PERUBAHAN

Semua perubahan tercatat otomatis:
- **Siapa** yang mengubah
- **Kapan** diubah
- **Apa** yang diubah (nilai lama → nilai baru)

Akses log:
1. Buka proyek → klik **"Log"** (kanan atas)
2. Atau di Dashboard → panel "Aktivitas Terbaru"

---

## 💾 BACKUP DATA

Backup semua data proyek:
1. Klik **"Pengaturan"** di sidebar
2. Klik **"Export Backup JSON"**
3. File JSON berisi semua proyek dan master harga
4. Simpan di tempat aman (Google Drive, dll)

---

## 📱 INSTALL SEBAGAI APPS (PWA)

### Android (Chrome)
1. Buka https://e-rab-desa.web.app di Chrome
2. Muncul banner **"Tambahkan ke layar utama"** → ketuk
3. Atau: Menu (⋮) → **"Tambahkan ke layar utama"**

### PC/Laptop (Chrome)
1. Di address bar, klik ikon **"Install"** (⊞)
2. Klik **"Install"**
3. App terbuka seperti aplikasi desktop

### Update Otomatis
- Setiap ada update dari developer, apps akan **refresh otomatis**
- Tidak perlu uninstall/reinstall
- Tidak perlu clear cache
- Cukup **soft refresh** (muncul notifikasi kecil di atas)

---

## 🆘 FAQ

**Q: Kenapa HSP berubah setelah update harga?**
A: Semua kalkulasi realtime. Saat harga diubah, semua proyek yang menggunakan bahan tersebut otomatis recalculate.

**Q: Bisakah 2 orang edit proyek bersamaan?**
A: Bisa, tapi disarankan bergantian. Data tersimpan di Firestore real-time.

**Q: Apakah bisa dipakai offline?**
A: Tampilan bisa muncul dari cache, tapi data terbaru butuh koneksi internet.

**Q: Bagaimana jika harga bahan naik di tengah proyek?**
A: Gunakan fitur Override Harga Per Proyek (jangan ubah harga global). Harga proyek yang sudah ada tidak terpengaruh.

---

*e-RAB Desa v1.0 — Berdasarkan Permen PUPR No.8 Tahun 2023*
