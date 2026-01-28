"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Booking = {
  serviceId: string;
  pro?: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  durationMin?: number;
};

const STORAGE_KEY = "agendamentos";

const SERVICE_LABEL: Record<string, string> = {
  corte: "Corte",
  combo: "Corte + Barba",
};

function readBookings(): Booking[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Booking[]) : [];
  } catch {
    return [];
  }
}

function writeBookings(bookings: Booking[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bookings));
}

function timeToMinutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function formatDateShortBR(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const fmt = new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
  return fmt.format(dt); // "seg., 26/01"
}

function serviceTitle(serviceId: string) {
  if (SERVICE_LABEL[serviceId]) return SERVICE_LABEL[serviceId];
  if (!serviceId) return "Não informado";
  return serviceId.charAt(0).toUpperCase() + serviceId.slice(1);
}

export default function MeusAgendamentosPage() {
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);

  useEffect(() => {
    setBookings(readBookings());
  }, []);

  const sorted = useMemo(() => {
    const copy = [...bookings];
    copy.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return timeToMinutes(a.time) - timeToMinutes(b.time);
    });
    return copy;
  }, [bookings]);

  const removeOne = (index: number) => {
    const next = bookings.filter((_, i) => i !== index);
    setBookings(next);
    writeBookings(next);
  };

  const clearAll = () => {
    setBookings([]);
    writeBookings([]);
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold">Meus agendamentos</h1>
            <p className="mt-2 text-zinc-300">
              Aqui aparecem os agendamentos que foram salvos no seu navegador.
            </p>
          </div>

          <button
            className="rounded-xl bg-zinc-900 px-5 py-3 font-semibold text-zinc-100 hover:bg-zinc-800 transition"
            onClick={() => router.push("/")}
          >
            Voltar
          </button>
        </div>

        <div className="mt-10 rounded-3xl bg-zinc-900/60 p-8">
          {sorted.length === 0 ? (
            <div className="text-zinc-300">Nenhum agendamento encontrado.</div>
          ) : (
            <div className="space-y-5">
              {sorted.map((b, idx) => (
                <div
                  key={`${b.serviceId}-${b.pro}-${b.date}-${b.time}-${idx}`}
                  className="rounded-2xl bg-zinc-900 p-6 ring-1 ring-zinc-800"
                >
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-5 md:items-center">
                    <div>
                      <div className="text-sm text-zinc-400">Serviço</div>
                      <div className="text-lg font-semibold">
                        {serviceTitle(b.serviceId)}
                      </div>
                    </div>

                    <div>
                      <div className="text-sm text-zinc-400">Profissional</div>
                      <div className="text-lg font-semibold">
                        {b.pro || "não informado"}
                      </div>
                    </div>

                    <div>
                      <div className="text-sm text-zinc-400">Data</div>
                      <div className="text-lg font-semibold">
                        {b.date ? formatDateShortBR(b.date) : "não informado"}
                      </div>
                    </div>

                    <div>
                      <div className="text-sm text-zinc-400">Horário</div>
                      <div className="text-lg font-semibold">{b.time}</div>
                    </div>

                    <div className="md:text-right">
                      <button
                        className="rounded-xl bg-zinc-800 px-5 py-3 font-semibold text-zinc-100 hover:bg-zinc-700 transition"
                        onClick={() => removeOne(bookings.indexOf(b))}
                      >
                        Apagar
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              <div className="pt-2">
                <button
                  className="rounded-xl bg-zinc-100 px-6 py-3 font-semibold text-zinc-950 hover:bg-white transition"
                  onClick={clearAll}
                >
                  Apagar todos
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
