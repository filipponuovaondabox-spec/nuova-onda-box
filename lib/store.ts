"use client";

import { create } from "zustand";
import {
  DB, Cliente, Entrata, Articolo, Ordine, Spedizione, Registrazione,
  Segnalazione, StatoSegnalazione, Utente,
  ordineImballati, speditoPerOrdine,
} from "./model";

const EMPTY_DB: DB = {
  clienti: [],
  articoli: [],
  entrate: [],
  ordini: [],
  spedizioni: [],
  segnalazioni: [],
  utenti: [],
};

// Admin predefinito: creato al primo avvio, modificabile dalla sezione Utenti
export const DEFAULT_ADMIN: Utente = {
  id: "ut_admin",
  username: "admin",
  password: "nuovaonda2024",
  ruolo: "admin",
  attivo: true,
};

// ─── Stato di sincronizzazione cloud ────────────────────────────────────────

// "local" = modalità localStorage attiva (backend Cloudflare non rilevato):
// stato voluto in anteprima/locale, non un errore. "offline" = il backend
// cloud era attivo ma è temporaneamente irraggiungibile.
export type SyncStatus = "synced" | "syncing" | "local" | "offline" | "loading";

interface SyncStore {
  status: SyncStatus;
  lastSync: string | null;
  setStatus: (s: SyncStatus) => void;
  setLastSync: (iso: string) => void;
}

export const useSync = create<SyncStore>((set) => ({
  status: "loading",
  lastSync: null,
  setStatus: (status) => set({ status }),
  setLastSync: (lastSync) => set({ lastSync }),
}));

// ─── Data store (condiviso via server) ──────────────────────────────────────

interface DataStore extends DB {
  hydrated: boolean;
  addCliente: (c: Cliente) => void;
  updateCliente: (c: Cliente) => void;
  deleteCliente: (id: string) => void;
  addEntrata: (e: Entrata) => void;
  deleteEntrata: (id: string) => void;
  addArticolo: (a: Articolo) => void;
  updateArticolo: (a: Articolo) => void;
  deleteArticolo: (id: string) => void;
  addOrdine: (o: Ordine) => void;
  deleteOrdine: (id: string) => void;
  iniziaAvviamento: (ordineId: string) => void;
  terminaAvviamento: (ordineId: string) => void;
  avviaOrdine: (ordineId: string) => void;
  terminaOrdine: (ordineId: string, r: Registrazione) => void;
  addRegistrazione: (ordineId: string, r: Registrazione) => void;
  concludiOrdine: (ordineId: string) => void;
  addSpedizione: (s: Spedizione) => void;
  deleteSpedizione: (id: string) => void;
  addSegnalazione: (s: Segnalazione) => void;
  setStatoSegnalazione: (id: string, stato: StatoSegnalazione, aggiornataDa: string) => void;
  deleteSegnalazione: (id: string) => void;
  addUtente: (u: Utente) => void;
  updateUtente: (u: Utente) => void;
  deleteUtente: (id: string) => void;
  resetDati: () => void;
}

function pickDb(s: DataStore): DB {
  return {
    clienti: s.clienti,
    articoli: s.articoli,
    entrate: s.entrate,
    ordini: s.ordini,
    spedizioni: s.spedizioni,
    segnalazioni: s.segnalazioni,
    utenti: s.utenti,
  };
}

