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

  // Form state
  const [data, setData] = useState(oggiISO());
  const [clienteId, setClienteId] = useState(db.clienti[0]?.id ?? "");
  const [clienteLibero, setClienteLibero] = useState("");
  const [usaLibero, setUsaLibero] = useState(false);
  const [formato, setFormato] = useState("");
  const [tipoCartone, setTipoCartone] = useState(TIPI_CARTONE[0]);
  const [quantita, setQuantita] = useState("");
  const [articoloId, setArticoloId] = useState("");
  const [fornitore, setFornitore] = useState("");
  const [note, setNote] = useState("");

  // Articoli collegati al cliente selezionato
  const articoliCliente = useMemo(
    () => db.articoli.filter((a) => !usaLibero && a.clienteId === clienteId),
    [db.articoli, clienteId, usaLibero]
  );
  const articoloSel = db.articoli.find((a) => a.id === articoloId) ?? null;

  // Selezione cliente: resetta l'articolo scelto
  const selezionaCliente = (id: string) => {
    setClienteId(id);
    setArticoloId("");
  };

  // Selezione articolo: compila in automatico formato foglio e tipologia cartone
  const selezionaArticolo = (id: string) => {
    setArticoloId(id);
    const art = db.articoli.find((a) => a.id === id);
    if (art) {
      if (art.formatoCartone) setFormato(art.formatoCartone);
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
    if (usaLibero && !clienteLibero.trim()) {
      push("Inserisci il nome del cliente", "errore");
      return;
    }
    const entrata: Entrata = {
      id: uid("en"),
      data,
      clienteId: usaLibero ? "" : clienteId,
      clienteLibero: usaLibero ? clienteLibero.trim() : undefined,
      formato: formato.trim(),
      tipoCartone,
      quantita: qta,
      articoloId: articoloId || "",
      fornitore: fornitore.trim(),
      note: note.trim(),
      operatore: operatoreCorrente(),
    };
    db.addEntrata(entrata);
    push(`Entrata registrata: ${fmtNum(qta)} fogli ${formato}`);
    setFormato(""); setQuantita(""); setFornitore(""); setNote(""); setClienteLibero("");
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
            <Field label="Cliente">
              <div className="space-y-2">
                <SelectInput
                  value={usaLibero ? "__libero__" : clienteId}
                  onChange={(e) => {
                    if (e.target.value === "__libero__") { setUsaLibero(true); setArticoloId(""); }
                    else { setUsaLibero(false); selezionaCliente(e.target.value); }
                  }}
                >
                  {db.clienti.map((c) => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                  <option value="__libero__">Altro (inserimento libero)…</option>
                </SelectInput>
                {usaLibero && (
                  <TextInput
                    placeholder="Nome cliente"
                    value={clienteLibero}
                    onChange={(e) => setClienteLibero(e.target.value)}
                  />
                )}
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Formato foglio" hint="es. 1200×2000 mm">
                <TextInput placeholder="1200×2000" value={formato} onChange={(e) => setFormato(e.target.value)} />
              </Field>
              <Field label="Quantità fogli">
                <TextInput type="number" min={1} placeholder="0" value={quantita} onChange={(e) => setQuantita(e.target.value)} />
              </Field>
            </div>
            <Field label="Tipologia cartone">
              <SelectInput value={tipoCartone} onChange={(e) => setTipoCartone(e.target.value)}>
                {TIPI_CARTONE.map((t) => <option key={t}>{t}</option>)}
              </SelectInput>
            </Field>
            <Field label="Scheda articolo" hint={usaLibero ? "Disponibile solo per clienti in anagrafica" : "Solo articoli del cliente selezionato"}>
              <SelectInput
                value={articoloId}
                onChange={(e) => selezionaArticolo(e.target.value)}
                disabled={usaLibero}
              >
                <option value="">
                  {usaLibero ? "—" : articoliCliente.length === 0 ? "Nessun articolo per questo cliente" : "Seleziona articolo…"}
                </option>
                {articoliCliente.map((a) => (
                  <option key={a.id} value={a.id}>{a.codice} — {a.dimL}×{a.dimP}×{a.dimH}</option>
                ))}
              </SelectInput>
            </Field>
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
