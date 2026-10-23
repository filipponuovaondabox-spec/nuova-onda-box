"use client";

import { useMemo, useState } from "react";
import { Plus, Trash, BellRinging } from "@phosphor-icons/react";
import { useData, useToasts, utenteCorrente, operatoreCorrente } from "@/lib/store";
import {
  Segnalazione, StatoSegnalazione, STATO_SEGNALAZIONE_LABEL,
  fmtDataOra, uid, adessoISO,
} from "@/lib/model";
import { Card, CardHeader, Table, Btn, Field, TextInput, TextArea, ConfirmModal } from "./ui-kit";

// ─── Segnalazioni "Da ordinare" ─────────────────────────────────────────────
// L'operatore segnala materiale da riordinare (colore, film estensibile,
// reggetta per pedane, colla…). Stati: nuova (giallo) → ordinato (blu) →
// evaso (verde). Solo l'admin cambia stato o elimina.

const MATERIALI_SUGGERITI = [
  "Colore/inchiostro",
  "Film estensibile",
  "Reggetta per pedane",
  "Colla",
  "Nastro adesivo",
  "Altro",
];

const STATO_STYLE: Record<StatoSegnalazione, string> = {
  nuova: "border-[#e0a800]/50 bg-[#ffc400]/25 text-[#7a5c00]",
  ordinato: "border-blue-300 bg-blue-100 text-blue-800",
  evaso: "border-green-300 bg-green-100 text-green-800",
};

const PROSSIMO_STATO: Record<StatoSegnalazione, StatoSegnalazione | null> = {
  nuova: "ordinato",
  ordinato: "evaso",
  evaso: null,
};

