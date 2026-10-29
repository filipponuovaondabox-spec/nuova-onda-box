// ─── Nuova Onda Box · modello dati ──────────────────────────────────────────

export type OrderStatus = "da_produrre" | "in_produzione" | "completato" | "spedito";

export interface Cliente {
  id: string;
  nome: string; // ragione sociale
  piva: string; // partita IVA
  telefono: string;
  email: string;
  contatto?: string; // legacy: telefono / email
  indirizzo: string; // indirizzo di consegna
  note: string;
}

export interface Articolo {
  id: string;
  codice: string;
  clienteId: string;
  clienteLibero?: string; // se il cliente non è in anagrafica
  dimL: number; // mm
  dimP: number; // mm
  dimH: number; // mm
  formatoCartone: string; // es. "1200x800 mm"
  tipoCartone: string;
  colore: string;
  stampa: string;
  numeroImpianto: string; // numero impianto di stampa
  bozzaNome?: string; // nome file della bozza di stampa
  bozzaData?: string; // bozza di stampa (base64 data URL, immagine o PDF)
  qtaPerPacco: number;
  qtaPerPedana: number; // scatole/fogli per pedana
  tipoPedana: string;
  note: string;
  creataIl: string; // ISO date
}

export interface Entrata {
  id: string;
  data: string; // ISO date
  clienteId: string;
  clienteLibero?: string;
  formato: string; // es. "1200×2000"
  tipoCartone: string; // tipologia cartone (Microonda, Onda B, ...)
  quantita: number; // fogli
  articoloId: string; // riferimento scheda articolo
  fornitore?: string; // fornitore del cartone
  note: string;
  operatore?: string; // utente che ha registrato l'operazione
}

export interface Pedana {
  id: string;
  quantita: number;
}

export interface Registrazione {
  id: string;
  data: string;
  prodotti: number; // fogli prodotti
  scartati: number; // fogli scartati
  scatoleScartate: number; // scatole scartate
  pedane: Pedana[];
  operatore?: string; // utente che ha registrato l'operazione
}

export interface Ordine {
  id: string;
  codice: string;
  articoloId: string;
  entrataId?: string;
  clienteId: string;
  clienteLibero?: string;
  qtaRichiesta: number; // fogli da produrre
  scadenza: string; // ISO date
  stato: OrderStatus;
  noteArticolo?: string; // copia delle note della scheda articolo al momento della creazione
  registrazioni: Registrazione[];
  avviamentoIniziatoIl?: string; // ISO datetime inizio avviamento (setup)
  avviamentoCompletatoIl?: string; // ISO datetime fine avviamento (setup)
  iniziatoIl?: string; // ISO datetime inizio produzione
  completatoIl?: string; // ISO datetime fine produzione
  creatoIl: string;
}

export interface Spedizione {
  id: string;
  ordineId: string;
  articoloId: string;
  clienteId: string;
  clienteLibero?: string;
  data: string;
  numPedane: number;
  pezzi: number;
  ddt: string;
  trasporto: string; // trasporto a carico di: Mittente / Destinatario / Vettore
  note: string;
  operatore?: string; // utente che ha registrato l'operazione
}

// ─── Segnalazioni "Da ordinare" ─────────────────────────────────────────────

export type StatoSegnalazione = "nuova" | "ordinato" | "evaso";

export interface Segnalazione {
  id: string;
  materiale: string; // es. colore, film estensibile, reggetta per pedane, colla
  quantita?: string; // opzionale
  note?: string; // opzionale
  operatore: string; // utente che ha inviato la segnalazione
  creataIl: string; // ISO datetime
  stato: StatoSegnalazione;
  aggiornataDa?: string; // admin che ha cambiato lo stato
  aggiornataIl?: string; // ISO datetime
}

// ─── Utenti e ruoli ─────────────────────────────────────────────────────────

export type Ruolo = "admin" | "operatore";

export interface Utente {
  id: string;
  username: string;
  password: string;
  ruolo: Ruolo;
  attivo: boolean;
}

export interface DB {
  clienti: Cliente[];
  articoli: Articolo[];
  entrate: Entrata[];
  ordini: Ordine[];
  spedizioni: Spedizione[];
  segnalazioni: Segnalazione[];
  utenti: Utente[];
}

// ─── Costanti di dominio ────────────────────────────────────────────────────

export const TIPI_CARTONE = [
  "Microonda",
  "Onda B",
  "Onda C",
  "Onda E",
  "Doppia Onda BC",
  "Doppia Onda EB",
  "Tripla Onda",
];

export const TIPI_STAMPA = [
  "Nessuna",
  "1 colore",
  "2 colori",
  "3+ colori",
  "Flexo",
  "Offset",
];

export const TIPI_PEDANA = [
  "EPAL 80×120",
  "EUR 80×120",
  "100×120",
  "Pedana perduta",
  "Mezza pedana",
];

