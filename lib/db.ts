"use client";

// ─── Nuova Onda Box · bridge client verso l'API condivisa ───────────────────
// Piccolo wrapper tipizzato attorno agli endpoint Cloudflare Pages Functions:
//   GET /api/db  → scarica l'intero archivio condiviso (da Cloudflare D1)
//   PUT /api/db  → salva l'intero archivio condiviso (batch atomico su D1)
// Lo store Zustand (lib/store.ts) usa queste funzioni per la sincronizzazione
// cloud; in assenza di rete l'app continua a funzionare sulla cache locale.

import type { DB } from "./model";

export interface DbGetResponse {
  ok: boolean;
  db?: DB;
  serverTime?: string;
  error?: string;
}

export interface DbPutResponse {
  ok: boolean;
  savedAt?: string;
  error?: string;
}

/** Scarica l'archivio condiviso dal server (Cloudflare D1). */
export async function fetchDb(): Promise<DB> {
  const res = await fetch("/api/db", { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as DbGetResponse;
  if (!json?.ok || !json.db) throw new Error("Risposta non valida");
  return json.db;
}

/** Salva l'archivio condiviso sul server (scrittura atomica tutto-o-niente). */
export async function saveDb(db: DB): Promise<string> {
  const res = await fetch("/api/db", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ db }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as DbPutResponse;
  if (!json?.ok) throw new Error(json?.error || "Salvataggio fallito");
  return json.savedAt ?? new Date().toISOString();
}