export const useData = create<DataStore>()((set, get) => ({
  ...EMPTY_DB,
  hydrated: false,

  addCliente: (c) => set((s) => ({ clienti: [c, ...s.clienti] })),

  updateCliente: (c) =>
    set((s) => ({
      clienti: s.clienti.map((x) => (x.id === c.id ? c : x)),
    })),

  deleteCliente: (id) =>
    set((s) => ({ clienti: s.clienti.filter((c) => c.id !== id) })),

  addEntrata: (e) => set((s) => ({ entrate: [e, ...s.entrate] })),

  deleteEntrata: (id) =>
    set((s) => ({ entrate: s.entrate.filter((e) => e.id !== id) })),

  addArticolo: (a) => set((s) => ({ articoli: [a, ...s.articoli] })),

  updateArticolo: (a) =>
    set((s) => ({
      articoli: s.articoli.map((x) => (x.id === a.id ? a : x)),
    })),

  deleteArticolo: (id) =>
    set((s) => ({ articoli: s.articoli.filter((a) => a.id !== id) })),

  addOrdine: (o) => set((s) => ({ ordini: [o, ...s.ordini] })),

  deleteOrdine: (id) =>
    set((s) => ({ ordini: s.ordini.filter((o) => o.id !== id) })),

  iniziaAvviamento: (ordineId) =>
    set((s) => ({
      ordini: s.ordini.map((o) =>
        o.id === ordineId && o.stato === "da_produrre" && !o.avviamentoIniziatoIl
          ? { ...o, avviamentoIniziatoIl: new Date().toISOString() }
          : o
      ),
    })),

  terminaAvviamento: (ordineId) =>
    set((s) => ({
      ordini: s.ordini.map((o) =>
        o.id === ordineId && o.avviamentoIniziatoIl && !o.avviamentoCompletatoIl
          ? { ...o, avviamentoCompletatoIl: new Date().toISOString() }
          : o
      ),
    })),

  avviaOrdine: (ordineId) =>
    set((s) => ({
      ordini: s.ordini.map((o) =>
        o.id === ordineId && o.stato === "da_produrre" && o.avviamentoCompletatoIl
          ? { ...o, stato: "in_produzione", iniziatoIl: new Date().toISOString() }
          : o
      ),
    })),

  terminaOrdine: (ordineId, r) =>
    set((s) => ({
      ordini: s.ordini.map((o) =>
        o.id === ordineId && o.stato === "in_produzione"
          ? {
              ...o,
              stato: "completato",
              completatoIl: new Date().toISOString(),
              registrazioni: [...o.registrazioni, r],
            }
          : o
      ),
    })),

  addRegistrazione: (ordineId, r) =>
    set((s) => ({
      ordini: s.ordini.map((o) =>
        o.id === ordineId
          ? {
              ...o,
              stato: o.stato === "da_produrre" ? "in_produzione" : o.stato,
              registrazioni: [...o.registrazioni, r],
            }
          : o
      ),
    })),

  concludiOrdine: (ordineId) =>
    set((s) => ({
      ordini: s.ordini.map((o) =>
        o.id === ordineId && o.stato !== "spedito"
          ? { ...o, stato: "completato" }
          : o
      ),
    })),

  addSpedizione: (sp) => {
    const s = get();
    const ordine = s.ordini.find((o) => o.id === sp.ordineId);
    set((st) => ({
      spedizioni: [sp, ...st.spedizioni],
      ordini: st.ordini.map((o) => {
        if (o.id !== sp.ordineId) return o;
        const totSpedito = speditoPerOrdine(st.spedizioni, o.id) + sp.pezzi;
        return totSpedito >= ordineImballati(o) && ordineImballati(o) > 0
          ? { ...o, stato: "spedito" }
          : o;
      }),
    }));
    return ordine;
  },

  deleteSpedizione: (id) =>
    set((s) => ({ spedizioni: s.spedizioni.filter((x) => x.id !== id) })),

  addSegnalazione: (sg) =>
    set((s) => ({ segnalazioni: [sg, ...s.segnalazioni] })),

  setStatoSegnalazione: (id, stato, aggiornataDa) =>
    set((s) => ({
      segnalazioni: s.segnalazioni.map((x) =>
        x.id === id
          ? { ...x, stato, aggiornataDa, aggiornataIl: new Date().toISOString() }
          : x
      ),
    })),

  deleteSegnalazione: (id) =>
    set((s) => ({ segnalazioni: s.segnalazioni.filter((x) => x.id !== id) })),

  addUtente: (u) => set((s) => ({ utenti: [u, ...s.utenti] })),

  updateUtente: (u) =>
    set((s) => ({ utenti: s.utenti.map((x) => (x.id === u.id ? u : x)) })),

  deleteUtente: (id) =>
    set((s) => ({ utenti: s.utenti.filter((x) => x.id !== id) })),

  resetDati: () => set({ ...EMPTY_DB, utenti: [{ ...DEFAULT_ADMIN }] }),
}));

