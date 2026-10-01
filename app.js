(function () {
  'use strict';

  // Kolom yang dipakai: key -> pola nama kolom (sudah dinormalisasi: huruf kecil, spasi tunggal)
  var KOLOM = [
    { key: 'awb', label: 'No. Waybill', wajib: true, cocok: function (h) { return h.indexOf('waybill') >= 0; } },
    { key: 'kirim', label: 'Kode Tugas Kirim Station Sblm', wajib: true, cocok: function (h) { return h.indexOf('kode tugas') >= 0 && h.indexOf('kirim') >= 0; } },
    { key: 'sampai', label: 'Kode Tugas Sampai', wajib: true, cocok: function (h) { return h.indexOf('kode tugas') >= 0 && h.indexOf('sampai') >= 0; } },
    { key: 'wKirim', label: 'Waktu Kirim Station Sblm', cocok: function (h) { return h.indexOf('waktu kirim') >= 0; } },
    { key: 'wSampai', label: 'Waktu Sampai', cocok: function (h) { return h === 'waktu sampai'; } },
    { key: 'dp', label: 'Drop Point', cocok: function (h) { return h === 'drop point'; } },
    { key: 'scan', label: 'Discan oleh', cocok: function (h) { return h.indexOf('discan oleh') >= 0; } },
    { key: 'asal', label: 'Lokasi Sebelumnya', cocok: function (h) { return h.indexOf('lokasi sebelum') >= 0; } }
  ];
  var GRUP_JUDUL = { kirim: 'Kode Tugas Kirim', sampai: 'Kode Tugas Sampai', dp: 'Drop Point', scan: 'Discan oleh', asal: 'Lokasi Sebelumnya' };
  var STATUS_LBL = { ok: 'Cocok', beda: 'Tidak cocok', kosong: 'Kode kosong' };
  var MAKS_BARIS = 1000;

  var $ = function (id) { return document.getElementById(id); };
  var baris = [];      // semua baris mentah (objek: header -> nilai), gabungan semua file
  var headers = [];    // gabungan nama kolom
  var peta = {};       // key -> nama kolom
  var data = [];       // hasil olah
  var grupAktif = 'kirim';

  function norm(h) { return String(h == null ? '' : h).replace(/\s+/g, ' ').trim().toLowerCase(); }
  function teks(v) { return v == null ? '' : String(v).trim(); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fmt(n) { return n.toLocaleString('id-ID'); }
  function pct(a, b) { return b ? (a / b * 100) : 0; }
  function fmtPct(a, b) { return b ? pct(a, b).toFixed(2).replace('.', ',') + '%' : '-'; }

  function setStatus(msg, cls) { var s = $('status'); s.textContent = msg; s.className = 'status' + (cls ? ' ' + cls : ''); }

  // ---------- baca file ----------
  function bacaFile(file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function (e) {
        try {
          var wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
          var hasil = [];
          wb.SheetNames.forEach(function (n) {
            var aoa = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: false, defval: '', blankrows: false });
            // cari baris header: baris (dari 15 pertama) yang punya kolom "kode tugas"
            var hi = -1;
            for (var i = 0; i < Math.min(15, aoa.length); i++) {
              if (aoa[i].some(function (c) { return norm(c).indexOf('kode tugas') >= 0; })) { hi = i; break; }
            }
            if (hi < 0) return;
            var head = aoa[hi].map(function (c) { return String(c).replace(/\s+/g, ' ').trim(); });
            for (var j = hi + 1; j < aoa.length; j++) {
              var o = {};
              head.forEach(function (h, k) { if (h) o[h] = aoa[j][k]; });
              hasil.push(o);
            }
            head.forEach(function (h) { if (h && headers.indexOf(h) < 0) headers.push(h); });
          });
          resolve(hasil);
        } catch (err) { reject(err); }
      };
      r.onerror = function () { reject(r.error); };
      r.readAsArrayBuffer(file);
    });
  }

  function muat(files) {
    files = Array.prototype.slice.call(files || []);
    if (!files.length) return;
    if (typeof XLSX === 'undefined') { setStatus('Library pembaca Excel gagal dimuat. Cek koneksi internet lalu muat ulang halaman.', 'error'); return; }
    setStatus('Membaca ' + files.length + ' file...');
    baris = []; headers = [];
    Promise.all(files.map(bacaFile)).then(function (list) {
      list.forEach(function (l) { baris = baris.concat(l); });
      if (!baris.length) { setStatus('Kolom "Kode Tugas" tidak ditemukan. Pastikan file adalah export Monitor Sampai.', 'error'); $('hasil').classList.add('hidden'); return; }
      deteksi();
      olah();
      setStatus(fmt(files.length) + ' file dibaca: ' + files.map(function (f) { return f.name; }).join(', '), 'ok');
    }).catch(function (err) {
      setStatus('Gagal membaca file: ' + (err && err.message ? err.message : err), 'error');
    });
  }

  function deteksi() {
    peta = {};
    KOLOM.forEach(function (k) {
      for (var i = 0; i < headers.length; i++) {
        if (k.cocok(norm(headers[i]))) { peta[k.key] = headers[i]; break; }
      }
    });
    tampilKolom();
  }

  function tampilKolom() {
    $('kolomBody').innerHTML = KOLOM.map(function (k) {
      var opsi = '<option value="">(tidak ada)</option>' + headers.map(function (h) {
        return '<option' + (peta[k.key] === h ? ' selected' : '') + ' value="' + esc(h) + '">' + esc(h) + '</option>';
      }).join('');
      var contoh = '';
      if (peta[k.key]) {
        for (var i = 0; i < baris.length && !contoh; i++) contoh = teks(baris[i][peta[k.key]]);
      }
      return '<tr><td>' + esc(k.label) + (k.wajib ? ' *' : '') + '</td><td><select data-key="' + k.key + '">' + opsi + '</select></td><td class="mono">' + esc(contoh) + '</td></tr>';
    }).join('');
  }

  // ---------- olah ----------
  function ambil(o, key) { return peta[key] ? teks(o[peta[key]]) : ''; }

  function olah() {
    var kurang = KOLOM.filter(function (k) { return k.wajib && !peta[k.key]; }).map(function (k) { return k.label; });
    $('hasil').classList.remove('hidden');
    if (kurang.length) {
      setStatus('Kolom wajib belum ditemukan: ' + kurang.join(', ') + '. Pilih manual di "Kolom terdeteksi".', 'error');
      data = []; render(); return;
    }
    var lihat = {};
    data = [];
    baris.forEach(function (o) {
      var awb = ambil(o, 'awb');
      if (!awb || lihat[awb]) return;
      lihat[awb] = 1;
      var kirim = ambil(o, 'kirim'), sampai = ambil(o, 'sampai');
      var st = (!kirim || !sampai) ? 'kosong' : (kirim.toUpperCase() === sampai.toUpperCase() ? 'ok' : 'beda');
      data.push({
        awb: awb, kirim: kirim, sampai: sampai, st: st,
        wKirim: ambil(o, 'wKirim'), wSampai: ambil(o, 'wSampai'),
        dp: ambil(o, 'dp'), scan: ambil(o, 'scan'), asal: ambil(o, 'asal')
      });
    });
    render();
  }

  function hitung(list) {
    var c = { total: list.length, ok: 0, beda: 0, kosong: 0 };
    list.forEach(function (d) { c[d.st]++; });
    return c;
  }

  function render() {
    var c = hitung(data);
    var p = pct(c.ok, c.total);
    var el = $('persen');
    el.textContent = c.total ? fmtPct(c.ok, c.total) : '-';
    el.className = 'persen ' + (p >= 99 ? 'ok' : p >= 95 ? 'warn' : 'bad');
    $('persenKet').textContent = fmt(c.ok) + ' dari ' + fmt(c.total) + ' AWB cocok';
    $('sTotal').textContent = fmt(c.total);
    $('sOk').textContent = fmt(c.ok);
    $('sBeda').textContent = fmt(c.beda);
    $('sKosong').textContent = fmt(c.kosong);
    $('bar').innerHTML = c.total ? ['ok', 'beda', 'kosong'].map(function (k) {
      var cls = k === 'ok' ? 'b-ok' : k === 'beda' ? 'b-beda' : 'b-kosong';
      return c[k] ? '<i class="' + cls + '" style="width:' + pct(c[k], c.total) + '%" title="' + STATUS_LBL[k] + ': ' + fmt(c[k]) + '"></i>' : '';
    }).join('') : '';
    renderGrup();
    renderDetail();
  }

  function renderGrup() {
    $('grupJudul').textContent = GRUP_JUDUL[grupAktif];
    var g = {};
    data.forEach(function (d) {
      var k = d[grupAktif] || '(kosong)';
      (g[k] = g[k] || []).push(d);
    });
    var rows = Object.keys(g).map(function (k) { var c = hitung(g[k]); c.nama = k; return c; });
    rows.sort(function (a, b) { return pct(a.ok, a.total) - pct(b.ok, b.total) || b.total - a.total; });
    $('grupBody').innerHTML = rows.length ? rows.map(function (r) {
      var p = pct(r.ok, r.total);
      var cls = p >= 99 ? 'ok' : p >= 95 ? 'kosong' : 'beda';
      return '<tr><td class="mono">' + esc(r.nama) + '</td><td class="num">' + fmt(r.total) + '</td><td class="num">' + fmt(r.ok) +
        '</td><td class="num">' + fmt(r.beda) + '</td><td class="num">' + fmt(r.kosong) + '</td><td class="num"><span class="tag ' + cls + '">' + fmtPct(r.ok, r.total) + '</span></td></tr>';
    }).join('') : '<tr><td colspan="6" class="kosong-info">Tidak ada data</td></tr>';
  }

  function saring() {
    var f = $('fStatus').value, q = $('fCari').value.trim().toUpperCase();
    return data.filter(function (d) {
      if (f === 'masalah' && d.st === 'ok') return false;
      if ((f === 'beda' || f === 'kosong' || f === 'ok') && d.st !== f) return false;
      if (q) return [d.awb, d.kirim, d.sampai, d.scan, d.dp].join(' ').toUpperCase().indexOf(q) >= 0;
      return true;
    });
  }

  function renderDetail() {
    var list = saring();
    var tampil = list.slice(0, MAKS_BARIS);
    $('detailBody').innerHTML = tampil.length ? tampil.map(function (d) {
      return '<tr><td class="mono">' + esc(d.awb) + '</td><td><span class="tag ' + d.st + '">' + STATUS_LBL[d.st] + '</span></td><td class="mono">' + esc(d.kirim || '-') +
        '</td><td class="mono">' + esc(d.sampai || '-') + '</td><td>' + esc(d.wKirim) + '</td><td>' + esc(d.wSampai) + '</td><td>' + esc(d.dp) + '</td><td>' + esc(d.scan) + '</td></tr>';
    }).join('') : '<tr><td colspan="8" class="kosong-info">' + (data.length ? 'Tidak ada AWB untuk filter ini' + ($('fStatus').value === 'masalah' ? ' - semua kode tugas cocok.' : '.') : 'Tidak ada data') + '</td></tr>';
    $('detailInfo').textContent = list.length > MAKS_BARIS
      ? 'Menampilkan ' + fmt(MAKS_BARIS) + ' dari ' + fmt(list.length) + ' AWB. Unduh CSV untuk daftar lengkap.'
      : fmt(list.length) + ' AWB.';
  }

  function unduh() {
    var list = saring();
    var kol = ['No. Waybill', 'Status', 'Kode Tugas Kirim Station Sblm', 'Kode Tugas Sampai', 'Waktu Kirim Station Sblm', 'Waktu Sampai', 'Lokasi Sebelumnya', 'Drop Point', 'Discan oleh'];
    var q = function (s) { s = String(s == null ? '' : s); return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    var isi = [kol.join(',')].concat(list.map(function (d) {
      return [d.awb, STATUS_LBL[d.st], d.kirim, d.sampai, d.wKirim, d.wSampai, d.asal, d.dp, d.scan].map(q).join(',');
    })).join('\r\n');
    var blob = new Blob(['﻿' + isi], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'cek-kode-tugas-' + $('fStatus').value + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  // ---------- event ----------
  $('file').addEventListener('change', function (e) { muat(e.target.files); e.target.value = ''; });
  var drop = $('drop');
  ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('aktif'); }); });
  ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('aktif'); }); });
  drop.addEventListener('drop', function (e) { muat(e.dataTransfer.files); });

  $('grupBtn').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    grupAktif = b.getAttribute('data-grup');
    Array.prototype.forEach.call(this.querySelectorAll('button'), function (x) { x.classList.toggle('aktif', x === b); });
    renderGrup();
  });
  $('fStatus').addEventListener('change', renderDetail);
  $('fCari').addEventListener('input', renderDetail);
  $('unduh').addEventListener('click', unduh);
  $('kolomBody').addEventListener('change', function (e) {
    var s = e.target.closest('select'); if (!s) return;
    peta[s.getAttribute('data-key')] = s.value || undefined;
    tampilKolom();
    olah();
  });
})();
