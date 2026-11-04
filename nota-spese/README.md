# Nota Spese da foto

App web (PWA mobile-first) per le note spese di trasferta.

**Flusso**
1. L'impiegato accede con l'account Microsoft aziendale.
2. Crea una nota spese (luogo, dal/al, cliente/evento): compare nella dashboard.
3. In evidenza il pulsante **+ Aggiungi giustificativo**: si apre la fotocamera e scatta lo scontrino.
4. **Claude** legge lo scontrino: individua la **lingua**, propone **metodo di pagamento** (contanti / carta aziendale), **importo**, data e descrizione (sempre in italiano). L'impiegato sceglie la **tipologia** (Trasporti, Carburante, Pedaggi, Taxi, Parcheggio, Hotel, Pasti, Altro), controlla e salva.
5. La foto viene caricata su **OneDrive** dell'impiegato in `Note Spese/<data> <destinazione> (#id)/` e la cartella radice `Note Spese` è condivisa in sola lettura con l'amministrazione.
6. A trasferta chiusa si scarica l'**Excel** compilato sul vostro modulo originale (`template/Modulo_Nota_Spese.xlsx`: stesse celle, menu a tendina, foglio Riepilogo e rimborso km), da controllare e firmare.

## Avvio rapido (prova in locale, senza Microsoft né Claude)
```bash
cd nota-spese && npm install
npm run dev        # http://localhost:3000 con DEV_AUTH=1: utente finto e scontrino "letto" finto
npm test
```

## Messa in produzione

### 1. Registrazione app (Microsoft Entra ID) — una volta sola, serve un amministratore
Portale Entra → *App registrations* → *New registration*:
- Account types: **solo questa directory** (single tenant).
- Redirect URI: tipo **Single-page application (SPA)** → `https://<vostro-dominio>` (la stessa URL dell'app).
- *API permissions* → Microsoft Graph → **Delegated**: `User.Read`, `Files.ReadWrite`. Poi *Grant admin consent*.
- Copia *Application (client) ID* → `AZURE_CLIENT_ID`, *Directory (tenant) ID* → `AZURE_TENANT_ID`.

### 2. Variabili d'ambiente
Copia `.env.example` e compila (`ANTHROPIC_API_KEY` da console.anthropic.com, `ADMIN_EMAILS` = amministrazione).
Avvio: `node --env-file=.env server/index.js` (Node ≥ 22.13).

### 3. HTTPS obbligatorio
La fotocamera e l'accesso Microsoft funzionano solo su **HTTPS**. Pubblicate dietro un reverse proxy / servizio con certificato (es. Azure App Service, un VPS con Caddy/nginx). Il disco `data/` (SQLite + copie locali degli scontrini) va tenuto su un volume persistente e nel backup.

## Come funziona la sicurezza
- Il browser ottiene da Microsoft un token (MSAL); il server lo verifica interrogando Microsoft Graph (`/me`) e **riusa lo stesso token per scrivere sul OneDrive di quell'utente**: il server non ha mai accesso a OneDrive di altri e non memorizza password/token.
- Ogni dipendente vede solo le proprie trasferte.
- L'amministrazione vede gli scontrini direttamente da OneDrive (cartella condivisa "Note Spese" di ciascun dipendente, in "Condivisi con me").

## Limiti noti / scelte da confermare
- **15 spese per trasferta**: è la capienza del vostro modulo (righe 14-28). Oltre, l'app invita ad aprire una nuova nota spese.
- **Valute estere**: Claude legge importo e valuta, ma non converte. Se lo scontrino non è in EUR l'impiegato inserisce l'importo in € (il valore originale finisce nelle Note dell'Excel).
- **"Carta aziendale"**: da uno scontrino non si può sapere se la carta è aziendale. Per default una carta → "Carta Aziendale" (modificabile); con `COMPANY_CARD_LAST4` l'app distingue la carta personale.
- Claude può sbagliare (specie su scontrini sbiaditi): l'impiegato vede e può correggere ogni campo prima di salvare, e l'app segnala date fuori dal periodo della trasferta.
- Eliminare una spesa nell'app non cancella la foto da OneDrive (traccia per l'amministrazione).
- Se l'upload su OneDrive fallisce, la spesa è salvata comunque in locale e l'upload viene ritentato alla chiusura della trasferta.
- Non provato contro un tenant Microsoft reale né con la chiave Claude vera (non disponibili in questa sessione): il flusso è testato in modalità sviluppo; il primo giro reale va fatto con un account di prova.

## Struttura
```
server/  index.js (API) · auth.js (verifica token) · claude.js (lettura scontrini) · graph.js (OneDrive) · excel.js (compila il modulo) · db.js
public/  interfaccia (HTML/JS senza build, MSAL servito dal server)
template/Modulo_Nota_Spese.xlsx   modulo originale
test/    test automatici
```
