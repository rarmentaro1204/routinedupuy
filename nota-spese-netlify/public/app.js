(() => {
const CFG = window.APP_CONFIG;
const CATEGORIES = ['Trasporti', 'Carburante', 'Pedaggi', 'Taxi', 'Parcheggio', 'Hotel', 'Pasti', 'Altro'];
const PAYMENTS = ['Carta Aziendale', 'Carta Personale', 'Contanti', 'Bonifico'];
const MAX_ROWS = 15;   // righe del modulo (14-28)
const SCOPES = ['User.Read', 'Files.ReadWrite'];
const G = 'https://graph.microsoft.com/v1.0';

const $app = document.getElementById('app'), $who = document.getElementById('who'), $title = document.getElementById('title');
let pca, account, user;

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const eur = n => Number(n || 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
const dIt = iso => iso ? iso.split('-').reverse().join('/') : '';
const val = id => document.getElementById(id).value;
const toast = m => { const t = document.getElementById('toast'); t.textContent = m; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 4000); };
const num = v => { if (v === '' || v == null) return null; const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) ? n : NaN; };
const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '') && !isNaN(Date.parse(s));
const safe = s => String(s).replace(/[\\/:*?"<>|#%~&{}]/g, '-').replace(/\s+/g, ' ').trim().slice(0, 60) || 'x';
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

// ================= autenticazione Microsoft =================
const redirectUri = () => location.origin + location.pathname.replace(/index\.html$/, '');

async function initAuth() {
  if (CFG.devAuth) { user = { id: 'dev', name: 'Mario Rossi (TEST)', department: 'Commerciale', email: 'dev@example.com' }; return true; }
  pca = new msal.PublicClientApplication({
    auth: { clientId: CFG.clientId, authority: `https://login.microsoftonline.com/${CFG.tenantId}`, redirectUri: redirectUri() },
    cache: { cacheLocation: 'localStorage' },
  });
  await pca.initialize();
  const res = await pca.handleRedirectPromise();
  account = res?.account || pca.getAllAccounts()[0];
  if (!account) return false;
  pca.setActiveAccount(account);
  const me = await gj('/me?$select=id,displayName,mail,userPrincipalName,department');
  user = { id: me.id, name: me.displayName, department: me.department || '', email: me.mail || me.userPrincipalName };
  return true;
}
const login = () => pca.loginRedirect({ scopes: SCOPES });
const logout = () => pca.logoutRedirect({ account });

async function getToken() {
  if (CFG.devAuth) return 'dev';
  try { return (await pca.acquireTokenSilent({ scopes: SCOPES, account })).accessToken; }
  catch { await pca.acquireTokenRedirect({ scopes: SCOPES }); return new Promise(() => {}); }
}

// ================= Microsoft Graph / OneDrive =================
async function g(method, path, { json, body, type } = {}) {
  const r = await fetch(G + path, {
    method,
    headers: { Authorization: 'Bearer ' + await getToken(), ...(json ? { 'Content-Type': 'application/json' } : {}), ...(type ? { 'Content-Type': type } : {}) },
    body: json ? JSON.stringify(json) : body,
  });
  if (!r.ok) throw Object.assign(new Error(`OneDrive/Graph ${r.status}: ${(await r.text()).slice(0, 160)}`), { status: r.status });
  return r;
}
const gj = async (path, o) => (await g('GET', path, o)).json();
const encPath = p => p.split('/').map(encodeURIComponent).join('/');
const drivePath = p => `/me/drive/root:/${encPath(p)}`;

// Le trasferte vivono su OneDrive: <radice>/<cartella trasferta>/trasferta.json + le foto degli scontrini
const tripFile = t => `${CFG.oneDriveRoot}/${t.folder}/trasferta.json`;

async function loadTrips() {
  let kids;
  try { kids = (await gj(drivePath(CFG.oneDriveRoot) + ':/children?$select=name,folder&$top=200')).value; }
  catch (e) { if (e.status === 404) return []; throw e; }
  const trips = await Promise.all(kids.filter(k => k.folder).map(async k => {
    try { return await (await g('GET', drivePath(`${CFG.oneDriveRoot}/${k.name}/trasferta.json`) + ':/content')).json(); } catch { return null; }
  }));
  return trips.filter(t => t && !t.deleted && t.owner?.id === user.id)
    .sort((a, b) => (b.date_from + b.created_at).localeCompare(a.date_from + a.created_at));
}
async function saveTrip(t) {
  await g('PUT', drivePath(tripFile(t)) + ':/content', { body: JSON.stringify(t), type: 'application/json' });
}
async function uploadReceipt(t, name, blob) {
  const item = await (await g('PUT', drivePath(`${CFG.oneDriveRoot}/${t.folder}/${name}`) + ':/content?@microsoft.graph.conflictBehavior=rename',
    { body: blob, type: 'image/jpeg' })).json();
  return { file: item.name, url: item.webUrl };
}
// Condivide (sola lettura) la cartella radice con l'amministrazione. Idempotente, una volta per dispositivo.
async function ensureShared() {
  if (CFG.devAuth && !CFG.adminEmails?.length) return;
  if (!CFG.adminEmails?.length) return;
  const flag = 'shared:' + user.id;
  try { if (localStorage.getItem(flag)) return; } catch {}
  const root = await gj(drivePath(CFG.oneDriveRoot));
  await g('POST', `/me/drive/items/${root.id}/invite`, { json: {
    recipients: CFG.adminEmails.map(email => ({ email })), roles: ['read'], requireSignIn: true, sendInvitation: false,
    message: `Note spese di ${user.name}` } });
  try { localStorage.setItem(flag, '1'); } catch {}
}
async function receiptUrl(t, file) {
  return (await gj(drivePath(`${CFG.oneDriveRoot}/${t.folder}/${file}`)))['@microsoft.graph.downloadUrl'];
}

// ================= lettura scontrino (funzione Netlify → Claude) =================
async function scan(image) {
  const r = await fetch(CFG.scanUrl, { method: 'POST', headers: { Authorization: 'Bearer ' + await getToken(), 'Content-Type': 'application/json' }, body: JSON.stringify({ image }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Errore ${r.status}`);
  let payment = null;
  if (j.metodo_pagamento === 'contanti') payment = 'Contanti';
  else if (j.metodo_pagamento === 'carta') {
    const cards = CFG.companyCardLast4 || [];
    payment = (cards.length && j.carta_ultime4 && !cards.includes(j.carta_ultime4)) ? 'Carta Personale' : 'Carta Aziendale';
  }
  const cur = (j.valuta || 'EUR').toUpperCase();
  return { readable: !!j.leggibile, language: j.lingua || '', merchant: j.esercente || '', date: j.data || null,
    amount: j.importo_totale, currency: cur, amountEur: cur === 'EUR' ? j.importo_totale : null, payment, description: j.descrizione || '' };
}

// ================= Excel (sul modulo originale) =================
const toDate = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const fmt = (cell, numFmt) => { cell.style = { ...cell.style, numFmt }; }; // gli stili del modulo sono condivisi: va copiato l'oggetto

async function buildExcel(t) {
  const tpl = await (await fetch('template/Modulo_Nota_Spese.xlsx')).arrayBuffer();
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(tpl);
  const ws = wb.getWorksheet('Nota Spese');
  ws.getCell('B5').value = t.owner.name; ws.getCell('B6').value = t.owner.department;
  ws.getCell('B7').value = t.client; ws.getCell('B8').value = t.destination;
  for (const [c, iso] of [['B9', t.date_from], ['B10', t.date_to]]) { ws.getCell(c).value = toDate(iso); fmt(ws.getCell(c), 'dd/mm/yyyy'); }
  [...t.expenses].sort((a, b) => a.date.localeCompare(b.date)).forEach((e, i) => {
    const r = 14 + i;
    ws.getCell(`A${r}`).value = toDate(e.date); fmt(ws.getCell(`A${r}`), 'dd/mm/yyyy');
    ws.getCell(`B${r}`).value = e.category; ws.getCell(`C${r}`).value = e.description; ws.getCell(`D${r}`).value = e.payment;
    ws.getCell(`E${r}`).value = e.amount; fmt(ws.getCell(`E${r}`), '#,##0.00');
    const note = [e.notes, e.orig_currency && e.orig_currency !== 'EUR' ? `${e.orig_amount} ${e.orig_currency}` : ''].filter(Boolean).join(' - ');
    if (note) ws.getCell(`F${r}`).value = note;
    ws.getCell(`G${r}`).value = 'SI';
  });
  if (t.km_rate != null) ws.getCell('B32').value = t.km_rate;
  if (t.km != null) ws.getCell('B33').value = t.km;
  wb.calcProperties.fullCalcOnLoad = true;
  return wb.xlsx.writeBuffer();
}

// ================= viste =================
function setHeader(title, back) {
  $title.innerHTML = back ? `<button class="link" style="color:#fff;font-size:18px" id="back">← ${esc(title)}</button>` : esc(title);
  if (back) document.getElementById('back').onclick = back;
  $who.innerHTML = user && !back ? `${esc(user.name)} ${CFG.devAuth ? '' : '<button id="out">Esci</button>'}` : '';
  const o = document.getElementById('out'); if (o) o.onclick = logout;
}
const fab = (label, fn) => { const b = document.createElement('button'); b.className = 'btn fab'; b.textContent = label; b.onclick = fn; $app.append(b); };
const total = t => t.expenses.reduce((s, e) => s + e.amount, 0);

function viewLogin() {
  setHeader('Nota Spese');
  $app.innerHTML = `<div class="login"><h2>Note spese di trasferta</h2><p class="mut">Accedi con il tuo account aziendale Microsoft.</p><button class="btn" id="go">Accedi con Microsoft</button></div>`;
  document.getElementById('go').onclick = login;
}

async function viewDashboard() {
  setHeader('Le mie note spese');
  $app.innerHTML = '<div class="empty">Caricamento…</div>';
  let trips;
  try { trips = await loadTrips(); } catch (e) { $app.innerHTML = `<div class="empty">Impossibile leggere OneDrive.<br>${esc(e.message)}</div>`; return; }
  $app.innerHTML = trips.length ? '' : '<div class="empty">Nessuna nota spese.<br>Creane una con il pulsante qui sotto.</div>';
  for (const t of trips) {
    const c = document.createElement('div'); c.className = 'card click';
    c.innerHTML = `<div class="row"><span class="big">${esc(t.destination)}</span><span class="badge ${t.status === 'closed' ? 'closed' : ''}">${t.status === 'closed' ? 'Chiusa' : 'In corso'}</span></div>
      <div class="mut">${dIt(t.date_from)} → ${dIt(t.date_to)}${t.client ? ' · ' + esc(t.client) : ''}</div>
      <div class="row" style="margin-top:8px"><span class="mut">${t.expenses.length} giustificativi</span><b>${eur(total(t))}</b></div>`;
    c.onclick = () => viewTrip(t);
    $app.append(c);
  }
  fab('+ Nuova nota spese', viewNewTrip);
}

function tripForm(t = {}) {
  return `<label>Luogo della trasferta *</label><input id="f_dest" value="${esc(t.destination)}" placeholder="es. Monaco di Baviera" autocomplete="off">
    <label>Cliente / Evento</label><input id="f_client" value="${esc(t.client)}" placeholder="es. Fiera Productronica" autocomplete="off">
    <div class="grid2"><div><label>Dal *</label><input id="f_from" type="date" value="${esc(t.date_from)}"></div><div><label>Al *</label><input id="f_to" type="date" value="${esc(t.date_to)}"></div></div>`;
}
function readTripForm() {
  const f = { destination: val('f_dest').trim(), client: val('f_client').trim(), date_from: val('f_from'), date_to: val('f_to') };
  if (!f.destination) throw new Error('Indica il luogo della trasferta');
  if (!isDate(f.date_from) || !isDate(f.date_to)) throw new Error('Date non valide');
  if (f.date_to < f.date_from) throw new Error('La data di fine è precedente a quella di inizio');
  return f;
}

function viewNewTrip() {
  setHeader('Nuova nota spese', viewDashboard);
  const today = new Date().toISOString().slice(0, 10);
  $app.innerHTML = `<div class="card">${tripForm({ date_from: today, date_to: today })}<div class="actions"><button class="btn" id="save">Crea nota spese</button></div></div>`;
  document.getElementById('save').onclick = async ev => {
    ev.target.disabled = true;
    try {
      const f = readTripForm(), id = newId();
      const t = { id, folder: `${f.date_from} ${safe(f.destination)} (${id})`, owner: { id: user.id, name: user.name, department: user.department, email: user.email },
        ...f, km_rate: null, km: null, status: 'open', created_at: new Date().toISOString(), closed_at: null, deleted: false, expenses: [] };
      await saveTrip(t);
      ensureShared().catch(e => toast('Cartella creata, ma condivisione con l\'amministrazione non riuscita: ' + e.message));
      viewTrip(t);
    } catch (e) { toast(e.message); ev.target.disabled = false; }
  };
}

function viewTrip(t) {
  setHeader('Trasferta', viewDashboard);
  const open = t.status === 'open';
  $app.innerHTML = `<div class="card"><div class="row"><span class="big">${esc(t.destination)}</span><span class="badge ${open ? '' : 'closed'}">${open ? 'In corso' : 'Chiusa'}</span></div>
    <div class="mut">${dIt(t.date_from)} → ${dIt(t.date_to)}${t.client ? ' · ' + esc(t.client) : ''}</div>
    <div class="row" style="margin-top:8px"><span class="mut">Totale spese</span><b class="big">${eur(total(t))}</b></div>
    ${open ? '<button class="link" id="edit">Modifica dati trasferta</button>' : ''}</div>`;
  if (!t.expenses.length) $app.insertAdjacentHTML('beforeend', '<div class="empty">Nessun giustificativo.<br>Fotografa il primo scontrino.</div>');
  for (const e of [...t.expenses].sort((a, b) => a.date.localeCompare(b.date))) {
    const c = document.createElement('div'); c.className = 'card exp';
    c.innerHTML = `<img alt="" id="img${e.id}"><div class="grow"><div><b>${esc(e.description || e.merchant || e.category)}</b></div>
      <div class="mut">${dIt(e.date)} · ${esc(e.category)} · ${esc(e.payment)}</div></div>
      <div style="text-align:right"><b>${eur(e.amount)}</b>${open ? `<br><button class="link" data-del="${e.id}">Elimina</button>` : ''}</div>`;
    $app.append(c);
    receiptUrl(t, e.file).then(u => { const i = document.getElementById('img' + e.id); if (i && u) i.src = u; }).catch(() => {});
  }
  $app.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
    if (!confirm('Eliminare questa spesa? La foto resta archiviata su OneDrive.')) return;
    try { t.expenses = t.expenses.filter(x => x.id !== b.dataset.del); await saveTrip(t); viewTrip(t); } catch (e) { toast(e.message); }
  });
  if (open) {
    document.getElementById('edit').onclick = () => editTrip(t);
    $app.insertAdjacentHTML('beforeend', `<div class="card"><b>Rimborso chilometrico</b> <span class="mut">(facoltativo)</span>
      <div class="grid2"><div><label>Tariffa €/Km</label><input id="km_rate" inputmode="decimal" value="${t.km_rate ?? ''}"></div>
      <div><label>Km percorsi</label><input id="km" inputmode="decimal" value="${t.km ?? ''}"></div></div></div>
      <div class="actions"><button class="btn sec" id="close" ${t.expenses.length ? '' : 'disabled'}>Chiudi trasferta e genera Excel</button><button class="btn danger" id="del">Elimina nota spese</button></div>`);
    document.getElementById('close').onclick = async ev => {
      const kr = num(val('km_rate')), km = num(val('km'));
      if ([kr, km].some(v => v != null && !(v >= 0))) return toast('Km o tariffa non validi');
      ev.target.disabled = true;
      try { t.km_rate = kr; t.km = km; t.status = 'closed'; t.closed_at = new Date().toISOString(); await saveTrip(t); viewTrip(t); }
      catch (e) { toast(e.message); ev.target.disabled = false; }
    };
    document.getElementById('del').onclick = async () => {
      if (!confirm("Eliminare l'intera nota spese? Le foto restano archiviate su OneDrive.")) return;
      try { t.deleted = true; await saveTrip(t); viewDashboard(); } catch (e) { toast(e.message); }
    };
    fab('+  Aggiungi giustificativo', () => addReceipt(t));
  } else {
    $app.insertAdjacentHTML('beforeend', `<div class="card mut">Trasferta chiusa. Scarica il file, controllalo, modificalo se serve e firmalo.</div>
      <div class="actions"><button class="btn" id="xl">⬇ Scarica Excel</button><button class="btn sec" id="reopen">Riapri trasferta</button></div>`);
    document.getElementById('xl').onclick = async ev => {
      ev.target.disabled = true;
      try {
        const buf = await buildExcel(t);
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
        a.download = `Nota_Spese_${t.owner.name.replace(/[^\w]+/g, '_')}_${t.date_from}.xlsx`;
        document.body.append(a); a.click(); a.remove();
      } catch (e) { toast('Excel non generato: ' + e.message); }
      ev.target.disabled = false;
    };
    document.getElementById('reopen').onclick = async () => { try { t.status = 'open'; t.closed_at = null; await saveTrip(t); viewTrip(t); } catch (e) { toast(e.message); } };
  }
}

function editTrip(t) {
  setHeader('Modifica trasferta', () => viewTrip(t));
  $app.innerHTML = `<div class="card">${tripForm(t)}<div class="actions"><button class="btn" id="save">Salva</button></div></div>`;
  document.getElementById('save').onclick = async () => {
    try { Object.assign(t, readTripForm()); await saveTrip(t); viewTrip(t); } catch (e) { toast(e.message); }
  };
}

// ================= aggiungi giustificativo: fotocamera → Claude → conferma =================
function addReceipt(t) {
  if (t.expenses.length >= MAX_ROWS) return toast(`Il modulo ha spazio per ${MAX_ROWS} spese: apri una nuova nota spese.`);
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/*'; inp.capture = 'environment';   // apre la fotocamera posteriore sul telefono
  inp.onchange = async () => { if (inp.files[0]) { try { receiptSheet(t, await shrink(inp.files[0])); } catch (e) { toast('Foto non leggibile: ' + e.message); } } };
  inp.click();
}
async function shrink(file, max = 1800) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.85);
}

function receiptSheet(t, image) {
  const s = { category: null, currency: 'EUR', language: '', merchant: '' };
  const el = document.createElement('div'); el.className = 'sheet';
  el.innerHTML = `<div class="inner"><div class="row"><b class="big">Nuovo giustificativo</b><button class="link" id="x">Annulla</button></div>
    <img class="preview" src="${image}" alt="Scontrino" style="margin-top:12px">
    <div class="scan" id="scan"><div class="spin"></div><div>Claude sta leggendo lo scontrino…</div></div>
    <label>Tipologia di spesa *</label>
    <div class="chips">${CATEGORIES.map(c => `<button type="button" class="chip" data-c="${esc(c)}">${esc(c)}</button>`).join('')}</div>
    <div class="grid2"><div><label>Data *</label><input id="r_date" type="date" value="${t.date_from}"></div>
      <div><label>Metodo di pagamento *</label><select id="r_pay"><option value="">—</option>${PAYMENTS.map(p => `<option>${esc(p)}</option>`).join('')}</select></div></div>
    <label>Descrizione</label><input id="r_desc" autocomplete="off">
    <div class="grid2"><div><label id="l_amt">Importo € *</label><input id="r_amt" inputmode="decimal" placeholder="0,00"></div><div id="orig" hidden><label>Importo scontrino</label><input id="r_orig" disabled></div></div>
    <label>Note</label><input id="r_notes" autocomplete="off">
    <div class="actions"><button class="btn" id="ok" disabled>Salva giustificativo</button></div></div>`;
  document.body.append(el);
  const q = id => el.querySelector('#' + id);
  const refresh = () => { q('ok').disabled = !(s.category && q('r_pay').value && q('r_date').value && num(q('r_amt').value) > 0); };
  q('x').onclick = () => el.remove();
  el.querySelectorAll('.chip').forEach(b => b.onclick = () => { s.category = b.dataset.c; el.querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === b)); refresh(); });
  ['r_pay', 'r_date', 'r_amt'].forEach(i => q(i).oninput = refresh);

  scan(image).then(r => {
    s.language = r.language; s.merchant = r.merchant; s.currency = r.currency; s.orig = r.amount;
    if (!r.readable) { q('scan').className = 'scan err'; q('scan').textContent = 'Scontrino poco leggibile: compila i campi a mano o rifai la foto.'; return; }
    if (r.date) q('r_date').value = r.date;
    if (r.payment) q('r_pay').value = r.payment;
    q('r_desc').value = r.description;
    if (r.amountEur != null) q('r_amt').value = String(r.amountEur).replace('.', ',');
    if (r.currency !== 'EUR') { q('orig').hidden = false; q('r_orig').value = `${r.amount ?? ''} ${r.currency}`; q('l_amt').textContent = `Importo in € * (scontrino in ${r.currency})`; }
    const out = r.date && (r.date < t.date_from || r.date > t.date_to);
    q('scan').className = 'scan ok';
    q('scan').innerHTML = `<div>Lingua: <b>${esc(r.language || '?')}</b>${r.merchant ? ' · ' + esc(r.merchant) : ''} — controlla i dati e scegli la tipologia.` +
      (out ? `<br><b>Attenzione:</b> la data dello scontrino (${dIt(r.date)}) è fuori dal periodo della trasferta.` : '') + '</div>';
    refresh();
  }).catch(e => { q('scan').className = 'scan err'; q('scan').textContent = 'Lettura non riuscita (' + e.message + '). Puoi compilare a mano.'; });

  q('ok').onclick = async () => {
    q('ok').disabled = true; q('ok').textContent = 'Upload su OneDrive…';
    try {
      const e = { id: newId(), date: q('r_date').value, category: s.category, payment: q('r_pay').value, description: q('r_desc').value.trim().slice(0, 120),
        amount: num(q('r_amt').value), notes: q('r_notes').value.trim(), language: s.language, merchant: s.merchant,
        orig_amount: s.currency !== 'EUR' ? (s.orig ?? null) : null, orig_currency: s.currency !== 'EUR' ? s.currency : null };
      if (!isDate(e.date)) throw new Error('Data non valida');
      if (!(e.amount > 0) || e.amount > 100000) throw new Error('Importo in € non valido');
      const blob = await (await fetch(image)).blob();
      const up = await uploadReceipt(t, `${e.date}_${e.category}_${e.amount.toFixed(2)}_${e.id}.jpg`, blob);   // prima la foto…
      Object.assign(e, up); t.expenses.push(e);
      await saveTrip(t);                                                                                          // …poi la riga
      ensureShared().catch(() => {});
      el.remove(); viewTrip(t);
    } catch (err) { toast(err.message); q('ok').disabled = false; q('ok').textContent = 'Salva giustificativo'; }
  };
}

// ================= avvio =================
(async () => {
  try { (await initAuth()) ? viewDashboard() : viewLogin(); }
  catch (e) { $app.innerHTML = `<div class="empty">Errore: ${esc(e.message)}</div>`; }
})();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
