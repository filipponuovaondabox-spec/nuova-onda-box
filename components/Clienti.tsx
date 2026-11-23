"use client";

import { useMemo, useState } from "react";
import { Plus, PencilSimple, Trash, MagnifyingGlass } from "@phosphor-icons/react";
import { useData, useToasts, utenteCorrente } from "@/lib/store";
import { Cliente, uid } from "@/lib/model";
import { Card, CardHeader, Table, Btn, Field, TextInput, TextArea, ConfirmModal, Modal } from "./ui-kit";
import SchedaCliente from "./SchedaCliente";

const EMPTY_FORM = { nome: "", piva: "", telefono: "", email: "", indirizzo: "", note: "" };

export default function Clienti() {
  const db = useData();
  const push = useToasts((s) => s.push);
  const isAdmin = utenteCorrente()?.ruolo === "admin";

  const [selezionatoId, setSelezionatoId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [filtro, setFiltro] = useState("");
  const [daEliminare, setDaEliminare] = useState<Cliente | null>(null);

  const clientiFiltrati = useMemo(() => {
    const f = filtro.trim().toLowerCase();
    if (!f) return db.clienti;
    return db.clienti.filter((c) =>
      [c.nome, c.piva, c.telefono, c.email, c.indirizzo]
        .some((v) => (v || "").toLowerCase().includes(f))
    );
  }, [db.clienti, filtro]);

  const apriNuovo = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setModalOpen(true);
  };

  const apriModifica = (c: Cliente) => {
    setEditingId(c.id);
    setForm({
      nome: c.nome,
      piva: c.piva,
      telefono: c.telefono ?? c.contatto ?? "",
      email: c.email ?? "",
      indirizzo: c.indirizzo,
      note: c.note,
    });
    setModalOpen(true);
  };

  const salva = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!form.nome.trim()) {
      push("Inserisci la ragione sociale", "errore");
      return;
    }
    if (editingId) {
      db.updateCliente({
        id: editingId,
        nome: form.nome.trim(),
        piva: form.piva.trim(),
        telefono: form.telefono.trim(),
        email: form.email.trim(),
        indirizzo: form.indirizzo.trim(),
        note: form.note.trim(),
      });
      push(`Cliente ${form.nome.trim()} aggiornato`);
    } else {
      db.addCliente({
        id: uid("cl"),
        nome: form.nome.trim(),
        piva: form.piva.trim(),
        telefono: form.telefono.trim(),
        email: form.email.trim(),
        indirizzo: form.indirizzo.trim(),
        note: form.note.trim(),
      });
      push(`Cliente ${form.nome.trim()} creato`);
    }
    setModalOpen(false);
  };

  const elimina = () => {
    if (!daEliminare) return;
    db.deleteCliente(daEliminare.id);
    push(`Cliente ${daEliminare.nome} eliminato`);
    setDaEliminare(null);
  };

  const selezionato = selezionatoId ? db.clienti.find((c) => c.id === selezionatoId) : null;
  if (selezionato) {
    return <SchedaCliente cliente={selezionato} onBack={() => setSelezionatoId(null)} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[#1c2b22]">Clienti</h2>
          <p className="text-sm text-[#4a5d50]">Anagrafica dei clienti dello scatolificio — tocca un cliente per aprire la sua scheda</p>
        </div>
        {isAdmin && (
          <Btn onClick={apriNuovo}><Plus size={16} weight="bold" /> Nuovo cliente</Btn>
        )}
      </div>

      <Card>
        <CardHeader
          title="Clienti registrati"
          subtitle={`${clientiFiltrati.length} clienti`}
          action={
            <div className="relative">
              <MagnifyingGlass size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#7fa08a]" />
              <input
                className="rounded-lg border border-[#b9d6c0] bg-white py-1.5 pl-8 pr-2 text-sm focus:border-[#4e7a5f] focus:outline-none"
                placeholder="Cerca cliente…"
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
              />
            </div>
          }
        />
        <Table head={["Ragione sociale", "P.IVA", "Telefono", "Email", "Indirizzo di consegna", "Note", ...(isAdmin ? [""] : [])]}>
          {clientiFiltrati.map((c) => (
            <tr
              key={c.id}
              className="cursor-pointer hover:bg-[#f7faf5]"
              onClick={() => setSelezionatoId(c.id)}
            >
              <td className="px-4 py-2.5 font-semibold text-[#0f4d27] underline-offset-2 hover:underline">{c.nome}</td>
              <td className="px-4 py-2.5 font-mono text-xs">{c.piva || "—"}</td>
              <td className="px-4 py-2.5">{c.telefono || c.contatto || "—"}</td>
              <td className="px-4 py-2.5">{c.email || "—"}</td>
              <td className="px-4 py-2.5">{c.indirizzo || "—"}</td>
              <td className="max-w-[220px] truncate px-4 py-2.5 text-xs text-[#4a5d50]">{c.note || "—"}</td>
              {isAdmin && (
                <td className="px-4 py-2.5 text-right">
                  <div className="flex justify-end gap-1">
                    <button onClick={(e) => { e.stopPropagation(); apriModifica(c); }} className="rounded-lg p-1.5 text-[#3d6b4c] hover:bg-[#eef4ec]" aria-label="Modifica cliente">
                      <PencilSimple size={16} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setDaEliminare(c); }} className="rounded-lg p-1.5 text-red-600 hover:bg-red-50" aria-label="Elimina cliente">
                      <Trash size={16} />
                    </button>
                  </div>
                </td>
              )}
            </tr>
          ))}
          {clientiFiltrati.length === 0 && (
            <tr><td colSpan={isAdmin ? 7 : 6} className="px-4 py-6 text-center text-[#4a5d50]">Nessun cliente registrato</td></tr>
          )}
        </Table>
      </Card>

      {/* Modal creazione/modifica */}
      <Modal open={modalOpen} title={editingId ? "Modifica cliente" : "Nuovo cliente"} onClose={() => setModalOpen(false)}>
        <form onSubmit={salva} className="space-y-4">
          <Field label="Ragione sociale">
            <TextInput value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Es. Pastificio Rossi S.p.A." required />
          </Field>
          <Field label="P.IVA">
            <TextInput value={form.piva} onChange={(e) => setForm({ ...form, piva: e.target.value })} placeholder="Es. 01234567890" />
          </Field>
          <Field label="Telefono">
            <TextInput value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} placeholder="Es. 0521 000000" />
          </Field>
          <Field label="Email">
            <TextInput type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Es. info@cliente.it" />
          </Field>
          <Field label="Indirizzo di consegna">
            <TextInput value={form.indirizzo} onChange={(e) => setForm({ ...form, indirizzo: e.target.value })} placeholder="Via, numero civico, città" />
          </Field>
          <Field label="Note">
            <TextArea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Note opzionali…" />
          </Field>
          <div className="flex justify-end gap-2">
            <Btn variant="secondary" onClick={() => setModalOpen(false)}>Annulla</Btn>
            <Btn type="submit">{editingId ? "Salva modifiche" : "Crea cliente"}</Btn>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={!!daEliminare}
        title="Eliminare questo cliente?"
        message={`Il cliente "${daEliminare?.nome ?? ""}" verrà rimosso dall'anagrafica. L'operazione non è reversibile.`}
        onCancel={() => setDaEliminare(null)}
        onConfirm={elimina}
      />
    </div>
  );
}
