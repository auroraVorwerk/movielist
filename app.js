const USERS = { aurora: 'Aurora', vivica: 'Vivica' };
const TMDB = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p/w92';
const IMG_L = 'https://image.tmdb.org/t/p/w342';
// Große Universen, die bei TMDB auf mehrere Filmreihen verteilt sind.
// k = TMDB-Stichwort, c = Filmreihen, m = Einzelfilme ohne Reihe; tk / tm = dasselbe für Serien
const UNIVERSES = [
  { name: 'Marvel Cinematic Universe', fr: 'MCU', tk: [180547],  a: ['mcu', 'marvel'], k: [180547] },
  { name: 'DC Extended Universe', fr: 'DCEU', tk: [229266],  a: ['dceu', 'dc extended', 'justice league', 'batman', 'superman'], k: [229266] },
  { name: 'DC Universe (ab 2025)', fr: 'DCU', tk: [312528],  a: ['dcu', 'dc universe', 'superman'], k: [312528] },
  { name: 'Star Wars', fr: 'Star Wars', tm: [4194, 60554, 79093, 82856, 115036, 92830, 83867, 105971, 114461, 114479, 202879, 203085, 114478],  a: ['star wars', 'krieg der sterne'], c: [10], m: [330459, 348350] },
  { name: 'Wizarding World', fr: 'Wizarding World', a: ['wizarding', 'harry potter', 'phantastische tierwesen', 'fantastic beasts'], c: [1241, 435259] },
  { name: 'Spider-Man (alle Reihen)', fr: 'Spider-Man', a: ['spider', 'spiderman'], c: [556, 125574, 531241, 573436] },
  { name: 'X-Men inkl. Deadpool und Wolverine', fr: 'X-Men', tm: [4574, 138502, 67195, 69629],  a: ['x-men', 'xmen', 'x men', 'deadpool', 'wolverine'], c: [748, 448150, 453993] },
  { name: 'Mittelerde', fr: 'Mittelerde', tm: [84773],  a: ['mittelerde', 'herr der ringe', 'hobbit', 'lord of the rings', 'middle earth', 'tolkien'], c: [119, 121938], m: [839033] },
  { name: 'Ich – Einfach unverbesserlich und Minions', fr: 'Minions', a: ['ich einfach', 'ich - einfach', 'ich – einfach', 'minions', 'despicable'], c: [86066, 544669] },
  { name: 'Shrek inkl. Der gestiefelte Kater', fr: 'Shrek', a: ['shrek', 'gestiefelte', 'puss in boots'], c: [2150, 94602] },
  { name: 'Rocky und Creed', fr: 'Rocky', a: ['rocky', 'creed'], c: [1575, 553717] },
  { name: 'Conjuring-Universum', fr: 'Conjuring', a: ['conjuring', 'annabelle', 'the nun', 'nun'], c: [313086, 402074, 968052], m: [480414] },
  { name: 'MonsterVerse', fr: 'MonsterVerse', tk: [380322],  a: ['monsterverse', 'godzilla', 'kong'], k: [380322] },
  { name: 'Planet der Affen (alle)', fr: 'Planet der Affen', tm: [19],  a: ['planet der affen', 'planet of the apes'], c: [1709, 173710] },
  { name: 'Star Trek', fr: 'Star Trek', tm: [253, 655, 580, 1855, 314, 67198, 85949, 85948, 106393, 103516, 223530, 1992],  a: ['star trek'], c: [151, 115570, 115575] },
  { name: 'Die Tribute von Panem inkl. Prequels', fr: 'Panem', a: ['panem', 'tribute von panem', 'hunger games'], c: [131635, 1701563] },
  { name: 'Alien inkl. Prometheus', fr: 'Alien', tm: [157239],  a: ['alien', 'prometheus'], c: [8091, 135416], m: [945961] },
  { name: 'Drachenzähmen leicht gemacht (Animation und Realfilm)', fr: 'Drachenzähmen', a: ['drachenzähmen', 'how to train'], c: [89137, 1458864] }
];
const norm = s => s.toLowerCase().replace(/[–-]/g, '-').trim();
const matchUniverses = q => {
  q = norm(q);
  return UNIVERSES.filter(u => u.a.some(a => a.startsWith(q) || q.startsWith(a) || (q.length >= 4 && a.includes(q))));
};

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
  $('#q').placeholder = { movie: 'Film oder Filmreihe suchen', tv: 'Serie oder Universum suchen', watch: 'In Watch List suchen', rewatch: 'In Rewatchable suchen' }[tab];
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
// Eine Franchise-Angabe kann mehrere Reihen enthalten: "MCU, X-Men"
const frList = i => (i.franchise || '').split(',').map(x => x.trim()).filter(Boolean);
// Dezente, feste Farbe pro Reihe (gleicher Name = gleiche Farbe)
const FR_HUES = [175, 35, 205, 95, 50, 150, 190, 120, 70, 220]; // ohne Rot- und Lilatöne (Aurora/Vivica)
function frColor(name, light = 58) {
  let h = 0; for (const c of name.toLowerCase()) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `hsl(${FR_HUES[h % FR_HUES.length]} 28% ${light}%)`;
}
const groupName = i => [...frList(i), i.collectionName || ''].filter(Boolean).join(' ');

