"use client";

import { useMemo, useRef, useState } from "react";
import { Plus, PencilSimple, Trash, CaretDown, CaretUp, Factory, FileImage, FilePdf, UploadSimple, X, MagnifyingGlass } from "@phosphor-icons/react";
import { useData, useToasts, utenteCorrente } from "@/lib/store";
import {
  Articolo, TIPI_CARTONE, TIPI_STAMPA, TIPI_PEDANA,
  fmtNum, fmtData, oggiISO, uid, nomeCliente, ordineProdotti, ordineScartati, scartoPct,
} from "@/lib/model";
import { Card, Btn, Field, TextInput, SelectInput, TextArea, ConfirmModal, Modal, StatusBadge } from "./ui-kit";
import BozzaModal from "./BozzaModal";

const EMPTY_FORM = {
  codice: "", clienteId: "", dimL: "", dimP: "", dimH: "",
  formatoCartone: "", tipoCartone: TIPI_CARTONE[0], colore: "",
  stampa: TIPI_STAMPA[0], numeroImpianto: "",
  bozzaNome: "", bozzaData: "",
  qtaPerPacco: "", qtaPerPedana: "", tipoPedana: TIPI_PEDANA[0], note: "",
};

export default function SchedeArticolo() {
  const db = useData();
  const push = useToasts((s) => s.push);
  const isAdmin = utenteCorrente()?.ruolo === "admin";

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [espansa, setEspansa] = useState<string | null>(null);
  const [daEliminare, setDaEliminare] = useState<Articolo | null>(null);
  const [bozzaAperta, setBozzaAperta] = useState<Articolo | null>(null);
  const [ricerca, setRicerca] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Filtro live: cerca nel codice articolo e nel nome del cliente (case-insensitive)
  const articoliFiltrati = useMemo(() => {
    const q = ricerca.trim().toLowerCase();
    if (!q) return db.articoli;
    return db.articoli.filter((a) => {
      const cliente = nomeCliente(db, a.clienteId, a.clienteLibero).toLowerCase();
      return a.codice.toLowerCase().includes(q) || cliente.includes(q);
    });
  }, [db, ricerca]);

  const apriNuovo = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, clienteId: db.clienti[0]?.id ?? "" });
    setModalOpen(true);
  };

  const apriModifica = (a: Articolo) => {
    setEditingId(a.id);
    setForm({
      codice: a.codice, clienteId: a.clienteId,
      dimL: String(a.dimL), dimP: String(a.dimP), dimH: String(a.dimH),
      formatoCartone: a.formatoCartone ?? "", tipoCartone: a.tipoCartone,
      colore: a.colore ?? "", stampa: a.stampa, numeroImpianto: a.numeroImpianto ?? "",
      bozzaNome: a.bozzaNome ?? "", bozzaData: a.bozzaData ?? "",
      qtaPerPacco: String(a.qtaPerPacco), qtaPerPedana: String(a.qtaPerPedana ?? ""),
      tipoPedana: a.tipoPedana, note: a.note,
    });
    setModalOpen(true);
  };

  const caricaBozza = (file: File | undefined) => {
    if (!file) return;
    const ok = file.type.startsWith("image/") || file.type === "application/pdf";
    if (!ok) {
      push("La bozza deve essere un'immagine o un PDF", "errore");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setForm((f) => ({ ...f, bozzaNome: file.name, bozzaData: String(reader.result) }));
      push(`Bozza "${file.name}" caricata`);
    };
    reader.readAsDataURL(file);
  };

  const salva = (ev: React.FormEvent) => {
    ev.preventDefault();
    const dimL = parseInt(form.dimL, 10), dimP = parseInt(form.dimP, 10), dimH = parseInt(form.dimH, 10);
    const qtaPerPacco = parseInt(form.qtaPerPacco, 10);
    const qtaPerPedana = parseInt(form.qtaPerPedana, 10);
    if (!form.codice.trim() || [dimL, dimP, dimH, qtaPerPacco, qtaPerPedana].some((n) => isNaN(n) || n <= 0)) {
      push("Compila tutti i campi numerici con valori validi", "errore");
      return;
    }
    const base = {
      codice: form.codice.trim(), clienteId: form.clienteId,
      dimL, dimP, dimH,
      formatoCartone: form.formatoCartone.trim(), tipoCartone: form.tipoCartone,
      colore: form.colore.trim(), stampa: form.stampa, numeroImpianto: form.numeroImpianto.trim(),
      bozzaNome: form.bozzaNome || undefined, bozzaData: form.bozzaData || undefined,
      qtaPerPacco, qtaPerPedana, tipoPedana: form.tipoPedana, note: form.note.trim(),
    };
    if (editingId) {
      db.updateArticolo({
        ...base,
        id: editingId,
        creataIl: db.articoli.find((a) => a.id === editingId)?.creataIl ?? oggiISO(),
      });
      push(`Scheda ${form.codice} aggiornata`);
    } else {
      db.addArticolo({ ...base, id: uid("ar"), creataIl: oggiISO() });
      push(`Scheda ${form.codice} creata`);
    }
    setModalOpen(false);
  };

  const storicoArticolo = (articoloId: string) =>
    db.ordini.filter((o) => o.articoloId === articoloId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[#1c2b22]">Schede Articolo</h2>
          <p className="text-sm text-[#4a5d50]">Anagrafica tecnica degli articoli prodotti</p>
        </div>
        {isAdmin && (
          <Btn onClick={apriNuovo}><Plus size={16} weight="bold" /> Nuova scheda</Btn>
        )}
      </div>

      {db.articoli.length > 0 && (
        <div className="relative max-w-md">
          <MagnifyingGlass
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#7fa08a]"
          />
          <input
            type="text"
            className="w-full rounded-lg border border-[#b9d6c0] bg-white py-2 pl-9 pr-9 text-sm focus:border-[#4e7a5f] focus:outline-none"
            placeholder="Cerca per codice articolo o cliente…"
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

      {db.articoli.length === 0 && (
        <Card className="p-8 text-center text-sm text-[#4a5d50]">
          Nessuna scheda articolo — crea la prima scheda con il pulsante «Nuova scheda».
        </Card>
      )}

      {db.articoli.length > 0 && articoliFiltrati.length === 0 && (
        <Card className="p-8 text-center text-sm text-[#4a5d50]">
          Nessun articolo trovato
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {articoliFiltrati.map((a) => {
          const storico = storicoArticolo(a.id);
          const aperta = espansa === a.id;
          return (
            <Card key={a.id} className="flex flex-col">
              <div className="flex-1 px-5 py-4">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-mono text-sm font-bold text-[#0f4d27]">{a.codice}</span>
                    <div className="mt-0.5 text-sm text-[#4a5d50]">{nomeCliente(db, a.clienteId, a.clienteLibero)}</div>
                  </div>
                  <span className="rounded-md bg-[#eef4ec] px-2 py-1 font-mono text-xs font-semibold text-[#3d6b4c]">
                    {a.dimL}×{a.dimP}×{a.dimH}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                  <span className="rounded-full bg-[#eef4ec] px-2 py-0.5 text-[#146031]">{a.tipoCartone}</span>
                  {a.formatoCartone && <span className="rounded-full bg-[#eef4ec] px-2 py-0.5 text-[#146031]">{a.formatoCartone}</span>}
                  {a.colore && <span className="rounded-full bg-[#eef4ec] px-2 py-0.5 text-[#146031]">{a.colore}</span>}
                  <span className="rounded-full bg-[#eef4ec] px-2 py-0.5 text-[#146031]">Stampa: {a.stampa}</span>
                  <span className="rounded-full bg-[#eef4ec] px-2 py-0.5 text-[#146031]">{a.qtaPerPacco}/pacco</span>
                  <span className="rounded-full bg-[#eef4ec] px-2 py-0.5 text-[#146031]">{fmtNum(a.qtaPerPedana)}/pedana</span>
                  <span className="rounded-full bg-[#eef4ec] px-2 py-0.5 text-[#146031]">{a.tipoPedana}</span>
                </div>

                {a.bozzaData && (
                  <button
                    onClick={() => setBozzaAperta(a)}
                    className="mt-3 flex w-full items-center gap-2 rounded-lg border border-[#cfe3d2] bg-[#f7faf5] px-3 py-2 text-left text-xs font-semibold text-[#3d6b4c] hover:bg-[#eef4ec]"
                  >
                    {a.bozzaData.startsWith("data:application/pdf") ? <FilePdf size={18} /> : <FileImage size={18} />}
                    Bozza di stampa: {a.bozzaNome || "visualizza"}
                  </button>
                )}

                {aperta && (
                  <div className="mt-4 space-y-3 border-t border-[#e2eee2] pt-3 text-sm">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div><span className="font-semibold text-[#4a5d50]">Formato cartone:</span> {a.formatoCartone || "—"}</div>
                      <div><span className="font-semibold text-[#4a5d50]">Colore:</span> {a.colore || "—"}</div>
                      <div><span className="font-semibold text-[#4a5d50]">Impianto stampa:</span> {a.numeroImpianto || "—"}</div>
                      <div><span className="font-semibold text-[#4a5d50]">Quantità per pedana:</span> {fmtNum(a.qtaPerPedana)}</div>
                      <div><span className="font-semibold text-[#4a5d50]">Creata il:</span> {fmtData(a.creataIl)}</div>
                    </div>
                    {a.note && <p className="text-xs leading-relaxed text-[#3f5248]"><span className="font-semibold">Note:</span> {a.note}</p>}
                    <div>
                      <div className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[#4a5d50]">
                        <Factory size={13} /> Storico produzioni ({storico.length})
                      </div>
                      {storico.length === 0 && <p className="text-xs text-[#7fa08a]">Nessuna produzione collegata</p>}
                      <ul className="space-y-1.5">
                        {storico.map((o) => (
                          <li key={o.id} className="flex items-center justify-between rounded-lg bg-[#f7faf5] px-3 py-1.5 text-xs">
                            <span className="font-mono font-semibold">{o.codice}</span>
                            <span className="text-[#4a5d50]">
                              {fmtNum(ordineProdotti(o))} prod. · {fmtNum(ordineScartati(o))} scart. ({scartoPct(o).toFixed(1)}%)
                            </span>
                            <StatusBadge stato={o.stato} />
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between border-t border-[#e2eee2] px-5 py-2.5">
                <button
                  onClick={() => setEspansa(aperta ? null : a.id)}
                  className="flex items-center gap-1 text-xs font-semibold text-[#4e7a5f] hover:text-[#3d6b4c]"
                >
                  {aperta ? <><CaretUp size={14} /> Chiudi</> : <><CaretDown size={14} /> Dettagli</>}
                </button>
                {isAdmin && (
                  <div className="flex gap-1">
                    <button onClick={() => apriModifica(a)} className="rounded-lg p-1.5 text-[#3d6b4c] hover:bg-[#eef4ec]" aria-label="Modifica scheda">
                      <PencilSimple size={16} />
                    </button>
                    <button onClick={() => setDaEliminare(a)} className="rounded-lg p-1.5 text-red-600 hover:bg-red-50" aria-label="Elimina scheda">
                      <Trash size={16} />
                    </button>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Modal creazione/modifica */}
      <Modal open={modalOpen} title={editingId ? "Modifica scheda articolo" : "Nuova scheda articolo"} onClose={() => setModalOpen(false)} wide>
        <form onSubmit={salva} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Codice articolo">
            <TextInput value={form.codice} onChange={(e) => setForm({ ...form, codice: e.target.value })} placeholder="SC-0000-00" />
          </Field>
          <Field label="Cliente">
            <SelectInput value={form.clienteId} onChange={(e) => setForm({ ...form, clienteId: e.target.value })}>
              {db.clienti.length === 0 && <option value="">Nessun cliente in anagrafica</option>}
              {db.clienti.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </SelectInput>
          </Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label="L (mm)"><TextInput type="number" min={1} value={form.dimL} onChange={(e) => setForm({ ...form, dimL: e.target.value })} /></Field>
            <Field label="P (mm)"><TextInput type="number" min={1} value={form.dimP} onChange={(e) => setForm({ ...form, dimP: e.target.value })} /></Field>
            <Field label="H (mm)"><TextInput type="number" min={1} value={form.dimH} onChange={(e) => setForm({ ...form, dimH: e.target.value })} /></Field>
          </div>
          <Field label="Formato cartone" hint="es. 1200x800 mm">
            <TextInput value={form.formatoCartone} onChange={(e) => setForm({ ...form, formatoCartone: e.target.value })} placeholder="1200x800 mm" />
          </Field>
          <Field label="Tipologia cartone">
            <SelectInput value={form.tipoCartone} onChange={(e) => setForm({ ...form, tipoCartone: e.target.value })}>
              {TIPI_CARTONE.map((t) => <option key={t}>{t}</option>)}
            </SelectInput>
          </Field>
          <Field label="Colore">
            <TextInput value={form.colore} onChange={(e) => setForm({ ...form, colore: e.target.value })} placeholder="Es. avana, bianco…" />
          </Field>
          <Field label="Stampa">
            <SelectInput value={form.stampa} onChange={(e) => setForm({ ...form, stampa: e.target.value })}>
              {TIPI_STAMPA.map((t) => <option key={t}>{t}</option>)}
            </SelectInput>
          </Field>
          <Field label="Numero impianto stampa">
            <TextInput value={form.numeroImpianto} onChange={(e) => setForm({ ...form, numeroImpianto: e.target.value })} placeholder="Es. IMP-01" />
          </Field>
          <Field label="Tipo di pedana">
            <SelectInput value={form.tipoPedana} onChange={(e) => setForm({ ...form, tipoPedana: e.target.value })}>
              {TIPI_PEDANA.map((t) => <option key={t}>{t}</option>)}
            </SelectInput>
          </Field>
          <Field label="Quantità per pacco">
            <TextInput type="number" min={1} value={form.qtaPerPacco} onChange={(e) => setForm({ ...form, qtaPerPacco: e.target.value })} />
          </Field>
          <Field label="Quantità per pedana" hint="Scatole/fogli per pedana">
            <TextInput type="number" min={1} value={form.qtaPerPedana} onChange={(e) => setForm({ ...form, qtaPerPedana: e.target.value })} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Bozza di stampa" hint="Immagine o PDF della bozza">
              <div className="flex items-center gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={(e) => caricaBozza(e.target.files?.[0])}
                />
                <Btn variant="secondary" onClick={() => fileRef.current?.click()}>
                  <UploadSimple size={16} weight="bold" /> Carica bozza
                </Btn>
                {form.bozzaData ? (
                  <span className="flex min-w-0 flex-1 items-center gap-2 rounded-lg bg-[#eef4ec] px-3 py-2 text-xs font-medium text-[#146031]">
                    {form.bozzaData.startsWith("data:application/pdf") ? <FilePdf size={16} /> : <FileImage size={16} />}
                    <span className="truncate">{form.bozzaNome || "bozza caricata"}</span>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, bozzaNome: "", bozzaData: "" })}
                      className="ml-auto rounded p-0.5 text-red-600 hover:bg-red-50"
                      aria-label="Rimuovi bozza"
                    >
                      <X size={14} weight="bold" />
                    </button>
                  </span>
                ) : (
                  <span className="text-xs text-[#7fa08a]">Nessun file selezionato</span>
                )}
              </div>
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Note tecniche">
              <TextArea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Fustellatura, tolleranze, vincoli di stampa…" />
            </Field>
          </div>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Btn variant="secondary" onClick={() => setModalOpen(false)}>Annulla</Btn>
            <Btn type="submit">{editingId ? "Salva modifiche" : "Crea scheda"}</Btn>
          </div>
        </form>
      </Modal>

      <BozzaModal articolo={bozzaAperta} onClose={() => setBozzaAperta(null)} />

      <ConfirmModal
        open={!!daEliminare}
        title="Eliminare questa scheda articolo?"
        message={daEliminare ? `Verrà eliminata la scheda ${daEliminare.codice}. Gli ordini e le entrate collegati non verranno rimossi, ma perderanno il riferimento tecnico.` : ""}
        onCancel={() => setDaEliminare(null)}
        onConfirm={() => {
          if (daEliminare) {
            db.deleteArticolo(daEliminare.id);
            push(`Scheda ${daEliminare.codice} eliminata`);
          }
          setDaEliminare(null);
        }}
      />
    </div>
  );
}
