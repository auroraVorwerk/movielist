const USERS = { aurora: 'Aurora', vivica: 'Vivica' };
const TMDB = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p/w92';
const IMG_L = 'https://image.tmdb.org/t/p/w342';
const MCU_KEYWORD = 180547;

if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

let me = localStorage.getItem('movielist-user');
let tab = 'movie';
let items = {};          // id -> Eintrag
let db = null, root = null;
let openId = null;

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const other = () => me === 'aurora' ? 'vivica' : 'aurora';
const today = () => new Date().toISOString().slice(0, 10);

/* ---------- Login ---------- */
function setUser(u) {
  me = u;
  localStorage.setItem('movielist-user', u);
  document.body.classList.toggle('vivica', u === 'vivica');
  $('#switch').textContent = USERS[u] + ' ⇄';
  $('#login').classList.add('hidden');
  $('#app').classList.remove('hidden');
  render();
  window.scrollTo(0, 0);
}
document.querySelectorAll('#login button').forEach(b => b.onclick = () => setUser(b.dataset.user));

/* PIN (einmal pro Gerät) */
const PIN_HASH = '138c0d83ca87eed6437518b1a81ef97e2a74feed4a455f6276b62bb07e240079';
const pinOk = () => localStorage.getItem('movielist-pin') === PIN_HASH;
async function sha256(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
function showWho() { $('#pinBox').classList.add('hidden'); $('#whoBox').classList.remove('hidden'); }
$('#pin').oninput = async () => {
  const v = $('#pin').value.replace(/\D/g, '');
  $('#pin').value = v; $('#pinErr').textContent = '';
  if (v.length < 6) return;
  if (await sha256(v) === PIN_HASH) { localStorage.setItem('movielist-pin', PIN_HASH); showWho(); }
  else { $('#pinErr').textContent = 'Falsche PIN'; $('#pin').value = ''; }
};
if (pinOk()) showWho();
$('#switch').onclick = () => {
  localStorage.removeItem('movielist-user');
  $('#app').classList.add('hidden');
  $('#login').classList.remove('hidden');
  window.scrollTo(0, 0);
};

/* ---------- Datenbank ---------- */
const configured = window.FIREBASE_CONFIG && FIREBASE_CONFIG.databaseURL;
if (configured) {
  firebase.initializeApp(FIREBASE_CONFIG);
  root = firebase.database().ref('movielist');
  db = root.child('items');
  db.on('value', snap => {
    items = snap.val() || {};
    render();
    if (openId) items[openId] ? openSheet(openId) : closeSheet();
  });
  migrate();
}

// Einmalig: früher automatisch gesetzte Franchise in "Filmreihe" verschieben
async function migrate() {
  const done = (await root.child('meta/migrated1').once('value')).val();
  if (done) return;
  const snap = (await db.once('value')).val() || {};
  for (const [id, it] of Object.entries(snap)) {
    if (it.type !== 'movie' || it.collectionId || !it.tmdbId) continue;
    try {
      const d = await tmdb(`/movie/${it.tmdbId}`);
      const upd = {};
      if (d.belongs_to_collection) {
        upd.collectionId = d.belongs_to_collection.id;
        upd.collectionName = cleanCollection(d.belongs_to_collection.name);
        if ((it.franchise || '').trim().toLowerCase() === upd.collectionName.toLowerCase()) upd.franchise = '';
      }
      if (!it.poster && d.poster_path) upd.poster = d.poster_path;
      if (Object.keys(upd).length) await db.child(id).update(upd);
    } catch (e) {}
  }
  root.child('meta/migrated1').set(true);
}

/* ---------- Tabs ---------- */
$('#tabs').onclick = e => {
  const b = e.target.closest('button'); if (!b) return;
  tab = b.dataset.tab;
  document.querySelectorAll('#tabs button').forEach(x => x.classList.toggle('on', x === b));
  $('#q').value = ''; hideResults();
  $('#q').placeholder = { movie: 'Film oder Filmreihe suchen', tv: 'Serie suchen und hinzufügen', watch: 'In Watch List suchen', rewatch: 'In Rewatchable suchen' }[tab];
  $('#genre').value = '';
  render();
  window.scrollTo(0, 0);
};
$('#genre').onchange = render;
$('#sort').onchange = render;

/* ---------- Regeln ---------- */
const rated = (it, u) => it.ratings && it.ratings[u] != null;
const inRewatch = it => !!(it.rewatch && (it.rewatch.aurora || it.rewatch.vivica));
const inWatch = it => !inRewatch(it) && !(rated(it, 'aurora') && rated(it, 'vivica'));

function visible() {
  const all = Object.entries(items).map(([id, it]) => ({ id, ...it }));
  return tab === 'movie' || tab === 'tv' ? all.filter(i => i.type === tab)
       : tab === 'watch' ? all.filter(inWatch) : all.filter(inRewatch);
}

/* ---------- Liste ---------- */
const groupKey = i => i.franchise ? 'f:' + i.franchise.trim().toLowerCase()
                    : i.collectionId ? 'c:' + i.collectionId : 'i:' + i.id;
const groupName = i => i.franchise || i.collectionName || '';

function render() {
  if (!me) return;
  const list = $('#list');
  if (!configured) {
    list.innerHTML = '<div class="setup">Noch keine Datenbank verbunden. Trag in <b>config.js</b> die Firebase-Daten und den TMDB-Schlüssel ein.</div>';
    return;
  }
  let arr = visible();

  const genres = [...new Set(arr.flatMap(i => i.genres || []))].sort((a, b) => a.localeCompare(b, 'de'));
  const sel = $('#genre'), cur = sel.value;
  sel.innerHTML = '<option value="">Alle Genres</option>' + genres.map(g => `<option${g === cur ? ' selected' : ''}>${esc(g)}</option>`).join('');
  if (cur && genres.includes(cur)) arr = arr.filter(i => (i.genres || []).includes(cur));

  const q = $('#q').value.trim().toLowerCase();
  if (q && (tab === 'watch' || tab === 'rewatch')) arr = arr.filter(i => (i.title + ' ' + groupName(i)).toLowerCase().includes(q));

  if (!arr.length) {
    list.innerHTML = `<div class="empty">${tab === 'movie' ? 'Noch keine Filme. Such oben nach einem Titel.' : tab === 'tv' ? 'Noch keine Serien. Such oben nach einem Titel.' : tab === 'watch' ? 'Hier landet alles, was noch nicht von euch beiden bewertet ist.' : 'Hier landet alles mit Rewatch-Haken.'}</div>`;
    return;
  }

  const groups = new Map();
  arr.forEach(i => {
    const key = groupKey(i);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(i);
  });
  const gl = [...groups.values()].map(g => g.sort((a, b) => (a.year || 9999) - (b.year || 9999)));

  const mode = $('#sort').value;
  const score = g => {
    if (mode === 'year') return Math.min(...g.map(i => i.year || 9999));
    const vals = g.map(i => mode === 'mine' ? i.ratings?.[me] : avg(i)).filter(v => v != null);
    return vals.length ? Math.max(...vals) : -1;
  };
  const name = g => (g.length > 1 ? groupName(g[0]) : g[0].title) || g[0].title || '';
  gl.sort((a, b) => {
    if (mode === 'title') return name(a).localeCompare(name(b), 'de');
    if (mode === 'year') return score(a) - score(b);
    return score(b) - score(a) || name(a).localeCompare(name(b), 'de');
  });

  list.innerHTML = gl.map(g => g.length > 1
    ? `<div class="grp">${esc(groupName(g[0]))}</div><div class="grpbody">${g.map(row).join('')}</div>`
    : row(g[0])).join('');
}

function avg(i) {
  const v = ['aurora', 'vivica'].map(u => i.ratings?.[u]).filter(x => x != null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

function row(i) {
  const m = i.ratings?.[me], o = i.ratings?.[other()];
  const mixed = tab === 'watch' || tab === 'rewatch';
  const line1 = [i.producer, i.franchise].filter(Boolean).join(' · ');
  return `<button class="row" data-id="${i.id}">
    <div class="rt"><div class="me${m == null ? ' none' : ''}">${m ?? '–'}</div><div class="ot${o == null ? ' none' : ''}">${o ?? '–'}</div></div>
    <div class="body">
      <div class="l1"><span class="t">${esc(i.title)}${mixed ? ` <span class="kind">${i.type === 'tv' ? 'Serie' : 'Film'}</span>` : ''}</span><span class="y">${i.year || ''}</span></div>
      <div class="meta"><span>${esc(line1) || '&nbsp;'}</span></div>
      <div class="meta"><span>${esc((i.genres || []).join(', '))}</span>${inRewatch(i) ? '<span class="rw">↻</span>' : ''}</div>
    </div>
  </button>`;
}

$('#list').onclick = e => { const r = e.target.closest('.row'); if (r) openSheet(r.dataset.id); };

/* ---------- TMDB ---------- */
function tmdb(path, params = {}) {
  const key = window.TMDB_KEY || '';
  const url = new URL(TMDB + path);
  url.searchParams.set('language', 'de-DE');
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const opts = {};
  if (key.length > 40) opts.headers = { Authorization: 'Bearer ' + key };
  else url.searchParams.set('api_key', key);
  return fetch(url, opts).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
}

function cleanCollection(n) {
  return n.replace(/[\s-]*(Filmreihe|Reihe|Collection|Kollektion|Sammlung)$/i, '').trim();
}

async function fetchEntry(type, tmdbId) {
  const d = await tmdb(`/${type}/${tmdbId}`);
  const e = {
    type, tmdbId,
    title: d.title || d.name,
    year: Number((d.release_date || d.first_air_date || '').slice(0, 4)) || null,
    producer: (d.production_companies || []).slice(0, 2).map(c => c.name).join(', '),
    franchise: '',
    genres: (d.genres || []).map(g => g.name),
    poster: d.poster_path || '',
    addedBy: me,
    addedAt: Date.now()
  };
  if (d.belongs_to_collection) {
    e.collectionId = d.belongs_to_collection.id;
    e.collectionName = cleanCollection(d.belongs_to_collection.name);
  }
  return e;
}

const haveKey = () => new Set(Object.values(items).map(i => i.type + ':' + i.tmdbId));
const findId = (type, tmdbId) => (Object.entries(items).find(([, i]) => i.type === type && i.tmdbId === tmdbId) || [])[0];

/* ---------- Suche ---------- */
let timer = null, lastQ = '';
$('#q').oninput = () => {
  if (tab === 'watch' || tab === 'rewatch') { render(); return; }
  clearTimeout(timer);
  const q = $('#q').value.trim();
  if (q.length < 2) { hideResults(); return; }
  timer = setTimeout(() => search(q), 300);
};
$('#q').onfocus = () => { if ($('#results').innerHTML && (tab === 'movie' || tab === 'tv') && $('#q').value.trim().length > 1) $('#results').classList.remove('hidden'); };
document.addEventListener('click', e => { if (!e.target.closest('.search')) hideResults(); });
function hideResults() { $('#results').classList.add('hidden'); }

async function search(q) {
  lastQ = q;
  const box = $('#results');
  if (!window.TMDB_KEY) { box.innerHTML = '<div class="hint">Kein TMDB-Schlüssel in config.js.</div>'; box.classList.remove('hidden'); return; }
  try {
    const [data, colls] = await Promise.all([
      tmdb('/search/' + tab, { query: q, include_adult: 'false' }),
      tab === 'movie' ? tmdb('/search/collection', { query: q }).catch(() => ({ results: [] })) : { results: [] }
    ]);
    if (q !== lastQ) return;
    let html = '';
    if (tab === 'movie' && /^(mcu|marvel)/i.test(q)) {
      html += `<button class="res coll" data-mcu="1"><div class="noimg"></div><div><div>Marvel Cinematic Universe</div><div class="tag">Ganze Filmreihe hinzufügen</div></div></button>`;
    }
    (colls.results || []).slice(0, 2).forEach(c => {
      const img = c.poster_path ? `<img src="${IMG + c.poster_path}" alt="">` : '<div class="noimg"></div>';
      html += `<button class="res coll" data-coll="${c.id}">${img}<div><div>${esc(cleanCollection(c.name))}</div><div class="tag">Ganze Filmreihe hinzufügen</div></div></button>`;
    });
    const have = haveKey();
    html += (data.results || []).slice(0, 12).map(r => {
      const title = r.title || r.name;
      const date = r.release_date || r.first_air_date || '';
      const orig = r.original_title || r.original_name;
      const img = r.poster_path ? `<img src="${IMG + r.poster_path}" alt="">` : '<div class="noimg"></div>';
      const known = have.has(tab + ':' + r.id);
      return `<button class="res" data-id="${r.id}">${img}<div><div>${esc(title)}</div><div class="y">${date.slice(0, 4) || 'ohne Jahr'}${orig && orig !== title ? ' · ' + esc(orig) : ''}</div></div>${known ? '<span class="have">schon drin</span>' : ''}</button>`;
    }).join('');
    box.innerHTML = html || '<div class="hint">Nichts gefunden.</div>';
    box.classList.remove('hidden');
  } catch (err) {
    box.innerHTML = '<div class="hint">Suche fehlgeschlagen. Stimmt der TMDB-Schlüssel?</div>';
    box.classList.remove('hidden');
  }
}

$('#results').onclick = async e => {
  const b = e.target.closest('.res'); if (!b) return;
  hideResults(); $('#q').value = '';
  if (b.dataset.mcu) return openBulk('Marvel Cinematic Universe', loadMcu, 'MCU');
  if (b.dataset.coll) return openBulk(null, () => loadCollection(Number(b.dataset.coll)));
  const tmdbId = Number(b.dataset.id), type = tab;
  const existing = findId(type, tmdbId);
  if (existing) { openSheet(existing); return; }
  try {
    const ref = db.push();
    await ref.set(await fetchEntry(type, tmdbId));
    openSheet(ref.key);
  } catch (err) {
    alert('Konnte den Titel nicht laden.');
  }
};

/* ---------- Ganze Filmreihe ---------- */
async function loadCollection(id) {
  const d = await tmdb(`/collection/${id}`);
  const parts = (d.parts || []).filter(p => p.release_date && p.release_date <= today())
    .sort((a, b) => a.release_date.localeCompare(b.release_date));
  return { name: cleanCollection(d.name), parts };
}
async function loadMcu() {
  const base = { with_keywords: MCU_KEYWORD, sort_by: 'primary_release_date.asc', 'with_runtime.gte': 70, without_genres: 99, 'primary_release_date.lte': today() };
  const first = await tmdb('/discover/movie', { ...base, page: 1 });
  let parts = first.results || [];
  for (let p = 2; p <= Math.min(first.total_pages || 1, 5); p++) parts = parts.concat((await tmdb('/discover/movie', { ...base, page: p })).results || []);
  return { name: 'Marvel Cinematic Universe', parts };
}

async function openBulk(title, loader, franchise = '') {
  openId = null;
  const sheet = $('#sheet');
  sheet.innerHTML = `<h2>${esc(title || 'Filmreihe')}</h2><div class="sub">Lädt …</div>`;
  sheet.classList.remove('hidden'); $('#sheetBg').classList.remove('hidden');
  let data;
  try { data = await loader(); } catch (e) { sheet.innerHTML = '<div class="sub">Konnte die Filmreihe nicht laden.</div>'; return; }
  const have = haveKey();
  const missing = data.parts.filter(p => !have.has('movie:' + p.id));
  // schon vorhandene Filme, die noch nicht die Franchise tragen
  const retag = franchise ? data.parts.map(p => findId('movie', p.id))
    .filter(id => id && (items[id].franchise || '') !== franchise) : [];
  const label = missing.length ? `${missing.length} hinzufügen` : retag.length ? `Als ${franchise} zusammenfassen` : '';
  sheet.innerHTML = `
    <h2>${esc(data.name)}</h2>
    <div class="sub">${data.parts.length} Filme${missing.length < data.parts.length ? ` · ${data.parts.length - missing.length} schon in der Liste` : ''}</div>
    <div class="blist">${data.parts.map(p => `<div class="bitem${have.has('movie:' + p.id) ? ' have' : ''}"><span>${esc(p.title)}</span><span class="y">${(p.release_date || '').slice(0, 4)}</span></div>`).join('')}</div>
    <div class="actions">
      <button class="btn" id="bCancel">Abbrechen</button>
      ${label ? `<button class="btn primary" id="bAdd">${label}</button>` : '<span class="sub">Alle schon drin</span>'}
    </div>`;
  $('#bCancel').onclick = closeSheet;
  if (!label) return;
  $('#bAdd').onclick = async () => {
    const btn = $('#bAdd'); btn.disabled = true;
    for (const id of retag) await db.child(id + '/franchise').set(franchise);
    let n = 0;
    for (let i = 0; i < missing.length; i += 6) {
      const batch = await Promise.all(missing.slice(i, i + 6).map(p => fetchEntry('movie', p.id).catch(() => null)));
      for (const e of batch) {
        if (!e) continue;
        if (franchise) e.franchise = franchise;
        await db.push().set(e);
        btn.textContent = `${++n} / ${missing.length}`;
      }
    }
    closeSheet();
  };
}

/* ---------- Detail ---------- */
function openSheet(id) {
  const i = items[id]; if (!i) return;
  openId = id;
  const m = i.ratings?.[me], o = i.ratings?.[other()];
  const rw = !!i.rewatch?.[me], orw = !!i.rewatch?.[other()];
  const frFocused = document.activeElement && document.activeElement.id === 'frIn';
  const frVal = frFocused ? $('#frIn').value : (i.franchise || '');
  $('#sheet').innerHTML = `
    <div class="head">
      ${i.poster ? `<img src="${IMG_L + i.poster}" alt="">` : ''}
      <div>
        <h2>${esc(i.title)}</h2>
        <div class="sub">${[i.year, i.type === 'tv' ? 'Serie' : 'Film'].filter(Boolean).join(' · ')}</div>
        <div class="sub">${esc(i.producer || '')}</div>
        <div class="sub">${esc((i.genres || []).join(', '))}</div>
        ${i.collectionName ? `<div class="sub">${esc(i.collectionName)}-Reihe</div>` : ''}
      </div>
    </div>
    <div id="collSuggest"></div>

    <div class="lbl">Deine Bewertung</div>
    <div class="scale">${[1,2,3,4,5,6,7,8,9,10].map(n => `<button data-r="${n}" class="${m === n ? 'on' : ''}">${n}</button>`).join('')}</div>

    <div class="lbl">${USERS[other()]}</div>
    <div class="otherline">${o != null ? o + ' / 10' : 'noch nicht bewertet'}${orw ? ' · Rewatch' : ''}</div>

    <div class="lbl">Rewatch</div>
    <button class="check${rw ? ' on' : ''}" id="rwBtn"><span class="box">${rw ? '✓' : ''}</span>Lohnt sich nochmal</button>

    <div class="lbl">Franchise</div>
    <div class="fr"><input id="frIn" value="${esc(frVal)}" placeholder="z. B. MCU"><button class="btn" id="frSave">Speichern</button></div>

    <div class="actions">
      <button class="danger" id="del">Entfernen</button>
      <button class="btn" id="close">Fertig</button>
    </div>`;
  $('#sheet').classList.remove('hidden'); $('#sheetBg').classList.remove('hidden');

  $('#sheet .scale').onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    const n = Number(b.dataset.r);
    db.child(id + '/ratings/' + me).set(m === n ? null : n);
  };
  $('#rwBtn').onclick = () => db.child(id + '/rewatch/' + me).set(rw ? null : true);
  $('#frSave').onclick = () => {
    const v = $('#frIn').value.trim();
    // gilt für die ganze Filmreihe, damit sie zusammenbleibt
    const ids = i.collectionId
      ? Object.keys(items).filter(k => items[k].collectionId === i.collectionId && (items[k].franchise || '') === (i.franchise || ''))
      : [id];
    if (!ids.includes(id)) ids.push(id);
    ids.forEach(k => db.child(k + '/franchise').set(v));
    $('#frIn').blur();
  };
  $('#del').onclick = () => { if (confirm(`„${i.title}“ entfernen?`)) { db.child(id).remove(); closeSheet(); } };
  $('#close').onclick = closeSheet;

  if (i.collectionId) suggestCollection(id, i.collectionId, i.collectionName);
}

const collCache = {};
async function suggestCollection(id, collId, name) {
  try {
    collCache[collId] = collCache[collId] || await loadCollection(collId);
    if (openId !== id) return;
    const have = haveKey();
    const missing = collCache[collId].parts.filter(p => !have.has('movie:' + p.id)).length;
    if (!missing) return;
    $('#collSuggest').innerHTML = `<div class="suggest"><div>${esc(name)}-Reihe<div class="s2">${missing} weitere${missing === 1 ? 'r Film' : ' Filme'} nicht in der Liste</div></div><button class="btn" id="collAdd">Ansehen</button></div>`;
    $('#collAdd').onclick = () => openBulk(name, async () => collCache[collId]);
  } catch (e) {}
}

function closeSheet() { openId = null; $('#sheet').classList.add('hidden'); $('#sheetBg').classList.add('hidden'); }
$('#sheetBg').onclick = closeSheet;

/* ---------- Start ---------- */
if (me && USERS[me] && pinOk()) setUser(me);
