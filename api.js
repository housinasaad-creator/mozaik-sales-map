/* Backend layer. Production: Supabase functions (sm_*) that check the access code on the SERVER. No config -> local demo store on this device only. */
(function () {
  'use strict';
  var CFG = window.MZK_CONFIG || {}, DEMO = !CFG.SUPABASE_URL;
  function rpc(fn, body) {
    return fetch(CFG.SUPABASE_URL + '/rest/v1/rpc/' + fn, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: CFG.SUPABASE_KEY }, body: JSON.stringify(body) })
      .then(function (r) {
        if (r.ok) return r.json();
        return r.json().catch(function () { return {}; }).then(function (e) { var err = new Error(e.message || ('http ' + r.status)); err.bad = /bad_code/.test(e.message || ''); err.status = r.status; throw err; });
      });
  }
  var API;
  if (!DEMO) {
    API = {
      demo: false,
      check: function (c) { return rpc('sm_check', { p_code: c }); },
      getAll: function (c) { return rpc('sm_get_all', { p_code: c }); },
      saveVisit: function (c, p) { return rpc('sm_save_visit', { p_code: c, p: p }); },
      clearVisit: function (c, id) { return rpc('sm_clear_visit', { p_code: c, p_place_id: id }); },
      getLog: function (c, id) { return rpc('sm_get_log', { p_code: c, p_place_id: id }); },
      addPlace: function (c, p) { return rpc('sm_add_place', { p_code: c, p: p }); },
      updatePlace: function (c, p) { return rpc('sm_update_place', { p_code: c, p: p }); },
      addPhoto: function (c, id, data, by) { return rpc('sm_add_photo', { p_code: c, p_place_id: id, p_data: data, p_by: by || '' }); },
      getPhotos: function (c, id) { return rpc('sm_get_photos', { p_code: c, p_place_id: id }); },
      deletePhoto: function (c, id) { return rpc('sm_delete_photo', { p_code: c, p_id: id }); }
    };
  } else {
    var K = 'mzk_demo_db';
    function load() { try { return JSON.parse(localStorage.getItem(K)) || { visits: {}, extras: [], overrides: {}, log: {} }; } catch (e) { return { visits: {}, extras: [], overrides: {}, log: {} }; } }
    function save(d) { localStorage.setItem(K, JSON.stringify(d)); }
    function ok(v) { return Promise.resolve(v); }
    API = {
      demo: true,
      check: function (c) { return ok(!!c); },
      getAll: function () { var d = load(); return ok({ visits: Object.keys(d.visits).map(function (k) { return d.visits[k]; }), extras: d.extras, overrides: Object.keys(d.overrides).map(function (k) { return d.overrides[k]; }), now: new Date().toISOString() }); },
      saveVisit: function (c, p) { var d = load(), old = d.visits[p.place_id], now = new Date().toISOString(); var r = Object.assign({}, old || {}, p, { visited_at: p.visited_at || (old && old.visited_at) || now, updated_at: now }); d.visits[p.place_id] = r; (d.log[p.place_id] = d.log[p.place_id] || []).unshift({ status: p.status, rep: p.rep, note: (p.notes || '').slice(0, 300), at: now }); save(d); return ok(r); },
      clearVisit: function (c, id) { var d = load(); delete d.visits[id]; (d.log[id] = d.log[id] || []).unshift({ status: 'none', rep: null, note: 'reset', at: new Date().toISOString() }); save(d); return ok(true); },
      getLog: function (c, id) { var d = load(); return ok(d.log[id] || []); },
      addPlace: function (c, p) { var d = load(); var r = { id: 'x:' + Math.random().toString(36).slice(2, 10), name: p.name, tags: p.tags || 'r', phone: p.phone, addr: p.addr, hours: p.hours, web: p.web, lat: p.lat, lon: p.lon, created_at: new Date().toISOString(), created_by: p.by }; d.extras.push(r); save(d); return ok(r); },
      addPhoto: function (c, id, data, by) { var d = load(); d.photos = d.photos || []; var r = { id: Date.now(), place_id: id, data: data, by: by, created_at: new Date().toISOString() }; d.photos.unshift(r); save(d); return ok({ id: r.id, created_at: r.created_at }); },
      getPhotos: function (c, id) { var d = load(); return ok((d.photos || []).filter(function (x) { return x.place_id === id; })); },
      deletePhoto: function (c, id) { var d = load(); d.photos = (d.photos || []).filter(function (x) { return x.id !== id; }); save(d); return ok(true); },
      updatePlace: function (c, p) { var d = load(); if (p.place_id.indexOf('x:') === 0) { d.extras = d.extras.filter(function (e) { return !(e.id === p.place_id && p.hidden); }); d.extras.forEach(function (e) { if (e.id === p.place_id) { e.name = p.name || e.name; e.phone = p.phone; e.addr = p.addr; e.hours = p.hours; e.web = p.web; } }); } else { d.overrides[p.place_id] = { place_id: p.place_id, name: p.name || null, phone: p.phone || null, addr: p.addr || null, hours: p.hours || null, web: p.web || null, hidden: !!p.hidden }; } save(d); return ok({ ok: true }); }
    };
  }
  window.MZK_API = API;
})();
