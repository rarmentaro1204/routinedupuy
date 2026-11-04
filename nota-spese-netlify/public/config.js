// ====== DA COMPILARE (nessun segreto qui: sono valori pubblici) ======
window.APP_CONFIG = {
  clientId: 'INSERISCI-APPLICATION-CLIENT-ID',     // Entra ID → App registrations → Application (client) ID
  tenantId: 'INSERISCI-DIRECTORY-TENANT-ID',       // Entra ID → Directory (tenant) ID
  adminEmails: ['amministrazione@azienda.it'],     // vedono in sola lettura la cartella OneDrive di ogni dipendente
  oneDriveRoot: 'Note Spese',                      // cartella radice nel OneDrive di ciascun dipendente
  companyCardLast4: [],                            // facoltativo, es. ['1234','5678']: altre carte → "Carta Personale"
  scanUrl: '/.netlify/functions/scan',             // se l'app sta su un altro dominio: URL completo della funzione Netlify
  devAuth: false,                                  // solo test automatici: lasciare false
};
