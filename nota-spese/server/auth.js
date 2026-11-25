import { config } from './config.js';

const cache = new Map(); // token -> { user, exp }

/** Middleware: il browser manda il token Microsoft Graph (ottenuto con MSAL) in "Authorization: Bearer".
 *  Lo verifichiamo chiedendo a Graph chi è l'utente: se Microsoft risponde, il token è valido. */
export async function requireUser(req, res, next) {
  try {
    if (config.devAuth) {
      req.user = { id: 'dev-user', name: 'Mario Rossi (DEV)', department: 'Commerciale', email: 'dev@example.com' };
      req.graphToken = null;
      return next();
    }
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ error: 'Non autenticato' });

    const hit = cache.get(token);
    if (hit && hit.exp > Date.now()) { req.user = hit.user; req.graphToken = token; return next(); }

    const r = await fetch('https://graph.microsoft.com/v1.0/me?$select=id,displayName,mail,userPrincipalName,department', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return res.status(401).json({ error: 'Token Microsoft non valido o scaduto' });
    const me = await r.json();
    const user = { id: me.id, name: me.displayName, department: me.department || '', email: me.mail || me.userPrincipalName };
    cache.set(token, { user, exp: Date.now() + 5 * 60_000 });
    if (cache.size > 500) for (const [k, v] of cache) if (v.exp < Date.now()) cache.delete(k);
    req.user = user; req.graphToken = token;
    next();
  } catch (e) { next(e); }
}
