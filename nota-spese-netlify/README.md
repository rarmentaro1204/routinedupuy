# Nota Spese — versione semplice (solo pagina statica)

Nessun server, nessun login, nessuna chiave: sono **solo file statici** (`public/`). Si pubblica su Netlify anche trascinando la cartella `public`.

**Flusso**
1. Prima volta: l'impiegato scrive nome e reparto (compaiono nell'Excel).
2. Crea una nota spese (luogo, dal/al, cliente/evento) → compare nella dashboard.
3. **+ Aggiungi giustificativo** → si apre la fotocamera → scatta lo scontrino → sceglie la tipologia, inserisce data, importo, metodo di pagamento (descrizione e note facoltative).
4. **Chiudi trasferta** → **Scarica Excel** (il vostro modulo compilato, da controllare e firmare) e **Scarica foto (ZIP)** da inviare all'amministrazione.

Dati e foto restano **nel browser del telefono** (IndexedDB). Niente va online.

## Pubblicare su Netlify
- Più semplice: <https://app.netlify.com/drop> → trascina la cartella **`public`**. Subito online su HTTPS (serve per fotocamera e installazione sul telefono).
- Oppure collega il repository: Base directory `nota-spese-netlify`, Publish directory `public` (già in `netlify.toml`).
- Sublink (`www.azienda.it/notespese`): i percorsi sono relativi, funziona sotto qualsiasi sottocartella; chi gestisce il sito inoltra `/notespese/*` al sito Netlify (reverse proxy / rewrite 200).

## Installare sul telefono
iPhone (Safari): Condividi → Aggiungi alla schermata Home. Android (Chrome): ⋮ → Installa app.
**Meglio installarla**: da icona in home iPhone/Safari non cancella i dati dopo qualche giorno di inattività, come invece può fare con un semplice sito aperto nel browser.

## Cose da sapere
- **I dati sono solo su quel telefono.** Cancellare i dati del browser, disinstallare l'app o cambiare telefono li perde: l'impiegato deve scaricare Excel e ZIP a fine trasferta. L'amministrazione riceve le foto solo se l'impiegato le invia.
- **15 spese per trasferta** (righe del modulo). Valute estere: si inserisce l'importo in € e si annota l'originale in Note.
- Non c'è lettura automatica degli scontrini né controllo dell'identità: nome e reparto sono quelli digitati.

## Versione completa messa da parte (nella cronologia git)
Login Microsoft, lettura scontrini con Claude e salvataggio su OneDrive per impiegato con cartella visibile all'amministrazione sono nel commit
"Versione Netlify: pagina statica + funzione di scansione, dati su OneDrive" (e, con server, nella cartella `nota-spese/`). Si può riprendere quando servirà.

## Test
`node test/e2e.cjs` — browser reale (richiede playwright): profilo, trasferta, scontrini, riavvio, Excel e ZIP.