export default function Segnalazioni() {
  const db = useData();
  const push = useToasts((s) => s.push);
  const utente = utenteCorrente();
  const isAdmin = utente?.ruolo === "admin";

  const [materiale, setMateriale] = useState(MATERIALI_SUGGERITI[0]);
  const [materialeLibero, setMaterialeLibero] = useState("");
  const [quantita, setQuantita] = useState("");
  const [note, setNote] = useState("");
  const [daEliminare, setDaEliminare] = useState<Segnalazione | null>(null);

  const ordinate = useMemo(() => {
    const peso: Record<StatoSegnalazione, number> = { nuova: 0, ordinato: 1, evaso: 2 };
    return [...db.segnalazioni].sort(
      (a, b) => peso[a.stato] - peso[b.stato] || b.creataIl.localeCompare(a.creataIl)
    );
  }, [db.segnalazioni]);

  const nuove = db.segnalazioni.filter((s) => s.stato === "nuova").length;

  const invia = (ev: React.FormEvent) => {
    ev.preventDefault();
    const mat = materiale === "Altro" ? materialeLibero.trim() : materiale;
    if (!mat) {
      push("Indica il materiale da ordinare", "errore");
      return;
    }
    db.addSegnalazione({
      id: uid("sg"),
      materiale: mat,
      quantita: quantita.trim() || undefined,
      note: note.trim() || undefined,
      operatore: operatoreCorrente() || "sconosciuto",
      creataIl: adessoISO(),
      stato: "nuova",
    });
    push(`Segnalazione inviata: ${mat}`);
    setQuantita("");
    setNote("");
    setMaterialeLibero("");
    setMateriale(MATERIALI_SUGGERITI[0]);
  };

  const avanza = (s: Segnalazione) => {
    const prossimo = PROSSIMO_STATO[s.stato];
    if (!prossimo) return;
    db.setStatoSegnalazione(s.id, prossimo, operatoreCorrente() || "admin");
    push(`"${s.materiale}" → ${STATO_SEGNALAZIONE_LABEL[prossimo]}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[#1c2b22]">Da ordinare</h2>
          <p className="text-sm text-[#4a5d50]">
            Segnalazioni di materiale da riordinare · {nuove} nuove
          </p>
        </div>
      </div>

      {/* Form segnalazione — disponibile a tutti gli operatori */}
      <Card>
        <CardHeader title="Nuova segnalazione" subtitle="Segnala materiale in esaurimento all'ufficio acquisti" />
        <form onSubmit={invia} className="space-y-4 px-5 py-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Materiale">
              <div className="space-y-2">
                <select
                  className="min-h-[44px] w-full rounded-lg border border-[#b9d6c0] bg-white px-3 py-2.5 text-base text-[#1c2b22] focus:border-[#4e7a5f] focus:outline-none sm:text-sm"
                  value={materiale}
                  onChange={(e) => setMateriale(e.target.value)}
                >
                  {MATERIALI_SUGGERITI.map((m) => <option key={m}>{m}</option>)}
                </select>
                {materiale === "Altro" && (
                  <TextInput
                    placeholder="Descrivi il materiale…"
                    value={materialeLibero}
                    onChange={(e) => setMaterialeLibero(e.target.value)}
                  />
                )}
              </div>
            </Field>
            <Field label="Quantità" hint="Es. 2 rotoli, 10 kg, 1 scatola">
              <TextInput value={quantita} onChange={(e) => setQuantita(e.target.value)} placeholder="Quantità necessaria" />
            </Field>
          </div>
          <Field label="Note">
            <TextArea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Urgenza, fornitore abituale, specifiche…" />
          </Field>
          <Btn type="submit">
            <BellRinging size={16} weight="bold" /> Invia segnalazione
          </Btn>
        </form>
      </Card>

      {/* Elenco segnalazioni */}
      <Card>
        <CardHeader
          title="Segnalazioni"
          subtitle="Nuova → Ordinato → Evaso"
        />
        <Table head={["Data", "Materiale", "Quantità", "Note", "Segnalata da", "Stato", ...(isAdmin ? ["Azioni", ""] : [])]}>
          {ordinate.map((s) => {
            const prossimo = PROSSIMO_STATO[s.stato];
            return (
              <tr key={s.id} className={s.stato === "nuova" ? "bg-[#ffc400]/10 hover:bg-[#ffc400]/20" : "hover:bg-[#f7faf5]"}>
                <td className="whitespace-nowrap px-4 py-2.5 text-xs">{fmtDataOra(s.creataIl)}</td>
                <td className="px-4 py-2.5 font-semibold text-[#1c2b22]">{s.materiale}</td>
                <td className="px-4 py-2.5">{s.quantita || "—"}</td>
                <td className="max-w-[220px] truncate px-4 py-2.5 text-xs text-[#4a5d50]">{s.note || "—"}</td>
                <td className="px-4 py-2.5 text-xs">{s.operatore}</td>
                <td className="px-4 py-2.5">
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${STATO_STYLE[s.stato]}`}>
                    <span className={`h-1.5 w-1.5 rounded-full bg-current ${s.stato === "nuova" ? "animate-pulse" : ""}`} />
                    {STATO_SEGNALAZIONE_LABEL[s.stato]}
                  </span>
                  {s.aggiornataDa && s.stato !== "nuova" && (
                    <div className="mt-0.5 text-[10px] text-[#7fa08a]">
                      da {s.aggiornataDa}{s.aggiornataIl ? ` · ${fmtDataOra(s.aggiornataIl)}` : ""}
                    </div>
                  )}
                </td>
                {isAdmin && (
                  <td className="px-4 py-2.5">
                    {prossimo && (
                      <button
                        onClick={() => avanza(s)}
                        className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-[#b9d6c0] bg-white px-2.5 py-1 text-xs font-semibold text-[#0f4d27] hover:bg-[#f7faf5]"
                      >
                        <Plus size={12} weight="bold" /> Segna {STATO_SEGNALAZIONE_LABEL[prossimo].toLowerCase()}
                      </button>
                    )}
                  </td>
                )}
                {isAdmin && (
                  <td className="px-4 py-2.5">
                    <button
                      onClick={() => setDaEliminare(s)}
                      className="rounded-lg p-1.5 text-red-600 hover:bg-red-50"
                      aria-label="Elimina segnalazione"
                    >
                      <Trash size={16} />
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
          {ordinate.length === 0 && (
            <tr>
              <td colSpan={isAdmin ? 8 : 6} className="px-4 py-6 text-center text-[#4a5d50]">
                Nessuna segnalazione — tutto il materiale è disponibile
              </td>
            </tr>
          )}
        </Table>
      </Card>

      <ConfirmModal
        open={!!daEliminare}
        title="Eliminare questa segnalazione?"
        message={`La segnalazione "${daEliminare?.materiale ?? ""}" verrà eliminata su tutti i dispositivi.`}
        onCancel={() => setDaEliminare(null)}
        onConfirm={() => {
          if (daEliminare) {
            db.deleteSegnalazione(daEliminare.id);
            push("Segnalazione eliminata");
          }
          setDaEliminare(null);
        }}
      />
    </div>
  );
}
