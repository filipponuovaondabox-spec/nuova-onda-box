"use client";

import { useEffect, useState } from "react";
import {
  ChartLineUp,
  Users,
  Package,
  Factory,
  PaperPlaneTilt,
  ClipboardText,
  SignOut,
  List,
  X,
  ArrowsClockwise,
  CloudCheck,
  CloudSlash,
  HardDrive,
  Trash,
  Warehouse,
  Bell,
  ClockCounterClockwise,
  UserGear,
} from "@phosphor-icons/react";
import {
  useData,
  useSync,
  startCloudSync,
  ToastHost,
  useAuth,
  initAuth,
  utenteCorrente,
} from "@/lib/store-bridge";
import { ConfirmModal } from "@/components/ui-kit";
import Dashboard from "@/components/Dashboard";
import Clienti from "@/components/Clienti";
import EntrataMagazzino from "@/components/EntrataMagazzino";
import SchedeArticolo from "@/components/SchedeArticolo";
import Produzione from "@/components/Produzione";
import UscitaMagazzino from "@/components/UscitaMagazzino";
import Magazzino from "@/components/Magazzino";
import Segnalazioni from "@/components/Segnalazioni";
import Storico from "@/components/Storico";
import Utenti from "@/components/Utenti";
import Login from "@/components/Login";

type Sezione =
  | "dashboard"
  | "clienti"
  | "entrata"
  | "articoli"
  | "produzione"
  | "uscita"
  | "magazzino"
  | "segnalazioni"
  | "storico"
  | "utenti";

const NAV: { id: Sezione; label: string; icon: React.ElementType; adminOnly?: boolean }[] = [
  { id: "dashboard", label: "Dashboard", icon: ChartLineUp },
  { id: "clienti", label: "Clienti", icon: Users },
  { id: "entrata", label: "Entrata", icon: Package },
  { id: "articoli", label: "Articoli", icon: ClipboardText },
  { id: "produzione", label: "Produzione", icon: Factory },
  { id: "uscita", label: "Uscita", icon: PaperPlaneTilt },
  { id: "magazzino", label: "Magazzino", icon: Warehouse },
  { id: "segnalazioni", label: "Da ordinare", icon: Bell },
  { id: "storico", label: "Storico", icon: ClockCounterClockwise },
  { id: "utenti", label: "Utenti", icon: UserGear, adminOnly: true },
];

