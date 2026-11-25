// Tutta la configurazione arriva da variabili d'ambiente (vedi .env.example).
const env = process.env;

export const config = {
  port: Number(env.PORT || 3000),
  devAuth: env.DEV_AUTH === '1',              // SOLO sviluppo: salta il login Microsoft
  azure: {
    clientId: env.AZURE_CLIENT_ID || '',
    tenantId: env.AZURE_TENANT_ID || '',
  },
  anthropicKey: env.ANTHROPIC_API_KEY || '',
  claudeModel: env.CLAUDE_MODEL || 'claude-sonnet-5-5',
  // Amministrazione: e-mail (separate da virgola) che vedono la cartella OneDrive di ogni dipendente
  adminEmails: (env.ADMIN_EMAILS || '').split(',').map(s => s.trim()).filter(Boolean),
  oneDriveRoot: env.ONEDRIVE_ROOT || 'Note Spese',
  companyCardLast4: (env.COMPANY_CARD_LAST4 || '').split(',').map(s => s.trim()).filter(Boolean),
  dataDir: env.DATA_DIR || new URL('../data/', import.meta.url).pathname,
  maxRows: 15,                                // righe disponibili nel modulo (righe 14-28)
};

export const CATEGORIES = ['Trasporti', 'Carburante', 'Pedaggi', 'Taxi', 'Parcheggio', 'Hotel', 'Pasti', 'Altro'];
export const PAYMENTS = ['Carta Aziendale', 'Carta Personale', 'Contanti', 'Bonifico'];
