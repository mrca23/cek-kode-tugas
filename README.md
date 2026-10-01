# Cek Kode Tugas

**Pakai online:** https://mrca23.github.io/cek-kode-tugas/

Web untuk membandingkan **Kode Tugas Kirim Station Sblm** dengan **Kode Tugas Sampai** dari export JMS **Monitor Sampai (Refine)(Detail)**, lalu menghitung persen akurasinya.

## Cara pakai
1. Buka link di atas (atau `index.html` lokal). Butuh internet sekali untuk memuat SheetJS dari cdnjs.
2. Pilih / tarik file `Monitor Sampai(Refine)(Detail)*.xlsx` (boleh beberapa file sekaligus).
3. Hasil: persen akurasi, rekap per Kode Tugas Kirim / Kode Tugas Sampai / Drop Point / Discan oleh / Lokasi Sebelumnya, dan daftar AWB yang tidak cocok (bisa unduh CSV).

## Generator Barcode (tab kedua)
Buka https://mrca23.github.io/cek-kode-tugas/#barcode
1. Tempel daftar No. Waybill / No. Bagging / Kode Tugas (satu per baris, atau pisahkan spasi/koma). Kalau file Monitor Sampai sudah dimasukkan di tab Cek Akurasi, bisa langsung ambil: kode tugas unik, AWB tidak cocok + kosong, atau semua AWB.
2. Pilih jenis (Code 128 default; Code 39 hanya A-Z 0-9 - . $ / + % spasi), jumlah kolom, tinggi, teks, nomor urut, buang duplikat.
3. **Buat Barcode** -> **Cetak / Simpan PDF** (hanya barcode yang tercetak) atau **Unduh gambar (PNG)** (maks 300 barcode per gambar).
Batas 2.000 kode sekali buat. Barcode dibuat dengan [JsBarcode](https://github.com/lindell/JsBarcode), selalu hitam di atas putih.

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
`python test/uji_barcode.py "<file Monitor Sampai>.xlsx"` - uji tab barcode; hasil PNG discan balik dengan `zxing-cpp`.
`python test/uji.py "<file Monitor Sampai>.xlsx"` - butuh `playwright` (Python). Skrip membuat salinan uji dengan 10 kode beda + 5 kosong, mengecek angka di web, (hapus `test/uji.xlsx` setelah uji: berisi data pelanggan).

Data file asli tidak disimpan di folder ini.
