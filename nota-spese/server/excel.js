import ExcelJS from 'exceljs';
import { config } from './config.js';

const TEMPLATE = new URL('../template/Modulo_Nota_Spese.xlsx', import.meta.url).pathname;
const FIRST_ROW = 14;

// Gli stili del modulo sono condivisi tra celle: va copiato l'oggetto, non modificato (altrimenti il formato "contamina" altre celle).
const fmt = (cell, numFmt) => { cell.style = { ...cell.style, numFmt }; };

const toDate = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };

/** Compila il modulo originale (stesse celle, menu e formule) con i dati della trasferta. */
export async function buildWorkbook(trip, expenses) {
  if (expenses.length > config.maxRows) throw new Error(`Il modulo ha spazio per ${config.maxRows} righe`);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(TEMPLATE);
  const ws = wb.getWorksheet('Nota Spese');

  ws.getCell('B5').value = trip.owner_name;
  ws.getCell('B6').value = trip.department;
  ws.getCell('B7').value = trip.client;
  ws.getCell('B8').value = trip.destination;
  for (const [cell, iso] of [['B9', trip.date_from], ['B10', trip.date_to]]) {
    ws.getCell(cell).value = toDate(iso); fmt(ws.getCell(cell), 'dd/mm/yyyy');
  }

  expenses.forEach((e, i) => {
    const r = FIRST_ROW + i;
    ws.getCell(`A${r}`).value = toDate(e.date); fmt(ws.getCell(`A${r}`), 'dd/mm/yyyy');
    ws.getCell(`B${r}`).value = e.category;
    ws.getCell(`C${r}`).value = e.description;
    ws.getCell(`D${r}`).value = e.payment;
    ws.getCell(`E${r}`).value = e.amount; fmt(ws.getCell(`E${r}`), '#,##0.00');
    const note = [e.notes, e.orig_currency && e.orig_currency !== 'EUR' ? `${e.orig_amount} ${e.orig_currency}` : '']
      .filter(Boolean).join(' - ');
    if (note) ws.getCell(`F${r}`).value = note;
    ws.getCell(`G${r}`).value = 'SI';   // giustificativo presente (foto salvata su OneDrive)
  });

  if (trip.km_rate != null) ws.getCell('B32').value = trip.km_rate;
  if (trip.km != null) ws.getCell('B33').value = trip.km;

  wb.calcProperties.fullCalcOnLoad = true; // Excel ricalcola subito Riepilogo e rimborso km
  return wb.xlsx.writeBuffer();
}
