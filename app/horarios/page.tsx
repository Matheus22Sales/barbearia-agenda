"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  OPEN_HOUR,
  CLOSE_HOUR,
  SLOT_STEP_MIN,
  type Professional,
  type Service,
} from "../lib/config";
import { findServiceByParam, getCatalog } from "../lib/catalog";
import { formatDateShortBR } from "../lib/format";
import { supabase } from "../lib/supabaseClient";

type AppointmentRow = {
  start_time?: string | null;
  time?: string | null;
  service_id?: string | null;
  service?: string | null;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${y}-${m}-${day}`;
}

function addDays(base: Date, days: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function minutesToTime(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${pad2(h)}:${pad2(m)}`;
}

function timeToMinutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function getSaoPauloNowSnapshot() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(new Date());
  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "00";

  return {
    isoDate: `${getPart("year")}-${getPart("month")}-${getPart("day")}`,
    currentMinutes: Number(getPart("hour")) * 60 + Number(getPart("minute")),
  };
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return fallback;
}

function inferDurationFromCatalog(services: Service[], row: AppointmentRow) {
  const serviceId = (row.service_id ?? "").toLowerCase();
  const serviceName = (row.service ?? "").toLowerCase();
  const matchedService = services.find((service) => {
    const currentId = service.id.toLowerCase();
    return currentId === serviceId || service.dbId === serviceId || service.name.toLowerCase() === serviceName;
  });

  return matchedService?.minutes ?? 30;
}

function HorariosPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const saoPauloNow = useMemo(() => getSaoPauloNowSnapshot(), []);

  const serviceId = (searchParams.get("service") ?? "").toLowerCase();
  const [services, setServices] = useState<Service[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);

  const service = useMemo(() => findServiceByParam(services, serviceId), [services, serviceId]);

  const days = useMemo(() => {
    const base = new Date();
    base.setHours(0, 0, 0, 0);

    return Array.from({ length: 7 }).map((_, i) => {
      const dt = addDays(base, i);
      const iso = toISODate(dt);
      return { iso, label: formatDateShortBR(iso) };
    });
  }, []);

  const [selectedDate, setSelectedDate] = useState<string>(days[0]?.iso ?? "");
  const [selectedProId, setSelectedProId] = useState<string>("");
  const [loadingTimes, setLoadingTimes] = useState(false);
  const [bookedRanges, setBookedRanges] = useState<Array<{ start: number; end: number }>>([]);
  const [timesError, setTimesError] = useState<string | null>(null);

  useEffect(() => {
    async function loadCatalog() {
      setCatalogLoading(true);
      try {
        const catalog = await getCatalog();
        setServices(catalog.services);
        setProfessionals(catalog.professionals);
      } finally {
        setCatalogLoading(false);
      }
    }

    void loadCatalog();
  }, []);

  const durationMin = service?.minutes ?? 30;

  const slots = useMemo(() => {
    const openMin = OPEN_HOUR * 60;
    const closeMin = CLOSE_HOUR * 60;
    const lastStart = closeMin - durationMin;

    const list: string[] = [];
    for (let t = openMin; t <= lastStart; t += SLOT_STEP_MIN) {
      list.push(minutesToTime(t));
    }
    return list;
  }, [durationMin]);

  useEffect(() => {
    async function loadAppointments() {
      setBookedRanges([]);
      setTimesError(null);

      if (!selectedDate || !selectedProId) return;

      setLoadingTimes(true);
      try {
        const { data, error } = await supabase
          .from("appointments")
          .select("start_time,time,service_id,service")
          .eq("professional_id", selectedProId)
          .eq("date", selectedDate);

        if (error) throw error;

        const ranges = ((data ?? []) as AppointmentRow[])
          .map((row) => {
            const rawTime = row.start_time ?? row.time ?? "";
            if (!rawTime) return null;

            const start = timeToMinutes(String(rawTime).slice(0, 5));
            const end = start + inferDurationFromCatalog(services, row);
            return { start, end };
          })
          .filter((value): value is { start: number; end: number } => Boolean(value));

        setBookedRanges(ranges);
      } catch (error) {
        setTimesError(getErrorMessage(error, "Erro ao carregar horários."));
      } finally {
        setLoadingTimes(false);
      }
    }

    void loadAppointments();
  }, [selectedDate, selectedProId, services]);

  const selectedPro = professionals.find((p) => p.id === selectedProId);
  const canShowTimes = Boolean(service && selectedDate && selectedProId && !catalogLoading);
  const isSelectedDateToday = selectedDate === saoPauloNow.isoDate;
  const visibleSlots = useMemo(
    () =>
      slots.filter((time) => {
        if (!isSelectedDateToday) return true;
        return timeToMinutes(time) > saoPauloNow.currentMinutes;
      }),
    [isSelectedDateToday, saoPauloNow.currentMinutes, slots],
  );

  const goConfirm = (time: string) => {
    if (!service) {
      alert("Serviço inválido. Volte e selecione novamente.");
      router.push("/");
      return;
    }
    if (!selectedDate || !selectedPro) {
      alert("Selecione o dia e o profissional antes de escolher o horário.");
      return;
    }

    const qs = new URLSearchParams({
      service: service.id,
      pro: selectedPro.name,
      proId: selectedPro.id,
      date: selectedDate,
      time,
    });

    router.push(`/confirmar?${qs.toString()}`);
  };

  return (
    <main className="min-h-screen text-zinc-100">
      <div className="mx-auto max-w-6xl px-6 py-8 sm:py-10">
        <header className="gold-panel rounded-[28px] px-6 py-6 sm:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="gold-accent-text text-xs font-semibold uppercase tracking-[0.28em]">
                Passo 2
              </div>
              <h1 className="mt-3 text-4xl font-black tracking-tight text-zinc-50 sm:text-5xl">
                Escolha o dia, o barbeiro e o horario.
              </h1>
              <p className="mt-4 text-base leading-7 text-zinc-300 sm:text-lg">
                Servico:{" "}
                <span className="font-semibold text-zinc-100">
                  {service?.name ?? "Nao informado"}
                </span>. A agenda abaixo ja considera horarios ocupados e bloqueios.
              </p>
            </div>

            <button
              className="rounded-2xl border border-zinc-700 bg-zinc-950/70 px-5 py-3 font-semibold text-zinc-100 hover:border-zinc-500 hover:bg-zinc-900"
              onClick={() => router.push("/")}
            >
              Voltar
            </button>
          </div>
        </header>

        <section className="mt-8 grid gap-8 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="gold-panel-strong rounded-[28px] p-6 sm:p-8">
            <h2 className="text-2xl font-bold text-zinc-50">Selecione o dia</h2>
            <p className="mt-2 text-zinc-400">
              Voce pode agendar para hoje ou para os proximos dias.
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
            {days.map((d) => {
              const active = d.iso === selectedDate;
              return (
                <button
                  key={d.iso}
                  className={[
                    "rounded-xl px-4 py-3 text-left transition border",
                    active
                      ? "bg-zinc-100 text-zinc-950 border-zinc-100"
                      : "bg-zinc-900 text-zinc-100 border-zinc-800 hover:bg-zinc-800",
                  ].join(" ")}
                  onClick={() => {
                    setSelectedDate(d.iso);
                  }}
                >
                  <div className="text-sm font-semibold">{d.label}</div>
                </button>
              );
            })}
            </div>

            <div className="mt-8 border-t border-zinc-800 pt-8">
              <h2 className="text-2xl font-bold text-zinc-50">Selecione o profissional</h2>
              <p className="mt-2 text-zinc-400">
                Os horarios mudam de acordo com o barbeiro escolhido.
              </p>

              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {professionals.map((p) => {
              const active = p.id === selectedProId;
              return (
                <button
                  key={p.id}
                  className={[
                    "rounded-2xl p-6 text-left transition border",
                    active
                      ? "bg-zinc-900 border-zinc-100 ring-2 ring-zinc-100"
                      : "bg-zinc-900 border-zinc-800 hover:bg-zinc-800",
                  ].join(" ")}
                  onClick={() => {
                    setSelectedProId(p.id);
                  }}
                >
                  <div className="text-lg font-semibold">{p.name}</div>
                  <div className="mt-1 text-sm text-zinc-400">Profissional</div>
                </button>
              );
            })}
              </div>

              <p className="mt-4 text-sm text-zinc-400">
                {catalogLoading
                  ? "Carregando profissionais..."
                  : "Selecione o dia e o profissional para liberar os horarios."}
              </p>
            </div>
          </div>

          <aside className="gold-panel rounded-[28px] p-6 sm:p-8 lg:sticky lg:top-6 lg:self-start">
            <div className="gold-accent-text text-xs font-semibold uppercase tracking-[0.28em]">
              Resumo
            </div>
            <h2 className="mt-2 text-2xl font-bold text-zinc-50">Selecione o horario</h2>
            <p className="mt-2 text-zinc-400">
              Horarios ocupados ou bloqueados ja aparecem indisponiveis.
            </p>

            {loadingTimes && (
              <div className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-950/55 px-4 py-3 text-sm text-zinc-400">
                Carregando disponibilidade...
              </div>
            )}

            {timesError && (
              <div className="mt-5 rounded-2xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-sm text-red-200">
                {timesError}
              </div>
            )}

            <div className="mt-5 grid gap-4">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/55 p-5">
                <div className="text-sm text-zinc-400">Servico</div>
                <div className="mt-2 text-xl font-semibold">
                  {catalogLoading ? "Carregando..." : service?.name ?? "Nao informado"}
                </div>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/55 p-5">
                <div className="text-sm text-zinc-400">Dia</div>
                <div className="mt-2 text-xl font-semibold">
                  {selectedDate ? formatDateShortBR(selectedDate) : "Selecione um dia"}
                </div>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/55 p-5">
                <div className="text-sm text-zinc-400">Profissional</div>
                <div className="mt-2 text-xl font-semibold">
                  {catalogLoading ? "Carregando..." : selectedPro?.name ?? "Selecione um profissional"}
                </div>
              </div>
            </div>

            {!canShowTimes && (
              <div className="mt-5 rounded-2xl border border-amber-400/15 bg-amber-500/8 p-5 text-sm leading-6 text-zinc-300">
                Primeiro escolha o dia e o profissional para liberar os horarios.
              </div>
            )}
          </aside>
        </section>

        <section className="mt-8 gold-panel-strong rounded-[28px] p-6 sm:p-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-zinc-50">Horarios disponiveis</h2>
              <p className="mt-2 text-zinc-400">
                Toque em um horario livre para seguir.
              </p>
            </div>
            {loadingTimes && <span className="text-sm text-zinc-400">Carregando...</span>}
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleSlots.map((time) => {
              const slotStart = timeToMinutes(time);
              const slotEnd = slotStart + durationMin;
              const blocked =
                !canShowTimes ||
                bookedRanges.some((range) => !(slotEnd <= range.start || slotStart >= range.end));

              return (
                <button
                  key={time}
                  disabled={blocked || loadingTimes}
                  className={[
                    "rounded-2xl px-6 py-4 font-semibold transition",
                    blocked || loadingTimes
                      ? "bg-zinc-900 text-zinc-500 cursor-not-allowed"
                      : "bg-zinc-100 text-zinc-950 hover:-translate-y-0.5 hover:bg-white",
                  ].join(" ")}
                  onClick={() => goConfirm(time)}
                >
                  {time}
                </button>
              );
            })}
          </div>

          {!loadingTimes &&
            canShowTimes &&
            visibleSlots.length > 0 &&
            visibleSlots.every((time) => {
              const slotStart = timeToMinutes(time);
              const slotEnd = slotStart + durationMin;
              return bookedRanges.some((range) => !(slotEnd <= range.start || slotStart >= range.end));
            }) && (
              <div className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-950/55 px-5 py-4 text-zinc-300">
                Nao existem horarios livres para esse servico com esse profissional nesta data.
              </div>
            )}

          {!loadingTimes && canShowTimes && visibleSlots.length === 0 && (
            <div className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-950/55 px-5 py-4 text-zinc-300">
              Os horarios de hoje ja passaram. Escolha outro dia para continuar.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export default function HorariosPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen text-zinc-100">
          <div className="mx-auto max-w-6xl px-6 py-8 sm:py-10">
            <section className="gold-panel rounded-[28px] px-6 py-10 sm:px-8">
              <div className="gold-accent-text text-xs font-semibold uppercase tracking-[0.28em]">
                Passo 2
              </div>
              <h1 className="mt-3 text-3xl font-black tracking-tight text-zinc-50 sm:text-4xl">
                Carregando horarios...
              </h1>
              <p className="mt-4 text-base leading-7 text-zinc-300">
                Estamos buscando a disponibilidade mais atual para voce escolher.
              </p>
            </section>
          </div>
        </main>
      }
    >
      <HorariosPageContent />
    </Suspense>
  );
}

