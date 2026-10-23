"use client";

import { useState } from "react";
import { Plus, PencilSimple, Trash, UserCircle, ShieldCheck, Power, WarningCircle } from "@phosphor-icons/react";
import { useData, useToasts, useAuth, utenteCorrente, DEFAULT_ADMIN } from "@/lib/store";
import { Utente, Ruolo, uid } from "@/lib/model";
import { Card, CardHeader, Table, Btn, Field, TextInput, SelectInput, ConfirmModal, Modal } from "./ui-kit";

// ─── Gestione utenti (solo admin) ───────────────────────────────────────────
// Crea/modifica/elimina account e password. Le modifiche si propagano a tutti
// i dispositivi tramite il database condiviso.

const EMPTY_FORM = { username: "", password: "", ruolo: "operatore" as Ruolo };

export default function Utenti() {
  const db = useData();
  const push = useToasts((s) => s.push);
  const corrente = utenteCorrente();
  const sessionUserId = useAuth((s) => s.userId);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [daEliminare, setDaEliminare] = useState<Utente | null>(null);

  const apriNuovo = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setModalOpen(true);
  };

  const apriModifica = (u: Utente) => {
    setEditingId(u.id);
    setForm({ username: u.username, password: u.password, ruolo: u.ruolo });
    setModalOpen(true);
  };

  const salva = (ev: React.FormEvent) => {
    ev.preventDefault();
    const username = form.username.trim();
    if (!username || !form.password) {
      push("Inserisci nome utente e password", "errore");
      return;
    }
    const duplicato = db.utenti.find(
      (u) => u.username.toLowerCase() === username.toLowerCase() && u.id !== editingId
    );
    if (duplicato) {
      push(`Il nome utente "${username}" è già in uso`, "errore");
      return;
    }
    if (editingId) {
      const esistente = db.utenti.find((u) => u.id === editingId);
      if (!esistente) return;
      db.updateUtente({ ...esistente, username, password: form.password, ruolo: form.ruolo });
      push(`Utente ${username} aggiornato`);
    } else {
      db.addUtente({ id: uid("ut"), username, password: form.password, ruolo: form.ruolo, attivo: true });
      push(`Utente ${username} creato`);
    }
    setModalOpen(false);
  };

  const elimina = () => {
    if (!daEliminare) return;
    db.deleteUtente(daEliminare.id);
    push(`Utente ${daEliminare.username} eliminato`);
    setDaEliminare(null);
  };

  const toggleAttivo = (u: Utente) => {
    db.updateUtente({ ...u, attivo: !u.attivo });
    push(u.attivo ? `Utente ${u.username} disattivato` : `Utente ${u.username} riattivato`);
  };

  // Avviso se l'admin predefinito usa ancora la password iniziale
  const adminDefault = db.utenti.find((u) => u.username === DEFAULT_ADMIN.username);
  const passwordDaCambiare = !!adminDefault && adminDefault.password === DEFAULT_ADMIN.password;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[#1c2b22]">Utenti</h2>
          <p className="text-sm text-[#4a5d50]">Account di accesso all'applicazione</p>
        </div>
        <Btn onClick={apriNuovo}><Plus size={16} weight="bold" /> Nuovo utente</Btn>
      </div>

      {passwordDaCambiare && (
        <div className="flex items-start gap-3 rounded-xl border border-[#e0a800]/60 bg-[#ffc400]/15 px-4 py-3.5">
          <WarningCircle size={22} weight="fill" className="mt-0.5 shrink-0 text-[#8a6d00]" />
          <div className="text-sm leading-relaxed text-[#5c4700]">
            <strong className="font-bold">Cambia la password iniziale.</strong> L&apos;account{" "}
            <span className="font-mono font-semibold">admin</span> usa ancora la password predefinita{" "}
            <span className="font-mono font-semibold">nuovaonda2024</span>. Per la sicurezza dei dati,
            modificala subito: tocca la matita accanto all&apos;utente admin e inserisci una nuova password.
          </div>
        </div>
      )}

      <Card>
        <CardHeader title="Account registrati" subtitle={`${db.utenti.length} utenti`} />
        <Table head={["Nome utente", "Ruolo", "Stato", ""]}>
          {db.utenti.map((u) => {
            const isSelf = u.id === sessionUserId;
            return (
              <tr key={u.id} className="hover:bg-[#f7faf5]">
                <td className="px-4 py-2.5">
                  <span className="inline-flex items-center gap-2 font-semibold text-[#1c2b22]">
                    <UserCircle size={18} className="text-[#4e7a5f]" />
                    {u.username}
                    {isSelf && (
                      <span className="rounded-full bg-[#ffc400]/25 px-2 py-0.5 text-[10px] font-bold text-[#7a5c00]">
                        tu
                      </span>
                    )}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  {u.ruolo === "admin" ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-[#0f4d27] bg-[#0f4d27] px-2 py-0.5 text-xs font-semibold text-white">
                      <ShieldCheck size={12} weight="fill" /> Admin
                    </span>
                  ) : (
                    <span className="rounded-full border border-[#b9d6c0] bg-[#eef4ec] px-2 py-0.5 text-xs font-semibold text-[#146031]">
                      Operatore
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  {u.attivo ? (
                    <span className="rounded-full border border-green-300 bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">Attivo</span>
                  ) : (
                    <span className="rounded-full border border-stone-300 bg-stone-100 px-2 py-0.5 text-xs font-semibold text-stone-600">Disattivato</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <div className="flex justify-end gap-1">
                    <button onClick={() => apriModifica(u)} className="rounded-lg p-1.5 text-[#3d6b4c] hover:bg-[#eef4ec]" aria-label="Modifica utente">
                      <PencilSimple size={16} />
                    </button>
                    <button
                      onClick={() => toggleAttivo(u)}
                      disabled={isSelf}
                      className={`rounded-lg p-1.5 disabled:cursor-not-allowed disabled:opacity-30 ${
                        u.attivo ? "text-[#8a6d00] hover:bg-[#ffc400]/15" : "text-green-700 hover:bg-green-50"
                      }`}
                      aria-label={u.attivo ? "Disattiva utente" : "Riattiva utente"}
                      title={u.attivo ? "Disattiva utente" : "Riattiva utente"}
                    >
                      <Power size={16} weight="bold" />
                    </button>
                    <button
                      onClick={() => setDaEliminare(u)}
                      disabled={isSelf}
                      className="rounded-lg p-1.5 text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-30"
                      aria-label="Elimina utente"
                    >
                      <Trash size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </Table>
      </Card>

      <Modal open={modalOpen} title={editingId ? "Modifica utente" : "Nuovo utente"} onClose={() => setModalOpen(false)}>
        <form onSubmit={salva} className="space-y-4">
          <Field label="Nome utente">
            <TextInput value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="Es. mario.reparto" required />
          </Field>
          <Field label="Password" hint={editingId ? "Inserisci la nuova password per cambiarla" : undefined}>
            <TextInput type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Password" required />
          </Field>
          <Field label="Ruolo">
            <SelectInput value={form.ruolo} onChange={(e) => setForm({ ...form, ruolo: e.target.value as Ruolo })}>
              <option value="operatore">Operatore — registra movimenti e segnalazioni</option>
              <option value="admin">Admin — accesso completo</option>
            </SelectInput>
          </Field>
          <div className="flex justify-end gap-2">
            <Btn variant="secondary" onClick={() => setModalOpen(false)}>Annulla</Btn>
            <Btn type="submit">{editingId ? "Salva modifiche" : "Crea utente"}</Btn>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={!!daEliminare}
        title="Eliminare questo utente?"
        message={`L'account "${daEliminare?.username ?? ""}" non potrà più accedere all'app su nessun dispositivo.`}
        onCancel={() => setDaEliminare(null)}
        onConfirm={elimina}
      />
    </div>
  );
}
