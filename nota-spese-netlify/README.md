# Nota Spese — versione per Netlify

Pagina statica (`public/`) + **una sola funzione Netlify** (`netlify/functions/scan.mjs`) che legge lo scontrino con Claude.
Non c'è database: ogni trasferta è un file `trasferta.json` nella cartella OneDrive dell'impiegato, accanto alle foto degli scontrini
(`Note Spese/<data> <luogo> (#id)/`). L'amministrazione vede quelle cartelle in sola lettura. L'Excel si genera nel browser sul modulo originale.

## Pubblicare (in ordine)

### 1. Registrare l'app in Microsoft Entra ID (serve un amministratore M365)
Entra → *App registrations* → *New registration*:
- Account types: **solo questa directory**.
- Redirect URI, tipo **Single-page application**: l'URL Netlify **con "/" finale** (es. `https://nomesito.netlify.app/`).
  Quando avrete il sublink aggiungete anche quello (es. `https://www.azienda.it/notespese/`). Ogni indirizzo da cui si accede va registrato.
- *API permissions* → Microsoft Graph → **Delegated** `User.Read` e `Files.ReadWrite` → *Grant admin consent*.

### 2. Compilare `public/config.js`
`clientId`, `tenantId`, `adminEmails` (chi deve vedere gli scontrini). Sono valori pubblici, non segreti.

### 3. Pubblicare su Netlify
Il modo più semplice è collegare il repository GitHub: *Add new site → Import from Git*,
**Base directory** `nota-spese-netlify`, **Publish directory** `public`, **Functions directory** `netlify/functions` (già in `netlify.toml`).
In alternativa da terminale, dentro `nota-spese-netlify`: `npx netlify deploy --prod`.
> Il trascinamento manuale della cartella nel sito Netlify ("drag & drop") pubblica le pagine ma può **non** includere la funzione: senza funzione la lettura dello scontrino non parte (si può comunque compilare a mano). Meglio Git o CLI.

### 4. Variabili d'ambiente (Netlify → Site configuration → Environment variables)
| Nome | Valore |
|---|---|
| `ANTHROPIC_API_KEY` | la chiave API Anthropic (**segreta**, solo qui) |
| `ALLOWED_DOMAIN` | es. `azienda.it` — solo e-mail di quel dominio possono usare la scansione (consigliato: evita che altri consumino la vostra chiave) |
| `CLAUDE_MODEL` | facoltativa, default `claude-sonnet-5-5` |
| `ALLOWED_ORIGINS` | solo se l'app sta su un dominio diverso da Netlify (vedi sotto) |

### 5. Sublink (es. `www.azienda.it/notespese`)
I percorsi dell'app sono relativi, quindi funziona sotto qualsiasi sottocartella. Chi gestisce il sito aziendale deve inoltrare
`/notespese/*` al sito Netlify (reverse proxy o rewrite con stato 200). Poi:
1. aggiungere `https://www.azienda.it/notespese/` ai Redirect URI di Entra;
2. se il proxy **non** inoltra anche `/.netlify/functions/*`, in `config.js` mettere in `scanUrl` l'URL completo `https://nomesito.netlify.app/.netlify/functions/scan` e su Netlify `ALLOWED_ORIGINS=https://www.azienda.it`.

## Installare sul telefono
iPhone (Safari): Condividi → Aggiungi alla schermata Home. Android (Chrome): ⋮ → Installa app.

## Test
```bash
node --test test/scan.test.mjs         # funzione di scansione (token, dominio, CORS, errori)
node test/e2e.cjs                       # browser reale con OneDrive/Claude simulati (serve playwright)
```

## Da sapere
- **15 spese per trasferta** (righe del modulo). Valute estere: l'importo in € lo inserisce l'impiegato.
- "Carta Aziendale" è il default per i pagamenti con carta (modificabile); con `companyCardLast4` si distinguono le carte personali.
- Eliminare una spesa/trasferta la toglie dall'app ma **le foto restano su OneDrive** (traccia per l'amministrazione).
- Se l'impiegato cancella la cartella `Note Spese` da OneDrive, perde anche i dati delle trasferte.
- La funzione Netlify ha un limite di tempo (10 s di default): la lettura di uno scontrino richiede in genere pochi secondi; se scade, l'app permette di compilare a mano.
- Non provato contro un tenant Microsoft e una chiave Claude reali: il primo giro va fatto con un account di prova. Punto da verificare per primo: lettura/scrittura OneDrive dal browser e condivisione con l'amministrazione.
