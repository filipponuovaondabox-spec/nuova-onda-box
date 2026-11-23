"use client";

import { useMemo, useState } from "react";
import { Plus, Trash, MagnifyingGlass } from "@phosphor-icons/react";
import { useData, useToasts, operatoreCorrente, utenteCorrente } from "@/lib/store";
import {
  Entrata, TIPI_CARTONE, fmtNum, fmtData, oggiISO, uid, nomeCliente, labelArticolo,
  ordineProdotti, ordineScartati,
} from "@/lib/model";
import { Card, CardHeader, Table, Btn, Field, TextInput, SelectInput, TextArea, ConfirmModal } from "./ui-kit";

export default function EntrataMagazzino() {
  const db = useData();
  const push = useToasts((s) => s.push);
  const isAdmin = utenteCorrente()?.ruolo === "admin";

  // Form state — il formato è il campo primario
  const [data, setData] = useState(oggiISO());
  const [formato, setFormato] = useState("");
  const [tipoCartone, setTipoCartone] = useState(TIPI_CARTONE[0]);
  const [quantita, setQuantita] = useState("");
  const [articoloId, setArticoloId] = useState("");
  const [fornitore, setFornitore] = useState("");
  const [note, setNote] = useState("");

  // Confronto formato: case-insensitive, ignora gli spazi, "x" ≡ "×"
  const normFormato = (s: string) =>
    s.toLowerCase().replace(/\s+/g, "").replace(/×/g, "x");
  const formatoNorm = normFormato(formato);

  // Il menu delle schede mostra SOLO gli articoli il cui formato corrisponde
  // a quello digitato; con formato vuoto si vedono tutte le schede
  const articoliFiltrati = useMemo(() => {
    if (!formatoNorm) return db.articoli;
    return db.articoli.filter((a) => normFormato(a.formatoCartone ?? "") === formatoNorm);
  }, [db.articoli, formatoNorm]);

  const articoloSel = db.articoli.find((a) => a.id === articoloId) ?? null;

  // Il cliente deriva SEMPRE dalla scheda articolo selezionata (campo bloccato)
  const clienteSel = articoloSel
    ? db.clienti.find((c) => c.id === articoloSel.clienteId) ?? null
    : null;
  const clienteLabel = articoloSel
    ? clienteSel?.nome ?? articoloSel.clienteLibero ?? "—"
    : "";

  // Cambio formato: resetta la scheda articolo selezionata
  const cambiaFormato = (v: string) => {
    setFormato(v);
    setArticoloId("");
  };

  // Selezione articolo: compila in automatico la tipologia cartone
  // (il formato resta quello digitato, perché funge da filtro)
  const selezionaArticolo = (id: string) => {
    setArticoloId(id);
    const art = db.articoli.find((a) => a.id === id);
    if (art) {
      if (art.tipoCartone) setTipoCartone(art.tipoCartone);
    }
  };

  // Filtri
  const [filtroCliente, setFiltroCliente] = useState("");
  const [filtroData, setFiltroData] = useState("");

  const [daEliminare, setDaEliminare] = useState<Entrata | null>(null);

  const entrateFiltrate = useMemo(() => {
    return db.entrate.filter((e) => {
      const nome = nomeCliente(db, e.clienteId, e.clienteLibero).toLowerCase();
      const okCliente = !filtroCliente || nome.includes(filtroCliente.toLowerCase());
      const okData = !filtroData || e.data === filtroData;
      return okCliente && okData;
    });
  }, [db, filtroCliente, filtroData]);

  // Giacenza per formato: entrate - consumate (prodotti + scartati degli ordini legati all'entrata)
  const giacenze = useMemo(() => {
    const map = new Map<string, { entrati: number; consumati: number }>();
    db.entrate.forEach((e) => {
      const cur = map.get(e.formato) ?? { entrati: 0, consumati: 0 };
      cur.entrati += e.quantita;
      map.set(e.formato, cur);
    });
    db.ordini.forEach((o) => {
      if (!o.entrataId) return;
      const entrata = db.entrate.find((e) => e.id === o.entrataId);
      if (!entrata) return;
      const cur = map.get(entrata.formato) ?? { entrati: 0, consumati: 0 };
      cur.consumati += ordineProdotti(o) + ordineScartati(o);
      map.set(entrata.formato, cur);
    });
    return Array.from(map.entries())
      .map(([formato, v]) => ({ formato, ...v, giacenza: v.entrati - v.consumati }))
      .sort((a, b) => b.giacenza - a.giacenza);
  }, [db]);

  const salva = (ev: React.FormEvent) => {
    ev.preventDefault();
    const qta = parseInt(quantita, 10);
    if (!formato.trim() || isNaN(qta) || qta <= 0) {
      push("Inserisci formato e quantità validi", "errore");
      return;
    }
    if (!articoloSel) {
      push("Seleziona una scheda articolo", "errore");
      return;
    }
    const entrata: Entrata = {
      id: uid("en"),
      data,
      clienteId: articoloSel.clienteId,
      clienteLibero: articoloSel.clienteLibero,
      formato: formato.trim(),
      tipoCartone,
      quantita: qta,
      articoloId: articoloSel.id,
      fornitore: fornitore.trim(),
      note: note.trim(),
      operatore: operatoreCorrente(),
    };
    db.addEntrata(entrata);
    push(`Entrata registrata: ${fmtNum(qta)} fogli ${formato}`);
    setFormato(""); setQuantita(""); setFornitore(""); setNote(""); setArticoloId("");
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-[#1c2b22]">Entrata Magazzino</h2>
        <p className="text-sm text-[#4a5d50]">Registrazione del cartone in entrata</p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Form */}
        <Card className="xl:col-span-1">
          <CardHeader title="Nuova entrata" subtitle="Registra fogli di cartone in arrivo" />
          <form onSubmit={salva} className="space-y-4 px-5 py-5">
            <Field label="Data">
              <TextInput type="date" value={data} onChange={(e) => setData(e.target.value)} required />
            </Field>
            <Field label="Formato foglio" hint="es. 100×70 — filtra le schede articolo">
              <TextInput placeholder="100×70" value={formato} onChange={(e) => cambiaFormato(e.target.value)} autoFocus />
            </Field>
            <Field label="Scheda articolo" hint={formatoNorm ? "Solo schede con il formato digitato" : "Digita un formato per filtrare"}>
              <SelectInput
                value={articoloId}
                onChange={(e) => selezionaArticolo(e.target.value)}
              >
                <option value="">
                  {articoliFiltrati.length === 0 ? "Nessuna scheda disponibile" : "Seleziona articolo…"}
                </option>
                {articoliFiltrati.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.codice} — {nomeCliente(db, a.clienteId, a.clienteLibero)}
                  </option>
                ))}
              </SelectInput>
            </Field>
            {formatoNorm && articoliFiltrati.length === 0 && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                Nessuna scheda articolo trovata per questo formato. Creala prima nella sezione Articoli.
              </div>
            )}
            <Field label="Cliente" hint="Compilato automaticamente dalla scheda articolo">
              <TextInput
                value={clienteLabel}
                readOnly
                disabled
                placeholder="Seleziona una scheda articolo…"
                className="cursor-not-allowed bg-[#eef3ee] text-[#4a5d50]"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Quantità fogli">
                <TextInput type="number" min={1} placeholder="0" value={quantita} onChange={(e) => setQuantita(e.target.value)} />
              </Field>
              <Field label="Tipologia cartone">
                <SelectInput value={tipoCartone} onChange={(e) => setTipoCartone(e.target.value)}>
                  {TIPI_CARTONE.map((t) => <option key={t}>{t}</option>)}
                </SelectInput>
              </Field>
            </div>
            {articoloSel && (
              <div className="rounded-lg bg-[#f7faf5] px-3 py-2 text-xs text-[#3f5248]">
                <span className="font-semibold">Da scheda:</span> formato {articoloSel.formatoCartone || "—"} · {articoloSel.tipoCartone}
              </div>
            )}
            <Field label="Fornitore">
              <TextInput placeholder="Nome fornitore" value={fornitore} onChange={(e) => setFornitore(e.target.value)} />
            </Field>
            <Field label="Note">
              <TextArea placeholder="Note opzionali…" value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
            <Btn type="submit" className="w-full">
              <Plus size={16} weight="bold" /> Registra entrata
            </Btn>
          </form>
        </Card>

        <div className="space-y-6 xl:col-span-2">
          {/* Giacenze */}
          <Card>
            <CardHeader title="Giacenza per formato" subtitle="Entrate meno consumi di produzione" />
            <Table head={["Formato (mm)", "Entrati", "Consumati", "Giacenza"]}>
              {giacenze.map((g) => (
                <tr key={g.formato} className="hover:bg-[#f7faf5]">
                  <td className="px-4 py-2.5 font-mono font-semibold">{g.formato}</td>
                  <td className="px-4 py-2.5 font-mono">{fmtNum(g.entrati)}</td>
                  <td className="px-4 py-2.5 font-mono text-red-700">{fmtNum(g.consumati)}</td>
                  <td className="px-4 py-2.5 font-mono font-bold text-[#0f4d27]">{fmtNum(g.giacenza)}</td>
                </tr>
              ))}
              {giacenze.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-[#4a5d50]">Nessuna giacenza</td></tr>
              )}
            </Table>
          </Card>

          {/* Tabella entrate */}
          <Card>
            <CardHeader
              title="Entrate registrate"
              subtitle={`${entrateFiltrate.length} registrazioni`}
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
            <Table head={["Data", "Cliente", "Formato", "Tipologia", "Quantità", "Articolo", "Fornitore", "Note", ""]}>
              {entrateFiltrate.map((e) => (
                <tr key={e.id} className="hover:bg-[#f7faf5]">
                  <td className="whitespace-nowrap px-4 py-2.5">{fmtData(e.data)}</td>
                  <td className="px-4 py-2.5">{nomeCliente(db, e.clienteId, e.clienteLibero)}</td>
                  <td className="px-4 py-2.5 font-mono">{e.formato}</td>
                  <td className="px-4 py-2.5">{e.tipoCartone || "—"}</td>
                  <td className="px-4 py-2.5 font-mono">{fmtNum(e.quantita)}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{labelArticolo(db, e.articoloId)}</td>
                  <td className="px-4 py-2.5">{e.fornitore || "—"}</td>
                  <td className="max-w-[160px] truncate px-4 py-2.5 text-[#4a5d50]">{e.note || "—"}</td>
                  <td className="px-4 py-2.5">
                    {isAdmin && (
                      <button
                        onClick={() => setDaEliminare(e)}
                        className="rounded-lg p-1.5 text-red-600 hover:bg-red-50"
                        aria-label="Elimina entrata"
                      >
                        <Trash size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {entrateFiltrate.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-6 text-center text-[#4a5d50]">Nessuna entrata trovata</td></tr>
              )}
            </Table>
          </Card>
        </div>
      </div>

      <ConfirmModal
        open={!!daEliminare}
        title="Eliminare questa entrata?"
        message={daEliminare ? `Verrà eliminata l'entrata del ${fmtData(daEliminare.data)} da ${fmtNum(daEliminare.quantita)} fogli (${daEliminare.formato}). L'operazione non è reversibile.` : ""}
        onCancel={() => setDaEliminare(null)}
        onConfirm={() => {
          if (daEliminare) {
            db.deleteEntrata(daEliminare.id);
            push("Entrata eliminata");
          }
          setDaEliminare(null);
        }}
      />
    </div>
  );
}