function SyncIndicator() {
  const sync = useSync();
  const icon =
    sync.status === "synced" ? (
      <CloudCheck size={14} weight="fill" />
    ) : sync.status === "syncing" || sync.status === "loading" ? (
      <ArrowsClockwise size={14} className="animate-spin" />
    ) : sync.status === "local" ? (
      <HardDrive size={14} weight="fill" />
    ) : (
      <CloudSlash size={14} weight="fill" />
    );
  const label =
    sync.status === "synced"
      ? "Sincronizzato"
      : sync.status === "syncing"
        ? "Salvataggio…"
        : sync.status === "loading"
          ? "Caricamento…"
          : sync.status === "local"
            ? "Dati locali"
            : "Offline";
  return (
    <div
      className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
        sync.status === "offline"
          ? "bg-red-100 text-red-700"
          : sync.status === "synced"
            ? "bg-[#e6f2e8] text-[#146031]"
            : sync.status === "local"
              ? "bg-[#e8eef6] text-[#2c4a73]"
              : "bg-[#fff3cd] text-[#7a5c00]"
      }`}
      title={
        sync.status === "local"
          ? "Modalità locale: dati salvati su questo dispositivo"
          : sync.lastSync
            ? `Ultimo sync: ${new Date(sync.lastSync).toLocaleTimeString("it-IT")}`
            : "Mai sincronizzato"
      }
    >
      {icon}
      {label}
    </div>
  );
}

function LogoMark() {
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#ffc400] shadow-sm">
      <Package size={20} weight="bold" className="text-[#0f4d27]" />
    </div>
  );
}

export default function Page() {
  const [sezione, setSezione] = useState<Sezione>("dashboard");
  const [menuAperto, setMenuAperto] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const db = useData();
  const auth = useAuth();

  useEffect(() => {
    initAuth();
    startCloudSync();
    setHydrated(true);
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  const utente = utenteCorrente();
  const isAdmin = utente?.ruolo === "admin";
  const navItems = NAV.filter((n) => !n.adminOnly || isAdmin);
  const nuoveSegnalazioni = db.segnalazioni.filter((s) => s.stato === "nuova").length;

  // Sezione non consentita (es. operatore su "utenti") → torna alla dashboard
  useEffect(() => {
    if (utente && sezione === "utenti" && utente.ruolo !== "admin") {
      setSezione("dashboard");
    }
  }, [utente, sezione]);

  if (!hydrated || !auth.ready) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#eef4ec]">
        <div className="flex flex-col items-center gap-3">
          <LogoMark />
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#0f4d27] border-t-transparent" />
          <p className="text-sm font-medium text-[#4a5d50]">Caricamento…</p>
        </div>
      </div>
    );
  }

  if (!utente) {
    return (
      <>
        <Login />
        <ToastHost />
      </>
    );
  }

  const vaiA = (s: Sezione) => {
    setSezione(s);
    setMenuAperto(false);
  };

  const badge = (id: Sezione) =>
    id === "segnalazioni" && isAdmin && nuoveSegnalazioni > 0 ? (
      <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-[#ffc400] px-1.5 text-[11px] font-bold text-[#0f4d27]">
        {nuoveSegnalazioni}
      </span>
    ) : null;

  const sidebarContent = (
    <>
      <div className="flex items-center gap-3 px-5 py-5">
        <LogoMark />
        <div>
          <div className="text-sm font-bold tracking-tight text-white">Nuova Onda Box</div>
          <div className="text-[11px] font-medium text-[#b9d6c0]">Gestione magazzino</div>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {navItems.map((n) => {
          const Icon = n.icon;
          const attivo = sezione === n.id;
          return (
            <button
              key={n.id}
              onClick={() => vaiA(n.id)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                attivo ? "bg-[#1b7a3d] text-white shadow-sm" : "text-[#cfe3d2] hover:bg-[#146031] hover:text-white"
              }`}
            >
              <Icon size={18} weight={attivo ? "fill" : "regular"} />
              {n.label}
              {badge(n.id)}
            </button>
          );
        })}
      </nav>
      <div className="space-y-3 border-t border-[#146031] px-4 py-4">
        <SyncIndicator />
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-xs font-bold text-white">{utente.username}</div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-[#b9d6c0]">
              {utente.ruolo === "admin" ? "Amministratore" : "Operatore"}
            </div>
          </div>
          <button
            onClick={() => auth.logout()}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-[#cfe3d2] hover:bg-[#146031] hover:text-white"
            title="Esci"
          >
            <SignOut size={16} weight="bold" />
            Esci
          </button>
        </div>
        {isAdmin && (
          <button
            onClick={() => setResetOpen(true)}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium text-[#b9d6c0] hover:bg-[#146031] hover:text-white"
          >
            <Trash size={14} /> Azzera tutti i dati
          </button>
        )}
      </div>
    </>
  );

  return (
    <div className="min-h-[100dvh] bg-[#f7faf5]">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-[#0f4d27] lg:flex">
        {sidebarContent}
      </aside>

      {/* Sidebar mobile */}
      {menuAperto && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMenuAperto(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-[#0f4d27] shadow-xl">
            <button
              onClick={() => setMenuAperto(false)}
              className="absolute right-3 top-4 rounded-lg p-1.5 text-[#cfe3d2] hover:bg-[#146031]"
              aria-label="Chiudi menu"
            >
              <X size={18} weight="bold" />
            </button>
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Topbar mobile */}
      <div className="sticky top-0 z-20 flex items-center justify-between bg-[#0f4d27] px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setMenuAperto(true)}
            className="rounded-lg p-1.5 text-white hover:bg-[#146031]"
            aria-label="Apri menu"
          >
            <List size={20} weight="bold" />
          </button>
          <LogoMark />
          <span className="text-sm font-bold text-white">Nuova Onda Box</span>
        </div>
        <div className="flex items-center gap-2">
          <SyncIndicator />
          <button
            onClick={() => auth.logout()}
            className="rounded-lg p-1.5 text-[#cfe3d2] hover:bg-[#146031] hover:text-white"
            aria-label="Esci"
            title={`Esci (${utente.username})`}
          >
            <SignOut size={18} weight="bold" />
          </button>
        </div>
      </div>

      {/* Contenuto */}
      <main className="px-4 pb-24 pt-6 sm:px-6 lg:ml-60 lg:px-8 lg:pb-10">
        <div className="mx-auto max-w-[1400px]">
          {sezione === "dashboard" && <Dashboard />}
          {sezione === "clienti" && <Clienti />}
          {sezione === "entrata" && <EntrataMagazzino />}
          {sezione === "articoli" && <SchedeArticolo />}
          {sezione === "produzione" && <Produzione />}
          {sezione === "uscita" && <UscitaMagazzino />}
          {sezione === "magazzino" && <Magazzino />}
          {sezione === "segnalazioni" && <Segnalazioni />}
          {sezione === "storico" && <Storico />}
          {sezione === "utenti" && isAdmin && <Utenti />}
        </div>
      </main>

      {/* Bottom nav mobile */}
      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-6 border-t border-[#cfe3d2] bg-white lg:hidden">
        {navItems.slice(0, 6).map((n) => {
          const Icon = n.icon;
          const attivo = sezione === n.id;
          return (
            <button
              key={n.id}
              onClick={() => vaiA(n.id)}
              className={`relative flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold ${
                attivo ? "text-[#0f4d27]" : "text-[#7fa08a]"
              }`}
            >
              <Icon size={20} weight={attivo ? "fill" : "regular"} />
              {n.label}
              {n.id === "segnalazioni" && isAdmin && nuoveSegnalazioni > 0 && (
                <span className="absolute right-2 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#ffc400] px-1 text-[9px] font-bold text-[#0f4d27]">
                  {nuoveSegnalazioni}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <ToastHost />
      <ConfirmModal
        open={resetOpen}
        title="Azzerare tutti i dati?"
        message="Verranno eliminati clienti, articoli, entrate, ordini, spedizioni e segnalazioni. Gli account utente verranno mantenuti. L'operazione non è reversibile."
        onCancel={() => setResetOpen(false)}
        onConfirm={() => {
          db.resetDati();
          setResetOpen(false);
        }}
      />
    </div>
  );
}
