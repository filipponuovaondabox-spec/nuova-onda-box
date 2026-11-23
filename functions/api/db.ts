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
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

// Preflight CORS
export function onRequestOptions(): Response {
  return new Response(null, { status: 204, headers: JSON_HEADERS });
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

  // Tabella meta: versione dell'archivio, incrementata a ogni salvataggio
  await db
    .prepare("CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)")
    .run();
  await db
    .prepare("INSERT OR IGNORE INTO meta (key, value) VALUES ('version', '0')")
    .run();

  // Riparazione auto-curante dello schema: se la tabella meta esisteva già
  // con uno schema vecchio (senza la colonna 'version' usata da versioni
  // precedenti dell'API), proviamo a leggerla e, in caso di errore, la
  // ricreiamo con lo schema corretto. Mai un 500 per problemi di schema.
  try {
    await db.prepare("SELECT value FROM meta WHERE key = 'version'").first();
  } catch {
    try {
      await db.prepare("DROP TABLE IF EXISTS meta").run();
      await db
        .prepare("CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)")
        .run();
      await db
        .prepare("INSERT OR IGNORE INTO meta (key, value) VALUES ('version', '0')")
        .run();
    } catch {
      // ignoriamo: le letture/scritture successive hanno i propri fallback
    }
  }

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

async function readVersion(db: D1Database): Promise<number> {
  try {
    const row = await db
      .prepare("SELECT value FROM meta WHERE key = 'version'")
      .first<{ value: string }>();
    return row ? Number(row.value) || 0 : 0;
  } catch {
    return 0;
  }
}

// Merge lato server: unione per id delle collezioni; a parità di id vince il
// record in arrivo (più recente). Nessuna modifica va persa.
function mergeById(serverRows: unknown[], incomingRows: unknown[]): unknown[] {
  const map = new Map<string, unknown>();
  for (const r of serverRows) {
    const id = (r as { id?: unknown })?.id;
    map.set(typeof id === "string" && id ? id : crypto.randomUUID(), r);
  }
  for (const r of incomingRows) {
    const id = (r as { id?: unknown })?.id;
    map.set(typeof id === "string" && id ? id : crypto.randomUUID(), r);
  }
  return [...map.values()];
}

// ─── Handlers ───────────────────────────────────────────────────────────────

export async function onRequestGet(
  context: PagesFunctionContext<Env>
): Promise<Response> {
  try {
    await ensureSchema(context.env.DB);
    const db = await readDb(context.env.DB);
    const version = await readVersion(context.env.DB);
    return jsonResponse({ ok: true, db, version, serverTime: new Date().toISOString() });
  } catch (err) {
    return jsonResponse(
      { ok: false, error: "Errore lettura database", detail: String(err) },
      500
    );
  }
}

// Alias POST: stesso comportamento di PUT (alcuni client/proxy usano POST)
export async function onRequestPost(
  context: PagesFunctionContext<Env>
): Promise<Response> {
  return onRequestPut(context);
}

export async function onRequestPut(
  context: PagesFunctionContext<Env>
): Promise<Response> {
  try {
    let body: { db?: Record<string, unknown>; baseVersion?: unknown };
    try {
      body = (await context.request.json()) as { db?: Record<string, unknown>; baseVersion?: unknown };
    } catch {
      return jsonResponse({ ok: false, error: "Payload non valido" }, 400);
    }
    const payload = body?.db;
    if (!payload || typeof payload !== "object") {
      return jsonResponse({ ok: false, error: "Payload non valido" }, 400);
    }

    await ensureSchema(context.env.DB);
    const d1 = context.env.DB;

    // Controllo di versione: il client dichiara su quale versione si basa.
    // Se il server è più avanti, il salvataggio viene rifiutato (409): il
    // client scaricherà i dati remoti, farà il merge e riproverà.
    const currentVersion = await readVersion(d1);
    const baseVersion =
      typeof body.baseVersion === "number" && Number.isFinite(body.baseVersion)
        ? body.baseVersion
        : null;

    // Conflitto di versione: il client si basa su una versione più vecchia.
    // Invece di rifiutare, facciamo il MERGE lato server (unione per id,
    // vince il record in arrivo) e salviamo il risultato: nessuna modifica
    // va persa e il client adotta lo stato fuso restituito nella risposta.
    let mergedPayload: Record<string, unknown> | null = null;
    if (baseVersion !== null && baseVersion < currentVersion) {
      const serverDb = await readDb(d1);
      mergedPayload = {};
      for (const c of COLLECTIONS) {
        const incoming = Array.isArray(payload[c]) ? (payload[c] as unknown[]) : [];
        mergedPayload[c] = mergeById(serverDb[c], incoming);
      }
    }
    const effectivePayload = (mergedPayload ?? payload) as Record<string, unknown>;
    const newVersion = currentVersion + 1;

    // Validazione minima della forma + ricostruzione atomica delle tabelle.
    // db.batch() è transazionale: o si salva tutto o non si salva niente.
    const statements: D1PreparedStatement[] = [];
    for (const c of COLLECTIONS) {
      statements.push(d1.prepare(`DELETE FROM ${c}`));
      const rows = Array.isArray(effectivePayload[c]) ? (effectivePayload[c] as unknown[]) : [];
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
    statements.push(
      d1
        .prepare("INSERT INTO meta (key, value) VALUES ('version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
        .bind(String(newVersion))
    );
    await d1.batch(statements);

    return jsonResponse({
      ok: true,
      savedAt: new Date().toISOString(),
      version: newVersion,
      merged: mergedPayload !== null,
      ...(mergedPayload ? { db: mergedPayload } : {}),
    });
  } catch (err) {
    return jsonResponse(
      { ok: false, error: "Errore salvataggio database", detail: String(err) },
      500
    );
  }
}
