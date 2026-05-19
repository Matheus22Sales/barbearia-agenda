"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  clearTrackedBookingIds,
  readTrackedBookingIds,
  type Booking,
  untrackBookingId,
} from "../lib/bookings";
import { supabase } from "../lib/supabaseClient";

type AppointmentRow = {
  id: string | number;
  service_id?: string | null;
  service?: string | null;
  professional_id?: string | null;
  professional_name?: string | null;
  date?: string | null;
  time?: string | null;
  start_time?: string | null;
  status?: string | null;
};

const SERVICE_LABEL: Record<string, string> = {
  corte: "Corte",
  combo: "Corte + Barba",
};

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
  return fmt.format(dt);
}

function serviceTitle(booking: Booking) {
  if (booking.serviceName) return booking.serviceName;
  if (SERVICE_LABEL[booking.serviceId]) return SERVICE_LABEL[booking.serviceId];
  if (!booking.serviceId) return "Não informado";
  return booking.serviceId.charAt(0).toUpperCase() + booking.serviceId.slice(1);
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return fallback;
}

function normalizeBooking(row: AppointmentRow): Booking {
  return {
    id: String(row.id),
    serviceId: row.service_id ?? "",
    serviceName: row.service ?? "",
    proId: row.professional_id ?? "",
    proName: row.professional_name ?? "não informado",
    date: row.date ?? "",
    time: row.start_time ?? row.time ?? "",
    status: row.status ?? null,
  };
}

export default function MeusAgendamentosPage() {
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadBookings() {
      setLoading(true);
      setError(null);

      const trackedIds = readTrackedBookingIds();
      if (trackedIds.length === 0) {
        setBookings([]);
        setLoading(false);
        return;
      }

      try {
        const { data, error: fetchError } = await supabase
          .from("appointments")
          .select("id,service_id,service,professional_id,professional_name,date,time,start_time,status")
          .in("id", trackedIds);

        if (fetchError) throw fetchError;

        setBookings(((data ?? []) as AppointmentRow[]).map(normalizeBooking));
      } catch (loadError) {
        setError(getErrorMessage(loadError, "Erro ao carregar seus agendamentos."));
      } finally {
        setLoading(false);
      }
    }

    void loadBookings();
  }, []);

  const sorted = useMemo(() => {
    const copy = [...bookings];
    copy.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return timeToMinutes(a.time) - timeToMinutes(b.time);
    });
    return copy;
  }, [bookings]);

  const removeOne = async (id: string) => {
    setError(null);
    try {
      const { error: deleteError } = await supabase.from("appointments").delete().eq("id", id);
      if (deleteError) throw deleteError;

      setBookings((current) => current.filter((booking) => booking.id !== id));
      untrackBookingId(id);
    } catch (deleteFailure) {
      setError(getErrorMessage(deleteFailure, "Erro ao apagar agendamento."));
    }
  };

  const clearAll = async () => {
    setError(null);
    try {
      const ids = bookings.map((booking) => booking.id);
      if (ids.length > 0) {
        const { error: deleteError } = await supabase.from("appointments").delete().in("id", ids);
        if (deleteError) throw deleteError;
      }

      setBookings([]);
      clearTrackedBookingIds();
    } catch (deleteFailure) {
      setError(getErrorMessage(deleteFailure, "Erro ao apagar agendamentos."));
    }
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold">Meus agendamentos</h1>
            <p className="mt-2 text-zinc-300">
              Aqui aparecem os agendamentos confirmados neste navegador.
            </p>
          </div>

          <button
            className="rounded-xl bg-zinc-900 px-5 py-3 font-semibold text-zinc-100 hover:bg-zinc-800 transition"
            onClick={() => router.push("/")}
          >
            Voltar
          </button>
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <div className="mt-10 rounded-3xl bg-zinc-900/60 p-8">
          {loading ? (
            <div className="text-zinc-300">Carregando...</div>
          ) : sorted.length === 0 ? (
            <div className="text-zinc-300">Nenhum agendamento encontrado.</div>
          ) : (
            <div className="space-y-5">
              {sorted.map((booking) => (
                <div
                  key={booking.id}
                  className="rounded-2xl bg-zinc-900 p-6 ring-1 ring-zinc-800"
                >
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-5 md:items-center">
                    <div>
                      <div className="text-sm text-zinc-400">Serviço</div>
                      <div className="text-lg font-semibold">
                        {serviceTitle(booking)}
                      </div>
                    </div>

                    <div>
                      <div className="text-sm text-zinc-400">Profissional</div>
                      <div className="text-lg font-semibold">
                        {booking.proName || "não informado"}
                      </div>
                    </div>

                    <div>
                      <div className="text-sm text-zinc-400">Data</div>
                      <div className="text-lg font-semibold">
                        {booking.date ? formatDateShortBR(booking.date) : "não informado"}
                      </div>
                    </div>

                    <div>
                      <div className="text-sm text-zinc-400">Horário</div>
                      <div className="text-lg font-semibold">{booking.time || "não informado"}</div>
                    </div>

                    <div className="md:text-right">
                      <button
                        className="rounded-xl bg-zinc-800 px-5 py-3 font-semibold text-zinc-100 hover:bg-zinc-700 transition"
                        onClick={() => void removeOne(booking.id)}
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
                  onClick={() => void clearAll()}
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

