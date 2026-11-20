/* Mozaik Ofset field-sales map. Layout is fixed (ltr) in both languages. */
(function () {
  'use strict';
  var API = window.MZK_API, TT = window.MZK_I18N, TR = window.MZK_TR_REPORT;
  var CATS = ['r', 'f', 'b', 'p', 's', 'w', 'c', 'k'];
  var STC = { none: '#1e3a78', done: '#2f9e57', pending: '#f39200', refused: '#c4161c' };
  var STI = { done: '✅', pending: '⏳', refused: '❌' };
  var S = { lang: localStorage.getItem('mzk_lang') || 'ar', code: localStorage.getItem('mzk_code') || '', filter: 'all', visits: {}, extras: [], overrides: {}, places: [], byId: {}, sel: null, tab: 'visits', vfilter: 'all',
            queue: JSON.parse(localStorage.getItem('mzk_queue') || '[]'), draft: {}, report: null };
  var $ = function (id) { return document.getElementById(id); };
  function t(k) { return (TT[S.lang] && TT[S.lang][k]) || TT.ar[k] || k; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function norm(s) { return String(s || '').toLowerCase().replace(/ı/g, 'i').replace(/İ/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c').replace(/[ً-ٟ]/g, ''); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function fmt(d, withTime) { if (!d) return ''; var x = new Date(d); if (isNaN(x)) return ''; return pad(x.getDate()) + '.' + pad(x.getMonth() + 1) + '.' + x.getFullYear() + (withTime ? ' ' + pad(x.getHours()) + ':' + pad(x.getMinutes()) : ''); }
  function save(k, v) { localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); }
  function toast(msg, ms) { var e = $('toast'); e.textContent = msg; e.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(function () { e.hidden = true; }, ms || 2400); }

  /* ---------------- language ---------------- */
  function applyLang() {
    document.documentElement.lang = S.lang; document.documentElement.dir = 'ltr';                    /* never mirrored */
    document.title = t('app');
    [].forEach.call(document.querySelectorAll('[data-i18n]'), function (e) { e.textContent = t(e.getAttribute('data-i18n')); });
    [].forEach.call(document.querySelectorAll('[data-i18n-ph]'), function (e) { e.placeholder = t(e.getAttribute('data-i18n-ph')); });
    [].forEach.call(document.querySelectorAll('.langs button'), function (b) { b.classList.toggle('on', b.getAttribute('data-lang') === S.lang); });
    if (!$('app').hidden) { renderChips(); renderTabs(); renderDrawer(); if (S.sel) renderSheet(); }
  }
  function setLang(l) { S.lang = l; save('mzk_lang', l); applyLang(); }
  [].forEach.call(document.querySelectorAll('.langs button'), function (b) { b.addEventListener('click', function () { setLang(b.getAttribute('data-lang')); }); });

  /* ---------------- places ---------------- */
  function buildPlaces() {
    var arr = [];
    window.PLACES.forEach(function (r) { arr.push({ id: r[0], name: r[1], lat: r[2], lon: r[3], cats: r[4], phone: r[5], addr: r[6], hours: r[7], web: r[8], src: r[9] }); });
    S.extras.forEach(function (e) { arr.push({ id: e.id, name: e.name, lat: e.lat, lon: e.lon, cats: e.tags || 'r', phone: e.phone || '', addr: e.addr || '', hours: e.hours || '', web: e.web || '', src: 'manual' }); });
    S.byId = {}; S.places = [];
    arr.forEach(function (p) {
      var o = S.overrides[p.id]; if (o) { if (o.hidden) return; ['name', 'phone', 'addr', 'hours', 'web'].forEach(function (k) { if (o[k]) p[k] = o[k]; }); }
      p.n = norm(p.name); S.byId[p.id] = p; S.places.push(p);
    });
  }
  function stOf(id) { var v = S.visits[id]; return v ? v.status : 'none'; }

  /* ---------------- map ---------------- */
  var map, cluster, markers = {}, selRing, meDot;
  function initMap() {
    map = L.map('map', { zoomControl: false, preferCanvas: true, tap: true }).setView([37.066, 37.383], 12);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors · Overture Maps' }).addTo(map);
    L.control.zoom({ position: 'topleft' }).addTo(map);
    cluster = L.markerClusterGroup({ chunkedLoading: true, maxClusterRadius: 44, disableClusteringAtZoom: 17, showCoverageOnHover: false, spiderfyOnMaxZoom: true });
    window.__mzk = { map: map, cluster: cluster, markers: markers, labels: function () { updateLabels(); return labeled; } };
    map.addLayer(cluster); map.on('moveend zoomend', function () { setTimeout(updateLabels, 60); }); cluster.on('animationend', function () { setTimeout(updateLabels, 60); });
    map.on('click', function () { if (S.sel && !$('pin').hidden === false) { /* keep sheet open on map taps to avoid accidental closes */ } });
  }
  function mk(p) {
    var m = markers[p.id]; if (m) return m;
    m = L.circleMarker([p.lat, p.lon], { radius: 9, color: '#fff', weight: 2.5, fillColor: STC[stOf(p.id)], fillOpacity: 1 });
    m.on('click', function () { openPlace(p.id); });
    markers[p.id] = m; return m;
  }
  function visible(p) { return (S.filter === 'all' || p.cats.indexOf(S.filter) >= 0); }
  function renderMarkers() {
    cluster.clearLayers(); var arr = [];
    S.places.forEach(function (p) { if (visible(p)) { var m = mk(p); m.setStyle({ fillColor: STC[stOf(p.id)] }); arr.push(m); } });
    cluster.addLayers(arr); setTimeout(updateLabels, 200);
  }
  var labeled = {};
  function updateLabels() {
    if (!map || !cluster) return; var z = map.getZoom(), bnd = map.getBounds().pad(0.05), cand = [], boxes = [], pick = {};
    if (z >= 16) Object.keys(markers).forEach(function (id) {
      var m = markers[id]; if (m._map && bnd.contains(m.getLatLng())) { var pt = map.latLngToContainerPoint(m.getLatLng()); cand.push({ id: id, x: pt.x, y: pt.y }); }
    });
    cand.sort(function (a, b) { return a.y - b.y || a.x - b.x; });
    cand.forEach(function (c) {
      if (Object.keys(pick).length >= 120) return;
      var p = S.byId[c.id]; if (!p) return;
      var w = Math.min(Math.max(String(p.name).length, 4), 22) * 6.6 + 14, x0 = c.x + 8, y0 = c.y - 9, x1 = x0 + w, y1 = y0 + 18, hit = false;
      for (var i = 0; i < boxes.length; i++) { var b = boxes[i]; if (x0 < b[2] + 3 && x1 > b[0] - 3 && y0 < b[3] + 2 && y1 > b[1] - 2) { hit = true; break; } }
      if (!hit) { boxes.push([x0, y0, x1, y1]); pick[c.id] = 1; }
    });
    Object.keys(labeled).forEach(function (id) { if (!pick[id]) { var m = markers[id]; if (m) m.unbindTooltip(); delete labeled[id]; } });
    Object.keys(pick).forEach(function (id) {
      if (labeled[id]) return; var m = markers[id], p = S.byId[id];
      m.bindTooltip(esc(p.name), { permanent: true, direction: 'right', offset: [8, 0], className: 'nm-tip', opacity: 1 }); m.openTooltip(); labeled[id] = 1;
    });
  }
  function recolor(id) { var m = markers[id]; if (m) m.setStyle({ fillColor: STC[stOf(id)] }); }
  function renderChips() {
    var cnt = { all: S.places.length }; CATS.forEach(function (c) { cnt[c] = 0; });
    S.places.forEach(function (p) { CATS.forEach(function (c) { if (p.cats.indexOf(c) >= 0) cnt[c]++; }); });
    var h = '<button class="chip' + (S.filter === 'all' ? ' on' : '') + '" data-f="all"><span class="lb">' + esc(t('all')) + '</span><small>' + cnt.all + '</small></button>';
    CATS.forEach(function (c) { h += '<button class="chip' + (S.filter === c ? ' on' : '') + '" data-f="' + c + '"><span class="lb">' + esc(t('f_' + c)) + '</span><small>' + cnt[c] + '</small></button>'; });
    $('chips').innerHTML = h;
  }
  $('chips').addEventListener('click', function (e) { var b = e.target.closest('.chip'); if (!b) return; S.filter = b.getAttribute('data-f'); renderChips(); renderMarkers(); });

  /* ---------------- search ---------------- */
  $('search').addEventListener('input', function () {
    var q = norm(this.value.trim()), box = $('results');
    if (q.length < 2) { box.innerHTML = ''; return; }
    var out = []; for (var i = 0; i < S.places.length && out.length < 8; i++) { var p = S.places[i]; if (p.n.indexOf(q) >= 0) out.push(p); }
    box.innerHTML = out.length ? out.map(function (p) { return '<div class="r" data-id="' + esc(p.id) + '"><span class="dot" style="background:' + STC[stOf(p.id)] + '"></span><div><div class="t">' + esc(p.name) + '</div><small class="t">' + esc(catLabel(p.cats)) + '</small></div></div>'; }).join('') : '<div class="r t">' + esc(t('no_results')) + '</div>';
  });
  $('results').addEventListener('click', function (e) { var r = e.target.closest('.r'); if (!r || !r.getAttribute('data-id')) return; var p = S.byId[r.getAttribute('data-id')]; $('results').innerHTML = ''; $('search').value = ''; $('search').blur(); focusPlace(p, true); });
  function catLabel(c) { return c.split('').map(function (x) { return t('c_' + x); }).join(' · '); }
  function focusPlace(p, open) {
    if (S.filter !== 'all' && p.cats.indexOf(S.filter) < 0) { S.filter = 'all'; renderChips(); renderMarkers(); }
    map.setView([p.lat, p.lon], Math.max(map.getZoom(), 17)); if (open !== false) openPlace(p.id);
  }

  /* ---------------- place card ---------------- */
  function openPlace(id) {
    S.sel = id; var p = S.byId[id]; if (!p) return;
    if (selRing) map.removeLayer(selRing);
    selRing = L.circleMarker([p.lat, p.lon], { radius: 17, color: '#c9a659', weight: 4, fill: false, interactive: false }).addTo(map);
    $('sheet').hidden = false; renderSheet(); $('sheet').scrollTop = 0; loadHistory(id); loadPhotos(id);
  }
  function closeSheet() { S.sel = null; $('sheet').hidden = true; if (selRing) { map.removeLayer(selRing); selRing = null; } }
  $('sheet-x').addEventListener('click', closeSheet);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('sheet').hidden) closeSheet(); });
  function row(k, v) { return '<div class="row"><div class="k t">' + esc(t(k)) + '</div><div class="v">' + v + '</div></div>'; }
  function renderSheet() {
    var p = S.byId[S.sel]; if (!p) return; var v = S.visits[p.id], st = v ? v.status : 'none';
    var h = '<div class="pn t">' + esc(p.name) + '</div><div class="tags">' + p.cats.split('').map(function (c) { return '<span class="tag t">' + esc(t('c_' + c)) + '</span>'; }).join('') + '<span class="badge t" style="background:' + STC[st] + '">' + esc(t('st_' + st)) + '</span></div>';
    var tel = p.phone ? '<a class="ltr" href="tel:' + esc(p.phone.replace(/[^+\d]/g, '')) + '">' + esc(p.phone) + '</a>' : '<span class="t">' + esc(t('no_info')) + '</span>';
    h += row('address', '<span class="t">' + (p.addr ? esc(p.addr) : esc(t('no_info'))) + '</span>') + row('phone', tel) + row('hours', '<span class="ltr">' + (p.hours ? esc(p.hours) : '') + '</span>' + (p.hours ? '' : '<span class="t">' + esc(t('no_info')) + '</span>'));
    if (p.web) h += row('website', '<a class="ltr" target="_blank" rel="noopener" href="' + esc(/^https?:/.test(p.web) ? p.web : 'https://' + p.web) + '">' + esc(p.web.replace(/^https?:\/\//, '')) + '</a>');
    if (v) h += '<div class="hint2 t">' + esc(t('last_save')) + ': ' + esc((v.rep || '—') + ' · ' + fmt(v.updated_at, true)) + '</div>';
    h += '<div class="acts"><button class="btn gold t" id="b-dir">🧭 ' + esc(t('directions')) + '</button>' + (p.phone ? '<button class="btn navy t" id="b-call">📞 ' + esc(t('call')) + '</button>' : '') + '</div>';
    h += '<div class="acts"><button class="btn line t" id="b-gph">🖼️ ' + esc(t('google_photos')) + '</button></div>';
    h += '<h4 class="t">' + esc(t('visit_title')) + '</h4><div class="stbtns">' + ['done', 'pending', 'refused', 'none'].map(function (s) { return '<button class="stb' + (st === s ? ' on' : '') + '" data-s="' + s + '"><span class="ic2">' + (s === 'none' ? '↩️' : STI[s]) + '</span>' + esc(t(s === 'none' ? 'btn_none' : 'st_' + s)) + '</button>'; }).join('') + '</div>';
    var showForm = !!v; var rep = (v && v.rep) || localStorage.getItem('mzk_rep') || '';
    h += '<div id="vform" class="form"' + (showForm ? '' : ' hidden') + '><h4 class="t">' + esc(t('details')) + '</h4>' +
      '<label>' + esc(t('rep')) + '</label><input type="text" id="f-rep" value="' + esc(rep) + '">' +
      '<label>' + esc(t('contact')) + '</label><input type="text" id="f-contact" value="' + esc(v ? v.contact : '') + '">' +
      '<label>' + esc(t('products')) + '</label><input type="text" id="f-products" value="' + esc(v ? v.products : '') + '">' +
      '<label>' + esc(t('samples')) + '</label><input type="text" id="f-samples" value="' + esc(v ? v.samples : '') + '">' +
      '<label>' + esc(t('notes')) + '</label><textarea id="f-notes">' + esc(v ? v.notes : '') + '</textarea>' +
      '<label>' + esc(t('follow_up')) + '</label><input type="date" id="f-follow" value="' + esc(v && v.follow_up ? String(v.follow_up).slice(0, 10) : '') + '">' +
      '<div class="acts"><button class="btn gold t" id="b-save">' + esc(t('save')) + '</button><button class="btn line t" id="b-reset">' + esc(t('reset')) + '</button></div></div>';
    h += '<div class="acts"><button class="btn line t" id="b-edit">✏️ ' + esc(t('edit_info')) + '</button></div><h4 class="t">' + esc(t('history')) + '</h4><div class="hist" id="hist"></div>';
    $('sheet-body').innerHTML = h;
  }
  $('sheet-body').addEventListener('click', function (e) {
    var p = S.byId[S.sel]; if (!p) return;
    if (e.target.closest('#b-dir')) return directions(p);
    if (e.target.closest('#b-call')) { location.href = 'tel:' + p.phone.replace(/[^+\d]/g, ''); return; }
    var sb = e.target.closest('.stb'); if (sb) { var sv = sb.getAttribute('data-s'); return sv === 'none' ? resetVisit(p) : setStatus(p, sv); }
    if (e.target.closest('#b-save')) return setStatus(p, stOf(p.id) === 'none' ? 'pending' : stOf(p.id));
    if (e.target.closest('#b-reset')) return resetVisit(p);
    if (e.target.closest('#b-edit')) return editInfo(p);
    if (e.target.closest('#b-gph')) return openUrl('https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(p.name + ' Gaziantep'));
    var pd = e.target.closest('[data-pdel]'); if (pd) { var pid = +pd.getAttribute('data-pdel'); API.deletePhoto(S.code, pid).then(function () { loadPhotos(p.id); }).catch(function () { toast(t('gate_net')); }); return; }
    var pv = e.target.closest('[data-pview]'); if (pv) { var im = pv.querySelector('img'); modal('<img src="' + im.src + '" style="width:100%;border-radius:12px">'); return; }
  });
  $('sheet-body').addEventListener('change', function (e) {
    if (e.target.id !== 'photo-in' || !e.target.files[0]) return; var p = S.byId[S.sel], f = e.target.files[0]; if (!p) return; toast(t('uploading'), 6000);
    shrink(f).then(function (data) { return API.addPhoto(S.code, p.id, data, localStorage.getItem('mzk_rep') || ''); }).then(function () { toast(t('saved')); loadPhotos(p.id); }).catch(function (err) { toast(err && err.bad ? t('gate_bad') : t('gate_net')); });
    e.target.value = '';
  });
  function shrink(file) {
    return new Promise(function (res, rej) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () { var m = 960, w = img.width, h = img.height, k = Math.min(1, m / Math.max(w, h)); var c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        var q = 0.72, d = c.toDataURL('image/jpeg', q); while (d.length > 480000 && q > 0.35) { q -= 0.1; d = c.toDataURL('image/jpeg', q); } res(d); };
      img.onerror = function () { rej(new Error('img')); }; img.src = url;
    });
  }
  function loadPhotos(id) {
    API.getPhotos(S.code, id).then(function (rows) { var box = $('photos'); if (!box || S.sel !== id) return;
      box.innerHTML = rows.length ? rows.map(function (r) { return '<div class="ph"><span data-pview="1"><img loading="lazy" src="' + r.data + '" alt=""></span><button data-pdel="' + r.id + '" aria-label="delete">✕</button></div>'; }).join('') : '<div class="hint2 t">' + esc(t('no_photos')) + '</div>'; }).catch(function () {});
  }
  var autoTimer = null;
  $('sheet-body').addEventListener('input', function (e) {
    if (!e.target.closest('#vform')) return; clearTimeout(autoTimer);
    autoTimer = setTimeout(function () { var p = S.byId[S.sel]; if (!p || stOf(p.id) === 'none') return; setStatus(p, stOf(p.id), true); }, 900);
  });
  function formVals() { var g = function (i) { var e = $(i); return e ? e.value.trim() : ''; }; return { rep: g('f-rep'), contact: g('f-contact'), products: g('f-products'), samples: g('f-samples'), notes: g('f-notes'), follow_up: g('f-follow') }; }
  function setStatus(p, status, quiet) {
    var f = formVals(); if (f.rep) save('mzk_rep', f.rep);
    var old = S.visits[p.id] || {};
    var payload = Object.assign({ place_id: p.id, status: status, name: p.name, lat: p.lat, lon: p.lon, tags: p.cats, phone: p.phone, addr: p.addr }, f);
    if (!$('vform')) payload = Object.assign(payload, { rep: old.rep || localStorage.getItem('mzk_rep') || '' });
    S.visits[p.id] = Object.assign({}, old, payload, { visited_at: old.visited_at || new Date().toISOString(), updated_at: new Date().toISOString() });
    recolor(p.id); if (!quiet) { renderSheet(); loadHistory(p.id); loadPhotos(p.id); } renderDrawer();
    send('saveVisit', [payload], function () { toast(t('saved'), 1200); });
  }
  function resetVisit(p) { delete S.visits[p.id]; recolor(p.id); renderSheet(); renderDrawer(); send('clearVisit', [p.id], function () { toast(t('saved')); }); }
  function loadHistory(id) {
    API.getLog(S.code, id).then(function (rows) {
      var box = $('hist'); if (!box || S.sel !== id) return;
      box.innerHTML = rows.length ? rows.map(function (r) { return '<div><span class="dt">' + esc(fmt(r.at, true)) + '</span><span class="t"><b>' + esc(t('st_' + r.status)) + '</b>' + (r.rep ? ' · ' + esc(r.rep) : '') + (r.note && r.note !== 'reset' ? ' — ' + esc(r.note) : '') + '</span></div>'; }).join('') : '<div class="t">' + esc(t('no_history')) + '</div>';
    }).catch(function () {});
  }

  /* ---------------- directions: Apple Maps / Google Maps app ---------------- */
  function dirUrl(app, p) {
    if (app === 'apple') return 'https://maps.apple.com/?daddr=' + p.lat + ',' + p.lon + '&q=' + encodeURIComponent(p.name) + '&dirflg=d';
    return 'https://www.google.com/maps/dir/?api=1&destination=' + p.lat + ',' + p.lon + '&travelmode=driving';
  }
  function openUrl(u) { var a = document.createElement('a'); a.href = u; a.target = '_self'; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove(); }
  function directions(p) {
    var pref = localStorage.getItem('mzk_dir'); var ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (pref === 'apple' || pref === 'google') return openUrl(dirUrl(pref, p));
    if (!ios) return openUrl(dirUrl('google', p));
    modal('<div class="modal-title t">' + esc(t('dir_choose')) + '</div><div class="dirbtns"><button class="btn gold t" data-d="apple">🍎 ' + esc(t('apple')) + '</button><button class="btn navy t" data-d="google">🗺️ ' + esc(t('google')) + '</button></div>' +
      '<div class="chk form"><label><input type="checkbox" id="rem" checked> <span class="t">' + esc(t('remember')) + '</span></label></div>', function (e) {
      var b = e.target.closest('[data-d]'); if (!b) return; var d = b.getAttribute('data-d'); if ($('rem') && $('rem').checked) save('mzk_dir', d); closeModal(); openUrl(dirUrl(d, p));
    });
  }

  /* ---------------- modal ---------------- */
  var modalHandler = null;
  function modal(html, handler, wide) { $('modal-body').innerHTML = html; $('modal').querySelector('.modal-card').classList.toggle('wide', !!wide); $('modal').hidden = false; modalHandler = handler || null; }
  function closeModal() { $('modal').hidden = true; $('modal-body').innerHTML = ''; modalHandler = null; }
  $('modal-x').addEventListener('click', closeModal);
  $('modal').addEventListener('click', function (e) { if (e.target === $('modal')) return closeModal(); if (modalHandler) modalHandler(e); });

  /* ---------------- edit info ---------------- */
  function editInfo(p) {
    modal('<div class="modal-title t">' + esc(t('edit_title')) + '</div><div class="form"><label>' + esc(t('name')) + '</label><input type="text" id="e-name" value="' + esc(p.name) + '">' +
      '<label>' + esc(t('phone')) + '</label><input type="tel" id="e-phone" value="' + esc(p.phone) + '"><label>' + esc(t('address')) + '</label><input type="text" id="e-addr" value="' + esc(p.addr) + '">' +
      '<label>' + esc(t('hours')) + '</label><input type="text" id="e-hours" value="' + esc(p.hours) + '"><label>' + esc(t('website')) + '</label><input type="url" id="e-web" value="' + esc(p.web) + '">' +
      '<div class="chk" style="margin-top:12px"><label><input type="checkbox" id="e-hide"> <span class="t">' + esc(t('hide_place')) + '</span></label></div>' +
      '<div class="acts"><button class="btn gold t" id="e-save">' + esc(t('save')) + '</button></div></div>', function (e) {
      if (!e.target.closest('#e-save')) return;
      var u = { place_id: p.id, name: $('e-name').value.trim(), phone: $('e-phone').value.trim(), addr: $('e-addr').value.trim(), hours: $('e-hours').value.trim(), web: $('e-web').value.trim(), hidden: $('e-hide').checked };
      if (p.id.indexOf('x:') === 0) { /* manual place: update in place */ var ex = S.extras.filter(function (x) { return x.id === p.id; })[0]; if (ex) { ex.name = u.name || ex.name; ex.phone = u.phone; ex.addr = u.addr; ex.hours = u.hours; ex.web = u.web; if (u.hidden) S.extras = S.extras.filter(function (x) { return x.id !== p.id; }); } }
      else S.overrides[p.id] = u;
      send('updatePlace', [u], function () { toast(t('saved')); });
      closeModal(); buildPlaces(); if (u.hidden) { closeSheet(); if (markers[p.id]) { cluster.removeLayer(markers[p.id]); delete markers[p.id]; } } else { var np = S.byId[p.id]; if (np) { renderSheet(); } } renderChips(); renderDrawer();
    });
  }

  /* ---------------- server calls with an offline queue ---------------- */
  var busy = false;
  function persistQueue() { save('mzk_queue', S.queue); var b = $('syncbadge'); b.hidden = !S.queue.length; b.textContent = '⏳ ' + S.queue.length + ' ' + t('pending_sync'); }
  function send(fn, args, done) {
    API[fn].apply(null, [S.code].concat(args)).then(function () { if (done) done(); }).catch(function (err) {
      if (err && err.bad) return logout();
      S.queue.push({ fn: fn, args: args }); persistQueue(); toast(t('saved_offline'), 3200);
    });
  }
  function flush() {
    if (busy || !S.queue.length || !S.code) return; busy = true;
    var item = S.queue[0];
    API[item.fn].apply(null, [S.code].concat(item.args)).then(function () { S.queue.shift(); persistQueue(); busy = false; if (!S.queue.length) toast(t('sync_done')); else flush(); })
      .catch(function (err) { busy = false; if (err && err.bad) logout(); });
  }
  window.addEventListener('online', flush); setInterval(flush, 20000);

  /* ---------------- menu (the three lines) ---------------- */
  function openDrawer() { $('drawer').hidden = false; $('scrim').hidden = false; renderTabs(); renderDrawer(); }
  function closeDrawer() { $('drawer').hidden = true; $('scrim').hidden = true; }
  $('menu-btn').addEventListener('click', openDrawer); $('drawer-x').addEventListener('click', closeDrawer); $('scrim').addEventListener('click', closeDrawer);
  function renderTabs() { $('tabs').innerHTML = [['visits', 'm_visits'], ['report', 'm_report'], ['add', 'm_add'], ['settings', 'm_settings']].map(function (x) { return '<button data-tab="' + x[0] + '"' + (S.tab === x[0] ? ' class="on"' : '') + '>' + esc(t(x[1])) + '</button>'; }).join(''); }
  $('tabs').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; S.tab = b.getAttribute('data-tab'); renderTabs(); renderDrawer(); });
  function visitList() { return Object.keys(S.visits).map(function (k) { return S.visits[k]; }).sort(function (a, b) { return String(b.updated_at).localeCompare(String(a.updated_at)); }); }
  function renderDrawer() {
    if ($('drawer').hidden) return; var h = '';
    if (S.tab === 'visits') {
      h += '<div class="acts"><button class="btn ghost t" id="m-sync">🔄 ' + esc(t('refresh')) + '</button></div>';
      var all = visitList(), c = { all: all.length, done: 0, pending: 0, refused: 0 }; all.forEach(function (v) { c[v.status]++; });
      h += '<div class="pills">' + ['all', 'done', 'pending', 'refused'].map(function (s) { return '<button class="pill t' + (S.vfilter === s ? ' on' : '') + '" data-vf="' + s + '">' + (s === 'all' ? esc(t('all')) : STI[s] + ' ' + esc(t('st_' + s))) + ' <b>' + c[s] + '</b></button>'; }).join('') + '</div>';
      var list = all.filter(function (v) { return S.vfilter === 'all' || v.status === S.vfilter; });
      h += list.length ? list.map(function (v) {
        var p = S.byId[v.place_id] || { name: v.name || v.place_id, cats: v.tags || '', addr: v.addr || '' };
        return '<div class="vitem" style="border-left-color:' + STC[v.status] + '" data-id="' + esc(v.place_id) + '"><div class="nm">' + esc(p.name) + '</div><div class="meta">' + STI[v.status] + ' ' + esc(t('st_' + v.status)) + ' · ' + esc(fmt(v.visited_at, true)) + (v.rep ? ' · ' + esc(v.rep) : '') + '</div>' +
          '<div class="meta">' + esc(catLabel(p.cats || '')) + (p.addr ? ' · ' + esc(p.addr) : '') + '</div>' + (v.contact ? '<div class="meta">' + esc(t('contact')) + ': ' + esc(v.contact) + '</div>' : '') +
          (v.products ? '<div class="meta">' + esc(t('products')) + ': ' + esc(v.products) + '</div>' : '') + (v.samples ? '<div class="meta">' + esc(t('samples')) + ': ' + esc(v.samples) + '</div>' : '') +
          (v.notes ? '<div class="nt">' + esc(v.notes) + '</div>' : '') + (v.follow_up ? '<div class="meta">📅 ' + esc(t('follow_up')) + ': ' + esc(fmt(v.follow_up)) + '</div>' : '') + '</div>';
      }).join('') : '<div class="hint">' + esc(t('none_yet')) + '</div>';
    } else if (S.tab === 'report') {
      var vs = visitList(), dmin = vs.length ? vs[vs.length - 1].visited_at : new Date().toISOString(), today = new Date().toISOString().slice(0, 10);
      h += '<div class="hint">' + esc(t('report_hint')) + '</div><div class="form drawer-form"><label>' + esc(t('from')) + '</label><input type="date" id="r-from" value="' + esc(String(dmin).slice(0, 10)) + '"><label>' + esc(t('to')) + '</label><input type="date" id="r-to" value="' + today + '">' +
        '<div class="acts"><button class="btn gold t" id="r-make">' + esc(t('make_report')) + '</button></div></div>';
    } else if (S.tab === 'add') {
      var d = S.draft; h += '<div class="panel-h t">' + esc(t('add_title')) + '</div><div class="form drawer-form"><label>' + esc(t('name')) + '</label><input type="text" id="a-name" value="' + esc(d.name || '') + '"><label>' + esc(t('type')) + '</label><div class="chk">' +
        CATS.map(function (c) { return '<label><input type="checkbox" class="a-cat" value="' + c + '"' + ((d.tags || 'r').indexOf(c) >= 0 ? ' checked' : '') + '> <span class="t">' + esc(t('c_' + c)) + '</span></label>'; }).join('') + '</div>' +
        '<label>' + esc(t('phone')) + '</label><input type="tel" id="a-phone" value="' + esc(d.phone || '') + '"><label>' + esc(t('address')) + '</label><input type="text" id="a-addr" value="' + esc(d.addr || '') + '"><label>' + esc(t('hours')) + '</label><input type="text" id="a-hours" value="' + esc(d.hours || '') + '"><label>' + esc(t('website')) + '</label><input type="url" id="a-web" value="' + esc(d.web || '') + '">' +
        '<div class="acts"><button class="btn gold t" id="a-go">📍 ' + esc(t('save_place')) + '</button></div></div>';
    } else {
      var pref = localStorage.getItem('mzk_dir') || 'ask';
      h += '<div class="panel-h t">' + esc(t('set_dir')) + '</div><div class="opt">' + [['ask', 'ask_each'], ['apple', 'apple'], ['google', 'google']].map(function (o) { return '<button class="t' + (pref === o[0] ? ' on' : '') + '" data-dp="' + o[0] + '">' + esc(t(o[1])) + '</button>'; }).join('') + '</div>' +
        '<div class="panel-h t">' + esc(t('set_rep')) + '</div><div class="form drawer-form"><input type="text" id="s-rep" value="' + esc(localStorage.getItem('mzk_rep') || '') + '"></div>' +
        '<div class="panel-h t">' + esc(t('lang')) + '</div><div class="opt"><button data-sl="ar"' + (S.lang === 'ar' ? ' class="on"' : '') + '>العربية</button><button data-sl="tr"' + (S.lang === 'tr' ? ' class="on"' : '') + '>Türkçe</button></div>' +
        '<div class="hint">' + esc(t('sources')) + '</div><div class="hint">' + (window.PLACES_META ? window.PLACES_META.total + ' ' + esc(t('n_places')) : '') + '</div><div class="acts"><button class="btn ghost t" id="s-out">' + esc(t('logout')) + '</button></div>';
    }
    $('drawer-body').innerHTML = h;
  }
  $('drawer-body').addEventListener('click', function (e) {
    var vf = e.target.closest('[data-vf]'); if (vf) { S.vfilter = vf.getAttribute('data-vf'); return renderDrawer(); }
    var vi = e.target.closest('.vitem'); if (vi) { var id = vi.getAttribute('data-id'), p = S.byId[id]; if (p) { closeDrawer(); focusPlace(p, true); } return; }
    if (e.target.closest('#m-sync')) return sync(true);
    if (e.target.closest('#r-make')) return makeReport();
    if (e.target.closest('#a-go')) return startAdd();
    var dp = e.target.closest('[data-dp]'); if (dp) { var v = dp.getAttribute('data-dp'); if (v === 'ask') localStorage.removeItem('mzk_dir'); else save('mzk_dir', v); return renderDrawer(); }
    var sl = e.target.closest('[data-sl]'); if (sl) return setLang(sl.getAttribute('data-sl'));
    if (e.target.closest('#s-out')) return logout();
  });
  $('drawer-body').addEventListener('input', function (e) { if (e.target.id === 's-rep') save('mzk_rep', e.target.value.trim()); });

  /* ---------------- add a missing place ---------------- */
  function startAdd() {
    var name = $('a-name').value.trim(); if (!name) { toast(t('need_name')); return; }
    var tags = [].filter.call(document.querySelectorAll('.a-cat'), function (c) { return c.checked; }).map(function (c) { return c.value; }).join('') || 'r';
    S.draft = { name: name, tags: tags, phone: $('a-phone').value.trim(), addr: $('a-addr').value.trim(), hours: $('a-hours').value.trim(), web: $('a-web').value.trim() };
    closeDrawer(); closeSheet(); $('pin').hidden = false;
  }
  $('pin-cancel').addEventListener('click', function () { $('pin').hidden = true; openDrawer(); });
  $('pin-save').addEventListener('click', function () {
    var c = map.getCenter(), d = S.draft, p = { name: d.name, tags: d.tags, phone: d.phone, addr: d.addr, hours: d.hours, web: d.web, lat: +c.lat.toFixed(6), lon: +c.lng.toFixed(6), by: localStorage.getItem('mzk_rep') || '' };
    $('pin').hidden = true;
    API.addPlace(S.code, p).then(function (r) {
      S.extras.push(r); S.draft = {}; buildPlaces(); renderChips(); S.filter = 'all'; renderMarkers(); toast(t('place_added')); focusPlace(S.byId[r.id], true);
    }).catch(function (err) { if (err && err.bad) logout(); else toast(t('gate_net')); $('pin').hidden = false; });
  });

  /* ---------------- Turkish management report ---------------- */
  function reportData(from, to) {
    var a = from ? new Date(from + 'T00:00:00') : new Date(0), b = to ? new Date(to + 'T23:59:59') : new Date();
    return visitList().filter(function (v) { var d = new Date(v.visited_at); return d >= a && d <= b; }).sort(function (x, y) { return String(x.visited_at).localeCompare(String(y.visited_at)); });
  }
  function catTR(c) { return (c || '').split('').map(function (x) { return TR.cats[x]; }).filter(Boolean).join(' / '); }
  function makeReport() {
    var from = $('r-from').value, to = $('r-to').value, rows = reportData(from, to); S.report = { from: from, to: to, rows: rows };
    var html = reportHtml(from, to, rows);
    modal('<div class="modal-title t">' + esc(t('report_title')) + '</div><div class="acts"><button class="btn gold t" id="rp-print">🖨️ ' + esc(t('print')) + '</button><button class="btn navy t" id="rp-csv">📊 ' + esc(t('csv')) + '</button></div><div class="rp" style="background:#fff;padding:12px;border-radius:12px;overflow-x:auto">' + html + '</div>', function (e) {
      if (e.target.closest('#rp-print')) { $('print-area').innerHTML = '<div class="rp">' + html + '</div>'; setTimeout(function () { window.print(); }, 60); }
      if (e.target.closest('#rp-csv')) downloadCsv(rows, from, to);
    }, true);
  }
  function reportHtml(from, to, rows) {
    var c = { done: 0, pending: 0, refused: 0 }; rows.forEach(function (v) { c[v.status]++; });
    var pct = rows.length ? Math.round(c.done * 100 / rows.length) : 0, reps = {}; rows.forEach(function (v) { if (v.rep) reps[v.rep] = 1; });
    var byc = {}; rows.forEach(function (v) { var tg = (v.tags || ''); var key = tg ? tg.charAt(0) : '?'; (byc[key] = byc[key] || { n: 0, done: 0, pending: 0, refused: 0 }); byc[key].n++; byc[key][v.status]++; });
    var h = '<div class="hd"><div><h1>' + esc(TR.title) + '</h1><div>' + esc(TR.company) + '</div><div style="color:#555;font-size:12px">' + esc(TR.sub) + '</div></div><img src="assets/logo-colored.png" alt=""></div>' +
      '<div style="font-size:12px;color:#333">' + esc(TR.period) + ': <b>' + esc(fmt(from) || '-') + ' – ' + esc(fmt(to) || '-') + '</b> &nbsp;|&nbsp; ' + esc(TR.created) + ': ' + esc(fmt(new Date(), true)) + (Object.keys(reps).length ? ' &nbsp;|&nbsp; ' + esc(TR.rep) + ': ' + esc(Object.keys(reps).join(', ')) : '') + '</div>' +
      '<h2>' + esc(TR.summary) + '</h2><div class="kp"><div><b>' + rows.length + '</b><span>' + esc(TR.total) + '</span></div><div><b style="color:#2f9e57">' + c.done + '</b><span>' + esc(TR.done) + '</span></div><div><b style="color:#b36b00">' + c.pending + '</b><span>' + esc(TR.pending) + '</span></div><div><b style="color:#c4161c">' + c.refused + '</b><span>' + esc(TR.refused) + '</span></div><div><b>%' + pct + '</b><span>' + esc(TR.conv) + '</span></div></div>';
    if (!rows.length) return h + '<p>' + esc(TR.none) + '</p><div class="ft">' + esc(TR.src) + '</div>';
    h += '<h2>' + esc(TR.by_cat) + '</h2><table><tr><th>' + esc(TR.cat) + '</th><th>' + esc(TR.visits) + '</th><th>' + esc(TR.st.done) + '</th><th>' + esc(TR.st.pending) + '</th><th>' + esc(TR.st.refused) + '</th></tr>' +
      Object.keys(byc).map(function (k) { var x = byc[k]; return '<tr><td>' + esc(TR.cats[k] || '-') + '</td><td>' + x.n + '</td><td>' + x.done + '</td><td>' + x.pending + '</td><td>' + x.refused + '</td></tr>'; }).join('') + '</table>' +
      '<h2>' + esc(TR.list) + '</h2><table><tr><th>' + [TR.date, TR.biz, TR.cat, TR.addr, TR.phone, TR.result, TR.contact, TR.products, TR.samples, TR.note || TR.notes, TR.follow, TR.rep].map(esc).join('</th><th>') + '</th></tr>' +
      rows.map(function (v) { var p = S.byId[v.place_id] || {}; return '<tr><td>' + esc(fmt(v.visited_at, true)) + '</td><td><b>' + esc(v.name || p.name || '') + '</b></td><td>' + esc(catTR(v.tags || p.cats)) + '</td><td>' + esc(v.addr || p.addr || '') + '</td><td>' + esc(v.phone || p.phone || '') + '</td><td class="s-' + v.status + '">' + esc(TR.st[v.status]) + '</td><td>' + esc(v.contact || '') + '</td><td>' + esc(v.products || '') + '</td><td>' + esc(v.samples || '') + '</td><td>' + esc(v.notes || '') + '</td><td>' + esc(fmt(v.follow_up)) + '</td><td>' + esc(v.rep || '') + '</td></tr>'; }).join('') + '</table><div class="ft">' + esc(TR.src) + '</div>';
    return h;
  }
  function downloadCsv(rows, from, to) {
    var head = [TR.date, TR.biz, TR.cat, TR.addr, TR.phone, TR.result, TR.contact, TR.products, TR.samples, TR.notes, TR.follow, TR.rep];
    var q = function (s) { return '"' + String(s == null ? '' : s).replace(/"/g, '""') + '"'; };
    var lines = [head.map(q).join(';')].concat(rows.map(function (v) { var p = S.byId[v.place_id] || {}; return [fmt(v.visited_at, true), v.name || p.name, catTR(v.tags || p.cats), v.addr || p.addr, v.phone || p.phone, TR.st[v.status], v.contact, v.products, v.samples, v.notes, fmt(v.follow_up), v.rep].map(q).join(';'); }));
    var blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'Mozaik-ziyaret-raporu-' + new Date().toISOString().slice(0, 10) + '.csv'; document.body.appendChild(a); a.click(); a.remove();
  }

  /* ---------------- locate me ---------------- */
  $('locate').addEventListener('click', function () {
    if (!navigator.geolocation) return toast(t('loc_fail'));
    navigator.geolocation.getCurrentPosition(function (pos) {
      var ll = [pos.coords.latitude, pos.coords.longitude]; if (meDot) map.removeLayer(meDot);
      meDot = L.circleMarker(ll, { radius: 9, color: '#fff', weight: 3, fillColor: '#2a7de1', fillOpacity: 1, interactive: false }).addTo(map); map.setView(ll, Math.max(map.getZoom(), 16));
    }, function () { toast(t('loc_fail')); }, { enableHighAccuracy: true, timeout: 12000 });
  });

  /* ---------------- gate / session ---------------- */
  function logout() { localStorage.removeItem('mzk_code'); S.code = ''; location.reload(); }
  function showGate(msg) { $('gate').hidden = false; $('app').hidden = true; $('gate-msg').textContent = msg || ''; applyLang(); }
  function tryCode(code, silent) {
    return API.check(code).then(function (ok) {
      if (!ok) { if (!silent) $('gate-msg').textContent = t('gate_bad'); else showGate(''); return false; }
      S.code = code; save('mzk_code', code); return loadAll().then(enter).then(function () { return true; });
    }).catch(function () {
      var cache = localStorage.getItem('mzk_cache');
      if (silent && cache) { S.code = code; applyState(JSON.parse(cache)); enter(); return true; }
      if (!silent) $('gate-msg').textContent = t('gate_net'); else showGate(''); return false;
    });
  }
  function applyState(d) { S.visits = {}; (d.visits || []).forEach(function (v) { S.visits[v.place_id] = v; }); S.extras = d.extras || []; S.overrides = {}; (d.overrides || []).forEach(function (o) { S.overrides[o.place_id] = o; }); }
  function loadAll() { return API.getAll(S.code).then(function (d) { save('mzk_cache', d); applyState(d); lastSig = sig(d); }); }
  var entered = false;
  function enter() {
    $('gate').hidden = true; $('app').hidden = false; $('demo-bar').hidden = true;
    if (!entered) { entered = true; initMap(); }
    buildPlaces(); renderChips(); renderMarkers(); applyLang(); persistQueue(); setTimeout(function () { map.invalidateSize(); }, 50); flush();
  }
  function askName() {
    if (localStorage.getItem('mzk_rep')) return;
    modal('<div class="modal-title t">' + esc(t('who_title')) + '</div><div class="hint2 t">' + esc(t('who_hint')) + '</div><div class="form"><input type="text" id="who" autocomplete="name"><div class="acts"><button class="btn gold t" id="who-ok">' + esc(t('save')) + '</button></div></div>', function (e) {
      if (!e.target.closest('#who-ok')) return; var v = $('who').value.trim(); if (!v) return; save('mzk_rep', v); closeModal(); toast(t('saved'), 1200);
    });
  }
  $('enter').addEventListener('click', function () { var c = $('code').value.trim(); if (!c) return; $('gate-msg').textContent = ''; $('enter').disabled = true; tryCode(c, false).then(function () { $('enter').disabled = false; }); });
  $('code').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('enter').click(); });
  /* ---- live sync between everybody who is logged in: refresh on focus, every 25 s, and by hand. Last save wins; the card shows who saved last. ---- */
  var lastSig = '', syncing = false;
  function sig(d) { return JSON.stringify([d.visits, d.extras, d.overrides]); }
  function sync(manual) {
    if (syncing || !S.code || $('app').hidden || S.queue.length) return Promise.resolve(); syncing = true;
    return API.getAll(S.code).then(function (d) {
      syncing = false; var s2 = sig(d); if (s2 === lastSig && !manual) return; lastSig = s2; save('mzk_cache', d);
      var oldV = S.visits, structural = JSON.stringify([d.extras, d.overrides]) !== JSON.stringify([S.extras, S.overrides]); applyState(d);
      if (structural) { buildPlaces(); renderChips(); renderMarkers(); }
      else { var ids = {}; Object.keys(oldV).concat(Object.keys(S.visits)).forEach(function (k) { if (JSON.stringify(oldV[k]) !== JSON.stringify(S.visits[k])) ids[k] = 1; }); Object.keys(ids).forEach(recolor); }
      renderDrawer();
      var typing = document.activeElement && $('sheet').contains(document.activeElement) && /INPUT|TEXTAREA/.test(document.activeElement.tagName);
      if (S.sel && !typing && !$('sheet').hidden) { renderSheet(); loadHistory(S.sel); loadPhotos(S.sel); }
      if (manual) toast(t('updated'), 1400);
    }).catch(function (err) { syncing = false; if (err && err.bad) logout(); });
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden) sync(); });
  window.addEventListener('focus', function () { sync(); });
  setInterval(function () { if (!document.hidden) sync(); }, 25000);

  applyLang();
  if (S.code) tryCode(S.code, true); else showGate('');
  if ('serviceWorker' in navigator && location.protocol !== 'file:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') navigator.serviceWorker.register('sw.js').catch(function () {});
})();
