import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { config, CATEGORIES, PAYMENTS } from './config.js';
import { db } from './db.js';
import { requireUser } from './auth.js';
import { scanReceipt, toExpenseFields } from './claude.js';
import { uploadReceipt } from './graph.js';
import { buildWorkbook } from './excel.js';

export const app = express();
app.use(express.json({ limit: '12mb' }));
app.use('/vendor/msal-browser.js', (req, res) =>
  res.sendFile(path.resolve('node_modules/@azure/msal-browser/lib/msal-browser.min.js')));
app.use(express.static(new URL('../public/', import.meta.url).pathname, { setHeaders: (res, f) => { if (f.endsWith('sw.js')) res.set('Cache-Control', 'no-cache'); } }));

const bad = (msg) => Object.assign(new Error(msg), { status: 400 });
const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '') && !isNaN(Date.parse(s));
const str = (v, max = 200) => String(v ?? '').trim().slice(0, max);
const num = v => (v === '' || v == null) ? null : Number(String(v).replace(',', '.'));

app.get('/api/config', (req, res) => res.json({
  clientId: config.azure.clientId, tenantId: config.azure.tenantId, devAuth: config.devAuth,
  categories: CATEGORIES, payments: PAYMENTS, maxRows: config.maxRows,
}));

const api = express.Router();
api.use(requireUser);
app.use('/api', api);

// Ogni dipendente vede solo le proprie trasferte.
function ownTrip(req) {
  const t = db.prepare('SELECT * FROM trips WHERE id = ? AND owner = ?').get(Number(req.params.id), req.user.id);
  if (!t) throw Object.assign(new Error('Trasferta non trovata'), { status: 404 });
  return t;
}
const expensesOf = id => db.prepare('SELECT * FROM expenses WHERE trip_id = ? ORDER BY date, id').all(id);

api.get('/me', (req, res) => res.json(req.user));

// --- trasferte ---
api.get('/trips', (req, res) => {
  res.json(db.prepare(`
    SELECT t.*, COUNT(e.id) AS n_expenses, COALESCE(SUM(e.amount), 0) AS total
    FROM trips t LEFT JOIN expenses e ON e.trip_id = t.id
    WHERE t.owner = ? GROUP BY t.id ORDER BY t.date_from DESC, t.id DESC`).all(req.user.id));
});

function tripFields(b) {
  const f = { client: str(b.client), destination: str(b.destination), date_from: str(b.date_from, 10), date_to: str(b.date_to, 10),
    km_rate: num(b.km_rate), km: num(b.km) };
  if (!f.destination) throw bad('Indica il luogo della trasferta');
  if (!isDate(f.date_from) || !isDate(f.date_to)) throw bad('Date non valide');
  if (f.date_to < f.date_from) throw bad('La data di fine è precedente a quella di inizio');
  if ([f.km_rate, f.km].some(v => v != null && !(v >= 0))) throw bad('Km o tariffa non validi');
  return f;
}

api.post('/trips', (req, res) => {
  const f = tripFields(req.body);
  const r = db.prepare(`INSERT INTO trips (owner, owner_name, department, client, destination, date_from, date_to, km_rate, km)
    VALUES (?,?,?,?,?,?,?,?,?)`).run(req.user.id, req.user.name, req.user.department, f.client, f.destination, f.date_from, f.date_to, f.km_rate, f.km);
  res.status(201).json(db.prepare('SELECT * FROM trips WHERE id = ?').get(r.lastInsertRowid));
});

api.get('/trips/:id', (req, res) => {
  const trip = ownTrip(req);
  res.json({ ...trip, expenses: expensesOf(trip.id) });
});

api.patch('/trips/:id', (req, res) => {
  const trip = ownTrip(req);
  if (trip.status !== 'open') throw bad('Trasferta chiusa: riaprila per modificarla');
  const f = tripFields({ ...trip, ...req.body });
  db.prepare(`UPDATE trips SET client=?, destination=?, date_from=?, date_to=?, km_rate=?, km=? WHERE id=?`)
    .run(f.client, f.destination, f.date_from, f.date_to, f.km_rate, f.km, trip.id);
  res.json(db.prepare('SELECT * FROM trips WHERE id = ?').get(trip.id));
});

api.delete('/trips/:id', (req, res) => {
  const trip = ownTrip(req);
  if (trip.status !== 'open') throw bad('Trasferta chiusa');
  for (const e of expensesOf(trip.id)) removeLocal(e);
  db.prepare('DELETE FROM trips WHERE id = ?').run(trip.id);
  res.status(204).end();
});

// --- scontrini ---
function decodeImage(dataUrl) {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(dataUrl || '');
  if (!m) throw bad('Immagine non valida');
  return { mediaType: m[1], base64: m[2], buffer: Buffer.from(m[2], 'base64') };
}

// Claude legge lo scontrino (nulla viene salvato finché l'operatore non conferma)
api.post('/trips/:id/scan', async (req, res) => {
  ownTrip(req);
  const img = decodeImage(req.body.image);
  const raw = await scanReceipt(img.base64, img.mediaType);
  res.json(toExpenseFields(raw));
});

