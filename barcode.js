(function () {
  'use strict';

  var MAKS = 2000;        // batas barcode sekali buat (semua grup)
  var MAKS_PNG = 300;     // batas barcode per gambar PNG
  var $ = function (id) { return document.getElementById(id); };
  var grupJadi = [];      // [{ tugas: 'ZXZB..' | '', items: ['LY..', ...] }] yang berhasil dibuat

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fmt(n) { return n.toLocaleString('id-ID'); }
  function setStatus(msg, cls) { var s = $('bcStatus'); s.textContent = msg; s.className = 'status' + (cls ? ' ' + cls : ''); }
  function pecah(teks) { return teks.split(/[\s,;]+/).map(function (s) { return s.trim(); }).filter(Boolean); }

  // ---------- tab ----------
  function bukaTab(t) {
    if (t !== 'barcode') t = 'cek';
    $('tabCek').classList.toggle('hidden', t !== 'cek');
    $('tabBarcode').classList.toggle('hidden', t !== 'barcode');
    Array.prototype.forEach.call(document.querySelectorAll('#tabNav a'), function (a) { a.classList.toggle('aktif', a.getAttribute('data-tab') === t); });
  }
  window.addEventListener('hashchange', function () { bukaTab(location.hash.slice(1)); });
  bukaTab(location.hash.slice(1));

  // ---------- input -> grup ----------
  // Mode kode tugas: tiap blok (dipisah baris kosong) = 1 grup, kode pertama = kode tugas.
  // Mode biasa: semua kode = 1 grup tanpa kode tugas.
  function bacaInput() {
    var teks = $('bcInput').value;
    var grup = $('bcTugas').checked
      ? teks.split(/\n\s*\n/).map(pecah).filter(function (l) { return l.length; }).map(function (l) { return { tugas: l[0], items: l.slice(1) }; })
      : [{ tugas: '', items: pecah(teks) }];
    if ($('bcUnik').checked) {
      grup.forEach(function (g) {
        var lihat = {};
        g.items = g.items.filter(function (s) { var k = s.toUpperCase(); if (lihat[k]) return false; lihat[k] = 1; return true; });
      });
    }
    return grup.filter(function (g) { return g.tugas || g.items.length; });
  }

  function opsi(format, besar) {
    return {
      format: format, height: besar ? 70 : +$('bcTinggi').value, width: 2, margin: 6,
      displayValue: $('bcTeks').checked || besar, font: 'monospace', fontSize: besar ? 20 : 16, textMargin: 2,
      background: '#ffffff', lineColor: '#000000'
    };
  }

  // gambar satu barcode ke svg; kembalikan svg atau null kalau kode tidak valid
  function svgBarcode(kode, format, besar) {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    var ok = true;
    try { var o = opsi(format, besar); o.valid = function (v) { ok = v; }; JsBarcode(svg, kode, o); } catch (e) { ok = false; }
    return ok ? svg : null;
  }

  function buat() {
    if (typeof JsBarcode === 'undefined') { setStatus('Library barcode gagal dimuat. Cek koneksi internet lalu muat ulang halaman.', 'error'); return; }
    var grup = bacaInput();
    if (!grup.length) { setStatus('Isi dulu daftar kode.', 'error'); return; }
    var format = $('bcFormat').value;
    var modeTugas = $('bcTugas').checked;
    var nomor = $('bcNomor').checked || modeTugas;
    var sisa = MAKS, lebih = false, jml = 0, gagal = 0;
    var wadah = $('bcGrid');
    wadah.innerHTML = '';
    grupJadi = [];
    var frag = document.createDocumentFragment();
    grup.forEach(function (g) {
      var items = g.items.map(function (s) { return format === 'CODE39' ? s.toUpperCase() : s; });
      var tugas = format === 'CODE39' ? g.tugas.toUpperCase() : g.tugas;
      if (items.length > sisa) { items = items.slice(0, sisa); lebih = true; }
      sisa -= items.length;
      var box = document.createElement('div');
      box.className = 'bc-grup';
      var jadi = { tugas: '', items: [] };
      if (tugas) {
        var t = document.createElement('div');
        t.className = 'bc-tugas';
        var svgT = svgBarcode(tugas, format, true);
        t.innerHTML = '<div class="judul"><span>KODE TUGAS</span><span>' + fmt(items.length) + ' bagging</span></div>';
        if (svgT) { t.appendChild(svgT); jadi.tugas = tugas; jml++; }
        else { t.innerHTML += '<div style="color:#c00000">' + esc(tugas) + ' tidak bisa dibuat dengan ' + format + '</div>'; gagal++; }
        box.appendChild(t);
      }
      var grid = document.createElement('div');
      grid.className = 'bc-grid';
      grid.style.setProperty('--kolom', $('bcKolom').value);
      items.forEach(function (kode, i) {
        var div = document.createElement('div');
        div.className = 'bc-item';
        var svg = svgBarcode(kode, format, false);
        if (svg) {
          if (nomor) div.innerHTML = '<div class="no">' + (i + 1) + '</div>';
          div.appendChild(svg);
          jadi.items.push({ no: i + 1, kode: kode });
          jml++;
        } else {
          div.className += ' gagal';
          div.innerHTML = (nomor ? (i + 1) + '. ' : '') + esc(kode) + '<br>tidak bisa dibuat dengan ' + format;
          gagal++;
        }
        grid.appendChild(div);
      });
      box.appendChild(grid);
      frag.appendChild(box);
      if (jadi.tugas || jadi.items.length) grupJadi.push(jadi);
    });
    wadah.appendChild(frag);
    $('bcHasilCard').classList.remove('hidden');
    $('bcCetak').disabled = $('bcUnduh').disabled = !jml;
    var msg = modeTugas
      ? fmt(grup.length) + ' kode tugas, ' + fmt(jml - grupJadi.filter(function (g) { return g.tugas; }).length) + ' bagging dibuat.'
      : fmt(jml) + ' barcode dibuat.';
    if (gagal) msg += ' ' + fmt(gagal) + ' kode gagal (karakter tidak didukung ' + format + ').';
    if (lebih) msg += ' Hanya ' + fmt(MAKS) + ' kode pertama yang dibuat.';
    setStatus(msg, gagal || lebih ? 'error' : 'ok');
  }

  // ---------- unduh PNG: satu gambar per grup ----------
  function kanvasBarcode(kode, format, besar) { var c = document.createElement('canvas'); JsBarcode(c, kode, opsi(format, besar)); return c; }

  function pngGrup(g, format, nomor) {
    var items = g.items.slice(0, MAKS_PNG);
    var kanvas = items.map(function (it) { return kanvasBarcode(it.kode, format, false); });
    var kol = +$('bcKolom').value, jarak = 16, nomorH = nomor ? 18 : 0;
    var w = kanvas.length ? Math.max.apply(null, kanvas.map(function (c) { return c.width; })) : 0;
    var h = kanvas.length ? Math.max.apply(null, kanvas.map(function (c) { return c.height; })) + nomorH : 0;
    var baris = Math.ceil(kanvas.length / kol);
    var kt = g.tugas ? kanvasBarcode(g.tugas, format, true) : null;
    var ktH = kt ? kt.height + 24 + jarak : 0;
    var out = document.createElement('canvas');
    out.width = Math.max(kol * w + (kol + 1) * jarak, kt ? kt.width + 2 * jarak : 0);
    out.height = ktH + baris * h + (baris + 1) * jarak;
    var ctx = out.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, out.width, out.height);
    ctx.textBaseline = 'top';
    if (kt) {
      ctx.fillStyle = '#000'; ctx.font = '700 14px system-ui, sans-serif';
      ctx.fillText('KODE TUGAS  -  ' + g.items.length + ' bagging', jarak, jarak);
      ctx.drawImage(kt, Math.floor((out.width - kt.width) / 2), jarak + 22);
      ctx.fillRect(jarak, ktH, out.width - 2 * jarak, 2);
    }
    ctx.fillStyle = '#555'; ctx.font = '600 13px system-ui, sans-serif';
    kanvas.forEach(function (c, i) {
      var x = jarak + (i % kol) * (w + jarak), y = ktH + jarak + Math.floor(i / kol) * (h + jarak);
      if (nomor) ctx.fillText(String(items[i].no), x + 4, y);
      ctx.drawImage(c, x + Math.floor((w - c.width) / 2), y + nomorH);
    });
    return { kanvas: out, potong: g.items.length > MAKS_PNG };
  }

  function unduhPng() {
    if (!grupJadi.length) return;
    var format = $('bcFormat').value, nomor = $('bcNomor').checked || $('bcTugas').checked;
    var potong = false;
    grupJadi.forEach(function (g, gi) {
      var r = pngGrup(g, format, nomor);
      potong = potong || r.potong;
      r.kanvas.toBlob(function (blob) {
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = (g.tugas || 'barcode') + '-' + g.items.length + '.png';
        // jeda antar unduhan supaya browser tidak memblokir unduhan beruntun
        setTimeout(function () {
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
        }, gi * 400);
      });
    });
    if (potong) setStatus('Gambar PNG hanya memuat ' + fmt(MAKS_PNG) + ' barcode pertama per kode tugas. Untuk semuanya pakai Cetak / Simpan PDF.', 'error');
  }

  // ---------- upload template: baris 1 = kode tugas, baris 2 dst = bagging; satu kolom = satu grup ----------
  function bacaTemplate(file) {
    if (!file) return;
    if (typeof XLSX === 'undefined') { setStatus('Library pembaca Excel gagal dimuat. Cek koneksi internet lalu muat ulang halaman.', 'error'); return; }
    var r = new FileReader();
    r.onload = function (e) {
      try {
        var wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        var grup = [];
        wb.SheetNames.forEach(function (n) {
          var aoa = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: false, defval: '', blankrows: false });
          var kol = aoa.reduce(function (m, row) { return Math.max(m, row.length); }, 0);
          for (var c = 0; c < kol; c++) {
            var isi = aoa.map(function (row) { return String(row[c] == null ? '' : row[c]).replace(/\s+/g, ''); }).filter(Boolean);
            if (isi.length) grup.push(isi);
          }
        });
        if (!grup.length) { setStatus('File template kosong.', 'error'); return; }
        $('bcInput').value = grup.map(function (l) { return l.join('\n'); }).join('\n\n');
        $('bcTugas').checked = true;
        buat();
        setStatus('Template "' + file.name + '": ' + $('bcStatus').textContent, $('bcStatus').className.indexOf('error') >= 0 ? 'error' : 'ok');
      } catch (err) {
        setStatus('Gagal membaca file: ' + (err && err.message ? err.message : err), 'error');
      }
    };
    r.readAsArrayBuffer(file);
  }
  $('bcFile').addEventListener('change', function (e) { bacaTemplate(e.target.files[0]); e.target.value = ''; });
  var drop = $('bcDrop');
  ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('aktif'); }); });
  ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('aktif'); }); });
  drop.addEventListener('drop', function (e) { bacaTemplate(e.dataTransfer.files[0]); });

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
    $('bcTugas').checked = false;
    setStatus(list.length ? fmt(list.length) + ' kode diambil dari file. Klik Buat Barcode.' : 'Tidak ada kode untuk pilihan ini.', list.length ? 'ok' : 'error');
  });

  $('bcBuat').addEventListener('click', buat);
  $('bcCetak').addEventListener('click', function () { window.print(); });
  $('bcUnduh').addEventListener('click', unduhPng);
  $('bcHapus').addEventListener('click', function () {
    $('bcInput').value = ''; $('bcGrid').innerHTML = ''; grupJadi = [];
    $('bcHasilCard').classList.add('hidden');
    $('bcCetak').disabled = $('bcUnduh').disabled = true;
    setStatus('');
  });
  $('bcKolom').addEventListener('change', function () {
    var v = this.value;
    Array.prototype.forEach.call(document.querySelectorAll('#bcGrid .bc-grid'), function (g) { g.style.setProperty('--kolom', v); });
  });
})();
