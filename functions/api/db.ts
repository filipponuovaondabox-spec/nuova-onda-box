// ─── Nuova Onda Box · API condivisa (Cloudflare Pages Function + D1) ────────
// Endpoint: GET /api/db  → restituisce l'intero archivio condiviso
//           PUT /api/db  → salva l'intero archivio condiviso
// Il database è Cloudflare D1 (SQLite serverless), collegato con il binding "DB"
// (vedi wrangler.toml → [[d1_databases]]). Le tabelle vengono create
// automaticamente alla prima richiesta e viene seedato l'utente admin
// predefinito (username "admin", password "nuovaonda2024").
//
// Ogni collezione (clienti, articoli, entrate, ordini, spedizioni,
// segnalazioni, utenti) è una tabella D1: una riga per record, con il
// contenuto JSON nella colonna `data`. Le scritture avvengono in batch
// atomico (db.batch), quindi un salvataggio è tutto-o-niente.

export interface Env {
  DB: D1Database;
}

// ─── Tipi minimi del runtime Cloudflare (evitano dipendenze extra) ──────────
interface D1Result<T = Record<string, unknown>> {
  results: T[];
  success: boolean;
}
interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(column?: string): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run(): Promise<unknown>;
}
interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<unknown[]>;
}
interface PagesFunctionContext<E> {
  request: Request;
  env: E;
}

// ─── Schema ─────────────────────────────────────────────────────────────────

const COLLECTIONS = [
  "clienti",
  "articoli",
  "entrate",
  "ordini",
  "spedizioni",
  "segnalazioni",
  "utenti",
] as const;

type Collection = (typeof COLLECTIONS)[number];

const DEFAULT_ADMIN = {
  id: "ut_admin",
  username: "admin",
  password: "nuovaonda2024",
  ruolo: "admin",
  attivo: true,
};

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

// Crea le tabelle se mancano e seeda l'admin predefinito.
// Eseguita una sola volta per istanza del worker (flag in memoria), con
// verifica del seed a ogni cold start: è idempotente e sicura.
let schemaReady = false;

async function ensureSchema(db: D1Database): Promise<void> {
  if (schemaReady) return;
  const statements: D1PreparedStatement[] = COLLECTIONS.map((c) =>
    db.prepare(
      `CREATE TABLE IF NOT EXISTS ${c} (id TEXT PRIMARY KEY, data TEXT NOT NULL)`
    )
  );
  await db.batch(statements);

  // Seed: utente admin predefinito, solo se la tabella utenti è vuota
  const row = await db
    .prepare("SELECT COUNT(*) AS n FROM utenti")
    .first<{ n: number }>();
  if (!row || Number(row.n) === 0) {
    await db
      .prepare("INSERT OR IGNORE INTO utenti (id, data) VALUES (?, ?)")
      .bind(DEFAULT_ADMIN.id, JSON.stringify(DEFAULT_ADMIN))
      .run();
  }
  schemaReady = true;
}

async function readCollection(
  db: D1Database,
  name: Collection
): Promise<unknown[]> {
  const res = await db
    .prepare(`SELECT data FROM ${name}`)
    .all<{ data: string }>();
  const out: unknown[] = [];
  for (const r of res.results ?? []) {
    try {
      out.push(JSON.parse(r.data));
    } catch {
      // riga corrotta: la ignoriamo senza bloccare l'intero archivio
    }
  }
  return out;
}

async function readDb(db: D1Database) {
  const result: Record<Collection, unknown[]> = {
    clienti: [],
    articoli: [],
    entrate: [],
    ordini: [],
    spedizioni: [],
    segnalazioni: [],
    utenti: [],
  };
  for (const c of COLLECTIONS) {
    result[c] = await readCollection(db, c);
  }
  return result;
}

// ─── Handlers ───────────────────────────────────────────────────────────────

export async function onRequestGet(
  context: PagesFunctionContext<Env>
): Promise<Response> {
  try {
    await ensureSchema(context.env.DB);
    const db = await readDb(context.env.DB);
    return jsonResponse({ ok: true, db, serverTime: new Date().toISOString() });
  } catch (err) {
    return jsonResponse(
      { ok: false, error: "Errore lettura database", detail: String(err) },
      500
    );
  }
}

export async function onRequestPut(
  context: PagesFunctionContext<Env>
): Promise<Response> {
  try {
    let body: { db?: Record<string, unknown> };
    try {
      body = (await context.request.json()) as { db?: Record<string, unknown> };
    } catch {
      return jsonResponse({ ok: false, error: "Payload non valido" }, 400);
    }
    const payload = body?.db;
    if (!payload || typeof payload !== "object") {
      return jsonResponse({ ok: false, error: "Payload non valido" }, 400);
    }

    await ensureSchema(context.env.DB);
    const d1 = context.env.DB;

    // Validazione minima della forma + ricostruzione atomica delle tabelle.
    // db.batch() è transazionale: o si salva tutto o non si salva niente.
    const statements: D1PreparedStatement[] = [];
    for (const c of COLLECTIONS) {
      statements.push(d1.prepare(`DELETE FROM ${c}`));
      const rows = Array.isArray(payload[c]) ? (payload[c] as unknown[]) : [];
      for (const record of rows) {
        const rec = record as { id?: unknown };
        const id =
          typeof rec?.id === "string" && rec.id
            ? rec.id
            : crypto.randomUUID();
        statements.push(
          d1
            .prepare(`INSERT INTO ${c} (id, data) VALUES (?, ?)`)
            .bind(id, JSON.stringify(record))
        );
      }
    }
    await d1.batch(statements);

    return jsonResponse({ ok: true, savedAt: new Date().toISOString() });
  } catch (err) {
    return jsonResponse(
      { ok: false, error: "Errore salvataggio database", detail: String(err) },
      500
    );
  }
}
