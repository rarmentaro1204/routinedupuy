import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

fs.mkdirSync(path.join(config.dataDir, 'receipts'), { recursive: true });
export const db = new DatabaseSync(path.join(config.dataDir, 'notaspese.db'));

db.exec(`
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS trips (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner TEXT NOT NULL,            -- id Microsoft (oid) del dipendente
  owner_name TEXT NOT NULL,
  department TEXT NOT NULL DEFAULT '',
  client TEXT NOT NULL DEFAULT '',
  destination TEXT NOT NULL,
  date_from TEXT NOT NULL,        -- YYYY-MM-DD
  date_to TEXT NOT NULL,
  km_rate REAL, km REAL,
  status TEXT NOT NULL DEFAULT 'open',   -- open | closed
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  closed_at TEXT
);
CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  payment TEXT NOT NULL,
  amount REAL NOT NULL,           -- importo in EUR (colonna "Importo €" del modulo)
  orig_amount REAL, orig_currency TEXT,
  language TEXT, merchant TEXT,
  notes TEXT NOT NULL DEFAULT '',
  receipt_file TEXT,              -- copia locale
  onedrive_url TEXT,              -- link OneDrive (null = upload ancora da fare)
  upload_error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS shared_roots (owner TEXT PRIMARY KEY);
`);
