"use client";

import { useState } from "react";
import { Package, User, LockKey, SignIn } from "@phosphor-icons/react";
import { useAuth, useToasts, verificaCredenziali } from "@/lib/store";

export default function Login() {
  const login = useAuth((s) => s.login);
  const push = useToasts((s) => s.push);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const accedi = (ev: React.FormEvent) => {
    ev.preventDefault();
    const u = verificaCredenziali(username, password);
    if (!u) {
      push("Nome utente o password non validi", "errore");
      return;
    }
    login(u.id);
    push(`Benvenuto, ${u.username}`);
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#0f4d27] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#ffc400] text-[#0f4d27] shadow-lg">
            <Package size={38} weight="bold" />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-white">Nuova Onda Box</h1>
          <p className="mt-1 text-sm text-[#b9d6c0]">Gestionale Scatolificio — accesso riservato</p>
        </div>

        <form
          onSubmit={accedi}
          className="space-y-4 rounded-2xl border border-[#146031] bg-white p-6 shadow-xl"
        >
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#4a5d50]">
              Nome utente
            </span>
            <div className="relative">
              <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7fa08a]" />
              <input
                className="min-h-[44px] w-full rounded-lg border border-[#b9d6c0] bg-white py-2.5 pl-9 pr-3 text-base text-[#1c2b22] placeholder-[#93b39c] focus:border-[#4e7a5f] focus:outline-none focus:ring-2 focus:ring-[#e0a800]/30 sm:text-sm"
                placeholder="Nome utente"
                autoComplete="username"
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#4a5d50]">
              Password
            </span>
            <div className="relative">
              <LockKey size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7fa08a]" />
              <input
                type="password"
                className="min-h-[44px] w-full rounded-lg border border-[#b9d6c0] bg-white py-2.5 pl-9 pr-3 text-base text-[#1c2b22] placeholder-[#93b39c] focus:border-[#4e7a5f] focus:outline-none focus:ring-2 focus:ring-[#e0a800]/30 sm:text-sm"
                placeholder="Password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </label>
          <button
            type="submit"
            className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-[#1b7a3d] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#146031]"
          >
            <SignIn size={16} weight="bold" /> Accedi
          </button>
          <p className="text-center text-xs text-[#7fa08a]">
            La sessione resta attiva su questo dispositivo.
          </p>
        </form>
      </div>
    </div>
  );
}
