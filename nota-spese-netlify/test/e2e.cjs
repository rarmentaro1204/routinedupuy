// Test nel browser reale: profilo → trasferta → scontrino a mano → chiusura → Excel e ZIP.
// Uso: node test/e2e.cjs [cartella-output]   (serve playwright; la cartella public viene servita in locale)
const { chromium } = require('playwright'); const http = require('http'); const fs = require('fs'); const path = require('path');
const assert = require('assert/strict');
const PUB = path.join(__dirname, '../public'); const OUT = process.argv[2] || '/tmp';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/json' };

(async () => {
  const srv = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
    const f = path.join(PUB, p); if (!f.startsWith(PUB) || !fs.existsSync(f)) { r.statusCode = 404; return r.end(); }
    r.setHeader('Content-Type', MIME[path.extname(f)] || 'application/octet-stream'); r.end(fs.readFileSync(f)); }).listen(0);
  const base = `http://localhost:${srv.address().port}`;
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 780 }, acceptDownloads: true, serviceWorkers: 'block' });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  const addReceipt = async (cat, date, amt, pay, desc) => {
    const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click('.fab')]);
    await fc.setFiles({ name: 'r.png', mimeType: 'image/png', buffer: fs.readFileSync(path.join(PUB, 'icon-512.png')) });
    await p.waitForSelector('#ok'); assert.equal(await p.isDisabled('#ok'), true, 'salva disabilitato finché mancano i dati');
    await p.click(`[data-c="${cat}"]`); await p.fill('#r_date', date); await p.fill('#r_amt', amt);
    if (pay) await p.click(`[data-p="${pay}"]`); if (desc) await p.fill('#r_desc', desc);
    await p.click('#ok'); await p.waitForSelector('.sheet', { state: 'detached' });
  };

  await p.goto(base + '/'); await p.waitForSelector('#p_name');                       // primo avvio: profilo
  await p.fill('#p_name', 'Mario Rossi'); await p.fill('#p_dep', 'Commerciale'); await p.click('#save'); await p.waitForSelector('.fab');
  await p.click('.fab'); await p.fill('#f_dest', 'Monaco di Baviera'); await p.fill('#f_client', 'Productronica');
  await p.fill('#f_from', '2026-11-02'); await p.fill('#f_to', '2026-11-04'); await p.click('#save'); await p.waitForSelector('.fab');
  await addReceipt('Pasti', '2026-11-03', '42,50', 'Carta Aziendale', 'Pranzo con cliente');
  await addReceipt('Taxi', '2026-11-04', '30', 'Contanti', 'Taxi aeroporto');
  await p.waitForFunction(() => document.querySelectorAll('.exp').length === 2);
  assert.match(await p.textContent('.card'), /72,50/);

  await p.reload(); await p.waitForSelector('.card.click');                           // i dati sono ancora lì dopo il riavvio
  assert.match(await p.textContent('.card.click'), /Monaco di Baviera/); assert.match(await p.textContent('.card.click'), /2 giustificativi/);
  await p.click('.card.click'); await p.waitForSelector('#close');
  await p.fill('#km_rate', '0,42'); await p.fill('#km', '120'); await p.click('#close'); await p.waitForSelector('#xl');
  let [dl] = await Promise.all([p.waitForEvent('download'), p.click('#xl')]); await dl.saveAs(OUT + '/nota.xlsx'); console.log(dl.suggestedFilename());
  [dl] = await Promise.all([p.waitForEvent('download'), p.click('#zp')]); await dl.saveAs(OUT + '/foto.zip'); console.log(dl.suggestedFilename());
  assert.deepEqual(errs, []); console.log('E2E OK'); await b.close(); srv.close();
})().catch(e => { console.error('E2E FAIL', e); process.exit(1); });