// ─── Motore dati dual-mode: Cloudflare (API + D1) ⇄ localStorage ────────────
// All'avvio l'app prova a raggiungere l'API condivisa (/api/db, Cloudflare
// Pages Functions + D1). Se l'API risponde, tutti i dati vivono sul database
// condiviso (polling quasi in tempo reale tra i dispositivi). Se l'API non è
// disponibile — anteprima locale, rete assente, binding D1 mancante — l'app
// passa automaticamente e silenziosamente alla modalità locale: tutti i dati
// (utenti, clienti, articoli, entrate, ordini, spedizioni, segnalazioni)
// vivono in localStorage e l'app resta pienamente funzionale. Se l'API torna
// raggiungibile durante la sessione, la modalità cloud viene ripristinata.

// Polling ridotto a 30s (solo a scheda visibile) per non esaurire la quota
// gratuita giornaliera di richieste Cloudflare; salvataggio con debounce ~2s.
const POLL_MS = 30000;
const SAVE_DEBOUNCE_MS = 2000;
// Backoff progressivo dei tentativi di salvataggio falliti: 10s → 30s → 60s
const RETRY_DELAYS_MS = [10000, 30000, 60000];
const CACHE_KEY = "nuova-onda-box-cache-v1";

let started = false;
let applyingRemote = false;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryAttempt = 0;
let saveInFlight = false;
let pendingSave = false;
// Modalità corrente: true = backend Cloudflare attivo, false = solo localStorage
let cloudMode = false;
// Flag "modifiche non sincronizzate": true finché lo stato locale non è stato
// salvato con successo sul server. Finché è true gli stati in arrivo dal
// polling vengono IGNORATI (mai sovrascrivere/scartare le modifiche locali).
let hasUnsyncedChanges = false;

function snapshot(): string {
  return JSON.stringify(pickDb(useData.getState()));
}

let lastSavedSnapshot = "";

function loadLocalCache(): DB | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return normalizeDb(parsed);
  } catch {
    return null;
  }
}

// Completa il DB con le collezioni mancanti e garantisce l'admin predefinito
function normalizeDb(parsed: Partial<DB>): DB {
  const db = { ...EMPTY_DB, ...parsed };
  if (!Array.isArray(db.utenti) || db.utenti.length === 0) {
    db.utenti = [{ ...DEFAULT_ADMIN }];
  }
  if (!Array.isArray(db.segnalazioni)) db.segnalazioni = [];
  return db;
}

function saveLocalCache() {
  try {
    localStorage.setItem(CACHE_KEY, snapshot());
  } catch {
    // quota piena o storage non disponibile: la sincronizzazione cloud resta attiva
  }
}

