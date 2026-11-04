// Test nel browser: pagina statica + OneDrive/Graph simulato + funzione di scansione simulata.
// Uso: node test/e2e.cjs   (serve playwright; la cartella public viene servita in locale)
const { chromium } = require('playwright'); const http = require('http'); const fs = require('fs'); const path = require('path');
const assert = require('assert/strict');
const PUB = path.join(__dirname, '../public');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/json', '.xlsx': 'application/octet-stream' };

(async () => {
  const srv = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
    const f = path.join(PUB, p); if (!f.startsWith(PUB) || !fs.existsSync(f)) { r.statusCode = 404; return r.end(); }
    r.setHeader('Content-Type', MIME[path.extname(f)] || 'text/plain'); r.end(fs.readFileSync(f)); }).listen(0);
  const base = `http://localhost:${srv.address().port}`;
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 780 }, acceptDownloads: true, serviceWorkers: 'block' });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));

  const drive = new Map(), invites = []; let scanCalls = 0;
  await p.route('**/config.js', r => r.fulfill({ contentType: 'text/javascript', body: `window.APP_CONFIG=${JSON.stringify({ devAuth: true, adminEmails: ['admin@azienda.it'], oneDriveRoot: 'Note Spese', companyCardLast4: [], scanUrl: '/.netlify/functions/scan' })}` }));
  await p.route('https://graph.microsoft.com/**', async r => {
    const q = r.request(); const u = new URL(q.url()); const m = /^\/v1\.0\/me\/drive\/root:\/(.+?)(:\/(content|children))?$/.exec(decodeURIComponent(u.pathname));
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' };
    if (q.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
    const json = (o, s = 200) => r.fulfill({ status: s, headers: cors, contentType: 'application/json', body: JSON.stringify(o) });
    if (q.headers().authorization !== 'Bearer dev') return json({}, 401);
    if (/\/invite$/.test(u.pathname)) { invites.push(JSON.parse(q.postData())); return json({ value: [] }); }
    if (!m) return json({ error: 'x' }, 404);
    const [, pth, , kind] = m;
    if (kind === 'children') {
      const names = new Set([...drive.keys()].filter(k => k.startsWith(pth + '/')).map(k => k.slice(pth.length + 1).split('/')[0]));
      return names.size ? json({ value: [...names].map(name => ({ name, folder: {} })) }) : json({}, 404);
    }
    if (kind === 'content' && q.method() === 'PUT') { drive.set(pth, q.postDataBuffer()); return json({ id: 'i' + drive.size, name: pth.split('/').pop(), webUrl: 'https://od/' + pth }, 201); }
    if (kind === 'content') return drive.has(pth) ? r.fulfill({ status: 200, headers: cors, body: drive.get(pth) }) : json({}, 404);
    return drive.has(pth) || pth === 'Note Spese' ? json({ id: 'root1', name: pth.split('/').pop(), '@microsoft.graph.downloadUrl': base + '/icon-192.png' }) : json({}, 404);
  });
  await p.route('**/.netlify/functions/scan', r => { scanCalls++; assert.equal(r.request().headers().authorization, 'Bearer dev');
    r.fulfill({ contentType: 'application/json', body: JSON.stringify({ leggibile: true, lingua: 'Tedesco', lingua_iso: 'de', esercente: 'Gasthaus Zum Adler', data: '2026-11-03',
      importo_totale: 42.5, valuta: 'EUR', metodo_pagamento: 'carta', carta_ultime4: '1234', descrizione: 'Pranzo - Gasthaus Zum Adler' }) }); });

  await p.goto(base + '/'); await p.waitForSelector('.fab');
  await p.click('.fab'); await p.fill('#f_dest', 'Monaco di Baviera'); await p.fill('#f_client', 'Productronica');
  await p.fill('#f_from', '2026-11-02'); await p.fill('#f_to', '2026-11-04'); await p.click('#save'); await p.waitForSelector('.fab');
  assert.equal(invites.length, 1); assert.equal(invites[0].recipients[0].email, 'admin@azienda.it'); assert.deepEqual(invites[0].roles, ['read']);

  const jpg = fs.readFileSync(path.join(PUB, 'icon-512.png'));
  const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click('.fab')]);
  await fc.setFiles({ name: 'r.png', mimeType: 'image/png', buffer: jpg });
  await p.waitForSelector('.scan.ok'); assert.match(await p.textContent('.scan'), /Tedesco/);
  await p.click('[data-c="Pasti"]'); assert.equal(await p.inputValue('#r_pay'), 'Carta Aziendale'); assert.equal(await p.inputValue('#r_amt'), '42,5');
  await p.click('#ok'); await p.waitForSelector('.exp');
  assert.ok([...drive.keys()].some(k => k.endsWith('.jpg')), 'foto su OneDrive');
  const tripKey = [...drive.keys()].find(k => k.endsWith('trasferta.json'));
  assert.equal(JSON.parse(drive.get(tripKey)).expenses[0].category, 'Pasti');

  await p.reload(); await p.waitForSelector('.card.click'); assert.match(await p.textContent('.card.click'), /Monaco di Baviera/); // i dati tornano da OneDrive
  await p.click('.card.click'); await p.waitForSelector('#close'); await p.click('#close'); await p.waitForSelector('#xl');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#xl')]);
  await dl.saveAs(process.argv[2] || '/tmp/e2e.xlsx');
  assert.deepEqual(errs, []); console.log('E2E OK — scansioni:', scanCalls, '— file:', dl.suggestedFilename());
  await b.close(); srv.close();
})().catch(e => { console.error('E2E FAIL', e); process.exit(1); });
