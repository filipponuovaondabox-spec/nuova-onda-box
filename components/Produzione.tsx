"use client";

import { useMemo, useState } from "react";
import { Plus, Trash, X, ArrowLeft, Play, Stop, FileImage, FilePdf, NotePencil, MagnifyingGlass } from "@phosphor-icons/react";
import { useData, useToasts, operatoreCorrente, utenteCorrente } from "@/lib/store";
import {
  Ordine, Pedana, Articolo, fmtNum, fmtPct, fmtData, fmtDataOra, oggiISO, uid, nomeCliente, labelArticolo,
  ordineProdotti, ordineScartati, ordineScatoleScartate, ordineImballati, ordinePedane, scartoPct, avanzamentoPct,
} from "@/lib/model";
import { Card, CardHeader, Table, Btn, Field, TextInput, SelectInput, ConfirmModal, Modal, StatusBadge, ProgressBar } from "./ui-kit";
import BozzaModal from "./BozzaModal";

export default function Produzione() {
  const db = useData();
  const push = useToasts((s) => s.push);
  const isAdmin = utenteCorrente()?.ruolo === "admin";

  const [selezionato, setSelezionato] = useState<string | null>(null);
  const [nuovoOpen, setNuovoOpen] = useState(false);
  const [terminaOpen, setTerminaOpen] = useState(false);
  const [daEliminare, setDaEliminare] = useState<Ordine | null>(null);
  const [bozzaAperta, setBozzaAperta] = useState<Articolo | null>(null);
  const [ricerca, setRicerca] = useState("");

  // Form nuovo ordine
  const [nArticolo, setNArticolo] = useState(db.articoli[0]?.id ?? "");
  const [nEntrata, setNEntrata] = useState("");
  const [nQta, setNQta] = useState("");
  const [nScadenza, setNScadenza] = useState(oggiISO());

  // Form fine produzione
  const [rData, setRData] = useState(oggiISO());
  const [rProdotti, setRProdotti] = useState("");
  const [rScartati, setRScartati] = useState("");
  const [rScatoleScartate, setRScatoleScartate] = useState("");
  const [pedane, setPedane] = useState<Pedana[]>([{ id: uid("pd"), quantita: 0 }]);

  const ordine = db.ordini.find((o) => o.id === selezionato) ?? null;
  const articoloOrdine = ordine ? db.articoli.find((a) => a.id === ordine.articoloId) : null;

  const entratePerArticolo = useMemo(
    () => db.entrate.filter((e) => e.articoloId === nArticolo),
    [db.entrate, nArticolo]
  );

  // Filtro live: cerca nel nome/codice articolo e nel nome del cliente (case-insensitive)
  const ordiniFiltrati = useMemo(() => {
    const q = ricerca.trim().toLowerCase();
    if (!q) return db.ordini;
    return db.ordini.filter((o) => {
      const articolo = labelArticolo(db, o.articoloId).toLowerCase();
      const cliente = nomeCliente(db, o.clienteId, o.clienteLibero).toLowerCase();
      return articolo.includes(q) || cliente.includes(q);
    });
  }, [db, ricerca]);

  const creaOrdine = (ev: React.FormEvent) => {
    ev.preventDefault();
    const qta = parseInt(nQta, 10);
    if (isNaN(qta) || qta <= 0) {
      push("Inserisci una quantità valida", "errore");
      return;
    }
    const art = db.articoli.find((a) => a.id === nArticolo);
    if (!art) { push("Seleziona un articolo", "errore"); return; }
    const maxCod = db.ordini.reduce((m, o) => {
      const n = parseInt(o.codice.replace(/\D/g, ""), 10);
      return isNaN(n) ? m : Math.max(m, n);
    }, 2600);
    db.addOrdine({
      id: uid("or"), codice: `OP-${maxCod + 1}`, articoloId: nArticolo,
      entrataId: nEntrata || undefined, clienteId: art.clienteId, clienteLibero: art.clienteLibero,
      qtaRichiesta: qta, scadenza: nScadenza, stato: "da_produrre", registrazioni: [], creatoIl: oggiISO(),
      noteArticolo: art.note?.trim() ? art.note : undefined,
    });
    push(`Ordine OP-${maxCod + 1} creato`);
    setNuovoOpen(false);
    setNQta("");
  };

  const iniziaAvviamento = (o: Ordine) => {
    db.iniziaAvviamento(o.id);
    push(`Avviamento di ${o.codice} iniziato`);
  };

  const terminaAvviamento = (o: Ordine) => {
    db.terminaAvviamento(o.id);
    push(`Avviamento di ${o.codice} terminato — pronto per la produzione`);
  };

  const iniziaProduzione = (o: Ordine) => {
    db.avviaOrdine(o.id);
    push(`Produzione di ${o.codice} iniziata`);
  };

  const apriTermina = () => {
    setRData(oggiISO());
    setRProdotti("");
    setRScartati("");
    setRScatoleScartate("");
    setPedane([{ id: uid("pd"), quantita: 0 }]);
    setTerminaOpen(true);
  };

  const registraFineProduzione = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!ordine) return;
    const prodotti = parseInt(rProdotti, 10) || 0;
    const scartati = parseInt(rScartati, 10) || 0;
    const scatoleScartate = parseInt(rScatoleScartate, 10) || 0;
    if (prodotti <= 0) {
      push("Inserisci la quantità di fogli prodotti", "errore");
      return;
    }
    const pedaneValide = pedane.filter((p) => p.quantita > 0);
    db.terminaOrdine(ordine.id, {
      id: uid("rg"), data: rData, prodotti, scartati, scatoleScartate, pedane: pedaneValide,
      operatore: operatoreCorrente(),
    });
    push(`Ordine ${ordine.codice} completato — merce disponibile per la spedizione`);
    setTerminaOpen(false);
  };

  // ─── Vista operatore (dettaglio ordine) ───────────────────────────────────
  if (ordine) {
    const prodotti = ordineProdotti(ordine);
    const scartati = ordineScartati(ordine);
    const scatoleScartate = ordineScatoleScartate(ordine);
    const imballati = ordineImballati(ordine);
    const diff = imballati - prodotti;
    const pacchi = articoloOrdine && articoloOrdine.qtaPerPacco > 0
      ? Math.floor(imballati / articoloOrdine.qtaPerPacco) : 0;

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Btn variant="ghost" onClick={() => setSelezionato(null)}><ArrowLeft size={16} weight="bold" /> Ordini</Btn>
            <div>
              <h2 className="flex items-center gap-3 text-2xl font-bold tracking-tight text-[#1c2b22]">
                <span className="font-mono">{ordine.codice}</span> <StatusBadge stato={ordine.stato} />
              </h2>
              <p className="text-sm text-[#4a5d50]">
                {labelArticolo(db, ordine.articoloId)} · {nomeCliente(db, ordine.clienteId, ordine.clienteLibero)} · scadenza {fmtData(ordine.scadenza)}
              </p>
              {(ordine.avviamentoIniziatoIl || ordine.iniziatoIl) && (
                <p className="text-xs text-[#7fa08a]">
                  {ordine.avviamentoIniziatoIl && `Avviamento iniziato il ${fmtDataOra(ordine.avviamentoIniziatoIl)}`}
                  {ordine.avviamentoCompletatoIl && ` · terminato il ${fmtDataOra(ordine.avviamentoCompletatoIl)}`}
                  {ordine.iniziatoIl && ` · Produzione iniziata il ${fmtDataOra(ordine.iniziatoIl)}`}
                  {ordine.completatoIl && ` · Completata il ${fmtDataOra(ordine.completatoIl)}`}
                </p>
              )}
            </div>
          </div>
          {ordine.stato === "da_produrre" && !ordine.avviamentoIniziatoIl && (
            <Btn onClick={() => iniziaAvviamento(ordine)}>
              <Play size={16} weight="fill" /> Inizia avviamento
            </Btn>
          )}
          {ordine.stato === "da_produrre" && ordine.avviamentoIniziatoIl && !ordine.avviamentoCompletatoIl && (
            <Btn onClick={() => terminaAvviamento(ordine)}>
              <Stop size={16} weight="fill" /> Termina avviamento
            </Btn>
          )}
          {ordine.stato === "da_produrre" && ordine.avviamentoCompletatoIl && (
            <Btn onClick={() => iniziaProduzione(ordine)}>
              <Play size={16} weight="fill" /> Inizia produzione
            </Btn>
          )}
          {ordine.stato === "in_produzione" && (
            <Btn onClick={apriTermina}>
              <Stop size={16} weight="fill" /> Termina produzione
            </Btn>
          )}
        </div>

        {/* Note articolo — ben visibili per l'operatore */}
        {(ordine.noteArticolo ?? articoloOrdine?.note)?.trim() && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-5 py-4 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-400/30 text-amber-800">
                <NotePencil size={18} weight="bold" />
              </span>
              <div className="min-w-0">
                <div className="text-xs font-bold uppercase tracking-wide text-amber-800">Note articolo</div>
                <p className="mt-1 whitespace-pre-wrap text-sm font-medium leading-relaxed text-amber-900">
                  {ordine.noteArticolo ?? articoloOrdine?.note}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Scheda articolo con bozza di stampa */}
        {articoloOrdine && (
          <Card>
            <CardHeader
              title={`Articolo ${articoloOrdine.codice}`}
              subtitle="Dati tecnici per l'operatore"
              action={
                articoloOrdine.bozzaData ? (
                  <Btn variant="secondary" onClick={() => setBozzaAperta(articoloOrdine)}>
                    {articoloOrdine.bozzaData.startsWith("data:application/pdf") ? <FilePdf size={16} /> : <FileImage size={16} />}
                    Vedi bozza
                  </Btn>
                ) : undefined
              }
            />
            <div className="flex flex-wrap gap-1.5 px-5 py-4 text-xs">
              <span className="rounded-full bg-[#eef4ec] px-2 py-0.5 text-[#146031]">{articoloOrdine.dimL}×{articoloOrdine.dimP}×{articoloOrdine.dimH} mm</span>
              {articoloOrdine.formatoCartone && <span className="rounded-full bg-[#eef4ec] px-2 py-0.5 text-[#146031]">Formato: {articoloOrdine.formatoCartone}</span>}
              <span className="rounded-full bg-[#eef4ec] px-2 py-0.5 text-[#146031]">{articoloOrdine.tipoCartone}</span>
              {articoloOrdine.colore && <span className="rounded-full bg-[#eef4ec] px-2 py-0.5 text-[#146031]">Colore: {articoloOrdine.colore}</span>}
              <span className="rounded-full bg-[#eef4ec] px-2 py-0.5 text-[#146031]">Stampa: {articoloOrdine.stampa}</span>
              {articoloOrdine.numeroImpianto && <span className="rounded-full bg-[#eef4ec] px-2 py-0.5 text-[#146031]">Impianto: {articoloOrdine.numeroImpianto}</span>}
              <span className="rounded-full bg-[#eef4ec] px-2 py-0.5 text-[#146031]">{articoloOrdine.qtaPerPacco}/pacco</span>
              <span className="rounded-full bg-[#eef4ec] px-2 py-0.5 text-[#146031]">{fmtNum(articoloOrdine.qtaPerPedana)}/pedana</span>
              <span className="rounded-full bg-[#eef4ec] px-2 py-0.5 text-[#146031]">{articoloOrdine.tipoPedana}</span>
            </div>
          </Card>
        )}

        {/* Riepilogo calcoli */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          {[
            { label: "Da produrre", value: fmtNum(ordine.qtaRichiesta) },
            { label: "Prodotti", value: fmtNum(prodotti) },
            { label: "Fogli scartati", value: fmtNum(scartati) },
            { label: "Scarto", value: fmtPct(scartoPct(ordine)) },
            { label: "Imballati", value: fmtNum(imballati) },
            { label: "Pacchi risultanti", value: fmtNum(pacchi) },
          ].map((k) => (
            <Card key={k.label} className="p-4">
              <div className="font-mono text-xl font-semibold text-[#1c2b22]">{k.value}</div>
              <div className="mt-1 text-xs font-medium uppercase tracking-wide text-[#4a5d50]">{k.label}</div>
            </Card>
          ))}
        </div>

        <Card className="p-5">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-semibold text-[#0f4d27]">Avanzamento</span>
            <span className="font-mono text-[#4a5d50]">{fmtNum(prodotti)} / {fmtNum(ordine.qtaRichiesta)} fogli</span>
          </div>
          <ProgressBar pct={avanzamentoPct(ordine)} />
          <div className="mt-3 text-sm">
            {ordine.stato === "da_produrre" ? (
              <span className="font-medium text-[#4a5d50]">
                {!ordine.avviamentoIniziatoIl
                  ? "Ordine da iniziare — premi «Inizia avviamento» per cominciare il setup."
                  : !ordine.avviamentoCompletatoIl
                    ? "Avviamento in corso — premi «Termina avviamento» al termine del setup."
                    : "Avviamento completato — premi «Inizia produzione» per avviare la lavorazione."}
              </span>
            ) : diff === 0 ? (
              <span className="font-medium text-green-700">Pezzi imballati corrispondono ai fogli prodotti.</span>
            ) : diff > 0 ? (
              <span className="font-medium text-amber-700">Imballati {fmtNum(diff)} pezzi in più rispetto ai prodotti — verificare i conteggi.</span>
            ) : (
              <span className="font-medium text-red-700">Mancano {fmtNum(-diff)} pezzi da imballare rispetto ai prodotti.</span>
            )}
          </div>
        </Card>

        {/* Storico registrazioni */}
        <Card>
          <CardHeader title="Registrazioni" subtitle={`${ordine.registrazioni.length} turni registrati · ${ordinePedane(ordine)} pedane totali · ${fmtNum(scatoleScartate)} scatole scartate`} />
          <Table head={["Data", "Prodotti", "Fogli scartati", "Scatole scartate", "Pedane", "Imballati"]}>
            {ordine.registrazioni.map((r) => (
              <tr key={r.id} className="hover:bg-[#f7faf5]">
                <td className="px-4 py-2.5">{fmtData(r.data)}</td>
                <td className="px-4 py-2.5 font-mono">{fmtNum(r.prodotti)}</td>
                <td className="px-4 py-2.5 font-mono text-red-700">{fmtNum(r.scartati)}</td>
                <td className="px-4 py-2.5 font-mono text-red-700">{fmtNum(r.scatoleScartate || 0)}</td>
                <td className="px-4 py-2.5 font-mono">{r.pedane.length}</td>
                <td className="px-4 py-2.5 font-mono">{fmtNum(r.pedane.reduce((s, p) => s + p.quantita, 0))}</td>
              </tr>
            ))}
            {ordine.registrazioni.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-[#4a5d50]">Nessuna registrazione ancora</td></tr>
            )}
          </Table>
        </Card>

        {/* Modal fine produzione */}
        <Modal open={terminaOpen} title={`Termina produzione — ${ordine.codice}`} onClose={() => setTerminaOpen(false)} wide>
          <form onSubmit={registraFineProduzione} className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Field label="Data">
                <TextInput type="date" value={rData} onChange={(e) => setRData(e.target.value)} />
              </Field>
              <Field label="Quantità prodotta" hint="Fogli prodotti">
                <TextInput type="number" min={0} value={rProdotti} onChange={(e) => setRProdotti(e.target.value)} placeholder="0" />
              </Field>
              <Field label="Fogli scartati">
                <TextInput type="number" min={0} value={rScartati} onChange={(e) => setRScartati(e.target.value)} placeholder="0" />
              </Field>
              <Field label="Scatole scartate">
                <TextInput type="number" min={0} value={rScatoleScartate} onChange={(e) => setRScatoleScartate(e.target.value)} placeholder="0" />
              </Field>
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-[#4a5d50]">
                  Pedane realizzate ({pedane.length})
                </span>
                <Btn variant="ghost" className="!px-2 !py-1 text-xs" onClick={() => setPedane([...pedane, { id: uid("pd"), quantita: 0 }])}>
                  <Plus size={14} weight="bold" /> Aggiungi pedana
                </Btn>
              </div>
              <div className="space-y-2">
                {pedane.map((p, i) => (
                  <div key={p.id} className="flex items-center gap-2">
                    <span className="w-20 font-mono text-xs text-[#4a5d50]">Pedana {i + 1}</span>
                    <TextInput
                      type="number" min={0} placeholder="Quantità"
                      value={p.quantita || ""}
                      onChange={(e) =>
                        setPedane(pedane.map((x) => x.id === p.id ? { ...x, quantita: parseInt(e.target.value, 10) || 0 } : x))
                      }
                    />
                    <button
                      type="button"
                      onClick={() => setPedane(pedane.filter((x) => x.id !== p.id))}
                      className="rounded-lg p-2 text-red-600 hover:bg-red-50 disabled:opacity-30"
                      disabled={pedane.length === 1}
                      aria-label="Rimuovi pedana"
                    >
                      <X size={14} weight="bold" />
                    </button>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-[#7fa08a]">
                Totale da imballare: {fmtNum(pedane.reduce((s, p) => s + (p.quantita || 0), 0))} pezzi
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Btn variant="secondary" onClick={() => setTerminaOpen(false)}>Annulla</Btn>
              <Btn type="submit"><Stop size={16} weight="fill" /> Salva e termina</Btn>
            </div>
          </form>
        </Modal>

        <BozzaModal articolo={bozzaAperta} onClose={() => setBozzaAperta(null)} />
      </div>
    );
  }

  // ─── Elenco ordini ────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[#1c2b22]">Produzione</h2>
          <p className="text-sm text-[#4a5d50]">Ordini di produzione e avanzamento</p>
        </div>
        <Btn onClick={() => setNuovoOpen(true)}><Plus size={16} weight="bold" /> Nuovo ordine</Btn>
      </div>

      {db.ordini.length > 0 && (
        <div className="relative max-w-md">
          <MagnifyingGlass
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#7fa08a]"
          />
          <input
            type="text"
            className="w-full rounded-lg border border-[#b9d6c0] bg-white py-2 pl-9 pr-9 text-sm focus:border-[#4e7a5f] focus:outline-none"
            placeholder="Cerca per articolo o cliente..."
            value={ricerca}
            onChange={(e) => setRicerca(e.target.value)}
          />
          {ricerca && (
            <button
              type="button"
              onClick={() => setRicerca("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-[#7fa08a] hover:bg-[#eef4ec] hover:text-[#3d6b4c]"
              aria-label="Cancella ricerca"
            >
              <X size={14} weight="bold" />
            </button>
          )}
        </div>
      )}

      <Card>
        <Table head={["Codice", "Articolo", "Cliente", "Da produrre", "Prodotti", "Scarto", "Scadenza", "Stato", "Avanzamento", "Azioni", ""]}>
          {ordiniFiltrati.map((o) => (
            <tr key={o.id} className="cursor-pointer hover:bg-[#f7faf5]" onClick={() => setSelezionato(o.id)}>
              <td className="px-4 py-3 font-mono text-xs font-semibold">{o.codice}</td>
              <td className="px-4 py-3">{labelArticolo(db, o.articoloId)}</td>
              <td className="px-4 py-3">{nomeCliente(db, o.clienteId, o.clienteLibero)}</td>
              <td className="px-4 py-3 font-mono">{fmtNum(o.qtaRichiesta)}</td>
              <td className="px-4 py-3 font-mono">{fmtNum(ordineProdotti(o))}</td>
              <td className="px-4 py-3 font-mono">{fmtPct(scartoPct(o))}</td>
              <td className="whitespace-nowrap px-4 py-3">{fmtData(o.scadenza)}</td>
              <td className="px-4 py-3"><StatusBadge stato={o.stato} /></td>
              <td className="px-4 py-3"><ProgressBar pct={avanzamentoPct(o)} /></td>
              <td className="px-4 py-3">
                {o.stato === "da_produrre" && !o.avviamentoIniziatoIl && (
                  <button
                    onClick={(e) => { e.stopPropagation(); iniziaAvviamento(o); }}
                    className="inline-flex items-center gap-1 rounded-lg border border-[#b9d6c0] bg-white px-2.5 py-1 text-xs font-semibold text-[#0f4d27] hover:bg-[#f7faf5]"
                  >
                    <Play size={14} weight="fill" /> Inizia avviamento
                  </button>
                )}
                {o.stato === "da_produrre" && o.avviamentoIniziatoIl && !o.avviamentoCompletatoIl && (
                  <button
                    onClick={(e) => { e.stopPropagation(); terminaAvviamento(o); }}
                    className="inline-flex items-center gap-1 rounded-lg border border-[#e0a800]/50 bg-[#ffc400]/15 px-2.5 py-1 text-xs font-semibold text-[#7a5c00] hover:bg-[#ffc400]/25"
                  >
                    <Stop size={14} weight="fill" /> Termina avviamento
                  </button>
                )}
                {o.stato === "da_produrre" && o.avviamentoCompletatoIl && (
                  <button
                    onClick={(e) => { e.stopPropagation(); iniziaProduzione(o); }}
                    className="inline-flex items-center gap-1 rounded-lg border border-[#b9d6c0] bg-white px-2.5 py-1 text-xs font-semibold text-[#0f4d27] hover:bg-[#f7faf5]"
                  >
                    <Play size={14} weight="fill" /> Inizia produzione
                  </button>
                )}
                {o.stato === "in_produzione" && (
                  <span className="inline-flex items-center gap-1 rounded-lg bg-[#ffc400]/25 px-2.5 py-1 text-xs font-semibold text-[#7a5c00]">
                    In corso…
                  </span>
                )}
                {o.stato === "completato" && (
                  <span className="inline-flex items-center gap-1 rounded-lg bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-800">
                    Pronto alla spedizione
                  </span>
                )}
              </td>
              <td className="px-4 py-3">
                {isAdmin && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setDaEliminare(o); }}
                    className="rounded-lg p-1.5 text-red-600 hover:bg-red-50"
                    aria-label="Elimina ordine"
                  >
                    <Trash size={16} />
                  </button>
                )}
              </td>
            </tr>
          ))}
          {db.ordini.length === 0 && (
            <tr><td colSpan={11} className="px-4 py-6 text-center text-[#4a5d50]">Nessun ordine di produzione</td></tr>
          )}
          {db.ordini.length > 0 && ordiniFiltrati.length === 0 && (
            <tr><td colSpan={11} className="px-4 py-6 text-center text-[#4a5d50]">Nessun ordine trovato per la ricerca</td></tr>
          )}
        </Table>
      </Card>

      {/* Modal nuovo ordine */}
      <Modal open={nuovoOpen} title="Nuovo ordine di produzione" onClose={() => setNuovoOpen(false)}>
        <form onSubmit={creaOrdine} className="space-y-4">
          <Field label="Scheda articolo">
            <SelectInput value={nArticolo} onChange={(e) => { setNArticolo(e.target.value); setNEntrata(""); }}>
              {db.articoli.length === 0 && <option value="">Nessuna scheda articolo disponibile</option>}
              {db.articoli.map((a) => (
                <option key={a.id} value={a.id}>{a.codice} — {a.dimL}×{a.dimP}×{a.dimH} ({nomeCliente(db, a.clienteId, a.clienteLibero)})</option>
              ))}
            </SelectInput>
          </Field>
          {(() => {
            const artSel = db.articoli.find((a) => a.id === nArticolo);
            if (!artSel) return null;
            return artSel.note?.trim() ? (
              <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-400/30 text-amber-800">
                    <NotePencil size={16} weight="bold" />
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs font-bold uppercase tracking-wide text-amber-800">Note articolo</div>
                    <p className="mt-0.5 whitespace-pre-wrap text-sm font-medium leading-relaxed text-amber-900">{artSel.note}</p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs italic text-[#7fa08a]">Nessuna nota per questo articolo.</p>
            );
          })()}
          <Field label="Entrata collegata" hint="Opzionale: attinge dalla giacenza di questa entrata">
            <SelectInput value={nEntrata} onChange={(e) => setNEntrata(e.target.value)}>
              <option value="">Nessuna</option>
              {entratePerArticolo.map((e) => (
                <option key={e.id} value={e.id}>{fmtData(e.data)} · {e.formato} · {fmtNum(e.quantita)} fogli</option>
              ))}
            </SelectInput>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Quantità fogli da produrre">
              <TextInput type="number" min={1} value={nQta} onChange={(e) => setNQta(e.target.value)} placeholder="0" />
            </Field>
            <Field label="Scadenza">
              <TextInput type="date" value={nScadenza} onChange={(e) => setNScadenza(e.target.value)} />
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <Btn variant="secondary" onClick={() => setNuovoOpen(false)}>Annulla</Btn>
            <Btn type="submit">Crea ordine</Btn>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={!!daEliminare}
        title="Eliminare questo ordine?"
        message={daEliminare ? `Verrà eliminato l'ordine ${daEliminare.codice} con tutte le sue registrazioni. L'operazione non è reversibile.` : ""}
        onCancel={() => setDaEliminare(null)}
        onConfirm={() => {
          if (daEliminare) {
            db.deleteOrdine(daEliminare.id);
            push(`Ordine ${daEliminare.codice} eliminato`);
          }
          setDaEliminare(null);
        }}
      />
    </div>
  );
}