async function pullFromServer(): Promise<boolean> {
  const { setStatus, setLastSync } = useSync.getState();
  try {
    const res = await fetch("/api/db", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (!json?.ok || !json.db) throw new Error("Risposta non valida");

    // API raggiungibile → modalità cloud (Cloudflare Pages Functions + D1)
    cloudMode = true;

    const remoteDb = normalizeDb(json.db);
    const remote = JSON.stringify(remoteDb);
    const local = snapshot();

    if (remote !== local) {
      // REGOLA FONDAMENTALE — mai perdere dati locali: lo stato del server
      // viene applicato SOLO se non ci sono modifiche locali non sincronizzate.
      // Finché hasUnsyncedChanges è true, gli stati in arrivo dal polling
      // (anche se più vecchi o diversi) vengono ignorati: la copia locale ha
      // la precedenza e verrà inviata al server dal prossimo push.
      if (!hasUnsyncedChanges) {
        applyingRemote = true;
        useData.setState({ ...remoteDb, hydrated: true });
        applyingRemote = false;
        lastSavedSnapshot = remote;
        saveLocalCache();
      }
    } else {
      lastSavedSnapshot = local;
      if (!useData.getState().hydrated) {
        applyingRemote = true;
        useData.setState({ hydrated: true });
        applyingRemote = false;
      }
    }
    setLastSync(new Date().toISOString());
    setStatus(saveInFlight || pendingSave || hasUnsyncedChanges ? "syncing" : "synced");
    return true;
  } catch {
    // Richiesta fallita (errore di rete o risposta non-200): NON si tocca lo
    // stato locale e NON si scartano le modifiche. Se il cloud era attivo si
    // segnala "offline"; altrimenti resta la modalità locale (anteprima).
    const wasCloud = cloudMode;
    cloudMode = false;
    setStatus(wasCloud || hasUnsyncedChanges ? "offline" : "local");
    if (!useData.getState().hydrated) {
      applyingRemote = true;
      useData.setState({ hydrated: true });
      applyingRemote = false;
    }
    return false;
  }
}

async function pushToServer() {
  if (saveInFlight) {
    pendingSave = true;
    return;
  }
  const { setStatus, setLastSync } = useSync.getState();
  saveInFlight = true;
  setStatus("syncing");
  try {
    const db = pickDb(useData.getState());
    const snap = JSON.stringify(db);
    const res = await fetch("/api/db", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ db }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json().catch(() => null);
    if (!json?.ok) throw new Error("Salvataggio rifiutato dal server");
    // Scrittura riuscita → il backend Cloudflare è attivo e non ci sono più
    // modifiche locali pendenti: da ora il polling può di nuovo applicare gli
    // stati in arrivo dal server.
    cloudMode = true;
    hasUnsyncedChanges = false;
    retryAttempt = 0;
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
    lastSavedSnapshot = snap;
    saveLocalCache();
    setLastSync(new Date().toISOString());
    setStatus("synced");
  } catch {
    // Salvataggio fallito (rete assente o risposta non-200): le modifiche
    // restano in locale (localStorage) e il flag resta attivo. Riprova con
    // backoff progressivo: 10s → 30s → 60s (poi sempre 60s).
    const wasCloud = cloudMode;
    cloudMode = false;
    setStatus(wasCloud || hasUnsyncedChanges ? "offline" : "local");
    if (hasUnsyncedChanges) scheduleRetry();
  } finally {
    saveInFlight = false;
    if (pendingSave) {
      pendingSave = false;
      scheduleSave(0);
    }
  }
}

function scheduleSave(delay = SAVE_DEBOUNCE_MS) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    pushToServer();
  }, delay);
}

// Riprova il salvataggio dopo un fallimento con backoff progressivo
// (10s, poi 30s, poi 60s; oltre i 60s resta fisso a 60s).
function scheduleRetry() {
  if (retryTimer) clearTimeout(retryTimer);
  const delay = RETRY_DELAYS_MS[Math.min(retryAttempt, RETRY_DELAYS_MS.length - 1)];
  retryAttempt += 1;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    if (hasUnsyncedChanges && !saveInFlight) pushToServer();
  }, delay);
}

