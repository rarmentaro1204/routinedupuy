# Weekly Verify Log

| Data/Ora (Europe/Rome) | File nuovi processati | Righe esaminate (dedup globale) | Duplicati marcati | Upgrade doppio controllo |
|---|---|---|---|---|
| 2026-08-31 11:58 | 3 | 48 | 16 | 26 |
| 2026-09-03 07:18 | 51 | 763 | 202 | 183 |

Nota run 2026-09-03: il doppio controllo (upgrade stato_verifica) è stato eseguito da 10 agenti paralleli, ma la quota di WebSearch della sessione (condivisa tra tutti gli agenti) si è esaurita dopo che ciascun agente aveva completato mediamente 1 file su ~5 assegnati. Le righe non raggiunte sono state lasciate correttamente invariate a "DA VERIFICARE UMANAMENTE" (nessuna promozione senza conferma reale, nessun declassamento). Su 513 righe candidate nei file nuovi, 183 sono state promosse a "VERIFICATA AI - doppio controllo"; le restanti ~330 restano da verificare (verranno eventualmente riconsiderate in una prossima esecuzione se il file rientra ancora nel perimetro, altrimenti richiedono verifica umana diretta).
