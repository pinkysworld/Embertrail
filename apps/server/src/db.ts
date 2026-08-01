import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { CharacterSheet } from "@embertrail/shared";
import { randomUUID, createHash } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, "../../../data");
mkdirSync(dataDir, { recursive: true });

const db = new Database(join(dataDir, "embertrail.sqlite"));
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    pass_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS characters (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    name TEXT NOT NULL,
    data TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY(account_id) REFERENCES accounts(id)
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    character_id TEXT,
    created_at INTEGER NOT NULL
  );
`);

function hashPass(pass: string): string {
  return createHash("sha256").update(`embertrail:${pass}`).digest("hex");
}

export function registerAccount(name: string, password: string): { ok: true; id: string } | { ok: false; error: string } {
  try {
    const id = randomUUID();
    db.prepare("INSERT INTO accounts (id, name, pass_hash, created_at) VALUES (?, ?, ?, ?)").run(
      id,
      name,
      hashPass(password),
      Date.now()
    );
    return { ok: true, id };
  } catch {
    return { ok: false, error: "name_taken" };
  }
}

export function loginAccount(name: string, password: string): { token: string; accountId: string } | null {
  const row = db.prepare("SELECT id, pass_hash FROM accounts WHERE name = ?").get(name) as
    | { id: string; pass_hash: string }
    | undefined;
  if (!row || row.pass_hash !== hashPass(password)) return null;
  const token = randomUUID();
  db.prepare("INSERT INTO sessions (token, account_id, created_at) VALUES (?, ?, ?)").run(
    token,
    row.id,
    Date.now()
  );
  return { token, accountId: row.id };
}

export function guestAccount(): { token: string; accountId: string; name: string } {
  const name = `Wanderer_${Math.floor(Math.random() * 9000 + 1000)}`;
  const reg = registerAccount(name, randomUUID());
  if (!reg.ok) return guestAccount();
  const login = loginAccount(name, ""); // won't work — use direct session
  // Create session directly
  const token = randomUUID();
  db.prepare("INSERT INTO sessions (token, account_id, created_at) VALUES (?, ?, ?)").run(
    token,
    reg.id,
    Date.now()
  );
  // Fix: guest needs known password — recreate properly
  return { token, accountId: reg.id, name };
}

export function createGuest(): { token: string; accountId: string; name: string } {
  const name = `Wanderer_${Math.floor(Math.random() * 9000 + 1000)}`;
  const password = randomUUID();
  const reg = registerAccount(name, password);
  if (!reg.ok) return createGuest();
  const login = loginAccount(name, password)!;
  return { token: login.token, accountId: login.accountId, name };
}

export function sessionAccount(token: string): string | null {
  const row = db.prepare("SELECT account_id FROM sessions WHERE token = ?").get(token) as
    | { account_id: string }
    | undefined;
  return row?.account_id ?? null;
}

export function saveCharacter(sheet: CharacterSheet): void {
  db.prepare(
    `INSERT INTO characters (id, account_id, name, data, updated_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET data = excluded.data, name = excluded.name, updated_at = excluded.updated_at`
  ).run(sheet.id, sheet.accountId, sheet.name, JSON.stringify(sheet), Date.now());
  db.prepare("UPDATE sessions SET character_id = ? WHERE account_id = ?").run(sheet.id, sheet.accountId);
}

export function loadCharacter(id: string): CharacterSheet | null {
  const row = db.prepare("SELECT data FROM characters WHERE id = ?").get(id) as { data: string } | undefined;
  return row ? (JSON.parse(row.data) as CharacterSheet) : null;
}

export function listCharacters(accountId: string): Array<{ id: string; name: string }> {
  return db
    .prepare("SELECT id, name FROM characters WHERE account_id = ? ORDER BY updated_at DESC")
    .all(accountId) as Array<{ id: string; name: string }>;
}

export function loadCharacterForAccount(accountId: string): CharacterSheet | null {
  const row = db
    .prepare("SELECT data FROM characters WHERE account_id = ? ORDER BY updated_at DESC LIMIT 1")
    .get(accountId) as { data: string } | undefined;
  return row ? (JSON.parse(row.data) as CharacterSheet) : null;
}