export function startCloudSync() {
  if (started || typeof window === "undefined") return;
  started = true;

  // 1) Idrata subito da localStorage: è la fonte dati della modalità locale e
  //    la cache di avvio per la modalità cloud. Garantisce inoltre l'utente
  //    admin predefinito (admin / nuovaonda2024) se non esiste ancora.
  const cached = loadLocalCache() ?? normalizeDb({});
  applyingRemote = true;
  useData.setState({ ...cached, hydrated: true });
  applyingRemote = false;
  lastSavedSnapshot = JSON.stringify(cached);
  saveLocalCache();

  // 2) Rilevamento automatico dell'ambiente: prova l'API condivisa
  //    (Cloudflare Pages Functions + D1). Se risponde → modalità cloud e i
  //    dati remoti vengono applicati (non ci sono ancora modifiche pendenti);
  //    se fallisce → modalità localStorage, senza errori visibili per l'utente.
  pullFromServer();

  // 3) Polling ogni 30s e SOLO a scheda visibile: in modalità cloud porta gli
  //    aggiornamenti dagli altri dispositivi; in modalità locale riprova
  //    l'API e, se torna raggiungibile, ripristina la modalità cloud.
  setInterval(() => {
    if (document.visibilityState !== "visible") return;
    if (hasUnsyncedChanges) {
      // Ci sono modifiche locali non salvate: il polling non serve (verrebbe
      // ignorato), meglio riprovare direttamente il salvataggio.
      if (!saveInFlight && !saveTimer && !retryTimer) pushToServer();
      return;
    }
    pullFromServer();
  }, POLL_MS);

  // 4) Quando l'app torna in primo piano (tipico su telefono): se ci sono
  //    modifiche pendenti riprova subito il salvataggio, altrimenti aggiorna.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    if (hasUnsyncedChanges) {
      if (!saveInFlight) pushToServer();
    } else {
      pullFromServer();
    }
  });
  window.addEventListener("focus", () => {
    if (hasUnsyncedChanges) {
      if (!saveInFlight) pushToServer();
    } else {
      pullFromServer();
    }
  });
  // Al ritorno della connessione: invia subito le modifiche fatte offline
  window.addEventListener("online", () => {
    if (hasUnsyncedChanges || snapshot() !== lastSavedSnapshot) pushToServer();
    else pullFromServer();
  });

  // 5) A ogni modifica locale: salva subito in localStorage (modalità locale
  //    e cache offline), marca il flag "modifiche non sincronizzate" e
  //    pianifica il push al server con debounce di ~2 secondi.
  useData.subscribe(() => {
    if (applyingRemote) return;
    hasUnsyncedChanges = true;
    saveLocalCache();
    if (cloudMode) {
      useSync.getState().setStatus("syncing");
      scheduleSave();
    }
  });
}

// ─── Toast ──────────────────────────────────────────────────────────────────

export interface Toast {
  id: number;
  messaggio: string;
  tipo: "successo" | "errore" | "info";
}

interface ToastStore {
  toasts: Toast[];
  push: (messaggio: string, tipo?: Toast["tipo"]) => void;
  dismiss: (id: number) => void;
}

let toastId = 0;

export const useToasts = create<ToastStore>((set) => ({
  toasts: [],
  push: (messaggio, tipo = "successo") => {
    const id = ++toastId;
    set((s) => ({ toasts: [...s.toasts, { id, messaggio, tipo }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 3500);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

// ─── Autenticazione (sessione sul dispositivo) ──────────────────────────────
// La sessione resta attiva sul dispositivo (localStorage): il login non viene
// richiesto a ogni apertura. Logout disponibile dal menu.

const SESSION_KEY = "nuova-onda-box-sessione-v1";

interface AuthStore {
  userId: string | null;
  ready: boolean; // true dopo aver letto la sessione dal dispositivo
  login: (userId: string) => void;
  logout: () => void;
}

export const useAuth = create<AuthStore>((set) => ({
  userId: null,
  ready: false,
  login: (userId) => {
    try {
      localStorage.setItem(SESSION_KEY, userId);
    } catch {
      // storage non disponibile: la sessione vale solo per questa apertura
    }
    set({ userId });
  },
  logout: () => {
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {
      // ignora
    }
    set({ userId: null });
  },
}));

// Da chiamare una volta all'avvio (client): ripristina la sessione salvata
export function initAuth() {
  if (useAuth.getState().ready || typeof window === "undefined") return;
  let userId: string | null = null;
  try {
    userId = localStorage.getItem(SESSION_KEY);
  } catch {
    userId = null;
  }
  useAuth.setState({ userId, ready: true });
}

// Utente attualmente autenticato (null se la sessione non è più valida)
export function utenteCorrente(): Utente | null {
  const { userId } = useAuth.getState();
  if (!userId) return null;
  const u = useData.getState().utenti.find((x) => x.id === userId);
  return u && u.attivo ? u : null;
}

// Nome dell'operatore da registrare sulle operazioni (entrate, produzioni, …)
export function operatoreCorrente(): string {
  return utenteCorrente()?.username ?? "";
}

// Verifica credenziali: restituisce l'utente se username/password sono validi
export function verificaCredenziali(username: string, password: string): Utente | null {
  const u = useData
    .getState()
    .utenti.find(
      (x) => x.username.toLowerCase() === username.trim().toLowerCase() && x.attivo
    );
  return u && u.password === password ? u : null;
}