api.post('/trips/:id/expenses', async (req, res) => {
  const trip = ownTrip(req);
  if (trip.status !== 'open') throw bad('Trasferta chiusa');
  if (expensesOf(trip.id).length >= config.maxRows) throw bad(`Il modulo ha spazio per ${config.maxRows} spese: apri una nuova trasferta`);
  const b = req.body;
  const img = decodeImage(b.image);
  const e = {
    date: str(b.date, 10), category: str(b.category), payment: str(b.payment), description: str(b.description, 120),
    notes: str(b.notes), amount: num(b.amount), orig_amount: num(b.orig_amount), orig_currency: str(b.orig_currency, 3).toUpperCase() || null,
    language: str(b.language, 40), merchant: str(b.merchant, 100),
  };
  if (!isDate(e.date)) throw bad('Data non valida');
  if (!CATEGORIES.includes(e.category)) throw bad('Scegli la tipologia di spesa');
  if (!PAYMENTS.includes(e.payment)) throw bad('Scegli il metodo di pagamento');
  if (!(e.amount > 0) || e.amount > 100000) throw bad('Importo in € non valido');

  const r = db.prepare(`INSERT INTO expenses (trip_id, date, category, description, payment, amount, orig_amount, orig_currency, language, merchant, notes)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(trip.id, e.date, e.category, e.description, e.payment, e.amount, e.orig_amount, e.orig_currency, e.language, e.merchant, e.notes);
  const id = Number(r.lastInsertRowid);
  // copia locale di sicurezza, poi upload su OneDrive
  const local = `${id}.jpg`;
  fs.writeFileSync(path.join(config.dataDir, 'receipts', local), img.buffer);
  db.prepare('UPDATE expenses SET receipt_file = ? WHERE id = ?').run(local, id);
  await pushToOneDrive(req, trip, db.prepare('SELECT * FROM expenses WHERE id = ?').get(id));
  res.status(201).json(db.prepare('SELECT * FROM expenses WHERE id = ?').get(id));
});

const receiptName = e => `${e.date}_${e.category}_${e.amount.toFixed(2)}_${e.id}.jpg`;

// Upload su OneDrive; se fallisce l'errore resta registrato e verrà ritentato alla chiusura.
async function pushToOneDrive(req, trip, e) {
  try {
    const buf = fs.readFileSync(path.join(config.dataDir, 'receipts', e.receipt_file));
    const url = await uploadReceipt(req.graphToken, req.user, trip, receiptName(e), buf);
    db.prepare('UPDATE expenses SET onedrive_url = ?, upload_error = NULL WHERE id = ?').run(url, e.id);
    return true;
  } catch (err) {
    console.error('Upload OneDrive fallito:', err.message);
    db.prepare('UPDATE expenses SET upload_error = ? WHERE id = ?').run(err.message.slice(0, 300), e.id);
    return false;
  }
}

function removeLocal(e) { if (e.receipt_file) fs.rmSync(path.join(config.dataDir, 'receipts', e.receipt_file), { force: true }); }

function ownExpense(req) {
  const e = db.prepare(`SELECT e.*, t.owner, t.status AS trip_status FROM expenses e JOIN trips t ON t.id = e.trip_id
    WHERE e.id = ? AND t.owner = ?`).get(Number(req.params.id), req.user.id);
  if (!e) throw Object.assign(new Error('Spesa non trovata'), { status: 404 });
  return e;
}

api.delete('/expenses/:id', (req, res) => {
  const e = ownExpense(req);
  if (e.trip_status !== 'open') throw bad('Trasferta chiusa');
  removeLocal(e); // la copia su OneDrive resta: è la traccia per l'amministrazione
  db.prepare('DELETE FROM expenses WHERE id = ?').run(e.id);
  res.status(204).end();
});

api.get('/expenses/:id/receipt', (req, res) => {
  const e = ownExpense(req);
  const f = path.join(config.dataDir, 'receipts', e.receipt_file || '');
  if (!e.receipt_file || !fs.existsSync(f)) throw Object.assign(new Error('Immagine non disponibile'), { status: 404 });
  res.type('image/jpeg').sendFile(f);
});

// --- chiusura ed Excel ---
api.post('/trips/:id/close', async (req, res) => {
  const trip = ownTrip(req);
  const list = expensesOf(trip.id);
  if (!list.length) throw bad('Aggiungi almeno un giustificativo prima di chiudere');
  for (const e of list.filter(x => !x.onedrive_url)) await pushToOneDrive(req, trip, e); // ritenta upload falliti
  db.prepare("UPDATE trips SET status='closed', closed_at=datetime('now') WHERE id=?").run(trip.id);
  const pending = expensesOf(trip.id).filter(x => !x.onedrive_url).length;
  res.json({ ...db.prepare('SELECT * FROM trips WHERE id = ?').get(trip.id), pending_uploads: pending });
});

api.post('/trips/:id/reopen', (req, res) => {
  const trip = ownTrip(req);
  db.prepare("UPDATE trips SET status='open', closed_at=NULL WHERE id=?").run(trip.id);
  res.json({ ok: true });
});

api.get('/trips/:id/excel', async (req, res) => {
  const trip = ownTrip(req);
  if (trip.status !== 'closed') throw bad('Chiudi la trasferta per scaricare il file Excel');
  const buf = await buildWorkbook(trip, expensesOf(trip.id));
  const name = `Nota_Spese_${trip.owner_name.replace(/[^\w]+/g, '_')}_${trip.date_from}.xlsx`;
  res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="${name}"` }).send(Buffer.from(buf));
});

app.use('/api', (req, res) => res.status(404).json({ error: 'Non trovato' }));
app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? 'Errore del server: ' + err.message : err.message });
});

if (process.argv[1] === new URL(import.meta.url).pathname) {
  if (!config.devAuth && (!config.azure.clientId || !config.azure.tenantId)) {
    console.error('Configura AZURE_CLIENT_ID e AZURE_TENANT_ID (vedi README) oppure avvia con DEV_AUTH=1'); process.exit(1);
  }
  app.listen(config.port, () => console.log(`Nota spese su http://localhost:${config.port}${config.devAuth ? '  [DEV_AUTH]' : ''}`));
}
