"use client";

import { useMemo } from "react";
import {
  Package, Factory, CheckCircle, Trash, Truck, Download, ArrowRight,
  Warehouse, GearSix, PaperPlaneTilt, DeviceMobile, AndroidLogo, AppleLogo, CloudCheck,
} from "@phosphor-icons/react";
import { useData, useToasts } from "@/lib/store";
import {
  fmtNum, fmtPct, fmtData, fmtDataBreve, giorniFaISO, oggiISO,
  ordineProdotti, ordineScartati, scartoPct, avanzamentoPct, nomeCliente, labelArticolo,
} from "@/lib/model";
import { Card, CardHeader, StatusBadge, ProgressBar, Table, Btn } from "./ui-kit";

export default function Dashboard() {
  const db = useData();
  const push = useToasts((s) => s.push);

  const stats = useMemo(() => {
    // Giacenza: entrate - consumate in produzione (prodotti + scartati)
    const totEntrati = db.entrate.reduce((s, e) => s + e.quantita, 0);
    const totConsumati = db.ordini.reduce(
      (s, o) => s + ordineProdotti(o) + ordineScartati(o), 0
    );
    const giacenza = totEntrati - totConsumati;

    const inProduzione = db.ordini.filter((o) => o.stato === "in_produzione").length;
    const completati = db.ordini.filter((o) => o.stato === "completato").length;

    const conScarto = db.ordini.filter((o) => o.registrazioni.length > 0);
    const scartoMedio =
      conScarto.length > 0
        ? conScarto.reduce((s, o) => s + scartoPct(o), 0) / conScarto.length
        : 0;

    const meseCorrente = oggiISO().slice(0, 7);
    const spedizioniMese = db.spedizioni.filter((s) => s.data.startsWith(meseCorrente)).length;

    return { giacenza, inProduzione, completati, scartoMedio, spedizioniMese };
  }, [db]);

  // Grafico: produzione ultimi 7 giorni
  const chartData = useMemo(() => {
    const days: { label: string; prodotti: number; scartati: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const day = giorniFaISO(i);
      let prodotti = 0;
      let scartati = 0;
      db.ordini.forEach((o) =>
        o.registrazioni.forEach((r) => {
          if (r.data === day) {
            prodotti += r.prodotti;
            scartati += r.scartati;
          }
        })
      );
      days.push({ label: fmtDataBreve(day), prodotti, scartati });
    }
    return days;
  }, [db.ordini]);

  const maxVal = Math.max(1, ...chartData.map((d) => d.prodotti + d.scartati));

  const ordiniAttivi = db.ordini.filter((o) => o.stato !== "spedito");

  const esportaDati = () => {
    const payload = {
      esportatoIl: new Date().toISOString(),
      clienti: db.clienti,
      articoli: db.articoli,
      entrate: db.entrate,
      ordini: db.ordini,
      spedizioni: db.spedizioni,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nuova-onda-box-export-${oggiISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    push("Dati esportati in JSON");
  };

  const kpis = [
    { label: "Fogli in giacenza", value: fmtNum(stats.giacenza), icon: Package, color: "text-[#4e7a5f] bg-[#eef4ec]" },
    { label: "Ordini in produzione", value: fmtNum(stats.inProduzione), icon: Factory, color: "text-[#8a6d00] bg-[#ffc400]/25" },
    { label: "Ordini completati", value: fmtNum(stats.completati), icon: CheckCircle, color: "text-green-700 bg-green-100" },
    { label: "Scarto medio", value: fmtPct(stats.scartoMedio), icon: Trash, color: "text-red-700 bg-red-100" },
    { label: "Spedizioni del mese", value: fmtNum(stats.spedizioniMese), icon: Truck, color: "text-[#0f4d27] bg-[#b9d6c0]/50" },
  ];

  const flusso = [
    { label: "Entrata", count: db.entrate.length, desc: "registrazioni", icon: Warehouse },
    { label: "Produzione", count: db.ordini.length, desc: "ordini totali", icon: GearSix },
    { label: "Uscita", count: db.spedizioni.length, desc: "spedizioni", icon: PaperPlaneTilt },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[#1c2b22]">Dashboard</h2>
          <p className="text-sm text-[#4a5d50]">Panoramica ufficio · aggiornata al {fmtData(oggiISO())}</p>
        </div>
        <Btn variant="secondary" onClick={esportaDati}>
          <Download size={16} weight="bold" /> Esporta dati
        </Btn>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {kpis.map((k) => (
          <Card key={k.label} className="p-4">
            <div className={`mb-3 inline-flex rounded-lg p-2 ${k.color}`}>
              <k.icon size={20} weight="duotone" />
            </div>
            <div className="font-mono text-2xl font-semibold text-[#1c2b22]">{k.value}</div>
            <div className="mt-1 text-xs font-medium uppercase tracking-wide text-[#4a5d50]">{k.label}</div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Grafico produzione */}
        <Card className="lg:col-span-2">
          <CardHeader title="Produzione ultimi 7 giorni" subtitle="Fogli prodotti vs scartati" />
          {chartData.every((d) => d.prodotti === 0 && d.scartati === 0) && (
            <p className="px-5 pt-4 text-center text-xs text-[#7fa08a]">
              Nessuna produzione registrata — il grafico si popolerà con i primi ordini completati.
            </p>
          )}
          <div className="flex h-56 items-end gap-3 px-5 py-5">
            {chartData.map((d) => (
              <div key={d.label} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex h-40 w-full items-end justify-center gap-1">
                  <div
                    className="w-1/3 rounded-t bg-[#5e8a6d]"
                    style={{ height: `${(d.prodotti / maxVal) * 100}%` }}
                    title={`Prodotti: ${fmtNum(d.prodotti)}`}
                  />
                  <div
                    className="w-1/3 rounded-t bg-red-400"
                    style={{ height: `${(d.scartati / maxVal) * 100}%` }}
                    title={`Scartati: ${fmtNum(d.scartati)}`}
                  />
                </div>
                <span className="text-[11px] text-[#4a5d50]">{d.label}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-4 border-t border-[#e2eee2] px-5 py-3 text-xs text-[#4a5d50]">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#5e8a6d]" /> Prodotti</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-red-400" /> Scartati</span>
          </div>
        </Card>

        {/* Flusso del ciclo */}
        <Card>
          <CardHeader title="Flusso del ciclo" subtitle="Entrata → Produzione → Uscita" />
          <div className="space-y-1 px-5 py-5">
            {flusso.map((f, i) => (
              <div key={f.label}>
                <div className="flex items-center gap-3 rounded-lg bg-[#f7faf5] px-4 py-3">
                  <f.icon size={22} weight="duotone" className="text-[#4e7a5f]" />
                  <div className="flex-1">
                    <div className="text-sm font-bold text-[#1c2b22]">{f.label}</div>
                    <div className="text-xs text-[#4a5d50]">{f.desc}</div>
                  </div>
                  <span className="font-mono text-xl font-semibold text-[#0f4d27]">{fmtNum(f.count)}</span>
                </div>
                {i < flusso.length - 1 && (
                  <div className="flex justify-center py-1 text-[#8fb894]">
                    <ArrowRight size={16} weight="bold" className="rotate-90" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Installazione PWA sul telefono */}
      <Card className="overflow-hidden border-[#e0a800]/40">
        <div className="flex flex-col gap-4 bg-gradient-to-r from-[#0f4d27] to-[#146031] px-5 py-5 sm:flex-row sm:items-center">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#ffc400] text-[#0f4d27]">
            <DeviceMobile size={26} weight="duotone" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-bold tracking-tight text-white">Installa sul telefono</h3>
            <p className="mt-0.5 text-sm text-[#b9d6c0]">
              Apri <span className="font-semibold text-[#ffc400]">lo stesso link di questa app</span> sul
              telefono e aggiungila alla schermata Home: funziona come un&apos;app vera e i dati sono
              condivisi automaticamente con l&apos;ufficio e gli altri operatori.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-[#ffc400]/15 px-3 py-1.5 text-xs font-semibold text-[#ffc400] sm:self-center">
            <CloudCheck size={15} weight="bold" /> Dati condivisi in tempo reale
          </span>
        </div>
        <div className="grid grid-cols-1 gap-4 px-5 py-5 sm:grid-cols-2">
          <div className="rounded-lg border border-[#cfe3d2] bg-[#f7faf5] p-4">
            <div className="flex items-center gap-2 text-sm font-bold text-[#0f4d27]">
              <AndroidLogo size={18} weight="fill" className="text-[#1b7a3d]" /> Android
            </div>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-[#3f5248]">
              <li>Apri il link dell&apos;app con <strong>Chrome</strong></li>
              <li>Tocca il menu <strong>⋮</strong> in alto a destra</li>
              <li>Tocca <strong>«Installa app»</strong> o <strong>«Aggiungi a schermata Home»</strong></li>
            </ol>
          </div>
          <div className="rounded-lg border border-[#cfe3d2] bg-[#f7faf5] p-4">
            <div className="flex items-center gap-2 text-sm font-bold text-[#0f4d27]">
              <AppleLogo size={18} weight="fill" /> iPhone
            </div>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-[#3f5248]">
              <li>Apri il link dell&apos;app con <strong>Safari</strong></li>
              <li>Tocca il pulsante <strong>Condividi</strong> (quadrato con freccia)</li>
              <li>Tocca <strong>«Aggiungi a Home»</strong></li>
            </ol>
          </div>
        </div>
      </Card>

      {/* Ordini attivi */}
      <Card>
        <CardHeader title="Ordini attivi" subtitle="Ordini non ancora spediti" />
        <Table head={["Codice", "Articolo", "Cliente", "Richiesta", "Scadenza", "Stato", "Avanzamento"]}>
          {ordiniAttivi.map((o) => (
            <tr key={o.id} className="hover:bg-[#f7faf5]">
              <td className="px-4 py-3 font-mono text-xs font-semibold">{o.codice}</td>
              <td className="px-4 py-3">{labelArticolo(db, o.articoloId)}</td>
              <td className="px-4 py-3">{nomeCliente(db, o.clienteId, o.clienteLibero)}</td>
              <td className="px-4 py-3 font-mono">{fmtNum(o.qtaRichiesta)}</td>
              <td className="px-4 py-3">{fmtData(o.scadenza)}</td>
              <td className="px-4 py-3"><StatusBadge stato={o.stato} /></td>
              <td className="px-4 py-3"><ProgressBar pct={avanzamentoPct(o)} /></td>
            </tr>
          ))}
          {ordiniAttivi.length === 0 && (
            <tr><td colSpan={7} className="px-4 py-6 text-center text-[#4a5d50]">Nessun ordine attivo</td></tr>
          )}
        </Table>
      </Card>
    </div>
  );
}
