/* ============================================================
   e-RAB Desa v1.2 — ahsp-labels.js
   Keterangan istilah teknis untuk pemula — HANYA di UI input
   Tidak muncul di preview, export PDF/Excel, atau dokumen RAB
   ============================================================ */

'use strict';

const AHSPLabels = {

  // Keterangan komponen (upah/bahan/alat) untuk dropdown input
  komponen: {
    // Upah
    'L01': 'Pekerja — tenaga kasar/pembantu tukang (satuan OH = Orang/Hari)',
    'L02': 'Tukang Batu/Tembok — ahli pasang bata, batu kali & plesteran (OH)',
    'L03': 'Kepala Tukang — pengawas & koordinator tukang di lapangan (OH)',
    'L04': 'Mandor — pengawas seluruh pekerjaan & tenaga kerja (OH)',
    // Bahan teknis
    'M00a': 'Air — untuk campuran beton, mortar & curing (liter)',
    'M01a_kg': 'Semen Portland / PC — bahan pengikat beton & mortar (satuan sak = 40 kg)',
    'M05a': 'Pasir Urug — pasir kasar untuk urugan & alas pondasi',
    'M05c': 'Pasir Beton — pasir halus bersih untuk campuran beton & mortar',
    'M08a': 'Kerikil/Batu Pecah — agregat kasar untuk campuran beton',
    'M09a': 'Minyak Bekisting — pelumas cetakan beton agar mudah dilepas setelah cor',
    'M35b': 'Kayu Papan Bekisting — kayu cetakan sementara untuk cor beton',
    'M72b': 'Paku Campur 5 & 7 cm — paku untuk merakit kayu bekisting',
    'MCC01': 'Curing Compound — cairan kimia untuk merawat beton baru agar tidak retak',
    'MALAT01': 'Kawat Ikat Besi / Bendrat — kawat lunak pengikat tulangan baja',
    'ALAT11': 'BBM Solar Molen — bahan bakar mesin pengaduk beton (molen)',
    // Alat berat
    'E01': 'AMP (Asphalt Mixing Plant) — pabrik/mesin pengaduk aspal panas',
    'E02': 'Asphalt Finisher — mesin penghampar & perata aspal di jalan',
    'E04': 'Motor Grader — alat berat perata permukaan tanah/jalan',
    'E05': 'Compressor — mesin penghasil udara bertekanan tinggi',
    'E06': 'Molen Beton — mesin pengaduk campuran beton (kapasitas 0,35 m³)',
    'E10a': 'Excavator Mini — alat gali tanah kecil (kapasitas 0,2 m³)',
    'E16a': 'Stamper Kodok — mesin pemadat tanah/pasir dengan gerak melompat (150 kg)',
    'E16b': 'Stamper Kuda / Vibrating Plate — mesin pemadat tanah dengan getaran datar',
    'E17': 'Tandem Roller — mesin pemadat jalan dengan dua roda besi besar',
    'E17a': 'Tandem Roller Kecil — versi kecil mesin pemadat jalan roda besi',
    'E18': 'Pneumatic Tire Roller — mesin pemadat jalan dengan roda karet (ban)',
    'E19': 'Vibro Roller — mesin pemadat bergetar untuk tanah & material jalan',
    'E35': 'Dump Truck — truk pengangkut dan penumpah material (kapasitas 10 ton)',
    'E41': 'Asphalt Distributor — alat penyemprot aspal cair ke permukaan jalan',
    'ECC': 'Concrete Cutter — gergaji mesin pemotong beton yang sudah keras',
    'ECT3': 'Crane Truck — truk dengan alat angkat/derek (3 ton + winch 5 ton)',
    'ECV': 'Concrete Vibrator — alat penggetar beton agar padat & bebas rongga udara',
    'EWT': 'Water Tanker — truk tangki air untuk penyiraman jalan/beton',
    'EMB01': 'Mesin Bor Sumur — alat pengeboran tanah untuk sumur air dalam',
    // Alat kecil ALAT01-12
    'ALAT01': 'Cangkul — alat gali dan aduk tanah manual',
    'ALAT02': 'Sekop — alat angkut dan ratakan material (pasir, tanah, semen)',
    'ALAT03': 'Gancu/Linggis — alat besi panjang untuk mencongkel/membongkar',
    'ALAT04': 'Gerobak Dorong/Angkut — alat angkut material di lokasi proyek',
    'ALAT05': 'Ember Cor (5 buah/set) — ember untuk mengangkut campuran beton',
    'ALAT06': 'Benang/Tali Bangunan — untuk acuan garis lurus & ketinggian bangunan',
    'ALAT07': 'Waterpass/Selang Ukur — alat ukur kerataan/ketinggian menggunakan air',
    'ALAT08': 'Palu Besi — alat pemukul untuk memasang paku & besi',
    'ALAT09': 'Besi Perata Beton (jidar) — batang besi/aluminium untuk meratakan cor beton',
    'ALAT10': 'Parang/Gergaji Kayu — alat potong kayu untuk bekisting & rangka',
    'ALAT11': 'BBM Solar Molen — bahan bakar solar untuk mesin molen beton (per liter)',
    'ALAT12': 'Kawat Ikat Besi (bendrat) — kawat lunak untuk mengikat besi tulangan'
  },

  // Keterangan nama AHSP untuk dropdown pilih pekerjaan
  ahsp: {
    'U-GAL-01': 'Menggali tanah secara manual menggunakan cangkul & sekop',
    'U-GAL-02': 'Galian tanah lebih dalam (1-2 m), butuh lebih banyak tenaga',
    'U-GAL-03': 'Galian tanah menggunakan excavator mini, lebih cepat',
    'U-URU-01': 'Mengisi lubang/alas pondasi dengan pasir urug dan dipadatkan',
    'U-URU-02': 'Mengisi kembali galian dengan tanah bekas galian',
    'U-PAD-01': 'Memadatkan pasir setebal 15 cm agar tidak amblas',
    'U-PAD-02': 'Memadatkan tanah setebal 10 cm sebagai dasar konstruksi',
    'U-BAT-01': 'Pasang batu kali dengan campuran semen:pasir 1:4',
    'U-BAT-02': 'Pasang batu kali dengan campuran semen:pasir 1:5 (lebih irit semen)',
    'U-PLS-01': 'Lapisan semen:pasir 1:3 tebal 15 mm pada dinding/beton',
    'U-PLS-02': 'Lapisan semen:pasir 1:4 tebal 15 mm (campuran lebih irit)',
    'U-ACI-01': 'Lapisan halus semen murni di atas plesteran agar permukaan mulus',
    'U-BET-K100': 'Cor beton tipis K-100/f\'c 7,5 MPa sebagai alas sebelum konstruksi',
    'U-BET-K125': 'Cor beton K-125/f\'c 10 MPa, kuat untuk lantai kerja',
    'U-BET-K175': 'Cor beton K-175/f\'c 14 MPa, untuk pondasi & sloof',
    'U-BET-K200': 'Cor beton K-200/f\'c 17 MPa, standar bangunan ringan',
    'U-BET-K225': 'Cor beton K-225/f\'c 19 MPa dengan molen, lebih kuat & merata',
    'U-BET-K250': 'Cor beton K-250/f\'c 20 MPa — standar jalan rabat desa',
    'U-BET-K300': 'Cor beton K-300/f\'c 25 MPa — untuk jalan kolektor/beban berat',
    'U-BEK-01': 'Cetakan kayu sementara untuk cor beton pondasi/lantai',
    'U-BEK-02': 'Cetakan kayu sementara untuk cor kolom, balok & ring balok',
    'U-TUL-01': 'Pemasangan besi beton (polos/ulir) untuk tulangan struktur, per kg',
    'PV-01': 'Paving block 6 cm mutu f\'c 20 MPa — cocok untuk jalan lingkungan/gang',
    'PV-02': 'Paving block 6 cm mutu f\'c 25 MPa — lebih kuat, untuk jalan akses',
    'PV-03': 'Paving block 8 cm (lebih tebal) mutu f\'c 20 MPa — tahan beban lebih berat',
    'PV-04': 'Paving block 8 cm mutu f\'c 25 MPa — untuk jalan kolektor/kendaraan berat',
    'PV-05': 'Mengisi celah paving block dengan pasir halus & dipadatkan',
    'PV-06': 'Kanstin/beton tepi jalan cor di tempat, mutu K-175',
    'JB-01': 'Lapisan beton tipis K-125 sebagai alas sebelum cor perkerasan jalan',
    'JB-02': 'Perkerasan beton jalan desa mutu K-250 — standar jalan desa',
    'JB-03': 'Perkerasan beton jalan mutu K-300 — untuk jalan kolektor/lebih kuat',
    'AS-01': 'Lapisan aspal tengah (AC-BC) hotmix — lapisan antara/binder',
    'AS-02': 'Lapisan aspal permukaan (AC-WC) hotmix — lapisan aus/wearing course',
    'AS-03': 'Lapen — aspal siram + batu pecah, metode semi mekanis untuk jalan desa',
    'AS-04': 'Lapis pondasi agregat batu pecah kelas A di bawah lapisan aspal',
    'DR-01': 'Saluran U-Ditch pabrikan ukuran 30×30×120 cm beserta lantai kerja',
    'DR-02': 'Saluran U-Ditch pabrikan ukuran 40×40×120 cm beserta lantai kerja',
    'DR-03': 'Saluran U-Ditch pabrikan ukuran 40×60×120 cm beserta lantai kerja',
    'DR-04': 'Saluran U-Ditch pabrikan ukuran 50×50×120 cm beserta lantai kerja',
    'DR-05': 'Saluran U-Ditch pabrikan ukuran 60×60×120 cm beserta lantai kerja',
    'DR-06': 'Saluran cor di tempat menggunakan pasangan batu kali 1:4',
    'TPT-01': 'Menggali tanah untuk dasar/pondasi tembok penahan',
    'TPT-02': 'Membangun badan TPT dari pasangan batu kali campuran 1:4',
    'TPT-03': 'Plesteran semen 1:3 pada sisi muka TPT agar tahan cuaca',
    'TPT-04': 'Pipa PVC kecil sebagai lubang drainase di belakang TPT agar tidak retak akibat tekanan air',
    'TPT-05': 'Mengisi kembali tanah di belakang TPT setelah selesai dibangun',
    'GD-01': 'Membersihkan lahan, meratakan tanah & persiapan sebelum membangun',
    'GD-02': 'Pasang batu kali 1:4 sebagai pondasi bangunan gedung',
    'GD-03': 'Cor beton K-200 untuk sloof (balok bawah), kolom & ring balok (balok atas)',
    'GD-04': 'Pasang bata merah dengan campuran semen:pasir 1:4',
    'GD-05': 'Plesteran dinding semen 1:3 tebal 15 mm',
    'GD-06': 'Acian/penghalusan permukaan dinding setelah diplester',
    'GD-07': 'Rangka atap baja ringan (profil C-channel) lengkap dengan reng',
    'GD-08': 'Pemasangan genteng keramik di atas rangka atap',
    'GD-09': 'Pasang keramik lantai ukuran 25×25 cm',
    'GD-10': 'Pasang keramik lantai ukuran 40×40 cm',
    'GD-11': 'Pasang keramik lantai ukuran 50×50 cm',
    'GD-12': 'Pasang keramik lantai ukuran 60×60 cm',
    'GD-13': 'Cat tembok 2 lapis: cat dasar + cat finish warna',
    'AB-01': 'Mengebor tanah untuk membuat sumur air bersih (per meter kedalaman)',
    'AB-02': 'Pasang pompa submersible (pompa benam dalam sumur) daya 0,5 HP',
    'AB-03': 'Pasang pipa distribusi PVC ukuran 1/2 inci (12,7 mm)',
    'AB-04': 'Pasang pipa distribusi PVC ukuran 3/4 inci (19 mm)',
    'AB-05': 'Pasang pipa distribusi utama PVC ukuran 1 inci (25 mm)',
    'AB-06': 'Pasang pipa induk PVC ukuran 1,5 inci (38 mm)',
    'AB-07': 'Pasang pipa induk besar PVC ukuran 2 inci (50 mm)',
    'AB-08': 'Pengadaan & pemasangan aksesoris/fitting pipa (keni, tee, stop kran, dll)',
  },

  // Ambil keterangan AHSP berdasarkan ID
  getAHSP(id) { return this.ahsp[id] || ''; },

  // Ambil keterangan komponen berdasarkan kode
  getKomponen(kode) { return this.komponen[kode] || ''; },

  // Inject keterangan ke option text (hanya untuk dropdown input)
  enrichOption(id, namaAsli) {
    const ket = this.getAHSP(id);
    return ket ? `${namaAsli} — ${ket}` : namaAsli;
  }
};

window.AHSPLabels = AHSPLabels;
