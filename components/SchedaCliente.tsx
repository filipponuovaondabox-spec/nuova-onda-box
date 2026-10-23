"use client";

import { useMemo } from "react";
import {
  ArrowLeft, Phone, Envelope, MapPin, NotePencil, IdentificationBadge,
  Warehouse, Factory, PaperPlaneTilt,
} from "@phosphor-icons/react";
import { useData } from "@/lib/store";
import {
  Cliente, fmtNum, fmtData, fmtDataOra, labelArticolo,
  ordineProdotti, ordineScartati, ordineImballati,
} from "@/lib/model";
import { Card, CardHeader, Table, Btn } from "./ui-kit";

// ─── Scheda cliente completa ────────────────────────────────────────────────
// Dati anagrafici, articoli collegati (solo informazioni tecniche) e storico
// completo dei movimenti del cliente (entrate cartone, produzioni, consegne)
// in ordine cronologico.

interface Movimento {
  chiave: string;
  data: string; // ISO date o datetime, per l'ordinamento
  dataLabel: string;
  tipo: "Entrata cartone" | "Produzione" | "Consegna";
  dettaglio: string;
  quantita: string;
  operatore?: string;
  note?: string;
}

const TIPO_STYLE: Record<Movimento["tipo"], string> = {
  "Entrata cartone": "bg-[#eef4ec] text-[#146031] border-[#b9d6c0]",
  Produzione: "bg-[#ffc400]/25 text-[#7a5c00] border-[#e0a800]/50",
  Consegna: "bg-[#0f4d27] text-white border-[#0f4d27]",
};