// Ein Film kann in mehreren Gruppen stehen; der Eintrag dahinter bleibt derselbe.
function buildGroups(arr) {
  const groups = new Map();
  const add = (key, name, i) => {
    if (!groups.has(key)) groups.set(key, { name, items: [] });
    groups.get(key).items.push(i);
  };
  arr.forEach(i => {
    frList(i).forEach(f => add('f:' + f.toLowerCase(), f, i));
    if (i.collectionId) add('c:' + i.collectionId, i.collectionName || '', i);
  });
  // Filmreihe weglassen, wenn alle ihre Filme schon gemeinsam in einer Franchise stehen
  for (const [key, g] of groups) {
    if (!key.startsWith('c:')) continue;
    const shared = g.items.map(i => frList(i).map(f => f.toLowerCase()))
      .reduce((a, b) => a.filter(x => b.includes(x)));
    if (shared.length) groups.delete(key);
  }
  const list = [...groups.values()].filter(g => g.items.length > 1);
  const grouped = new Set(list.flatMap(g => g.items.map(i => i.id)));
  arr.filter(i => !grouped.has(i.id)).forEach(i => list.push({ name: '', items: [i] }));
  list.forEach(g => g.items.sort((a, b) => (a.year || 9999) - (b.year || 9999)));
  return list;
}

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

  const gl = buildGroups(arr);

  const mode = $('#sort').value;
  const score = grp => {
    const g = grp.items;
    if (mode === 'year') return Math.min(...g.map(i => i.year || 9999));
    const vals = g.map(i => mode === 'mine' ? i.ratings?.[me] : avg(i)).filter(v => v != null);
    return vals.length ? Math.max(...vals) : -1;
  };
  const name = g => g.name || g.items[0].title || '';
  gl.sort((a, b) => {
    if (mode === 'title') return name(a).localeCompare(name(b), 'de');
    if (mode === 'year') return score(a) - score(b);
    return score(b) - score(a) || name(a).localeCompare(name(b), 'de');
  });

  list.innerHTML = gl.map(g => g.items.length > 1
    ? `<div class="grp" style="color:${frColor(g.name)}">${esc(g.name)}</div><div class="grpbody" style="border-left-color:${frColor(g.name, 32)}">${g.items.map(row).join('')}</div>`
    : row(g.items[0])).join('');
}