export const TRASPORTO = ["Mittente", "Destinatario", "Vettore"];

export const STATUS_LABEL: Record<OrderStatus, string> = {
  da_produrre: "Da iniziare",
  in_produzione: "In produzione",
  completato: "Completato",
  spedito: "Spedito",
};

// ─── Helper di calcolo ──────────────────────────────────────────────────────

export function ordineProdotti(o: Ordine): number {
  return o.registrazioni.reduce((s, r) => s + r.prodotti, 0);
}
export function ordineScartati(o: Ordine): number {
  return o.registrazioni.reduce((s, r) => s + r.scartati, 0);
}
export function ordineScatoleScartate(o: Ordine): number {
  return o.registrazioni.reduce((s, r) => s + (r.scatoleScartate || 0), 0);
}
export function ordineImballati(o: Ordine): number {
  return o.registrazioni.reduce(
    (s, r) => s + r.pedane.reduce((p, x) => p + (x.quantita || 0), 0),
    0
  );
}
export function ordinePedane(o: Ordine): number {
  return o.registrazioni.reduce((s, r) => s + r.pedane.length, 0);
}
export function scartoPct(o: Ordine): number {
  const p = ordineProdotti(o);
  const s = ordineScartati(o);
  if (p + s === 0) return 0;
  return (s / (p + s)) * 100;
}
export function avanzamentoPct(o: Ordine): number {
  if (o.qtaRichiesta === 0) return 0;
  return Math.min(100, (ordineProdotti(o) / o.qtaRichiesta) * 100);
}
export function speditoPerOrdine(spedizioni: Spedizione[], ordineId: string): number {
  return spedizioni
    .filter((s) => s.ordineId === ordineId)
    .reduce((sum, s) => sum + s.pezzi, 0);
}
export function disponibilePerOrdine(spedizioni: Spedizione[], o: Ordine): number {
  return Math.max(0, ordineImballati(o) - speditoPerOrdine(spedizioni, o.id));
}

// ─── Formattazione italiana ─────────────────────────────────────────────────

const nf = new Intl.NumberFormat("it-IT");
const df = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const dfShort = new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short" });

export function fmtNum(n: number): string {
  return nf.format(Math.round(n));
}
export function fmtData(iso: string): string {
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  return df.format(d);
}
export function fmtDataBreve(iso: string): string {
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  return dfShort.format(d);
}
export function fmtPct(n: number, decimals = 1): string {
  return (
    n.toLocaleString("it-IT", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }) + "%"
  );
}
export function adessoISO(): string {
  return new Date().toISOString();
}
export function fmtDataOra(iso: string): string {
  const d = new Date(iso);
  return `${df.format(d)} ${d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}`;
}
export function oggiISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}
export function giorniFaISO(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function nomeCliente(db: DB, clienteId: string, libero?: string): string {
  const c = db.clienti.find((x) => x.id === clienteId);
  return c ? c.nome : libero || "—";
}

export function labelArticolo(db: DB, articoloId: string): string {
  const a = db.articoli.find((x) => x.id === articoloId);
  if (!a) return "—";
  return `${a.codice} · ${a.dimL}×${a.dimP}×${a.dimH}`;
}

// ─── Giacenze di magazzino ──────────────────────────────────────────────────

// Fogli di cartone entrati per articolo (0 se l'entrata non è legata a una scheda)
export function entratiPerArticolo(db: DB, articoloId: string): number {
  return db.entrate
    .filter((e) => e.articoloId === articoloId)
    .reduce((s, e) => s + e.quantita, 0);
}

// Fogli di cartone consumati in produzione per articolo (prodotti + scartati)
export function consumatiPerArticolo(db: DB, articoloId: string): number {
  return db.ordini
    .filter((o) => o.articoloId === articoloId)
    .reduce((s, o) => s + ordineProdotti(o) + ordineScartati(o), 0);
}

// Giacenza di cartone (fogli) per articolo
export function giacenzaCartoneArticolo(db: DB, articoloId: string): number {
  return entratiPerArticolo(db, articoloId) - consumatiPerArticolo(db, articoloId);
}

// Scatole prodotte e non ancora spedite, per articolo
export function giacenzaScatoleArticolo(db: DB, articoloId: string): number {
  const prodotte = db.ordini
    .filter((o) => o.articoloId === articoloId)
    .reduce((s, o) => s + ordineImballati(o), 0);
  const spedite = db.spedizioni
    .filter((s) => s.articoloId === articoloId)
    .reduce((s, x) => s + x.pezzi, 0);
  return prodotte - spedite;
}

// ─── Segnalazioni: etichette e stili di stato ───────────────────────────────

export const STATO_SEGNALAZIONE_LABEL: Record<StatoSegnalazione, string> = {
  nuova: "Nuova",
  ordinato: "Ordinato",
  evaso: "Evaso",
};
