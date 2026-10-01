(function () {
  'use strict';

  var MAKS = 2000;        // batas barcode sekali buat
  var MAKS_PNG = 300;     // batas barcode per gambar PNG
  var $ = function (id) { return document.getElementById(id); };
  var daftar = [];        // kode yang berhasil dibuat

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fmt(n) { return n.toLocaleString('id-ID'); }
  function setStatus(msg, cls) { var s = $('bcStatus'); s.textContent = msg; s.className = 'status' + (cls ? ' ' + cls : ''); }

  // ---------- tab ----------
  function bukaTab(t) {
    if (t !== 'barcode') t = 'cek';
    $('tabCek').classList.toggle('hidden', t !== 'cek');
    $('tabBarcode').classList.toggle('hidden', t !== 'barcode');
    Array.prototype.forEach.call(document.querySelectorAll('#tabNav a'), function (a) { a.classList.toggle('aktif', a.getAttribute('data-tab') === t); });
  }
  window.addEventListener('hashchange', function () { bukaTab(location.hash.slice(1)); });
  bukaTab(location.hash.slice(1));

  // ---------- input ----------
  function bacaInput() {
    var list = $('bcInput').value.split(/[\s,;]+/).map(function (s) { return s.trim(); }).filter(Boolean);
    if ($('bcUnik').checked) {
      var lihat = {};
      list = list.filter(function (s) { var k = s.toUpperCase(); if (lihat[k]) return false; lihat[k] = 1; return true; });
    }
    return list;
  }

  function opsi(format) {
    return {
      format: format, height: +$('bcTinggi').value, width: 2, margin: 6,
      displayValue: $('bcTeks').checked, font: 'monospace', fontSize: 16, textMargin: 2,
      background: '#ffffff', lineColor: '#000000'
    };
  }

  function buat() {
    if (typeof JsBarcode === 'undefined') { setStatus('Library barcode gagal dimuat. Cek koneksi internet lalu muat ulang halaman.', 'error'); return; }
    var list = bacaInput();
    if (!list.length) { setStatus('Isi dulu daftar kode.', 'error'); return; }
    var lebih = list.length > MAKS;
    if (lebih) list = list.slice(0, MAKS);
    var format = $('bcFormat').value;
    if (format === 'CODE39') list = list.map(function (s) { return s.toUpperCase(); });
    var grid = $('bcGrid');
    grid.style.setProperty('--kolom', $('bcKolom').value);
    grid.innerHTML = '';
    daftar = [];
    var gagal = [];
    var nomor = $('bcNomor').checked;
    var frag = document.createDocumentFragment();
    list.forEach(function (kode, i) {
      var div = document.createElement('div');
      div.className = 'bc-item';
      var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      var ok = true;
      try {
        var o = opsi(format);
        o.valid = function (v) { ok = v; };
        JsBarcode(svg, kode, o);
      } catch (e) { ok = false; }
      if (ok) {
        if (nomor) div.innerHTML = '<div class="no">' + (i + 1) + '</div>';
        div.appendChild(svg);
        daftar.push(kode);
      } else {
        div.className += ' gagal';
        div.innerHTML = (nomor ? (i + 1) + '. ' : '') + esc(kode) + '<br>tidak bisa dibuat dengan ' + format;
        gagal.push(kode);
      }
      frag.appendChild(div);
    });
    grid.appendChild(frag);
    $('bcHasilCard').classList.remove('hidden');
    $('bcCetak').disabled = $('bcUnduh').disabled = !daftar.length;
    var msg = fmt(daftar.length) + ' barcode dibuat.';
    if (gagal.length) msg += ' ' + fmt(gagal.length) + ' kode gagal (karakter tidak didukung ' + format + ').';
    if (lebih) msg += ' Hanya ' + fmt(MAKS) + ' kode pertama yang dibuat.';
    setStatus(msg, gagal.length || lebih ? 'error' : 'ok');
  }

  // ---------- unduh PNG (satu lembar gambar berisi semua barcode) ----------
  function unduhPng() {
    if (!daftar.length) return;
    var list = daftar.slice(0, MAKS_PNG);
    var format = $('bcFormat').value, nomor = $('bcNomor').checked;
    var kanvas = list.map(function (kode) { var c = document.createElement('canvas'); JsBarcode(c, kode, opsi(format)); return c; });
    var kol = +$('bcKolom').value, jarak = 16, nomorH = nomor ? 18 : 0;
    var w = Math.max.apply(null, kanvas.map(function (c) { return c.width; }));
    var h = Math.max.apply(null, kanvas.map(function (c) { return c.height; })) + nomorH;
    var baris = Math.ceil(kanvas.length / kol);
    var out = document.createElement('canvas');
    out.width = kol * w + (kol + 1) * jarak;
    out.height = baris * h + (baris + 1) * jarak;
    var ctx = out.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, out.width, out.height);
    ctx.fillStyle = '#555'; ctx.font = '600 13px system-ui, sans-serif'; ctx.textBaseline = 'top';
    kanvas.forEach(function (c, i) {
      var x = jarak + (i % kol) * (w + jarak), y = jarak + Math.floor(i / kol) * (h + jarak);
      if (nomor) ctx.fillText(String(i + 1), x + 4, y);
      ctx.drawImage(c, x + Math.floor((w - c.width) / 2), y + nomorH);
    });
    out.toBlob(function (blob) {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'barcode-' + list.length + '.png';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    });
    if (daftar.length > MAKS_PNG) setStatus('Gambar PNG hanya memuat ' + fmt(MAKS_PNG) + ' barcode pertama. Untuk semuanya pakai Cetak / Simpan PDF.', 'error');
  }

  // ---------- ambil dari file Monitor Sampai ----------
  document.addEventListener('cekkode:data', function () {
    var ada = window.cekKodeTugas && window.cekKodeTugas.data().length;
    $('bcAmbil').classList.toggle('hidden', !ada);
  });
  $('bcAmbil').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b || !window.cekKodeTugas) return;
    var data = window.cekKodeTugas.data(), jenis = b.getAttribute('data-ambil'), list = [];
    if (jenis === 'kodeTugas') {
      var lihat = {};
      data.forEach(function (d) { [d.kirim, d.sampai].forEach(function (k) { if (k && !lihat[k]) { lihat[k] = 1; list.push(k); } }); });
    } else {
      list = data.filter(function (d) { return jenis === 'awbSemua' || d.st !== 'ok'; }).map(function (d) { return d.awb; });
    }
    $('bcInput').value = list.join('\n');
    setStatus(list.length ? fmt(list.length) + ' kode diambil dari file. Klik Buat Barcode.' : 'Tidak ada kode untuk pilihan ini.', list.length ? 'ok' : 'error');
  });

  $('bcBuat').addEventListener('click', buat);
  $('bcCetak').addEventListener('click', function () { window.print(); });
  $('bcUnduh').addEventListener('click', unduhPng);
  $('bcHapus').addEventListener('click', function () {
    $('bcInput').value = ''; $('bcGrid').innerHTML = ''; daftar = [];
    $('bcHasilCard').classList.add('hidden');
    $('bcCetak').disabled = $('bcUnduh').disabled = true;
    setStatus('');
  });
  ['bcKolom'].forEach(function (id) {
    $(id).addEventListener('change', function () { $('bcGrid').style.setProperty('--kolom', this.value); });
  });
})();
