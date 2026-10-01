# Cek Kode Tugas

**Pakai online:** https://mrca23.github.io/cek-kode-tugas/

Web untuk membandingkan **Kode Tugas Kirim Station Sblm** dengan **Kode Tugas Sampai** dari export JMS **Monitor Sampai (Refine)(Detail)**, lalu menghitung persen akurasinya.

## Cara pakai
1. Buka link di atas (atau `index.html` lokal). Butuh internet sekali untuk memuat SheetJS dari cdnjs.
2. Pilih / tarik file `Monitor Sampai(Refine)(Detail)*.xlsx` (boleh beberapa file sekaligus).
3. Hasil: persen akurasi, rekap per Kode Tugas Kirim / Kode Tugas Sampai / Drop Point / Discan oleh / Lokasi Sebelumnya, dan daftar AWB yang tidak cocok (bisa unduh CSV).

## Generator Barcode (tab kedua)
Buka https://mrca23.github.io/cek-kode-tugas/#barcode

**Template kode tugas + bagging** (upload Excel): kolom A baris 1 = kode tugas, baris 2 dst = kode bagging berurutan. Hasil: 1 barcode kode tugas (besar, di atas) + semua barcode bagging bernomor sesuai urutan baris. Banyak kode tugas (mis. 5): taruh berjejer di kolom B, C, ... **atau** lanjut di kolom yang sama - kode berawalan `ZX` dianggap kode tugas baru (baris kosong boleh). Muncul ringkasan kode tugas + jumlah bagging di atas hasil. Tiap kode tugas diawali pita hitam **MULAI KODE TUGAS x dari y** dan ditutup blok **AKHIR KODE TUGAS** (garis utuh + teks, tanpa garis putus-putus supaya tidak terbaca scanner), jarak 72px ke kode tugas berikutnya. Kalau lebih dari 1 kode tugas, layar menampilkan **satu kode tugas per halaman** dengan tombol **Sebelumnya / Berikutnya** (atas & bawah; tombol bawah menyebut kode tugas berikutnya, di kode tugas terakhir jadi "Selesai"). Tombol tidak menahan fokus supaya Enter dari scanner tidak ikut menekannya. Cetak / Simpan PDF dan PNG tetap memuat semua kode tugas. Beberapa kolom/sheet/kode tugas (tiap kode tugas mulai halaman baru saat dicetak, PNG satu file per kode tugas). Spasi di dalam sel dibuang. Bisa juga manual: centang "Baris pertama = kode tugas", pisahkan kode tugas dengan baris kosong.

**Daftar biasa:**
1. Tempel daftar No. Waybill / No. Bagging / Kode Tugas (satu per baris, atau pisahkan spasi/koma). Kalau file Monitor Sampai sudah dimasukkan di tab Cek Akurasi, bisa langsung ambil: kode tugas unik, AWB tidak cocok + kosong, atau semua AWB.
2. Pilih jenis (Code 128 default; Code 39 hanya A-Z 0-9 - . $ / + % spasi), jumlah kolom (default 1 = berbaris ke bawah), tinggi, teks, nomor urut, buang duplikat.
3. **Buat Barcode** -> **Cetak / Simpan PDF** (hanya barcode yang tercetak) atau **Unduh gambar (PNG)** (satu file per kode tugas; kalau terlalu tinggi dipecah `-bagian1`, `-bagian2`, ... karena browser tidak bisa membuat gambar setinggi > ~32.000px).
**Jarak aman** (default Lebar 72px antar kolom) + quiet zone 11 modul kiri-kanan tiap barcode supaya scanner tidak ikut membaca barcode sebelahnya; kalau masih terbaca ganda pilih "Sangat lebar" atau Kolom 1. Batas 2.000 kode sekali buat (kode tugas yang tidak kebagian tidak dibuat dan dilaporkan). Peringatan otomatis: bagging dobel dibuang, bagging yang sama di dua kode tugas, kode tugas tidak berawalan ZX. Barcode dibuat dengan [JsBarcode](https://github.com/lindell/JsBarcode), selalu hitam di atas putih.

## Definisi
| Istilah | Arti |
|---|---|
| Cocok | Kode Tugas Kirim Station Sblm = Kode Tugas Sampai (spasi & huruf besar/kecil diabaikan) |
| Tidak cocok | dua kode terisi tapi berbeda |
| Kode kosong | salah satu / kedua kode tidak terisi |
| Akurasi | Cocok / Total AWB x 100% (AWB dobel dihitung sekali, baris pertama) |

Warna persen: hijau >= 99%, kuning >= 95%, merah < 95%.

## Deteksi kolom
Dari nama kolom (baris header dicari di 15 baris pertama, baris yang mengandung "Kode Tugas"). Spasi ganda di nama kolom (mis. `Kode Tugas  Kirim Station Sblm`) tidak masalah. Bisa diganti manual di bagian "Kolom terdeteksi".

## Uji
`python test/uji_template.py "FILE SAMPEL.xlsx"` - uji template; urutan hasil scan PNG harus sama dengan urutan baris file.
`python test/uji_audit.py "FILE SAMPEL.xlsx" ["Monitor Sampai.xlsx"]` - uji lengkap hasil audit (24 cek: tanda mulai/akhir, navigasi Sebelumnya/Berikutnya, PNG terpecah tetap urut, angka panjang, duplikat, batas 2.000, regresi tab Cek).
`python test/uji_multi.py` - uji 5 kode tugas (berjejer & ditumpuk).
`python test/uji_barcode.py "<file Monitor Sampai>.xlsx"` - uji tab barcode; hasil PNG discan balik dengan `zxing-cpp`.
`python test/uji.py "<file Monitor Sampai>.xlsx"` - butuh `playwright` (Python). Skrip membuat salinan uji dengan 10 kode beda + 5 kosong, mengecek angka di web, (hapus `test/uji.xlsx` setelah uji: berisi data pelanggan).

Data file asli tidak disimpan di folder ini.
