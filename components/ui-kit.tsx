"use client";

import React, { useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, CheckCircle, WarningCircle, Info } from "@phosphor-icons/react";
import { OrderStatus, STATUS_LABEL, fmtNum } from "@/lib/model";
import { useToasts } from "@/lib/store";

// ─── Badge di stato ─────────────────────────────────────────────────────────

const STATUS_STYLE: Record<OrderStatus, string> = {
  da_produrre: "bg-stone-200 text-stone-700 border-stone-300",
  in_produzione: "bg-[#ffc400]/25 text-[#7a5c00] border-[#e0a800]/50",
  completato: "bg-green-100 text-green-800 border-green-300",
  spedito: "bg-[#0f4d27] text-white border-[#0f4d27]",
};

export function StatusBadge({ stato }: { stato: OrderStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[stato]}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full bg-current opacity-70 ${
          stato === "in_produzione" ? "animate-pulse" : ""
        }`}
      />
      {STATUS_LABEL[stato]}
    </span>
  );
}

// ─── Card ───────────────────────────────────────────────────────────────────

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-[#cfe3d2] bg-white shadow-[0_1px_3px_rgba(83,62,47,0.08),0_4px_12px_rgba(83,62,47,0.05)] ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-[#e2eee2] px-5 py-4">
      <div>
        <h3 className="text-base font-bold tracking-tight text-[#1c2b22]">{title}</h3>
        {subtitle && <p className="mt-0.5 text-sm text-[#4a5d50]">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

// ─── Bottoni ────────────────────────────────────────────────────────────────

type BtnVariant = "primary" | "secondary" | "danger" | "ghost";

const BTN_STYLE: Record<BtnVariant, string> = {
  primary:
    "bg-[#1b7a3d] text-white hover:bg-[#146031] shadow-sm",
  secondary:
    "bg-[#ffc400] text-[#0f4d27] border border-[#e0a800] hover:bg-[#ffcf33] shadow-sm",
  danger: "bg-red-600 text-white hover:bg-red-700",
  ghost: "text-[#3d6b4c] hover:bg-[#eef4ec]",
};

export function Btn({
  children,
  onClick,
  variant = "primary",
  type = "button",
  disabled,
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: BtnVariant;
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${BTN_STYLE[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

// ─── Campi form ─────────────────────────────────────────────────────────────

const INPUT_CLS =
  "w-full min-h-[44px] rounded-lg border border-[#b9d6c0] bg-white px-3 py-2.5 text-base sm:text-sm text-[#1c2b22] placeholder-[#93b39c] focus:border-[#4e7a5f] focus:outline-none focus:ring-2 focus:ring-[#e0a800]/30";

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#4a5d50]">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-[#7fa08a]">{hint}</span>}
    </label>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${INPUT_CLS} ${props.className ?? ""}`} />;
}

export function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${INPUT_CLS} ${props.className ?? ""}`} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} rows={2} className={`${INPUT_CLS} ${props.className ?? ""}`} />;
}

// ─── Tabella ────────────────────────────────────────────────────────────────

export function Table({
  head,
  children,
}: {
  head: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-[#cfe3d2] bg-[#f7faf5]">
            {head.map((h) => (
              <th
                key={h}
                className="whitespace-nowrap px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-[#4a5d50]"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#e2eee2]">{children}</tbody>
      </table>
    </div>
  );
}

// ─── Modal di conferma ──────────────────────────────────────────────────────

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Elimina",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onCancel]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={onCancel}
        >
          <motion.div
            initial={{ scale: 0.95, y: 8 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 8 }}
            transition={{ duration: 0.15 }}
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-[#1c2b22]">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-[#3f5248]">{message}</p>
            <div className="mt-5 flex justify-end gap-2">
              <Btn variant="secondary" onClick={onCancel}>
                Annulla
              </Btn>
              <Btn variant="danger" onClick={onConfirm}>
                {confirmLabel}
              </Btn>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Modal generico ─────────────────────────────────────────────────────────

export function Modal({
  open,
  title,
  onClose,
  children,
  wide,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.97, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.97, y: 12 }}
            transition={{ duration: 0.15 }}
            className={`my-8 w-full ${wide ? "max-w-3xl" : "max-w-lg"} rounded-xl bg-white shadow-xl`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#e2eee2] px-6 py-4">
              <h3 className="text-lg font-bold text-[#1c2b22]">{title}</h3>
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-[#4a5d50] hover:bg-[#eef4ec]"
                aria-label="Chiudi"
              >
                <X size={18} weight="bold" />
              </button>
            </div>
            <div className="px-6 py-5">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Toasts ─────────────────────────────────────────────────────────────────

export function ToastHost() {
  const { toasts, dismiss } = useToasts();
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            className={`pointer-events-auto flex items-center gap-3 rounded-lg border px-4 py-3 text-sm font-medium shadow-lg ${
              t.tipo === "successo"
                ? "border-green-300 bg-green-50 text-green-900"
                : t.tipo === "errore"
                  ? "border-red-300 bg-red-50 text-red-900"
                  : "border-[#e0a800]/50 bg-[#ffc400]/15 text-[#7a5c00]"
            }`}
          >
            {t.tipo === "successo" ? (
              <CheckCircle size={18} weight="fill" className="shrink-0 text-green-600" />
            ) : t.tipo === "errore" ? (
              <WarningCircle size={18} weight="fill" className="shrink-0 text-red-600" />
            ) : (
              <Info size={18} weight="fill" className="shrink-0 text-[#e0a800]" />
            )}
            <span className="flex-1">{t.messaggio}</span>
            <button onClick={() => dismiss(t.id)} aria-label="Chiudi notifica">
              <X size={14} weight="bold" className="opacity-60 hover:opacity-100" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// ─── Barra di avanzamento ───────────────────────────────────────────────────

export function ProgressBar({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-full max-w-[140px] overflow-hidden rounded-full bg-[#e2eee2]">
        <div
          className={`h-full rounded-full transition-all ${
            clamped >= 100 ? "bg-green-600" : "bg-[#e0a800]"
          }`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className="font-mono text-xs text-[#4a5d50]">{fmtNum(clamped)}%</span>
    </div>
  );
}
