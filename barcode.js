(function () {
  'use strict';

  var MAKS = 2000;          // batas barcode sekali buat (semua grup)
  var TINGGI_MAKS = 12000;  // batas aman tinggi gambar PNG (browser gagal di atas ~32.000px), lebih dari itu dipecah per bagian
  var $ = function (id) { return document.getElementById(id); };
  var grupJadi = [];        // [{ tugas: 'ZXZB..' | '', items: [{ no, kode }] }] yang berhasil dibuat

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fmt(n) { return n.toLocaleString('id-ID'); }
  function setStatus(msg, cls) { var s = $('bcStatus'); s.textContent = msg; s.className = 'status' + (cls ? ' ' + cls : ''); }
  function pecah(teks) { return teks.split(/[\s,;]+/).map(function (s) { return s.trim(); }).filter(Boolean); }
  // kode tugas J&T berawalan ZX (mis. ZXZB26030732611), bagging berawalan LY
  function polaTugas(s) { return /^ZX[A-Z]*\d/i.test(s); }

  // urutan kode -> grup. Kode pertama = kode tugas; kode berawalan ZX berikutnya = mulai kode tugas baru.
  function kelompokkan(list) {
    var grup = [], cur = null;
    list.forEach(function (v) {
      if (!cur || polaTugas(v)) { cur = { tugas: v, items: [] }; grup.push(cur); }
      else cur.items.push(v);
    });
    return grup;
  }

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
  // Mode kode tugas: blok dipisah baris kosong / kode berawalan ZX = grup baru, kode pertama = kode tugas.
  // Mode biasa: semua kode = 1 grup tanpa kode tugas.
  function bacaInput() {
    var teks = $('bcInput').value;
    var grup = $('bcTugas').checked
      ? teks.split(/\n\s*\n/).map(pecah).reduce(function (a, l) { return a.concat(kelompokkan(l)); }, [])
      : [{ tugas: '', items: pecah(teks) }];
    var info = { dobel: 0, lintas: [] };
    if ($('bcUnik').checked) {
      grup.forEach(function (g) {
        var lihat = {};
        g.items = g.items.filter(function (s) { var k = s.toUpperCase(); if (lihat[k]) { info.dobel++; return false; } lihat[k] = 1; return true; });
      });
    }
    // bagging yang sama muncul di lebih dari satu kode tugas
    var milik = {};
    grup.forEach(function (g, gi) {
      g.items.forEach(function (s) {
        var k = s.toUpperCase();
        if (milik[k] === undefined) milik[k] = gi;
        else if (milik[k] !== gi && info.lintas.indexOf(s) < 0) info.lintas.push(s);
      });
    });
    grup = grup.filter(function (g) { return g.tugas || g.items.length; });
    return { grup: grup, info: info };
  }

  function opsi(format, besar) {
    return {
      // quiet zone kiri-kanan 11 modul (standar Code128 minimal 10) supaya batas barcode jelas bagi scanner
      format: format, height: besar ? 70 : +$('bcTinggi').value, width: 2, margin: 6, marginLeft: 22, marginRight: 22,
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

  function labelKe(gi, n) { return n > 1 ? ' ' + (gi + 1) + ' dari ' + n : ''; }

  function buat() {
    if (typeof JsBarcode === 'undefined') { setStatus('Library barcode gagal dimuat. Cek koneksi internet lalu muat ulang halaman.', 'error'); return; }
    var baca = bacaInput(), grup = baca.grup, info = baca.info;
    if (!grup.length) { setStatus('Isi dulu daftar kode.', 'error'); return; }
    var format = $('bcFormat').value;
    var modeTugas = $('bcTugas').checked;
    var nomor = $('bcNomor').checked || modeTugas;
    var sisa = MAKS, lebih = false, dilewati = 0, jml = 0, gagal = 0;
    var adaTugas = grup.filter(function (g) { return g.tugas; }).length;
    var bukanZX = modeTugas ? grup.filter(function (g) { return g.tugas && !polaTugas(g.tugas); }).map(function (g) { return g.tugas; }) : [];
    var jarak = $('bcJarak').value + 'px';
    var wadah = $('bcGrid');
    wadah.innerHTML = '';
    grupJadi = [];
    var frag = document.createDocumentFragment();
    if (adaTugas > 1) {
      var nav = document.createElement('div');
      nav.className = 'bc-ringkas';
      nav.innerHTML = grup.map(function (g, gi) {
        return '<a href="#" data-grup="' + gi + '">' + esc(g.tugas || '(tanpa kode tugas)') + '<span>' + fmt(g.items.length) + ' bagging</span></a>';
      }).join('');
      frag.appendChild(nav);
    }
    grup.forEach(function (g, gi) {
      // batas tercapai: kode tugas berikutnya tidak dibuat sama sekali (jangan tampil kode tugas tanpa bagging)
      if (sisa <= 0) { dilewati++; lebih = true; return; }
      var items = g.items.map(function (s) { return format === 'CODE39' ? s.toUpperCase() : s; });
      var tugas = format === 'CODE39' ? g.tugas.toUpperCase() : g.tugas;
      if (items.length > sisa) { items = items.slice(0, sisa); lebih = true; }
      sisa -= items.length;
      var box = document.createElement('div');
      box.className = 'bc-grup';
      box.id = 'bcGrup' + gi;
      box.setAttribute('data-tugas', tugas);
      var jadi = { tugas: '', items: [] };
      if (tugas) {
        var t = document.createElement('div');
        t.className = 'bc-tugas';
        var svgT = svgBarcode(tugas, format, true);
        t.innerHTML = '<div class="judul"><span>MULAI KODE TUGAS' + labelKe(gi, adaTugas) + '</span><span>' + fmt(items.length) + ' bagging</span></div>';
        if (svgT) { t.appendChild(svgT); jadi.tugas = tugas; jml++; }
        else { t.innerHTML += '<div style="color:#c00000">' + esc(tugas) + ' tidak bisa dibuat dengan ' + format + '</div>'; gagal++; }
        box.appendChild(t);
      }
      var grid = document.createElement('div');
      grid.className = 'bc-grid';
      grid.style.setProperty('--kolom', $('bcKolom').value);
      grid.style.setProperty('--jarak', jarak);
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
      if (tugas) {
        // tanda akhir: hanya garis utuh + teks (tanpa garis putus-putus yang bisa terbaca seperti batang barcode)
        var akhir = document.createElement('div');
        akhir.className = 'bc-akhir';
        akhir.innerHTML = '<span>AKHIR KODE TUGAS' + labelKe(gi, adaTugas) + '</span><b>' + esc(tugas) + '</b><span>' + fmt(items.length) + ' bagging</span>';
        box.appendChild(akhir);
      }
      frag.appendChild(box);
      if (jadi.tugas || jadi.items.length) grupJadi.push(jadi);
    });
    wadah.appendChild(frag);
    pasangNavigasi();
    $('bcHasilCard').classList.remove('hidden');
    $('bcCetak').disabled = $('bcUnduh').disabled = !jml;
    var nTugas = grupJadi.filter(function (g) { return g.tugas; }).length;
    var msg = modeTugas ? fmt(nTugas) + ' kode tugas, ' + fmt(jml - nTugas) + ' bagging dibuat.' : fmt(jml) + ' barcode dibuat.';
    if (gagal) msg += ' ' + fmt(gagal) + ' kode gagal (karakter tidak didukung ' + format + ').';
    if (lebih) msg += ' Batas ' + fmt(MAKS) + ' kode tercapai' + (dilewati ? ', ' + fmt(dilewati) + ' kode tugas terakhir tidak dibuat' : '') + '.';
    if (info.dobel) msg += ' ' + fmt(info.dobel) + ' bagging dobel dibuang (nomor urut menyesuaikan).';
    if (info.lintas.length) msg += ' Bagging ada di lebih dari satu kode tugas: ' + info.lintas.slice(0, 5).join(', ') + (info.lintas.length > 5 ? ', ...' : '') + '.';
    if (bukanZX.length) msg += ' Periksa kode tugas yang tidak berawalan ZX: ' + bukanZX.slice(0, 3).join(', ') + '.';
    setStatus(msg, gagal || lebih || info.dobel || info.lintas.length || bukanZX.length ? 'error' : 'ok');
  }

  // ---------- navigasi: lebih dari 1 kode tugas -> tampil satu per satu (Sebelumnya / Berikutnya) ----------
  // hanya di layar; Cetak dan PNG tetap memuat semua kode tugas
  var aktif = 0;
  function kotakGrup() { return Array.prototype.slice.call(document.querySelectorAll('#bcGrid .bc-grup')); }

  function htmlNav(posisi) {
    return '<div class="bc-nav bc-nav-' + posisi + '">' +
      '<button class="sekunder" data-nav="-1">&lsaquo; Sebelumnya</button>' +
      '<span class="bc-nav-ket"></span>' +
      '<button data-nav="1">Berikutnya &rsaquo;</button></div>';
  }

  function pasangNavigasi() {
    var kotak = kotakGrup();
    if (kotak.length < 2) return;
    var atas = document.createElement('div'); atas.innerHTML = htmlNav('atas');
    kotak[0].parentNode.insertBefore(atas.firstChild, kotak[0]);
    kotak.forEach(function (k) {
      var bawah = document.createElement('div'); bawah.innerHTML = htmlNav('bawah');
      k.appendChild(bawah.firstChild);
    });
    tampilGrup(0, false);
  }

  function tampilGrup(i, gulir) {
    var kotak = kotakGrup(), n = kotak.length;
    if (n < 2) return;
    aktif = Math.max(0, Math.min(n - 1, i));
    kotak.forEach(function (k, ki) { k.classList.toggle('sembunyi', ki !== aktif); });
    var akhir = aktif === n - 1;
    Array.prototype.forEach.call(document.querySelectorAll('#bcGrid .bc-nav'), function (nav) {
      nav.querySelector('[data-nav="-1"]').disabled = aktif === 0;
      var lanjut = nav.querySelector('[data-nav="1"]');
      lanjut.disabled = akhir;
      var berikut = kotak[aktif + 1] && kotak[aktif + 1].getAttribute('data-tugas');
      lanjut.innerHTML = akhir ? 'Selesai' : (nav.classList.contains('bc-nav-bawah') && berikut ? 'Berikutnya: ' + esc(berikut) + ' &rsaquo;' : 'Berikutnya &rsaquo;');
      nav.querySelector('.bc-nav-ket').textContent = 'Kode tugas ' + (aktif + 1) + ' dari ' + n + (akhir ? ' (terakhir)' : '');
    });
    Array.prototype.forEach.call(document.querySelectorAll('#bcGrid .bc-ringkas a'), function (a) {
      a.classList.toggle('aktif', 'bcGrup' + a.getAttribute('data-grup') === kotak[aktif].id);
    });
    if (gulir) $('bcHasilCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ---------- unduh PNG: per kode tugas, dipecah per bagian kalau terlalu tinggi ----------
  function kanvasBarcode(kode, format, besar) { var c = document.createElement('canvas'); JsBarcode(c, kode, opsi(format, besar)); return c; }

  // satu bagian gambar: header kode tugas (bagian pertama), barcode bagging, tanda akhir (bagian terakhir)
  function pngBagian(g, items, kanvas, uk, bagian, total) {
    var awal = bagian === 1, akhir = bagian === total, pad = 16;
    var baris = Math.ceil(kanvas.length / uk.kol);
    var kt = awal && g.tugas ? uk.kt : null;
    var atasH = kt ? kt.height + 46 : (g.tugas ? 30 : 0);
    var bawahH = akhir && g.tugas ? 64 : 0;
    var out = document.createElement('canvas');
    out.width = uk.lebar;
    out.height = pad + atasH + Math.max(0, baris * uk.h + (baris - 1) * uk.jarakBaris) + bawahH + pad;
    var ctx = out.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, out.width, out.height);
    ctx.textBaseline = 'top';
    var ket = total > 1 ? '  (bagian ' + bagian + '/' + total + ')' : '';
    if (kt) {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, out.width, pad + 22);
      ctx.fillStyle = '#fff'; ctx.font = '700 14px system-ui, sans-serif';
      ctx.fillText('MULAI KODE TUGAS  -  ' + g.items.length + ' bagging' + ket, pad, 10);
      ctx.drawImage(kt, Math.floor((out.width - kt.width) / 2), pad + 26);
    } else if (g.tugas) {
      ctx.fillStyle = '#000'; ctx.font = '700 14px system-ui, sans-serif';
      ctx.fillText(g.tugas + ' - lanjutan' + ket, pad, pad);
    }
    ctx.fillStyle = '#555'; ctx.font = '600 13px system-ui, sans-serif';
    kanvas.forEach(function (c, i) {
      var x = pad + (i % uk.kol) * (uk.w + uk.jarakKol), y = pad + atasH + Math.floor(i / uk.kol) * (uk.h + uk.jarakBaris);
      if (uk.nomor) ctx.fillText(String(items[i].no), x + 4, y);
      ctx.drawImage(c, x + Math.floor((uk.w - c.width) / 2), y + uk.nomorH);
    });
    if (bawahH) {
      var y0 = out.height - pad - bawahH + 24;
      ctx.fillStyle = '#000';
      ctx.fillRect(pad, y0, out.width - 2 * pad, 4);
      ctx.fillRect(pad, y0 + 36, out.width - 2 * pad, 4);
      ctx.font = '700 14px system-ui, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('AKHIR KODE TUGAS ' + g.tugas + '  -  ' + g.items.length + ' bagging', out.width / 2, y0 + 13);
      ctx.textAlign = 'left';
    }
    return out;
  }

  function pngGrup(g, format, nomor) {
    var kanvas = g.items.map(function (it) { return kanvasBarcode(it.kode, format, false); });
    var kol = +$('bcKolom').value, jarakKol = Math.max(16, +$('bcJarak').value);
    var uk = { kol: kol, nomor: nomor, nomorH: nomor ? 18 : 0, jarakKol: jarakKol, jarakBaris: Math.round(jarakKol / 2.5) + 8 };
    uk.w = kanvas.length ? Math.max.apply(null, kanvas.map(function (c) { return c.width; })) : 0;
    uk.h = kanvas.length ? Math.max.apply(null, kanvas.map(function (c) { return c.height; })) + uk.nomorH : 0;
    uk.kt = g.tugas ? kanvasBarcode(g.tugas, format, true) : null;
    uk.lebar = Math.max(kol * uk.w + (kol - 1) * jarakKol + 32, uk.kt ? uk.kt.width + 32 : 0, 440);
    var perBagian = Math.max(kol, Math.floor((TINGGI_MAKS - 300) / (uk.h + uk.jarakBaris)) * kol);
    var total = Math.max(1, Math.ceil(kanvas.length / perBagian)), hasil = [];
    for (var b = 0; b < total; b++) {
      var a = b * perBagian, z = a + perBagian;
      hasil.push(pngBagian(g, g.items.slice(a, z), kanvas.slice(a, z), uk, b + 1, total));
    }
    return hasil;
  }

  function unduhPng() {
    if (!grupJadi.length) return;
    var format = $('bcFormat').value, nomor = $('bcNomor').checked || $('bcTugas').checked;
    var antre = 0;
    grupJadi.forEach(function (g) {
      var bagian = pngGrup(g, format, nomor);
      bagian.forEach(function (kanvas, bi) {
        var nama = (g.tugas || 'barcode') + '-' + g.items.length + (bagian.length > 1 ? '-bagian' + (bi + 1) : '') + '.png';
        var urut = antre++;
        kanvas.toBlob(function (blob) {
          if (!blob) { setStatus('Gagal membuat gambar ' + nama + '. Pakai Cetak / Simpan PDF.', 'error'); return; }
          var a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = nama;
          // jeda antar unduhan supaya browser tidak memblokir unduhan beruntun
          setTimeout(function () {
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
          }, urut * 400);
        });
      });
    });
  }

  // ---------- upload template: baris 1 = kode tugas, baris 2 dst = bagging; satu kolom = satu grup ----------
  // nomor yang tersimpan sebagai angka dibaca mentah supaya tidak berubah jadi format tampilan (mis. 1.23E+14)
  function teksSel(v) {
    if (v == null) return '';
    if (typeof v === 'number') return Number.isInteger(v) ? v.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 0 }) : String(v);
    return String(v).replace(/\s+/g, '');
  }

  function bacaTemplate(file) {
    if (!file) return;
    if (typeof XLSX === 'undefined') { setStatus('Library pembaca Excel gagal dimuat. Cek koneksi internet lalu muat ulang halaman.', 'error'); return; }
    var r = new FileReader();
    r.onload = function (e) {
      try {
        var wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        var grup = [];
        wb.SheetNames.forEach(function (n) {
          var aoa = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: '', blankrows: false });
          var kol = aoa.reduce(function (m, row) { return Math.max(m, row.length); }, 0);
          for (var c = 0; c < kol; c++) {
            var isi = aoa.map(function (row) { return teksSel(row[c]); }).filter(Boolean);
            grup = grup.concat(kelompokkan(isi));
          }
        });
        if (!grup.length) { setStatus('File template kosong.', 'error'); return; }
        $('bcInput').value = grup.map(function (g) { return [g.tugas].concat(g.items).join('\n'); }).join('\n\n');
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

  // daftar ringkas & tombol Sebelumnya/Berikutnya (tanpa mengubah alamat # supaya tab tidak berpindah)
  $('bcGrid').addEventListener('click', function (e) {
    var nav = e.target.closest('.bc-nav button');
    if (nav) {
      nav.blur();   // lepas fokus: Enter dari scanner tidak boleh ikut menekan tombol
      tampilGrup(aktif + +nav.getAttribute('data-nav'), true);
      return;
    }
    var a = e.target.closest('.bc-ringkas a'); if (!a) return;
    e.preventDefault();
    a.blur();
    var idx = kotakGrup().map(function (k) { return k.id; }).indexOf('bcGrup' + a.getAttribute('data-grup'));
    if (idx >= 0) tampilGrup(idx, true);
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
  $('bcJarak').addEventListener('change', function () {
    var v = this.value + 'px';
    Array.prototype.forEach.call(document.querySelectorAll('#bcGrid .bc-grid'), function (g) { g.style.setProperty('--jarak', v); });
  });
})();
