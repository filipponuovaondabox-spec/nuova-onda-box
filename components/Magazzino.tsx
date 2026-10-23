"use client";

import { useMemo } from "react";
import { useData } from "@/lib/store";
import {
  fmtNum, nomeCliente,
  entratiPerArticolo, ordineProdotti, giacenzaScatoleArticolo,
} from "@/lib/model";
import { Card, CardHeader, Table } from "./ui-kit";

// ─── Magazzino unico ────────────────────────────────────────────────────────
// Un'unica vista: per ogni articolo, fogli di cartone entrati, scatole
// prodotte (imballate) e giacenza di scatole (prodotte meno spedite).

export default function Magazzino() {
  const db = useData();

  const righe = useMemo(
    () =>
      db.articoli
        .map((a) => ({
          articolo: a,
          entrati: entratiPerArticolo(db, a.id),
          prodotti: db.ordini
            .filter((o) => o.articoloId === a.id)
            .reduce((s, o) => s + ordineProdotti(o), 0),
          giacenza: giacenzaScatoleArticolo(db, a.id),
        }))
        .sort((a, b) => a.giacenza - b.giacenza),
    [db]
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-[#1c2b22]">Magazzino</h2>
        <p className="text-sm text-[#4a5d50]">
          Giacenze per articolo: cartone entrato, scatole prodotte e scatole in giacenza
        </p>
      </div>

      <Card>
        <CardHeader
          title="Giacenze di magazzino"
          subtitle={`${righe.length} articoli · entrati, prodotti e giacenza per articolo`}
        />
        <Table head={["Articolo", "Cliente", "Formato", "Tipologia", "Dimensione Scatola", "Entrati", "Prodotti", "Giacenza"]}>
          {righe.map((r) => {
            const esaurito = r.giacenza <= 0;
            return (
              <tr
                key={r.articolo.id}
                className={esaurito ? "bg-red-50 hover:bg-red-100/70" : "hover:bg-[#f7faf5]"}
              >
                <td className="px-4 py-2.5 font-mono text-xs font-bold text-[#0f4d27]">
                  {r.articolo.codice}
                </td>
                <td className="px-4 py-2.5">
                  {nomeCliente(db, r.articolo.clienteId, r.articolo.clienteLibero)}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs">
                  {r.articolo.formatoCartone || "—"}
                </td>
                <td className="px-4 py-2.5">{r.articolo.tipoCartone}</td>
                <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs">
                  {r.articolo.dimL}×{r.articolo.dimP}×{r.articolo.dimH}
                </td>
                <td className="px-4 py-2.5 font-mono">{fmtNum(r.entrati)}</td>
                <td className="px-4 py-2.5 font-mono">{fmtNum(r.prodotti)}</td>
                <td className="px-4 py-2.5 font-mono font-bold text-[#0f4d27]">
                  {fmtNum(r.giacenza)}
                </td>
              </tr>
            );
          })}
          {righe.length === 0 && (
            <tr>
              <td colSpan={8} className="px-4 py-6 text-center text-[#4a5d50]">
                Nessun articolo in anagrafica
              </td>
            </tr>
          )}
        </Table>
      </Card>
    </div>
  );
}
