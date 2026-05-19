"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  SERVICES,
  PROFESSIONALS,
  OPEN_HOUR,
  CLOSE_HOUR,
  SLOT_STEP_MIN,
} from "../lib/config";
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

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return fallback;
}

function inferDuration(row: AppointmentRow) {
  const serviceId = (row.service_id ?? "").toLowerCase();
  const serviceName = (row.service ?? "").toLowerCase();
  const matchedService = SERVICES.find((service) => {
    const currentId = service.id.toLowerCase();
    return currentId === serviceId || service.dbId === serviceId || service.name.toLowerCase() === serviceName;
  });

  return matchedService?.minutes ?? 30;
}

export default function HorariosPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const serviceId = (searchParams.get("service") ?? "").toLowerCase();
  const service = SERVICES.find((s) => s.id === serviceId);

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
            const end = start + inferDuration(row);
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
  }, [selectedDate, selectedProId]);

  const selectedPro = PROFESSIONALS.find((p) => p.id === selectedProId);
  const canShowTimes = Boolean(service && selectedDate && selectedProId);

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
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Escolha um horário</h1>
            <p className="mt-2 text-zinc-300">
              Serviço selecionado:{" "}
              <span className="font-semibold text-zinc-100">
                {service?.name ?? "não informado"}
              </span>
            </p>
          </div>

          <button
            className="rounded-xl bg-zinc-900 px-5 py-3 font-semibold text-zinc-100 hover:bg-zinc-800 transition"
            onClick={() => router.push("/")}
          >
            Voltar
          </button>
        </div>

        <section className="mt-10">
          <h2 className="text-xl font-semibold">Selecione o dia</h2>

          <div className="mt-4 flex flex-wrap gap-3">
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
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold">Selecione o profissional</h2>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PROFESSIONALS.map((p) => {
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
            Selecione o dia e o profissional para liberar os horários.
          </p>
        </section>

        <section className="mt-10">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold">Selecione o horário</h2>
            {loadingTimes && <span className="text-sm text-zinc-400">Carregando...</span>}
          </div>

          {timesError && (
            <div className="mt-4 rounded-xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-sm text-red-200">
              {timesError}
            </div>
          )}

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {slots.map((time) => {
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
                    "rounded-xl px-6 py-4 font-semibold transition",
                    blocked || loadingTimes
                      ? "bg-zinc-900 text-zinc-500 cursor-not-allowed"
                      : "bg-zinc-100 text-zinc-950 hover:bg-white",
                  ].join(" ")}
                  onClick={() => goConfirm(time)}
                >
                  {time}
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}

