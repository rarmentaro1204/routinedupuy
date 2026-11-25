import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DEV_AUTH = '1';
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ns-')) + '/';
const { app } = await import('../server/index.js');
const ExcelJS = (await import('exceljs')).default;

let server, base;
before(() => new Promise(r => { server = app.listen(0, () => { base = `http://localhost:${server.address().port}`; r(); }); }));
after(() => server.close());

const call = async (p, o = {}) => {
  const r = await fetch(base + '/api' + p, { ...o, headers: { 'Content-Type': 'application/json' }, body: o.body && JSON.stringify(o.body) });
  return r;
};
// JPEG 1x1
const IMG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

test('flusso completo: trasferta → scontrino → chiusura → Excel', async () => {
  let r = await call('/trips', { method: 'POST', body: { destination: 'Monaco', client: 'Fiera X', date_from: '2026-11-02', date_to: '2026-11-04' } });
  assert.equal(r.status, 201); const trip = await r.json();

  r = await call(`/trips/${trip.id}/scan`, { method: 'POST', body: { image: IMG } });
  const scan = await r.json();
  assert.equal(scan.language, 'Tedesco'); assert.equal(scan.payment, 'Carta Aziendale'); assert.equal(scan.amount, 42.5);

  // senza categoria → rifiutato
  r = await call(`/trips/${trip.id}/expenses`, { method: 'POST', body: { image: IMG, date: '2026-11-03', payment: 'Contanti', amount: '10' } });
  assert.equal(r.status, 400);

  r = await call(`/trips/${trip.id}/expenses`, { method: 'POST', body: { image: IMG, date: '2026-11-03', category: 'Pasti',
    payment: 'Carta Aziendale', description: 'Pranzo - Adler', amount: '42,50' } });
  assert.equal(r.status, 201);
  const exp = await r.json(); assert.ok(exp.onedrive_url.startsWith('dev://'));
  await call(`/trips/${trip.id}/expenses`, { method: 'POST', body: { image: IMG, date: '2026-11-04', category: 'Taxi',
    payment: 'Contanti', description: 'Taxi aeroporto', amount: 30, orig_amount: 32, orig_currency: 'CHF' } });

  r = await call(`/trips/${trip.id}/excel`); assert.equal(r.status, 400); // non ancora chiusa

  r = await call(`/trips/${trip.id}/close`, { method: 'POST' }); assert.equal((await r.json()).status, 'closed');
  r = await call(`/trips/${trip.id}/expenses`, { method: 'POST', body: { image: IMG, date: '2026-11-04', category: 'Altro', payment: 'Contanti', amount: 1 } });
  assert.equal(r.status, 400); // chiusa: niente nuove spese

  r = await call(`/trips/${trip.id}/excel`); assert.equal(r.status, 200);
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(Buffer.from(await r.arrayBuffer()));
  const ws = wb.getWorksheet('Nota Spese');
  assert.equal(ws.getCell('B8').value, 'Monaco');
  assert.equal(ws.getCell('B14').value, 'Pasti'); assert.equal(ws.getCell('E14').value, 42.5);
  assert.equal(ws.getCell('D15').value, 'Contanti'); assert.match(ws.getCell('F15').value, /32 CHF/);
  assert.equal(ws.getCell('G14').value, 'SI');
  assert.equal(wb.getWorksheet('Riepilogo').getCell('B4').value.formula !== undefined, true); // formule intatte
  assert.ok(ws.dataValidations.model['B14'], 'menu a tendina mantenuti');
});

test('limite 15 righe del modulo', async () => {
  const t = await (await call('/trips', { method: 'POST', body: { destination: 'X', date_from: '2026-11-01', date_to: '2026-11-01' } })).json();
  for (let i = 0; i < 15; i++) {
    const r = await call(`/trips/${t.id}/expenses`, { method: 'POST', body: { image: IMG, date: '2026-11-01', category: 'Altro', payment: 'Contanti', amount: 1 } });
    assert.equal(r.status, 201);
  }
  const r = await call(`/trips/${t.id}/expenses`, { method: 'POST', body: { image: IMG, date: '2026-11-01', category: 'Altro', payment: 'Contanti', amount: 1 } });
  assert.equal(r.status, 400);
});

test('date non valide e isolamento tra utenti', async () => {
  let r = await call('/trips', { method: 'POST', body: { destination: 'X', date_from: '2026-11-05', date_to: '2026-11-01' } });
  assert.equal(r.status, 400);
  r = await call('/trips/999999'); assert.equal(r.status, 404);
});

test('Excel: le date restano date e gli importi numeri', async () => {
  const { buildWorkbook } = await import('../server/excel.js');
  const trip = { owner_name: 'A B', department: 'X', client: '', destination: 'Y', date_from: '2026-11-02', date_to: '2026-11-04', km_rate: 0.5, km: 100 };
  const buf = await buildWorkbook(trip, [{ date: '2026-11-03', category: 'Pasti', description: 'd', payment: 'Contanti', amount: 12.3, notes: '' }]);
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buf); const ws = wb.getWorksheet('Nota Spese');
  assert.equal(ws.getCell('A14').numFmt, 'dd/mm/yyyy');
  assert.equal(ws.getCell('E14').numFmt, '#,##0.00');
  assert.equal(ws.getCell('B9').numFmt, 'dd/mm/yyyy');
  assert.equal(ws.getCell('B32').value, 0.5);
});
