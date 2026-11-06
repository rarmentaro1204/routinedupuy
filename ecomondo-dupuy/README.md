# Ecomondo 2026 · Lead Dupuy

Web app statica (nessuna build) con gli espositori di Ecomondo 2026 potenzialmente interessati a Dupuy
(depolveratori, aspiratori industriali, ATEX). Focus: energia, biomasse, riciclo, più gli altri settori in linea.

## Deploy su Netlify
- **Drag & drop**: trascina la cartella `ecomondo-dupuy/` su https://app.netlify.com/drop
- **Da Git**: nuovo sito da questo repo, *Base directory* = `ecomondo-dupuy`, nessun comando di build, *Publish directory* = `.`

## Contenuto
- `data.js` – dati (fonte: catalogo espositori ecomondo.com, scaricato il 5/11/2026)
- Mappa interattiva dei padiglioni (clic = filtro) e vista "Percorso per padiglione" in ordine di visita, stampabile; link "📍 Mappa" allo stand sulla mappa ufficiale
- Priorità 1–5, ruolo (Cliente finale / OEM / Partner / Competitor), motivazione in 2 righe
- Decision maker: nominativi da fonti web pubbliche per le aziende a priorità alta (da verificare) +
  ricerche LinkedIn precompilate per ruolo per tutte le aziende
- Il sito è marcato `noindex`.
