"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SERVICES } from "./lib/config";
import { moneyBRL } from "./lib/format";

export default function HomePage() {
  const router = useRouter();
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);

  const descriptions = useMemo(() => {
    return {
      corte: "Corte profissional com acabamento impecável.",
      combo: "Serviço completo: corte + barba.",
    } as Record<string, string>;
  }, []);

  const selected = SERVICES.find((s) => s.id === selectedServiceId) ?? null;

  function goNext() {
    if (!selectedServiceId) return;
    router.push(`/horarios?service=${encodeURIComponent(selectedServiceId)}`);
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-zinc-400 text-sm">Barbearia</div>
            <h1 className="mt-1 text-4xl font-bold">Agende seu horário</h1>
            <p className="mt-3 text-zinc-300">
              Escolha o serviço, selecione um horário disponível e confirme em menos de 1 minuto.
            </p>
          </div>

          <button
            onClick={() => router.push("/meus-agendamentos")}
            className="rounded-xl bg-zinc-900 px-5 py-3 font-semibold text-zinc-100 hover:bg-zinc-800 transition"
          >
            Meus agendamentos
          </button>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2">
          {SERVICES.map((s) => {
            const active = selectedServiceId === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setSelectedServiceId(s.id)}
                className={[
                  "text-left rounded-2xl bg-zinc-900/60 p-7 transition",
                  "hover:bg-zinc-900",
                  active ? "ring-2 ring-zinc-100/70" : "ring-1 ring-zinc-800",
                ].join(" ")}
              >
                <div className="text-2xl font-bold">{s.name}</div>

                <div className="mt-2 text-zinc-300">
                  {descriptions[s.id] ?? ""}
                </div>

                <div className="mt-4 flex items-center gap-6 text-sm text-zinc-300">
                  <div>{s.minutes} min</div>
                  <div className="font-semibold text-zinc-100">{moneyBRL(s.price)}</div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-10 flex items-center justify-between gap-4">
          <div className="text-zinc-400">
            {selected
              ? `Selecionado: ${selected.name}`
              : "Selecione um serviço para continuar."}
          </div>

          <button
            disabled={!selectedServiceId}
            onClick={goNext}
            className={[
              "rounded-xl px-6 py-3 font-semibold transition",
              selectedServiceId
                ? "bg-zinc-100 text-zinc-950 hover:bg-white"
                : "bg-zinc-900 text-zinc-500 cursor-not-allowed",
            ].join(" ")}
          >
            Continuar
          </button>
        </div>

        <footer className="mt-12 border-t border-zinc-900 pt-6 text-sm text-zinc-400">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>*Valores e serviços são exemplo. Depois vamos puxar isso do banco.</div>

            <a
              className="hover:text-zinc-200 transition"
              href="https://instagram.com/barbeariagoldeninterlagos"
              target="_blank"
              rel="noreferrer"
            >
              Instagram: @barbeariagoldeninterlagos
            </a>
          </div>
        </footer>
      </div>
    </main>
  );
}
