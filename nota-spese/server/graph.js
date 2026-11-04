import { config } from './config.js';
import { db } from './db.js';

const G = 'https://graph.microsoft.com/v1.0';
const safe = s => String(s).replace(/[\\/:*?"<>|#%~&{}]/g, '-').replace(/\s+/g, ' ').trim().slice(0, 80) || 'x';
const encPath = p => p.split('/').map(encodeURIComponent).join('/');

async function graph(token, method, url, { json, body, headers } = {}) {
  const r = await fetch(G + url, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(json ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: json ? JSON.stringify(json) : body,
  });
  if (!r.ok) throw new Error(`Graph ${method} ${url.split('?')[0]} → ${r.status} ${(await r.text()).slice(0, 300)}`);
  return r.status === 204 ? null : r.json();
}

/** Garantisce che la cartella radice "Note Spese" nel OneDrive del dipendente esista
 *  e sia condivisa (sola lettura) con l'amministrazione. Una volta sola per dipendente. */
async function ensureRootShared(token, user) {
  if (!config.adminEmails.length) return;
  if (db.prepare('SELECT 1 FROM shared_roots WHERE owner = ?').get(user.id)) return;
  let root;
  try { root = await graph(token, 'GET', `/me/drive/root:/${encPath(config.oneDriveRoot)}`); }
  catch {
    root = await graph(token, 'POST', '/me/drive/root/children', { json: {
      name: config.oneDriveRoot, folder: {}, '@microsoft.graph.conflictBehavior': 'fail' } });
  }
  await graph(token, 'POST', `/me/drive/items/${root.id}/invite`, { json: {
    recipients: config.adminEmails.map(email => ({ email })),
    roles: ['read'], requireSignIn: true, sendInvitation: false,
    message: `Note spese di ${user.name}` } });
  db.prepare('INSERT OR IGNORE INTO shared_roots (owner) VALUES (?)').run(user.id);
}

export function tripFolderName(trip) {
  return `${trip.date_from} ${safe(trip.destination)} (#${trip.id})`;
}

/** Carica lo scontrino nel OneDrive del dipendente: Note Spese/<trasferta>/<file>.jpg */
export async function uploadReceipt(token, user, trip, fileName, buffer) {
  if (config.devAuth && !token) return `dev://onedrive/${tripFolderName(trip)}/${fileName}`;
  await ensureRootShared(token, user);
  const p = `${config.oneDriveRoot}/${tripFolderName(trip)}/${safe(fileName)}`;
  const item = await graph(token, 'PUT',
    `/me/drive/root:/${encPath(p)}:/content?@microsoft.graph.conflictBehavior=rename`,
    { body: buffer, headers: { 'Content-Type': 'image/jpeg' } });
  return item.webUrl;
}
