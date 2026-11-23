"use client";

// ─── Nuova Onda Box · bridge client verso l'API condivisa ───────────────────
// Piccolo wrapper tipizzato attorno agli endpoint Cloudflare Pages Functions:
//   GET /api/db  → scarica l'intero archivio condiviso (da Cloudflare D1)
//   PUT /api/db  → salva l'intero archivio condiviso (batch atomico su D1)
// Ogni risposta include la `version` dell'archivio: il server la incrementa a
// ogni salvataggio e rifiuta (409) i salvataggi basati su versioni vecchie.
// Lo store Zustand (lib/store.ts) usa queste funzioni per la sincronizzazione
// cloud; in assenza di rete l'app continua a funzionare sulla cache locale.

import type { DB } from "./model";

export interface DbGetResponse {
  ok: boolean;
  db?: DB;
  version?: number;
  serverTime?: string;
  error?: string;
}

export interface DbPutResponse {
  ok: boolean;
  savedAt?: string;
  version?: number;
  error?: string;
  merged?: boolean;
  db?: DB;
}

/** Scarica archivio condiviso e versione corrente dal server (Cloudflare D1). */
export async function fetchDb(): Promise<{ db: DB; version: number }> {
  const res = await fetch("/api/db", { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as DbGetResponse;
  if (!json?.ok || !json.db) throw new Error("Risposta non valida");
  return { db: json.db, version: typeof json.version === "number" ? json.version : 0 };
}

export class VersionConflictError extends Error {
  constructor(public serverVersion: number) {
    super("version_conflict");
  }
}

/**
 * Salva l'archivio condiviso sul server (scrittura atomica tutto-o-niente).
 * `baseVersion` è la versione su cui si basa il salvataggio: se il server è
 * più avanti risponde 409 e viene lanciato VersionConflictError.
 */
export async function saveDb(db: DB, baseVersion: number | null): Promise<{ savedAt: string; version: number; mergedDb?: DB }> {
  const res = await fetch("/api/db", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ db, baseVersion }),
  });
  const json = (await res.json().catch(() => null)) as DbPutResponse | null;
  if (res.status === 409 || json?.error === "version_conflict") {
    throw new VersionConflictError(typeof json?.version === "number" ? json.version : -1);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (!json?.ok) throw new Error(json?.error || "Salvataggio fallito");
  return {
    savedAt: json.savedAt ?? new Date().toISOString(),
    version: typeof json.version === "number" ? json.version : 0,
    mergedDb: json.merged && json.db ? json.db : undefined,
  };
}
