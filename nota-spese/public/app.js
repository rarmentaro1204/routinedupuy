const $app = document.getElementById('app');
const $who = document.getElementById('who');
const $title = document.getElementById('title');
let cfg, pca, account, user;

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const eur = n => Number(n || 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
const dIt = iso => iso ? iso.split('-').reverse().join('/') : '';
const toast = (m) => { const t = document.getElementById('toast'); t.textContent = m; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3500); };

// ---------- autenticazione Microsoft (MSAL) ----------
const SCOPES = ['User.Read', 'Files.ReadWrite'];

async function initAuth() {
  cfg = await (await fetch('/api/config')).json();
  if (cfg.devAuth) { user = await api('/me'); return true; }
  pca = new msal.PublicClientApplication({
    auth: { clientId: cfg.clientId, authority: `https://login.microsoftonline.com/${cfg.tenantId}`, redirectUri: location.origin },
    cache: { cacheLocation: 'localStorage' },
  });
  await pca.initialize();
  const res = await pca.handleRedirectPromise();
  account = res?.account || pca.getAllAccounts()[0];
  if (!account) return false;
  pca.setActiveAccount(account);
  user = await api('/me');
  return true;
}
const login = () => pca.loginRedirect({ scopes: SCOPES });
const logout = () => pca.logoutRedirect({ account });

async function getToken() {
  if (cfg.devAuth) return null;
  try { return (await pca.acquireTokenSilent({ scopes: SCOPES, account })).accessToken; }
  catch { await pca.acquireTokenRedirect({ scopes: SCOPES }); return new Promise(() => {}); }
}