function avg(i) {
  const v = ['aurora', 'vivica'].map(u => i.ratings?.[u]).filter(x => x != null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

function row(i) {
  const m = i.ratings?.[me], o = i.ratings?.[other()];
  const mixed = tab === 'watch' || tab === 'rewatch';
  const line1 = [esc(i.producer || ''), frList(i).map(f => `<span style="color:${frColor(f)}">${esc(f)}</span>`).join(', ')].filter(Boolean).join(' · ');
  return `<button class="row" data-id="${i.id}">
    <div class="rt"><div class="me${m == null ? ' none' : ''}">${m ?? '–'}</div><div class="ot${o == null ? ' none' : ''}">${o ?? '–'}</div></div>
    <div class="body">
      <div class="l1"><span class="t">${esc(i.title)}${mixed ? ` <span class="kind">${i.type === 'tv' ? 'Serie' : 'Film'}</span>` : ''}</span><span class="y">${i.year || ''}</span></div>
      <div class="meta"><span>${line1 || '&nbsp;'}</span></div>
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
    const unis = matchUniverses(q).filter(u => tab === 'movie' ? (u.k || u.c || u.m) : (u.tk || u.tm));
    unis.forEach(u => {
      html += `<button class="res coll" data-uni="${UNIVERSES.indexOf(u)}"><div class="noimg"></div><div><div>${esc(u.name)}</div><div class="tag">Ganzes Universum hinzufügen</div></div></button>`;
    });
    const uniColls = new Set(unis.flatMap(u => u.c || []));
    (colls.results || []).filter(c => !uniColls.has(c.id)).slice(0, unis.length ? 1 : 2).forEach(c => {
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
  if (b.dataset.uni) { const u = UNIVERSES[Number(b.dataset.uni)], t = tab; return openBulk(u.name, () => loadUniverse(u, t), u.fr, t); }
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
  const parts = (d.parts || []).map(part).filter(p => p.date && p.date <= today())
    .sort((a, b) => a.date.localeCompare(b.date));
  return { name: cleanCollection(d.name), parts };
}
// Einheitliches Format für Filme und Serien: { id, title, date }
const part = p => ({ id: p.id, title: p.title || p.name, date: p.release_date || p.first_air_date || '' });

async function loadKeyword(kw, type = 'movie') {
  const base = type === 'movie'
    ? { with_keywords: kw, sort_by: 'primary_release_date.asc', 'with_runtime.gte': 70, without_genres: 99, 'primary_release_date.lte': today() }
    : { with_keywords: kw, sort_by: 'first_air_date.asc', without_genres: '99,10763,10767', 'first_air_date.lte': today() };
  const first = await tmdb('/discover/' + type, { ...base, page: 1 });
  let parts = first.results || [];
  for (let p = 2; p <= Math.min(first.total_pages || 1, 5); p++) parts = parts.concat((await tmdb('/discover/' + type, { ...base, page: p })).results || []);
  return parts.map(part);
}
async function loadUniverse(u, type = 'movie') {
  const lists = await Promise.all(type === 'movie' ? [
    ...(u.k || []).map(k => loadKeyword(k)),
    ...(u.c || []).map(id => loadCollection(id).then(c => c.parts).catch(() => [])),
    ...(u.m || []).map(id => tmdb(`/movie/${id}`).then(m => [part(m)]).catch(() => []))
  ] : [
    ...(u.tk || []).map(k => loadKeyword(k, 'tv')),
    ...(u.tm || []).map(id => tmdb(`/tv/${id}`).then(m => [part(m)]).catch(() => []))
  ]);
  const seen = new Set();
  const parts = lists.flat().filter(p => p.date && p.date <= today() && !seen.has(p.id) && seen.add(p.id))
    .sort((a, b) => a.date.localeCompare(b.date));
  return { name: u.name, parts };
}

async function openBulk(title, loader, franchise = '', type = 'movie') {
  openId = null;
  const sheet = $('#sheet');
  sheet.innerHTML = `<h2>${esc(title || 'Filmreihe')}</h2><div class="sub">Lädt …</div>`;
  sheet.classList.remove('hidden'); $('#sheetBg').classList.remove('hidden');
  let data;
  try { data = await loader(); } catch (e) { sheet.innerHTML = '<div class="sub">Konnte die Filmreihe nicht laden.</div>'; return; }
  const have = haveKey();
  const missing = data.parts.filter(p => !have.has(type + ':' + p.id));
  // schon vorhandene Filme, die noch nicht die Franchise tragen
  const retag = franchise ? data.parts.map(p => findId(type, p.id))
    .filter(id => id && !frList(items[id]).some(f => f.toLowerCase() === franchise.toLowerCase())) : [];
  const label = missing.length ? `${missing.length} hinzufügen` : retag.length ? `Als ${franchise} zusammenfassen` : '';
  sheet.innerHTML = `
    <h2>${esc(data.name)}</h2>
    <div class="sub">${data.parts.length} ${type === 'tv' ? 'Serien' : 'Filme'}${missing.length < data.parts.length ? ` · ${data.parts.length - missing.length} schon in der Liste` : ''}</div>
    <div class="blist">${data.parts.map(p => `<div class="bitem${have.has(type + ':' + p.id) ? ' have' : ''}"><span>${esc(p.title)}</span><span class="y">${p.date.slice(0, 4)}</span></div>`).join('')}</div>
    <div class="actions">
      <button class="btn" id="bCancel">Abbrechen</button>
      ${label ? `<button class="btn primary" id="bAdd">${label}</button>` : '<span class="sub">Alle schon drin</span>'}
    </div>`;
  $('#bCancel').onclick = closeSheet;
  if (!label) return;
  $('#bAdd').onclick = async () => {
    const btn = $('#bAdd'); btn.disabled = true;
    for (const id of retag) await db.child(id + '/franchise').set([...frList(items[id]), franchise].join(', '));
    let n = 0;
    for (let i = 0; i < missing.length; i += 6) {
      const batch = await Promise.all(missing.slice(i, i + 6).map(p => fetchEntry(type, p.id).catch(() => null)));
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

    <div class="lbl">Franchise · mehrere mit Komma trennen</div>
    <div class="fr"><input id="frIn" value="${esc(frVal)}" placeholder="z. B. MCU, X-Men"><button class="btn" id="frSave">Speichern</button></div>

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