export default function SchedaCliente({
  cliente,
  onBack,
}: {
  cliente: Cliente;
  onBack: () => void;
}) {
  const db = useData();

  // Articoli collegati al cliente (solo informazioni tecniche dell'articolo)
  const articoli = useMemo(
    () => db.articoli.filter((a) => a.clienteId === cliente.id),
    [db, cliente.id]
  );

  // Storico completo dei movimenti del cliente, in ordine cronologico
  const movimenti = useMemo(() => {
    const lista: Movimento[] = [];

    db.entrate
      .filter((e) => e.clienteId === cliente.id)
      .forEach((e) =>
        lista.push({
          chiave: `en-${e.id}`,
          data: e.data,
          dataLabel: fmtData(e.data),
          tipo: "Entrata cartone",
          dettaglio: `${e.formato}${e.tipoCartone ? ` · ${e.tipoCartone}` : ""}${
            e.fornitore ? ` · ${e.fornitore}` : ""
          } · ${labelArticolo(db, e.articoloId)}`,
          quantita: `+${fmtNum(e.quantita)} fogli`,
          operatore: e.operatore,
          note: e.note,
        })
      );

    db.ordini
      .filter((o) => o.clienteId === cliente.id)
      .forEach((o) => {
        const prodotti = ordineProdotti(o);
        const scartati = ordineScartati(o);
        const imballati = ordineImballati(o);
        const ops = Array.from(
          new Set(o.registrazioni.map((r) => r.operatore).filter(Boolean))
        ).join(", ");
        lista.push({
          chiave: `or-${o.id}`,
          data: o.completatoIl ?? o.iniziatoIl ?? o.creatoIl,
          dataLabel: o.completatoIl
            ? fmtDataOra(o.completatoIl)
            : o.iniziatoIl
              ? fmtDataOra(o.iniziatoIl)
              : fmtData(o.creatoIl),
          tipo: "Produzione",
          dettaglio: `${o.codice} · ${labelArticolo(db, o.articoloId)}${
            scartati > 0 ? ` · ${fmtNum(scartati)} scartati` : ""
          }`,
          quantita: `${fmtNum(prodotti)} fogli · ${fmtNum(imballati)} scatole`,
          operatore: ops || undefined,
        });
      });

    db.spedizioni
      .filter((s) => s.clienteId === cliente.id)
      .forEach((s) =>
        lista.push({
          chiave: `sp-${s.id}`,
          data: s.data,
          dataLabel: fmtData(s.data),
          tipo: "Consegna",
          dettaglio: `DDT ${s.ddt} · Trasporto: ${s.trasporto} · ${labelArticolo(db, s.articoloId)}`,
          quantita: `${fmtNum(s.pezzi)} pezzi · ${fmtNum(s.numPedane)} pedane`,
          operatore: s.operatore,
          note: s.note,
        })
      );

    // Ordine cronologico inverso (dal più recente al più vecchio)
    return lista.sort((a, b) => b.data.localeCompare(a.data));
  }, [db, cliente.id]);

  const anagrafica = [
    { icon: IdentificationBadge, label: "P.IVA", value: cliente.piva || "—" },
    { icon: Phone, label: "Telefono", value: cliente.telefono || cliente.contatto || "—" },
    { icon: Envelope, label: "Email", value: cliente.email || "—" },
    { icon: MapPin, label: "Indirizzo di consegna", value: cliente.indirizzo || "—" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Btn variant="ghost" onClick={onBack}>
          <ArrowLeft size={16} weight="bold" /> Clienti
        </Btn>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[#1c2b22]">{cliente.nome}</h2>
          <p className="text-sm text-[#4a5d50]">Scheda cliente — anagrafica, articoli e movimenti</p>
        </div>
      </div>

      {/* Dati anagrafici */}
      <Card>
        <CardHeader title="Dati anagrafici" subtitle="Informazioni registrate sul cliente" />
        <div className="grid grid-cols-1 gap-4 px-5 py-4 sm:grid-cols-2">
          {anagrafica.map((r) => (
            <div key={r.label} className="flex items-start gap-2.5">
              <r.icon size={18} className="mt-0.5 shrink-0 text-[#4e7a5f]" />
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-[#4a5d50]">
                  {r.label}
                </div>
                <div className="text-sm font-medium text-[#1c2b22]">{r.value}</div>
              </div>
            </div>
          ))}
          {cliente.note && (
            <div className="flex items-start gap-2.5 sm:col-span-2">
              <NotePencil size={18} className="mt-0.5 shrink-0 text-[#4e7a5f]" />
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-[#4a5d50]">Note</div>
                <div className="text-sm leading-relaxed text-[#3f5248]">{cliente.note}</div>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Articoli del cliente */}
      <Card>
        <CardHeader
          title="Articoli del cliente"
          subtitle={`${articoli.length} schede collegate`}
        />
        <Table head={["Articolo", "Dimensioni", "Formato", "Tipologia", "Stampa", "Pedana"]}>
          {articoli.map((a) => (
            <tr key={a.id} className="hover:bg-[#f7faf5]">
              <td className="px-4 py-2.5 font-mono text-xs font-bold text-[#0f4d27]">{a.codice}</td>
              <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs">
                {a.dimL}×{a.dimP}×{a.dimH}
              </td>
              <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs">{a.formatoCartone || "—"}</td>
              <td className="px-4 py-2.5">{a.tipoCartone}</td>
              <td className="px-4 py-2.5">{a.stampa}</td>
              <td className="whitespace-nowrap px-4 py-2.5 text-xs">
                {fmtNum(a.qtaPerPedana)}/pedana · {a.tipoPedana}
              </td>
            </tr>
          ))}
          {articoli.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-6 text-center text-[#4a5d50]">
                Nessun articolo collegato a questo cliente
              </td>
            </tr>
          )}
        </Table>
      </Card>

      {/* Storico movimenti */}
      <Card>
        <CardHeader
          title="Storico movimenti"
          subtitle={`${movimenti.length} movimenti · entrate cartone, produzioni e consegne, dal più recente`}
        />
        <Table head={["Data", "Tipo", "Dettaglio", "Quantità", "Operatore", "Note"]}>
          {movimenti.map((m) => (
            <tr key={m.chiave} className="hover:bg-[#f7faf5]">
              <td className="whitespace-nowrap px-4 py-2.5">{m.dataLabel}</td>
              <td className="px-4 py-2.5">
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${TIPO_STYLE[m.tipo]}`}
                >
                  {m.tipo === "Entrata cartone" ? (
                    <Warehouse size={12} />
                  ) : m.tipo === "Produzione" ? (
                    <Factory size={12} />
                  ) : (
                    <PaperPlaneTilt size={12} />
                  )}
                  {m.tipo}
                </span>
              </td>
              <td className="px-4 py-2.5 text-xs">{m.dettaglio}</td>
              <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs font-semibold">{m.quantita}</td>
              <td className="px-4 py-2.5 text-xs">{m.operatore || "—"}</td>
              <td className="max-w-[200px] truncate px-4 py-2.5 text-xs text-[#4a5d50]">{m.note || "—"}</td>
            </tr>
          ))}
          {movimenti.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-6 text-center text-[#4a5d50]">
                Nessun movimento registrato per questo cliente
              </td>
            </tr>
          )}
        </Table>
      </Card>
    </div>
  );
}
