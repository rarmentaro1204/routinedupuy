import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.ANTHROPIC_API_KEY = 'k'; process.env.ALLOWED_DOMAIN = 'azienda.it';
const { default: scan } = await import('../netlify/functions/scan.mjs');
const IMG = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
const req = (o = {}) => new Request('https://x/.netlify/functions/scan', { method: 'POST', headers: { authorization: 'Bearer t', ...(o.headers || {}) }, body: JSON.stringify(o.body ?? { image: IMG }) });
const realFetch = globalThis.fetch;
const mock = (mail, anth = { status: 200, body: { content: [{ type: 'tool_use', input: { leggibile: true, importo_totale: 5 } }] } }) =>
  globalThis.fetch = async (url, init) => url.includes('graph')
    ? (init.headers.Authorization === 'Bearer t' ? Response.json({ mail }) : new Response('', { status: 401 }))
    : (assert.equal(init.headers['x-api-key'], 'k'), Response.json(anth.body, { status: anth.status }));

test('senza token → 401', async () => { mock('a@azienda.it'); const r = await scan(new Request('https://x', { method: 'POST', body: '{}' })); assert.equal(r.status, 401); });
test('dominio non ammesso → 403', async () => { mock('a@altro.com'); assert.equal((await scan(req())).status, 403); });
test('immagine non valida → 400', async () => { mock('a@azienda.it'); assert.equal((await scan(req({ body: { image: 'ciao' } }))).status, 400); });
test('ok → restituisce i dati di Claude', async () => { mock('a@azienda.it'); const r = await scan(req()); assert.equal(r.status, 200); assert.equal((await r.json()).importo_totale, 5); });
test('errore Anthropic → 502 senza dettagli', async () => { mock('a@azienda.it', { status: 500, body: { e: 1 } }); assert.equal((await scan(req())).status, 502); });
test('CORS solo per origini ammesse', async () => {
  process.env.ALLOWED_ORIGINS = 'https://www.azienda.it'; mock('a@azienda.it');
  const ok = await scan(new Request('https://x', { method: 'OPTIONS', headers: { origin: 'https://www.azienda.it' } }));
  const no = await scan(new Request('https://x', { method: 'OPTIONS', headers: { origin: 'https://evil.com' } }));
  assert.equal(ok.headers.get('access-control-allow-origin'), 'https://www.azienda.it'); assert.equal(no.headers.get('access-control-allow-origin'), null);
  globalThis.fetch = realFetch;
});
