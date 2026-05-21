"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BUSINESS_BOOKING_LABEL,
  BUSINESS_HOURS_LABEL,
  BUSINESS_NAME,
  BUSINESS_SLOT_LABEL,
  INSTAGRAM_HANDLE,
  INSTAGRAM_URL,
  type Service,
} from "./lib/config";
import { getCatalog } from "./lib/catalog";
import { moneyBRL } from "./lib/format";

export default function HomePage() {
  const router = useRouter();
  const [services, setServices] = useState<Service[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);

  const selected = useMemo(
    () => services.find((service) => service.dbId === selectedServiceId) ?? null,
    [services, selectedServiceId],
  );

  useEffect(() => {
    async function loadCatalog() {
      setCatalogLoading(true);
      try {
        const catalog = await getCatalog();
        setServices(catalog.services);
      } finally {
        setCatalogLoading(false);
      }
    }

    void loadCatalog();
  }, []);

  useEffect(() => {
    if (!selectedServiceId) return;
    if (services.some((service) => service.dbId === selectedServiceId)) return;
    setSelectedServiceId(null);
  }, [services, selectedServiceId]);

  function goNext() {
    if (!selectedServiceId) return;
    router.push(`/horarios?service=${encodeURIComponent(selectedServiceId)}`);
  }

  return (
    <main className="min-h-screen text-zinc-100">
      <div className="mx-auto max-w-6xl px-6 py-8 sm:py-10">
        <header className="gold-panel rounded-[28px] px-6 py-5 sm:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <div className="gold-accent-text text-xs font-semibold uppercase tracking-[0.28em]">
                {BUSINESS_NAME}
              </div>
              <h1 className="mt-3 text-4xl font-black tracking-tight text-zinc-50 sm:text-5xl">
                Agende seu horario com valores, tempo e disponibilidade claros.
              </h1>
              <p className="mt-4 max-w-xl text-base leading-7 text-zinc-300 sm:text-lg">
                Escolha o servico, veja os horarios realmente livres e finalize o
                agendamento sem ficar preso a troca de mensagens para entender valores,
                duracao e encaixes da agenda.
              </p>
            </div>

            <div className="grid gap-3 sm:min-w-64">
              <button
                onClick={() => router.push("/meus-agendamentos")}
                className="rounded-2xl border border-zinc-700 bg-zinc-950/70 px-5 py-3 font-semibold text-zinc-100 hover:border-zinc-500 hover:bg-zinc-900"
              >
                Meus agendamentos
              </button>
              <a
                href={INSTAGRAM_URL}
                target="_blank"
                rel="noreferrer"
                className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-3 text-center font-semibold text-amber-100 hover:bg-amber-500/15"
              >
                Ver Instagram
              </a>
            </div>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/55 px-5 py-4">
              <div className="text-xs uppercase tracking-[0.22em] text-zinc-500">Funcionamento</div>
              <div className="mt-2 text-lg font-bold">{BUSINESS_HOURS_LABEL}</div>
              <div className="mt-1 text-sm text-zinc-400">{BUSINESS_SLOT_LABEL}</div>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/55 px-5 py-4">
              <div className="text-xs uppercase tracking-[0.22em] text-zinc-500">Agendamento</div>
              <div className="mt-2 text-lg font-bold">{BUSINESS_BOOKING_LABEL}</div>
              <div className="mt-1 text-sm text-zinc-400">
                Informacoes objetivas antes da confirmacao
              </div>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/55 px-5 py-4">
              <div className="text-xs uppercase tracking-[0.22em] text-zinc-500">Contato</div>
              <div className="mt-2 text-lg font-bold">{INSTAGRAM_HANDLE}</div>
              <div className="mt-1 text-sm text-zinc-400">Atualizacoes e novidades da barbearia</div>
            </div>
          </div>
        </header>

        <section className="mt-8 grid gap-8 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="gold-panel-strong rounded-[28px] p-6 sm:p-8">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="gold-accent-text text-xs font-semibold uppercase tracking-[0.28em]">
                  Passo 1
                </div>
              <h2 className="mt-2 text-3xl font-bold text-zinc-50">Escolha seu servico</h2>
              <p className="mt-3 max-w-2xl text-zinc-300">
                A disponibilidade ja considera o tempo de cada servico, entao os horarios
                exibidos depois fazem sentido para a agenda real.
              </p>
              </div>
              <div className="text-sm text-zinc-500">
                {selected ? "Servico selecionado" : "Nenhum servico selecionado"}
              </div>
            </div>

            <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2">
              {services.map((service) => {
                const active = selectedServiceId === service.dbId;

                return (
                  <button
                    key={service.dbId}
                    onClick={() => setSelectedServiceId(service.dbId)}
                    className={[
                      "group text-left rounded-[24px] border p-7 transition",
                      active
                        ? "border-amber-400/70 bg-amber-500/10 ring-2 ring-amber-300/35"
                        : "border-zinc-800 bg-zinc-950/55 hover:border-zinc-600 hover:bg-zinc-900/90",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="text-2xl font-bold">{service.name}</div>
                      <div
                        className={[
                          "flex h-15 w-29 shrink-0 items-center justify-center rounded-full border px-3 py-1 text-center text-xs font-semibold uppercase tracking-[0.18em] leading-4",
                          active
                            ? "border-amber-300/45 text-amber-100"
                            : "border-zinc-700 text-zinc-400 group-hover:text-zinc-300",
                        ].join(" ")}
                      >
                        <span className="block w-full text-center">{service.minutes} min</span>
                      </div>
                    </div>

                    <div className="mt-3 text-zinc-300">{service.description}</div>

                    <div className="mt-6 flex items-center justify-between gap-6 text-sm text-zinc-300">
                      <div className="text-zinc-400">Atendimento com agenda online</div>
                      <div className="text-lg font-semibold text-zinc-100">
                        {moneyBRL(service.price)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {!catalogLoading && services.length === 0 && (
              <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-950/55 px-5 py-4 text-zinc-300">
                Nenhum servico foi encontrado no catalogo. Cadastre os servicos no Supabase para
                liberar o agendamento.
              </div>
            )}

            <div className="mt-8 flex flex-col gap-4 border-t border-zinc-800 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-zinc-400">
                {catalogLoading
                  ? "Carregando servicos..."
                  : selected
                  ? `Selecionado: ${selected.name}`
                  : "Selecione um servico para liberar os proximos passos."}
              </div>

              <button
                disabled={!selectedServiceId || catalogLoading}
                onClick={goNext}
                className={[
                  "rounded-2xl px-6 py-3 font-semibold transition",
                  selectedServiceId && !catalogLoading
                    ? "bg-zinc-100 text-zinc-950 hover:-translate-y-0.5 hover:bg-white"
                    : "cursor-not-allowed bg-zinc-900 text-zinc-500",
                ].join(" ")}
              >
                Continuar para horarios
              </button>
            </div>
          </div>

          <aside className="gold-panel rounded-[28px] p-6 sm:p-8 lg:sticky lg:top-6 lg:self-start">
            <div className="gold-accent-text text-xs font-semibold uppercase tracking-[0.28em]">
              Resumo
            </div>
            <h2 className="mt-2 text-2xl font-bold text-zinc-50">Seu agendamento comeca aqui</h2>

            <div className="mt-6 grid gap-4">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/55 p-5">
                <div className="text-sm text-zinc-400">Servico</div>
                <div className="mt-2 text-xl font-semibold">
                  {selected?.name ?? "Escolha um servico"}
                </div>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/55 p-5">
                <div className="text-sm text-zinc-400">Duracao</div>
                <div className="mt-2 text-xl font-semibold">
                  {selected ? `${selected.minutes} minutos` : "A definir"}
                </div>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/55 p-5">
                <div className="text-sm text-zinc-400">Valor</div>
                <div className="mt-2 text-xl font-semibold">
                  {selected ? moneyBRL(selected.price) : "A definir"}
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-amber-400/15 bg-amber-500/8 p-5 text-sm leading-6 text-zinc-300">
              Depois de escolher o servico, nos mostramos so horarios compativeis com a duracao
              dele e com a agenda do profissional.
            </div>
          </aside>
        </section>

        <footer className="mt-8 border-t border-zinc-900/80 pt-6 text-sm text-zinc-400">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>Agenda online pronta para teste e operacao basica da barbearia.</div>

            <a
              className="hover:text-zinc-200"
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noreferrer"
            >
              Instagram: {INSTAGRAM_HANDLE}
            </a>
          </div>
        </footer>
      </div>
    </main>
  );
}
