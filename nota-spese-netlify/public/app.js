(() => {
const CATEGORIES = ['Trasporti', 'Carburante', 'Pedaggi', 'Taxi', 'Parcheggio', 'Hotel', 'Pasti', 'Altro'];
const PAYMENTS = ['Carta Aziendale', 'Carta Personale', 'Contanti', 'Bonifico'];
const MAX_ROWS = 15;   // righe del modulo (14-28)

const $app = document.getElementById('app'), $who = document.getElementById('who'), $title = document.getElementById('title');

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const eur = n => Number(n || 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
const dIt = iso => iso ? iso.split('-').reverse().join('/') : '';
const val = id => document.getElementById(id).value;
const toast = m => { const t = document.getElementById('toast'); t.textContent = m; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 4000); };
const num = v => { if (v === '' || v == null) return null; const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) ? n : NaN; };
const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '') && !isNaN(Date.parse(s));
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const safe = s => String(s).replace(/[^\w\-À-ÿ]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'x';

// ================= archivio sul telefono (IndexedDB) =================
// trips: una riga per trasferta (con le sue spese) · photos: le foto degli scontrini
const dbp = new Promise((res, rej) => {
  if (!window.indexedDB) return rej(new Error('Archivio non disponibile in questo browser'));
  const r = indexedDB.open('notaspese', 1);
  r.onupgradeneeded = () => { r.result.createObjectStore('trips', { keyPath: 'id' }); r.result.createObjectStore('photos'); };
  r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
});
const store = async (name, mode, fn) => {
  const db = await dbp;
  return new Promise((res, rej) => {
    const t = db.transaction(name, mode); const req = fn(t.objectStore(name));
    t.oncomplete = () => res(req?.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error || new Error('Salvataggio annullato'));
  });
};
const allTrips = () => store('trips', 'readonly', s => s.getAll());
const saveTrip = t => store('trips', 'readwrite', s => s.put(t));
const delTrip = id => store('trips', 'readwrite', s => s.delete(id));
const putPhoto = (key, blob) => store('photos', 'readwrite', s => s.put(blob, key));
const getPhoto = key => store('photos', 'readonly', s => s.get(key));
const delPhoto = key => store('photos', 'readwrite', s => s.delete(key));
const photoKey = (t, e) => `${t.id}/${e.id}`;

// profilo dell'impiegato (nome e reparto compaiono nell'Excel)
const getProfile = () => { try { return JSON.parse(localStorage.getItem('profilo') || 'null'); } catch { return null; } };
const setProfile = p => { try { localStorage.setItem('profilo', JSON.stringify(p)); } catch {} };
let profile = getProfile();

// ================= Excel (sul modulo originale) + ZIP foto =================
const toDate = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const fmt = (cell, numFmt) => { cell.style = { ...cell.style, numFmt }; }; // gli stili del modulo sono condivisi: va copiato l'oggetto
const sorted = t => [...t.expenses].sort((a, b) => a.date.localeCompare(b.date));

async function buildExcel(t) {
  const tpl = await (await fetch('template/Modulo_Nota_Spese.xlsx')).arrayBuffer();
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(tpl);
  const ws = wb.getWorksheet('Nota Spese');
  ws.getCell('B5').value = t.owner.name; ws.getCell('B6').value = t.owner.department;
  ws.getCell('B7').value = t.client; ws.getCell('B8').value = t.destination;
  for (const [c, iso] of [['B9', t.date_from], ['B10', t.date_to]]) { ws.getCell(c).value = toDate(iso); fmt(ws.getCell(c), 'dd/mm/yyyy'); }
  sorted(t).forEach((e, i) => {
    const r = 14 + i;
    ws.getCell(`A${r}`).value = toDate(e.date); fmt(ws.getCell(`A${r}`), 'dd/mm/yyyy');
    ws.getCell(`B${r}`).value = e.category; ws.getCell(`C${r}`).value = e.description; ws.getCell(`D${r}`).value = e.payment;
    ws.getCell(`E${r}`).value = e.amount; fmt(ws.getCell(`E${r}`), '#,##0.00');
    if (e.notes) ws.getCell(`F${r}`).value = e.notes;
    ws.getCell(`G${r}`).value = 'SI';
  });
  if (t.km_rate != null) ws.getCell('B32').value = t.km_rate;
  if (t.km != null) ws.getCell('B33').value = t.km;
  wb.calcProperties.fullCalcOnLoad = true;
  return wb.xlsx.writeBuffer();
}
const baseName = t => `${safe(t.owner.name)}_${t.date_from}_${safe(t.destination)}`;
function download(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}
async function buildZip(t) {
  const zip = new JSZip();
  let n = 0;
  for (const e of sorted(t)) {
    const b = await getPhoto(photoKey(t, e)); if (!b) continue;
    zip.file(`${String(++n).padStart(2, '0')}_${e.date}_${safe(e.category)}_${e.amount.toFixed(2)}.jpg`, b);
  }
  return zip.generateAsync({ type: 'blob' });
}

// ================= viste =================
function setHeader(title, back) {
  $title.innerHTML = back ? `<button class="link" style="color:#fff;font-size:18px" id="back">← ${esc(title)}</button>` : esc(title);
  if (back) document.getElementById('back').onclick = back;
  $who.innerHTML = profile && !back ? `${esc(profile.name)} <button id="prof">Profilo</button>` : '';
  const o = document.getElementById('prof'); if (o) o.onclick = () => viewProfile(viewDashboard);
}
const fab = (label, fn) => { const b = document.createElement('button'); b.className = 'btn fab'; b.textContent = label; b.onclick = fn; $app.append(b); };
const total = t => t.expenses.reduce((s, e) => s + e.amount, 0);

function viewProfile(next) {
  setHeader('Il tuo profilo', profile ? next : null);
  $app.innerHTML = `<div class="card"><p class="mut">Nome e reparto compaiono nel modulo Excel. I dati e le foto restano su questo telefono.</p>
    <label>Nome e cognome *</label><input id="p_name" value="${esc(profile?.name)}" autocomplete="name">
    <label>Reparto *</label><input id="p_dep" value="${esc(profile?.department)}" autocomplete="off">
    <div class="actions"><button class="btn" id="save">Salva</button></div></div>`;
  document.getElementById('save').onclick = () => {
    const name = val('p_name').trim(), department = val('p_dep').trim();
    if (!name || !department) return toast('Compila nome e reparto');
    profile = { name, department }; setProfile(profile); next();
  };
}

async function viewDashboard() {
  setHeader('Le mie note spese');
  const trips = (await allTrips()).sort((a, b) => (b.date_from + b.created_at).localeCompare(a.date_from + a.created_at));
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
  $app.innerHTML = `<div class="card">${tripForm({ date_from: today(), date_to: today() })}<div class="actions"><button class="btn" id="save">Crea nota spese</button></div></div>`;
  document.getElementById('save').onclick = async ev => {
    ev.target.disabled = true;
    try {
      const t = { id: newId(), owner: { ...profile }, ...readTripForm(), km_rate: null, km: null, status: 'open', created_at: new Date().toISOString(), closed_at: null, expenses: [] };
      await saveTrip(t); viewTrip(t);
    } catch (e) { toast(e.message); ev.target.disabled = false; }
  };
}

async function viewTrip(t) {
  setHeader('Trasferta', viewDashboard);
  const open = t.status === 'open';
  $app.innerHTML = `<div class="card"><div class="row"><span class="big">${esc(t.destination)}</span><span class="badge ${open ? '' : 'closed'}">${open ? 'In corso' : 'Chiusa'}</span></div>
    <div class="mut">${dIt(t.date_from)} → ${dIt(t.date_to)}${t.client ? ' · ' + esc(t.client) : ''}</div>
    <div class="row" style="margin-top:8px"><span class="mut">Totale spese</span><b class="big">${eur(total(t))}</b></div>
    ${open ? '<button class="link" id="edit">Modifica dati trasferta</button>' : ''}</div>`;
  if (!t.expenses.length) $app.insertAdjacentHTML('beforeend', '<div class="empty">Nessun giustificativo.<br>Fotografa il primo scontrino.</div>');
  for (const e of sorted(t)) {
    const c = document.createElement('div'); c.className = 'card exp';
    c.innerHTML = `<img alt="" id="img${e.id}"><div class="grow"><div><b>${esc(e.description || e.category)}</b></div>
      <div class="mut">${dIt(e.date)} · ${esc(e.category)} · ${esc(e.payment)}</div></div>
      <div style="text-align:right"><b>${eur(e.amount)}</b>${open ? `<br><button class="link" data-del="${e.id}">Elimina</button>` : ''}</div>`;
    $app.append(c);
    getPhoto(photoKey(t, e)).then(b => { const i = document.getElementById('img' + e.id); if (i && b) i.src = URL.createObjectURL(b); });
    c.querySelector('img').onclick = () => showPhoto(t, e);
  }
  $app.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
    if (!confirm('Eliminare questa spesa e la sua foto?')) return;
    try { const e = t.expenses.find(x => x.id === b.dataset.del); t.expenses = t.expenses.filter(x => x !== e); await saveTrip(t); await delPhoto(photoKey(t, e)); viewTrip(t); } catch (err) { toast(err.message); }
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
      if (!confirm("Eliminare l'intera nota spese e tutte le foto? Non si può annullare.")) return;
      try { for (const e of t.expenses) await delPhoto(photoKey(t, e)); await delTrip(t.id); viewDashboard(); } catch (e) { toast(e.message); }
    };
    fab('+  Aggiungi giustificativo', () => addReceipt(t));
  } else {
    $app.insertAdjacentHTML('beforeend', `<div class="card mut"><b>1.</b> Scarica l'Excel, controllalo, modificalo se serve e firmalo.<br><b>2.</b> Scarica le foto e invia tutto all'amministrazione.</div>
      <div class="actions"><button class="btn" id="xl">⬇ Scarica Excel</button><button class="btn" id="zp">⬇ Scarica foto scontrini (ZIP)</button><button class="btn sec" id="reopen">Riapri trasferta</button></div>`);
    const run = (id, fn) => document.getElementById(id).onclick = async ev => {
      ev.target.disabled = true; try { await fn(); } catch (e) { toast('Errore: ' + e.message); } ev.target.disabled = false;
    };
    run('xl', async () => download(new Blob([await buildExcel(t)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `Nota_Spese_${baseName(t)}.xlsx`));
    run('zp', async () => download(await buildZip(t), `Scontrini_${baseName(t)}.zip`));
    run('reopen', async () => { t.status = 'open'; t.closed_at = null; await saveTrip(t); viewTrip(t); });
  }
}

async function showPhoto(t, e) {
  const b = await getPhoto(photoKey(t, e)); if (!b) return;
  const el = document.createElement('div'); el.className = 'sheet'; el.style.background = '#000';
  el.innerHTML = `<div class="inner"><button class="link" style="color:#fff" id="c">← Chiudi</button><img class="preview" style="max-height:none;margin-top:12px" src="${URL.createObjectURL(b)}" alt="Scontrino"></div>`;
  document.body.append(el); el.querySelector('#c').onclick = () => el.remove();
}

function editTrip(t) {
  setHeader('Modifica trasferta', () => viewTrip(t));
  $app.innerHTML = `<div class="card">${tripForm(t)}<div class="actions"><button class="btn" id="save">Salva</button></div></div>`;
  document.getElementById('save').onclick = async () => { try { Object.assign(t, readTripForm()); await saveTrip(t); viewTrip(t); } catch (e) { toast(e.message); } };
}

// ================= aggiungi giustificativo: fotocamera → dati a mano =================
function addReceipt(t) {
  if (t.expenses.length >= MAX_ROWS) return toast(`Il modulo ha spazio per ${MAX_ROWS} spese: apri una nuova nota spese.`);
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/*'; inp.capture = 'environment';   // apre la fotocamera posteriore sul telefono
  inp.onchange = async () => { if (inp.files[0]) { try { receiptSheet(t, await shrink(inp.files[0])); } catch (e) { toast('Foto non leggibile: ' + e.message); } } };
  inp.click();
}
// ridimensiona (max 1800px) e comprime: scontrino leggibile ma leggero
async function shrink(file, max = 1800) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('compressione fallita')), 'image/jpeg', 0.85));
}

function receiptSheet(t, photo) {
  const s = { category: null };
  const d0 = today() >= t.date_from && today() <= t.date_to ? today() : t.date_from;
  const lastPay = (() => { try { return localStorage.getItem('ultimoPagamento') || ''; } catch { return ''; } })();
  const el = document.createElement('div'); el.className = 'sheet';
  el.innerHTML = `<div class="inner"><div class="row"><b class="big">Nuovo giustificativo</b><button class="link" id="x">Annulla</button></div>
    <img class="preview" src="${URL.createObjectURL(photo)}" alt="Scontrino" style="margin-top:12px">
    <label>Tipologia di spesa *</label>
    <div class="chips">${CATEGORIES.map(c => `<button type="button" class="chip" data-c="${esc(c)}">${esc(c)}</button>`).join('')}</div>
    <div class="grid2"><div><label>Data *</label><input id="r_date" type="date" value="${d0}"></div>
      <div><label>Importo € *</label><input id="r_amt" inputmode="decimal" placeholder="0,00"></div></div>
    <label>Metodo di pagamento *</label>
    <div class="chips" id="pays">${PAYMENTS.map(p => `<button type="button" class="chip${p === lastPay ? ' on' : ''}" data-p="${esc(p)}">${esc(p)}</button>`).join('')}</div>
    <label>Descrizione</label><input id="r_desc" autocomplete="off" placeholder="es. Pranzo con cliente">
    <label>Note</label><input id="r_notes" autocomplete="off" placeholder="es. importo originale 45 CHF">
    <div class="actions"><button class="btn" id="ok" disabled>Salva giustificativo</button></div></div>`;
  document.body.append(el);
  s.payment = PAYMENTS.includes(lastPay) ? lastPay : null;
  const q = id => el.querySelector('#' + id);
  const refresh = () => { q('ok').disabled = !(s.category && s.payment && q('r_date').value && num(q('r_amt').value) > 0); };
  q('x').onclick = () => el.remove();
  el.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { s.category = b.dataset.c; el.querySelectorAll('[data-c]').forEach(x => x.classList.toggle('on', x === b)); refresh(); });
  el.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { s.payment = b.dataset.p; el.querySelectorAll('[data-p]').forEach(x => x.classList.toggle('on', x === b)); refresh(); });
  ['r_date', 'r_amt'].forEach(i => q(i).oninput = refresh);
  refresh();

  q('ok').onclick = async () => {
    q('ok').disabled = true;
    try {
      const e = { id: newId(), date: q('r_date').value, category: s.category, payment: s.payment, description: q('r_desc').value.trim().slice(0, 120),
        amount: Math.round(num(q('r_amt').value) * 100) / 100, notes: q('r_notes').value.trim() };
      if (!isDate(e.date)) throw new Error('Data non valida');
      if (!(e.amount > 0) || e.amount > 100000) throw new Error('Importo non valido');
      if (e.date < t.date_from || e.date > t.date_to) {
        if (!confirm(`La data (${dIt(e.date)}) è fuori dal periodo della trasferta. Salvare lo stesso?`)) { q('ok').disabled = false; return; }
      }
      await putPhoto(photoKey(t, e), photo);      // prima la foto…
      t.expenses.push(e); await saveTrip(t);       // …poi la riga
      try { localStorage.setItem('ultimoPagamento', e.payment); } catch {}
      el.remove(); viewTrip(t);
    } catch (err) { toast(err.message); q('ok').disabled = false; }
  };
}

// ================= avvio =================
(async () => {
  try {
    await dbp;
    try { navigator.storage?.persist?.(); } catch {}   // chiede al browser di non cancellare i dati
    profile ? viewDashboard() : viewProfile(viewDashboard);
  } catch (e) { $app.innerHTML = `<div class="empty">Errore: ${esc(e.message)}</div>`; }
})();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