async function api(path, { method = 'GET', body, raw } = {}) {
  const t = await getToken();
  const r = await fetch('/api' + path, {
    method,
    headers: { ...(t ? { Authorization: `Bearer ${t}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    throw new Error(j.error || `Errore ${r.status}`);
  }
  if (raw) return r;
  return r.status === 204 ? null : r.json();
}

// ---------- viste ----------
function setHeader(title, back) {
  $title.innerHTML = back ? `<button class="link" style="color:#fff;font-size:18px" id="back">← ${esc(title)}</button>` : esc(title);
  if (back) document.getElementById('back').onclick = back;
  $who.innerHTML = user && !back ? `${esc(user.name)} ${cfg.devAuth ? '' : '<button id="out">Esci</button>'}` : '';
  const o = document.getElementById('out'); if (o) o.onclick = logout;
}
const fab = (label, fn) => { const b = document.createElement('button'); b.className = 'btn fab'; b.textContent = label; b.onclick = fn; $app.append(b); return b; };

function viewLogin() {
  setHeader('Nota Spese');
  $app.innerHTML = `<div class="login"><h2>Note spese di trasferta</h2><p class="mut">Accedi con il tuo account aziendale Microsoft.</p>
    <button class="btn" id="go">Accedi con Microsoft</button></div>`;
  document.getElementById('go').onclick = login;
}

async function viewDashboard() {
  setHeader('Le mie note spese');
  $app.innerHTML = '<div class="empty">Caricamento…</div>';
  const trips = await api('/trips');
  $app.innerHTML = trips.length ? '' : '<div class="empty">Nessuna nota spese.<br>Creane una con il pulsante qui sotto.</div>';
  for (const t of trips) {
    const c = document.createElement('div'); c.className = 'card click';
    c.innerHTML = `<div class="row"><span class="big">${esc(t.destination)}</span>
        <span class="badge ${t.status === 'closed' ? 'closed' : ''}">${t.status === 'closed' ? 'Chiusa' : 'In corso'}</span></div>
      <div class="mut">${dIt(t.date_from)} → ${dIt(t.date_to)}${t.client ? ' · ' + esc(t.client) : ''}</div>
      <div class="row" style="margin-top:8px"><span class="mut">${t.n_expenses} giustificativi</span><b>${eur(t.total)}</b></div>`;
    c.onclick = () => viewTrip(t.id);
    $app.append(c);
  }
  fab('+ Nuova nota spese', viewNewTrip);
}

function tripForm(t = {}) {
  return `<label>Luogo della trasferta *</label><input id="f_dest" value="${esc(t.destination)}" placeholder="es. Monaco di Baviera" autocomplete="off">
    <label>Cliente / Evento</label><input id="f_client" value="${esc(t.client)}" placeholder="es. Fiera Productronica" autocomplete="off">
    <div class="grid2"><div><label>Dal *</label><input id="f_from" type="date" value="${esc(t.date_from)}"></div>
    <div><label>Al *</label><input id="f_to" type="date" value="${esc(t.date_to)}"></div></div>`;
}
const readTripForm = () => ({ destination: val('f_dest'), client: val('f_client'), date_from: val('f_from'), date_to: val('f_to') });
const val = id => document.getElementById(id).value;

function viewNewTrip() {
  setHeader('Nuova nota spese', viewDashboard);
  const today = new Date().toISOString().slice(0, 10);
  $app.innerHTML = `<div class="card">${tripForm({ date_from: today, date_to: today })}
    <div class="actions"><button class="btn" id="save">Crea nota spese</button></div></div>`;
  document.getElementById('save').onclick = async (ev) => {
    ev.target.disabled = true;
    try { const t = await api('/trips', { method: 'POST', body: readTripForm() }); viewTrip(t.id); }
    catch (e) { toast(e.message); ev.target.disabled = false; }
  };
}

async function viewTrip(id) {
  setHeader('Trasferta', viewDashboard);
  $app.innerHTML = '<div class="empty">Caricamento…</div>';
  let t;
  try { t = await api('/trips/' + id); } catch (e) { toast(e.message); return viewDashboard(); }
  const open = t.status === 'open';
  const total = t.expenses.reduce((s, e) => s + e.amount, 0);
  $app.innerHTML = `<div class="card"><div class="row"><span class="big">${esc(t.destination)}</span>
      <span class="badge ${open ? '' : 'closed'}">${open ? 'In corso' : 'Chiusa'}</span></div>
    <div class="mut">${dIt(t.date_from)} → ${dIt(t.date_to)}${t.client ? ' · ' + esc(t.client) : ''}</div>
    <div class="row" style="margin-top:8px"><span class="mut">Totale spese</span><b class="big">${eur(total)}</b></div>
    ${open ? '<button class="link" id="edit">Modifica dati trasferta</button>' : ''}</div>`;
  if (!t.expenses.length) $app.insertAdjacentHTML('beforeend', '<div class="empty">Nessun giustificativo.<br>Fotografa il primo scontrino.</div>');
  for (const e of t.expenses) {
    const c = document.createElement('div'); c.className = 'card exp';
    c.innerHTML = `<img alt="" id="img${e.id}"><div class="grow"><div><b>${esc(e.description || e.merchant || e.category)}</b></div>
      <div class="mut">${dIt(e.date)} · ${esc(e.category)} · ${esc(e.payment)}</div>
      ${!e.onedrive_url ? '<span class="badge warn">OneDrive: da caricare</span>' : ''}</div>
      <div style="text-align:right"><b>${eur(e.amount)}</b>${open ? `<br><button class="link" data-del="${e.id}">Elimina</button>` : ''}</div>`;
    $app.append(c);
    api(`/expenses/${e.id}/receipt`, { raw: true }).then(r => r.blob()).then(b => { const i = document.getElementById('img' + e.id); if (i) i.src = URL.createObjectURL(b); }).catch(() => {});
  }
  $app.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
    if (!confirm('Eliminare questa spesa?')) return;
    try { await api('/expenses/' + b.dataset.del, { method: 'DELETE' }); viewTrip(id); } catch (e) { toast(e.message); }
  });
  if (open) {
    document.getElementById('edit').onclick = () => editTrip(t);
    $app.insertAdjacentHTML('beforeend', `<div class="card"><b>Rimborso chilometrico</b> <span class="mut">(facoltativo)</span>
      <div class="grid2"><div><label>Tariffa €/Km</label><input id="km_rate" inputmode="decimal" value="${t.km_rate ?? ''}"></div>
      <div><label>Km percorsi</label><input id="km" inputmode="decimal" value="${t.km ?? ''}"></div></div></div>
      <div class="actions"><button class="btn sec" id="close" ${t.expenses.length ? '' : 'disabled'}>Chiudi trasferta e genera Excel</button>
      <button class="btn danger" id="del">Elimina nota spese</button></div>`);
    document.getElementById('close').onclick = async (ev) => {
      ev.target.disabled = true;
      try {
        await api('/trips/' + id, { method: 'PATCH', body: { km_rate: val('km_rate'), km: val('km') } });
        const r = await api(`/trips/${id}/close`, { method: 'POST' });
        if (r.pending_uploads) toast(`Attenzione: ${r.pending_uploads} scontrini non ancora caricati su OneDrive`);
        viewTrip(id);
      } catch (e) { toast(e.message); ev.target.disabled = false; }
    };
    document.getElementById('del').onclick = async () => {
      if (!confirm('Eliminare l\'intera nota spese e i giustificativi?')) return;
      try { await api('/trips/' + id, { method: 'DELETE' }); viewDashboard(); } catch (e) { toast(e.message); }
    };
    fab('+  Aggiungi giustificativo', () => addReceipt(t));
  } else {
    $app.insertAdjacentHTML('beforeend', `<div class="card mut">Trasferta chiusa. Scarica il file, controllalo, modificalo se serve e firmalo.</div>
      <div class="actions"><button class="btn" id="xl">⬇ Scarica Excel</button><button class="btn sec" id="reopen">Riapri trasferta</button></div>`);
    document.getElementById('xl').onclick = () => downloadExcel(t);
    document.getElementById('reopen').onclick = async () => { await api(`/trips/${id}/reopen`, { method: 'POST' }); viewTrip(id); };
  }
}

function editTrip(t) {
  setHeader('Modifica trasferta', () => viewTrip(t.id));
  $app.innerHTML = `<div class="card">${tripForm(t)}<div class="actions"><button class="btn" id="save">Salva</button></div></div>`;
  document.getElementById('save').onclick = async () => {
    try { await api('/trips/' + t.id, { method: 'PATCH', body: readTripForm() }); viewTrip(t.id); } catch (e) { toast(e.message); }
  };
}

async function downloadExcel(t) {
  try {
    const r = await api(`/trips/${t.id}/excel`, { raw: true });
    const name = /filename="(.+)"/.exec(r.headers.get('Content-Disposition') || '')?.[1] || 'Nota_Spese.xlsx';
    const a = document.createElement('a'); a.href = URL.createObjectURL(await r.blob()); a.download = name; document.body.append(a); a.click(); a.remove();
  } catch (e) { toast(e.message); }
}

// ---------- aggiungi giustificativo: fotocamera → Claude → conferma ----------
function addReceipt(trip) {
  // capture="environment" apre direttamente la fotocamera posteriore sul telefono (sul PC: selezione file)
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/*'; inp.capture = 'environment';
  inp.onchange = async () => { if (inp.files[0]) receiptSheet(trip, await shrink(inp.files[0])); };
  inp.click();
}

// ridimensiona (max 1800px) e comprime: scontrino leggibile ma upload leggero
async function shrink(file, max = 1800) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.85);
}

function receiptSheet(trip, image) {
  const clamp = d => (d && d >= trip.date_from && d <= trip.date_to) ? d : (d || trip.date_from);
  const s = { category: null, currency: 'EUR', language: '', merchant: '', scanning: true };
  const el = document.createElement('div'); el.className = 'sheet';
  el.innerHTML = `<div class="inner"><div class="row"><b class="big">Nuovo giustificativo</b><button class="link" id="x">Annulla</button></div>
    <img class="preview" src="${image}" alt="Scontrino" style="margin-top:12px">
    <div class="scan" id="scan"><div class="spin"></div>Claude sta leggendo lo scontrino…</div>
    <label>Tipologia di spesa *</label>
    <div class="chips" id="cats">${cfg.categories.map(c => `<button type="button" class="chip" data-c="${esc(c)}">${esc(c)}</button>`).join('')}</div>
    <div class="grid2"><div><label>Data *</label><input id="r_date" type="date" value="${trip.date_from}"></div>
      <div><label>Metodo di pagamento *</label><select id="r_pay"><option value="">—</option>${cfg.payments.map(p => `<option>${esc(p)}</option>`).join('')}</select></div></div>
    <label>Descrizione</label><input id="r_desc" autocomplete="off">
    <div class="grid2"><div><label id="l_amt">Importo € *</label><input id="r_amt" inputmode="decimal" placeholder="0,00"></div>
      <div id="orig" hidden><label>Importo scontrino</label><input id="r_orig" disabled></div></div>
    <label>Note</label><input id="r_notes" autocomplete="off">
    <div class="actions"><button class="btn" id="ok" disabled>Salva giustificativo</button></div></div>`;
  document.body.append(el);
  const q = id => el.querySelector('#' + id);
  const close = () => el.remove();
  q('x').onclick = close;
  el.querySelectorAll('.chip').forEach(b => b.onclick = () => {
    s.category = b.dataset.c; el.querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === b)); refresh();
  });
  const refresh = () => { q('ok').disabled = !(s.category && q('r_pay').value && q('r_date').value && Number(q('r_amt').value.replace(',', '.')) > 0); };
  ['r_pay', 'r_date', 'r_amt'].forEach(i => q(i).oninput = refresh);

  api(`/trips/${trip.id}/scan`, { method: 'POST', body: { image } }).then(r => {
    s.scanning = false; s.language = r.language; s.merchant = r.merchant; s.currency = r.currency;
    if (!r.readable) { q('scan').className = 'scan err'; q('scan').textContent = 'Scontrino poco leggibile: compila i campi a mano o rifai la foto.'; return; }
    if (r.date) q('r_date').value = clamp(r.date);
    if (r.payment) q('r_pay').value = r.payment;
    q('r_desc').value = r.description;
    if (r.amountEur != null) q('r_amt').value = String(r.amountEur).replace('.', ',');
    if (r.currency !== 'EUR') {
      q('orig').hidden = false; q('r_orig').value = r.amount != null ? `${r.amount} ${r.currency}` : r.currency;
      q('l_amt').textContent = `Importo in € * (scontrino in ${r.currency})`;
    }
    const outOfRange = r.date && (r.date < trip.date_from || r.date > trip.date_to);
    q('scan').className = 'scan ok';
    q('scan').innerHTML = `<div>Lingua: <b>${esc(r.language || '?')}</b>${r.merchant ? ' · ' + esc(r.merchant) : ''} — controlla i dati e scegli la tipologia.` +
      (outOfRange ? `<br><b>Attenzione:</b> la data dello scontrino (${dIt(r.date)}) è fuori dal periodo della trasferta.` : '') + '</div>';
    refresh();
  }).catch(e => { q('scan').className = 'scan err'; q('scan').textContent = 'Lettura non riuscita (' + e.message + '). Puoi compilare a mano.'; });

  q('ok').onclick = async () => {
    q('ok').disabled = true; q('ok').textContent = 'Salvataggio e upload su OneDrive…';
    try {
      const orig = s.currency !== 'EUR' ? q('r_orig').value.match(/[\d.,]+/)?.[0] : null;
      await api(`/trips/${trip.id}/expenses`, { method: 'POST', body: {
        image, date: q('r_date').value, category: s.category, payment: q('r_pay').value, description: q('r_desc').value,
        amount: q('r_amt').value, notes: q('r_notes').value, language: s.language, merchant: s.merchant,
        orig_amount: orig, orig_currency: s.currency !== 'EUR' ? s.currency : null } });
      close(); viewTrip(trip.id);
    } catch (e) { toast(e.message); q('ok').disabled = false; q('ok').textContent = 'Salva giustificativo'; }
  };
}

// ---------- avvio ----------
(async () => {
  try { (await initAuth()) ? viewDashboard() : viewLogin(); }
  catch (e) { $app.innerHTML = `<div class="empty">Errore: ${esc(e.message)}</div>`; }
})();
