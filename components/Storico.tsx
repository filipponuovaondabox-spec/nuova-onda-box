"use client";

import { useMemo, useState } from "react";
import { Warehouse, Factory, PaperPlaneTilt, MagnifyingGlass } from "@phosphor-icons/react";
import { useData } from "@/lib/store";
import {
  fmtNum, fmtData, fmtDataOra, nomeCliente, labelArticolo,
  ordineProdotti, ordineScartati, ordineImballati,
} from "@/lib/model";
import { Card, CardHeader, Table } from "./ui-kit";

// ─── Storico movimenti generale ─────────────────────────────────────────────
// Tutti i movimenti (entrate cartone, produzioni, consegne) in ordine
// cronologico inverso, con l'utente che ha registrato ciascuna operazione.

interface Movimento {
  chiave: string;
  data: string;
  dataLabel: string;
  tipo: "Entrata cartone" | "Produzione" | "Consegna";
  cliente: string;
  dettaglio: string;
  quantita: string;
  operatore?: string;
}

const TIPO_STYLE: Record<Movimento["tipo"], string> = {
  "Entrata cartone": "bg-[#eef4ec] text-[#146031] border-[#b9d6c0]",
  Produzione: "bg-[#ffc400]/25 text-[#7a5c00] border-[#e0a800]/50",
  Consegna: "bg-[#0f4d27] text-white border-[#0f4d27]",
};

type FiltroTipo = "tutti" | Movimento["tipo"];

export default function Storico() {
  const db = useData();
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>("tutti");
  const [filtroCliente, setFiltroCliente] = useState("");

  const movimenti = useMemo(() => {
    const lista: Movimento[] = [];

    db.entrate.forEach((e) =>
      lista.push({
        chiave: `en-${e.id}`,
        data: e.data,
        dataLabel: fmtData(e.data),
        tipo: "Entrata cartone",
        cliente: nomeCliente(db, e.clienteId, e.clienteLibero),
        dettaglio: `${e.formato}${e.tipoCartone ? ` · ${e.tipoCartone}` : ""}${
          e.fornitore ? ` · ${e.fornitore}` : ""
        } · ${labelArticolo(db, e.articoloId)}`,
        quantita: `+${fmtNum(e.quantita)} fogli`,
        operatore: e.operatore,
      })
    );

    db.ordini.forEach((o) => {
      const prodotti = ordineProdotti(o);
      const scartati = ordineScartati(o);
      const imballati = ordineImballati(o);
      const ops = Array.from(
        new Set(o.registrazioni.map((r) => r.operatore).filter(Boolean))
      ).join(", ");
      lista.push({
        chiave: `or-${o.id}`,
        data: o.completatoIl ?? o.iniziatoIl ?? o.creatoIl,
        dataLabel: o.completatoIl || o.iniziatoIl
          ? fmtDataOra(o.completatoIl ?? o.iniziatoIl!)
          : fmtData(o.creatoIl),
        tipo: "Produzione",
        cliente: nomeCliente(db, o.clienteId, o.clienteLibero),
        dettaglio: `${o.codice} · ${labelArticolo(db, o.articoloId)}${
          scartati > 0 ? ` · ${fmtNum(scartati)} scartati` : ""
        }`,
        quantita: `${fmtNum(prodotti)} fogli · ${fmtNum(imballati)} scatole`,
        operatore: ops || undefined,
      });
    });

    db.spedizioni.forEach((s) =>
      lista.push({
        chiave: `sp-${s.id}`,
        data: s.data,
        dataLabel: fmtData(s.data),
        tipo: "Consegna",
        cliente: nomeCliente(db, s.clienteId, s.clienteLibero),
        dettaglio: `DDT ${s.ddt} · Trasporto: ${s.trasporto} · ${labelArticolo(db, s.articoloId)}`,
        quantita: `${fmtNum(s.pezzi)} pezzi · ${fmtNum(s.numPedane)} pedane`,
        operatore: s.operatore,
      })
    );

    // Più recenti in alto
    return lista.sort((a, b) => b.data.localeCompare(a.data));
  }, [db]);

  const filtrati = useMemo(() => {
    const f = filtroCliente.trim().toLowerCase();
    return movimenti.filter((m) => {
      if (filtroTipo !== "tutti" && m.tipo !== filtroTipo) return false;
      if (f && !m.cliente.toLowerCase().includes(f)) return false;
      return true;
    });
  }, [movimenti, filtroTipo, filtroCliente]);

  const tipi: { id: FiltroTipo; label: string }[] = [
    { id: "tutti", label: "Tutti" },
    { id: "Entrata cartone", label: "Entrate" },
    { id: "Produzione", label: "Produzioni" },
    { id: "Consegna", label: "Consegne" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-[#1c2b22]">Storico movimenti</h2>
        <p className="text-sm text-[#4a5d50]">
          Tutti i movimenti registrati, dal più recente · con l'utente che li ha eseguiti
        </p>
      </div>

      <Card>
        <CardHeader
          title={`${filtrati.length} movimenti`}
          subtitle="Entrate, produzioni e consegne"
          action={
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-lg border border-[#cfe3d2] bg-[#f7faf5] p-0.5">
                {tipi.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setFiltroTipo(t.id)}
                    className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                      filtroTipo === t.id ? "bg-[#0f4d27] text-white" : "text-[#3d6b4c] hover:bg-[#eef4ec]"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="relative">
                <MagnifyingGlass size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#7fa08a]" />
                <input
                  className="rounded-lg border border-[#b9d6c0] bg-white py-1.5 pl-8 pr-2 text-sm focus:border-[#4e7a5f] focus:outline-none"
                  placeholder="Cerca cliente…"
                  value={filtroCliente}
                  onChange={(e) => setFiltroCliente(e.target.value)}
                />
              </div>
            </div>
          }
        />
        <Table head={["Data", "Tipo", "Cliente", "Dettaglio", "Quantità", "Utente"]}>
          {filtrati.map((m) => (
            <tr key={m.chiave} className="hover:bg-[#f7faf5]">
              <td className="whitespace-nowrap px-4 py-2.5">{m.dataLabel}</td>
              <td className="px-4 py-2.5">
                <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${TIPO_STYLE[m.tipo]}`}>
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
              <td className="px-4 py-2.5 font-medium">{m.cliente}</td>
              <td className="px-4 py-2.5 text-xs">{m.dettaglio}</td>
              <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs font-semibold">{m.quantita}</td>
              <td className="px-4 py-2.5 text-xs">{m.operatore || "—"}</td>
            </tr>
          ))}
          {filtrati.length === 0 && (
            <tr><td colSpan={6} className="px-4 py-6 text-center text-[#4a5d50]">Nessun movimento trovato</td></tr>
          )}
        </Table>
      </Card>
    </div>
  );
}
