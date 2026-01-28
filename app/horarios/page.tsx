"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  SERVICES,
  PROFESSIONALS,
  OPEN_HOUR,
  CLOSE_HOUR,
  SLOT_STEP_MIN,
} from "../lib/config";
import { isSlotBlocked } from "../lib/bookings";
import { formatDateShortBR } from "../lib/format";

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
  const [selectedTime, setSelectedTime] = useState<string>("");

  const durationMin = service?.minutes ?? 30;

  const slots = useMemo(() => {
    const openMin = OPEN_HOUR * 60;
    const closeMin = CLOSE_HOUR * 60;

    // regra: agendamento precisa TERMINAR até CLOSE_HOUR
    const lastStart = closeMin - durationMin;

    const list: string[] = [];
    for (let t = openMin; t <= lastStart; t += SLOT_STEP_MIN) {
      list.push(minutesToTime(t));
    }
    return list;
  }, [durationMin]);

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

        {/* DIA */}
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
                    setSelectedTime("");
                  }}
                >
                  <div className="text-sm font-semibold">{d.label}</div>
                </button>
              );
            })}
          </div>
        </section>

        {/* PROFISSIONAL */}
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
                    setSelectedTime("");
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

        {/* HORÁRIOS */}
        <section className="mt-10">
          <h2 className="text-xl font-semibold">Selecione o horário</h2>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {slots.map((time) => {
              const blocked =
                !canShowTimes ||
                isSlotBlocked({
                  proId: selectedProId,
                  date: selectedDate,
                  startTime: time,
                  durationMin,
                });

              const active = time === selectedTime;

              return (
                <button
                  key={time}
                  disabled={blocked}
                  className={[
                    "rounded-xl px-6 py-4 font-semibold transition",
                    blocked
                      ? "bg-zinc-900 text-zinc-500 cursor-not-allowed"
                      : active
                      ? "bg-zinc-100 text-zinc-950"
                      : "bg-zinc-100 text-zinc-950 hover:bg-white",
                  ].join(" ")}
                  onClick={() => {
                    setSelectedTime(time);
                    goConfirm(time);
                  }}
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
