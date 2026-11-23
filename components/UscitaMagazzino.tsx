"use client";

import { useMemo, useState } from "react";
import { PaperPlaneTilt, Trash, MagnifyingGlass } from "@phosphor-icons/react";
import { useData, useToasts, operatoreCorrente, utenteCorrente } from "@/lib/store";
import {
  Spedizione, TRASPORTO, fmtNum, fmtData, oggiISO, uid, nomeCliente, labelArticolo,
  ordineImballati, disponibilePerOrdine, giacenzaScatoleArticolo,
} from "@/lib/model";
import { Card, CardHeader, Table, Btn, Field, TextInput, SelectInput, TextArea, ConfirmModal, StatusBadge } from "./ui-kit";

export default function UscitaMagazzino() {
  const db = useData();
  const push = useToasts((s) => s.push);
  const isAdmin = utenteCorrente()?.ruolo === "admin";

  const ordiniEleggibili = useMemo(
    () => db.ordini.filter((o) => o.stato === "completato" || o.stato === "spedito")
      .filter((o) => disponibilePerOrdine(db.spedizioni, o) > 0),
    [db.ordini, db.spedizioni]
  );

  const [ordineId, setOrdineId] = useState("");
  const [data, setData] = useState(oggiISO());
  const [numPedane, setNumPedane] = useState("");
  const [pezzi, setPezzi] = useState("");
  const [ddt, setDdt] = useState("");
  const [trasporto, setTrasporto] = useState<string>(TRASPORTO[0]);
  const [note, setNote] = useState("");

  const [filtroCliente, setFiltroCliente] = useState("");
  const [filtroData, setFiltroData] = useState("");
  const [daEliminare, setDaEliminare] = useState<Spedizione | null>(null);

  const ordineSel = db.ordini.find((o) => o.id === ordineId) ?? null;
  const disponibile = ordineSel ? disponibilePerOrdine(db.spedizioni, ordineSel) : 0;
  // Giacenza complessiva dell'articolo collegato all'ordine selezionato
  const giacenzaArticolo = ordineSel ? giacenzaScatoleArticolo(db, ordineSel.articoloId) : 0;
  // Il cliente deriva sempre dall'articolo dell'ordine selezionato (campo in sola lettura)
  const clienteAuto = ordineSel
    ? nomeCliente(db, ordineSel.clienteId, ordineSel.clienteLibero)
    : "";

  // Validazione in tempo reale: la quantità non può superare la giacenza disponibile
  const pezziNum = parseInt(pezzi, 10);
  const erroreQuantita =
    ordineSel && !isNaN(pezziNum) && pezziNum > Math.min(disponibile, giacenzaArticolo)
      ? `Quantità non disponibile: giacenza articolo ${fmtNum(giacenzaArticolo)} pezzi (max spedibile per questo ordine: ${fmtNum(disponibile)})`
      : null;

  const spedizioniFiltrate = useMemo(() => {
    return db.spedizioni.filter((s) => {
      const nome = nomeCliente(db, s.clienteId, s.clienteLibero).toLowerCase();
      const okCliente = !filtroCliente || nome.includes(filtroCliente.toLowerCase());
      const okData = !filtroData || s.data === filtroData;
      return okCliente && okData;
    });
  }, [db, filtroCliente, filtroData]);

  const salva = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!ordineSel) { push("Seleziona un ordine completato", "errore"); return; }
    const nPed = parseInt(numPedane, 10);
    const nPezzi = parseInt(pezzi, 10);
    if (isNaN(nPed) || nPed <= 0 || isNaN(nPezzi) || nPezzi <= 0) {
      push("Inserisci pedane e pezzi validi", "errore");
      return;
    }
    if (nPezzi > disponibile) {
      push(`Quantità non disponibile: puoi spedire al massimo ${fmtNum(disponibile)} pezzi per questo ordine`, "errore");
      return;
    }
    if (nPezzi > giacenzaArticolo) {
      push(`Quantità non disponibile: giacenza articolo insufficiente (${fmtNum(giacenzaArticolo)} pezzi in magazzino)`, "errore");
      return;
    }
    if (!ddt.trim()) { push("Inserisci il numero DDT", "errore"); return; }

    db.addSpedizione({
      id: uid("sp"), ordineId: ordineSel.id, articoloId: ordineSel.articoloId,
      clienteId: ordineSel.clienteId, clienteLibero: ordineSel.clienteLibero,
      data, numPedane: nPed, pezzi: nPezzi, ddt: ddt.trim(), trasporto, note: note.trim(),
      operatore: operatoreCorrente(),
    });
    const residuo = disponibile - nPezzi;
    push(
      residuo <= 0
        ? `Spedizione registrata — ordine ${ordineSel.codice} spedito, ciclo concluso`
        : `Spedizione registrata — restano ${fmtNum(residuo)} pezzi disponibili`
    );
    setOrdineId(""); setNumPedane(""); setPezzi(""); setDdt(""); setNote("");
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-[#1c2b22]">Uscita Magazzino</h2>
        <p className="text-sm text-[#4a5d50]">Spedizioni e documenti di trasporto</p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Form uscita */}
        <Card className="xl:col-span-1">
          <CardHeader title="Nuova uscita" subtitle="Spedisci merce da ordini completati" />
          <form onSubmit={salva} className="space-y-4 px-5 py-5">
            <Field label="Ordine completato">
              <SelectInput value={ordineId} onChange={(e) => setOrdineId(e.target.value)}>
                <option value="">Seleziona ordine…</option>
                {ordiniEleggibili.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.codice} — {labelArticolo(db, o.articoloId)}
                  </option>
                ))}
              </SelectInput>
            </Field>
            {ordineSel && (
              <div className="rounded-lg bg-[#f7faf5] px-3 py-2 text-xs text-[#3f5248]">
                <div><span className="font-semibold">Cliente ordine:</span> {nomeCliente(db, ordineSel.clienteId, ordineSel.clienteLibero)}</div>
                <div><span className="font-semibold">Imballati:</span> {fmtNum(ordineImballati(ordineSel))} pezzi</div>
                <div><span className="font-semibold">Disponibili:</span> <span className="font-mono font-bold text-[#0f4d27]">{fmtNum(disponibile)}</span> pezzi</div>
              </div>
            )}
            <Field label="Cliente destinatario" hint="Impostato automaticamente dall'articolo dell'ordine selezionato">
              <TextInput
                value={clienteAuto}
                readOnly
                disabled
                placeholder="Seleziona prima un ordine…"
                className="cursor-not-allowed bg-[#eef4ec] font-semibold text-[#3d6b4c] opacity-100"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Data">
                <TextInput type="date" value={data} onChange={(e) => setData(e.target.value)} />
              </Field>
              <Field label="N. DDT">
                <TextInput placeholder="DDT-2025/…" value={ddt} onChange={(e) => setDdt(e.target.value)} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Pedane spedite">
                <TextInput type="number" min={1} value={numPedane} onChange={(e) => setNumPedane(e.target.value)} placeholder="0" />
              </Field>
              <Field label="Pezzi spediti" hint={ordineSel ? `Max ${fmtNum(disponibile)} · giacenza articolo ${fmtNum(giacenzaArticolo)}` : undefined}>
                <TextInput type="number" min={1} value={pezzi} onChange={(e) => setPezzi(e.target.value)} placeholder="0" />
              </Field>
            </div>
            {erroreQuantita && (
              <p className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                {erroreQuantita}
              </p>
            )}
            <Field label="Trasporto" hint="Trasporto a carico di">
              <SelectInput value={trasporto} onChange={(e) => setTrasporto(e.target.value)}>
                {TRASPORTO.map((t) => <option key={t}>{t}</option>)}
              </SelectInput>
            </Field>
            <Field label="Note">
              <TextArea placeholder="Note opzionali…" value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
            <Btn type="submit" className="w-full" disabled={ordiniEleggibili.length === 0 || !!erroreQuantita}>
              <PaperPlaneTilt size={16} weight="bold" /> Registra uscita
            </Btn>
            {ordiniEleggibili.length === 0 && (
              <p className="text-center text-xs text-[#7fa08a]">Nessun ordine completato con merce disponibile</p>
            )}
          </form>
        </Card>

        {/* Storico spedizioni */}
        <Card className="xl:col-span-2">
          <CardHeader
            title="Storico spedizioni"
            subtitle={`${spedizioniFiltrate.length} spedizioni`}
            action={
              <div className="flex flex-wrap gap-2">
                <div className="relative">
                  <MagnifyingGlass size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#7fa08a]" />
                  <input
                    className="rounded-lg border border-[#b9d6c0] bg-white py-1.5 pl-8 pr-2 text-sm focus:border-[#4e7a5f] focus:outline-none"
                    placeholder="Cerca cliente…"
                    value={filtroCliente}
                    onChange={(e) => setFiltroCliente(e.target.value)}
                  />
                </div>
                <input
                  type="date"
                  className="rounded-lg border border-[#b9d6c0] bg-white px-2 py-1.5 text-sm focus:border-[#4e7a5f] focus:outline-none"
                  value={filtroData}
                  onChange={(e) => setFiltroData(e.target.value)}
                />
              </div>
            }
          />
          <Table head={["Data", "DDT", "Ordine", "Cliente", "Pedane", "Pezzi", "Trasporto", "Stato ordine", ""]}>
            {spedizioniFiltrate.map((s) => {
              const ord = db.ordini.find((o) => o.id === s.ordineId);
              return (
                <tr key={s.id} className="hover:bg-[#f7faf5]">
                  <td className="whitespace-nowrap px-4 py-2.5">{fmtData(s.data)}</td>
                  <td className="px-4 py-2.5 font-mono text-xs font-semibold">{s.ddt}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{ord?.codice ?? "—"}</td>
                  <td className="px-4 py-2.5">{nomeCliente(db, s.clienteId, s.clienteLibero)}</td>
                  <td className="px-4 py-2.5 font-mono">{fmtNum(s.numPedane)}</td>
                  <td className="px-4 py-2.5 font-mono">{fmtNum(s.pezzi)}</td>
                  <td className="px-4 py-2.5">{s.trasporto}</td>
                  <td className="px-4 py-2.5">{ord ? <StatusBadge stato={ord.stato} /> : "—"}</td>
                  <td className="px-4 py-2.5">
                    {isAdmin && (
                      <button
                        onClick={() => setDaEliminare(s)}
                        className="rounded-lg p-1.5 text-red-600 hover:bg-red-50"
                        aria-label="Elimina spedizione"
                      >
                        <Trash size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {spedizioniFiltrate.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-6 text-center text-[#4a5d50]">Nessuna spedizione trovata</td></tr>
            )}
          </Table>
        </Card>
      </div>

      <ConfirmModal
        open={!!daEliminare}
        title="Eliminare questa spedizione?"
        message={daEliminare ? `Verrà eliminata la spedizione con DDT ${daEliminare.ddt} (${fmtNum(daEliminare.pezzi)} pezzi). I pezzi torneranno disponibili sull'ordine.` : ""}
        onCancel={() => setDaEliminare(null)}
        onConfirm={() => {
          if (daEliminare) {
            db.deleteSpedizione(daEliminare.id);
            push("Spedizione eliminata");
          }
          setDaEliminare(null);
        }}
      />
    </div>
  );
}
