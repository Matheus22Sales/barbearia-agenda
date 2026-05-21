"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  clearTrackedBookingIds,
  readTrackedBookingIds,
  type Booking,
  untrackBookingId,
} from "../lib/bookings";
import { INSTAGRAM_HANDLE, INSTAGRAM_URL } from "../lib/config";
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
  if (!booking.serviceId) return "Nao informado";
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

function statusLabel(status: string | null | undefined) {
  const normalized = status?.toLowerCase();

  if (normalized === "scheduled") return "Agendado";
  if (normalized === "cancelled" || normalized === "canceled") return "Cancelado";
  if (normalized === "completed") return "Concluído";
  return "Agendado";
}

function normalizeBooking(row: AppointmentRow): Booking {
  return {
    id: String(row.id),
    serviceId: row.service_id ?? "",
    serviceName: row.service ?? "",
    proId: row.professional_id ?? "",
    proName: row.professional_name ?? "Nao informado",
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
  const [createdBookingId, setCreatedBookingId] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const url = new URL(window.location.href);
    const created = url.searchParams.get("created");
    if (!created) return;

    setCreatedBookingId(created);
    url.searchParams.delete("created");
    window.history.replaceState({}, "", url.toString());
  }, []);

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

  const createdBooking = useMemo(() => {
    if (!createdBookingId) return null;
    return sorted.find((booking) => booking.id === createdBookingId) ?? null;
  }, [createdBookingId, sorted]);

  const copySummary = async (booking: Booking) => {
    const lines = [
      "Agendamento confirmado",
      `Servico: ${serviceTitle(booking)}`,
      `Profissional: ${booking.proName || "Nao informado"}`,
      `Data: ${booking.date ? formatDateShortBR(booking.date) : "Nao informado"}`,
      `Horario: ${booking.time || "Nao informado"}`,
    ];

    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopyFeedback("Resumo copiado com sucesso.");
    } catch {
      setError("Nao foi possivel copiar o resumo automaticamente.");
    }
  };

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
    <main className="min-h-screen text-zinc-100">
      <div className="mx-auto max-w-6xl px-6 py-8 sm:py-10">
        <header className="gold-panel rounded-[28px] px-6 py-6 sm:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="gold-accent-text text-xs font-semibold uppercase tracking-[0.28em]">
                Acompanhamento
              </div>
              <h1 className="mt-3 text-4xl font-black tracking-tight text-zinc-50 sm:text-5xl">
                Seus agendamentos salvos neste navegador.
              </h1>
              <p className="mt-4 text-base leading-7 text-zinc-300 sm:text-lg">
                Aqui ficam os horarios confirmados por este dispositivo, com opcao
                de apagar testes e liberar a agenda de novo.
              </p>
            </div>

            <button
              className="rounded-2xl border border-zinc-700 bg-zinc-950/70 px-5 py-3 font-semibold text-zinc-100 hover:border-zinc-500 hover:bg-zinc-900"
              onClick={() => router.push("/")}
            >
              Voltar para inicio
            </button>
          </div>
        </header>

        {error && (
          <div className="mt-6 rounded-2xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        {createdBooking && (
          <section className="mt-6 gold-panel rounded-[28px] p-6 sm:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <div className="gold-accent-text text-xs font-semibold uppercase tracking-[0.28em]">
                  Confirmado
                </div>
                <h2 className="mt-2 text-3xl font-black tracking-tight text-zinc-50">
                  Seu horario foi reservado com sucesso.
                </h2>
                <p className="mt-3 text-zinc-300">
                  O resumo ficou salvo neste navegador. Se quiser, voce tambem pode copiar os
                  detalhes agora e seguir acompanhando por aqui.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  className="rounded-2xl bg-zinc-100 px-5 py-3 font-semibold text-zinc-950 hover:bg-white transition"
                  onClick={() => void copySummary(createdBooking)}
                >
                  Copiar resumo
                </button>
                <a
                  className="rounded-2xl border border-zinc-700 bg-zinc-950/70 px-5 py-3 font-semibold text-zinc-100 hover:border-zinc-500 hover:bg-zinc-900 transition"
                  href={INSTAGRAM_URL}
                  target="_blank"
                  rel="noreferrer"
                >
                  Abrir Instagram
                </a>
              </div>
            </div>

            {copyFeedback && (
              <div className="mt-5 rounded-2xl border border-emerald-500/40 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-200">
                {copyFeedback}
              </div>
            )}

            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/55 p-5">
                <div className="text-sm text-zinc-400">Servico</div>
                <div className="mt-2 text-lg font-semibold text-zinc-50">
                  {serviceTitle(createdBooking)}
                </div>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/55 p-5">
                <div className="text-sm text-zinc-400">Profissional</div>
                <div className="mt-2 text-lg font-semibold text-zinc-50">
                  {createdBooking.proName || "Nao informado"}
                </div>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/55 p-5">
                <div className="text-sm text-zinc-400">Data</div>
                <div className="mt-2 text-lg font-semibold text-zinc-50">
                  {createdBooking.date
                    ? formatDateShortBR(createdBooking.date)
                    : "Nao informado"}
                </div>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/55 p-5">
                <div className="text-sm text-zinc-400">Horario</div>
                <div className="mt-2 text-lg font-semibold text-zinc-50">
                  {createdBooking.time || "Nao informado"}
                </div>
              </div>
            </div>

            <div className="mt-5 text-sm text-zinc-400">
              Canal publico da barbearia:{" "}
              <a
                className="font-semibold text-zinc-100 underline decoration-zinc-600 underline-offset-4"
                href={INSTAGRAM_URL}
                target="_blank"
                rel="noreferrer"
              >
                {INSTAGRAM_HANDLE}
              </a>
            </div>
          </section>
        )}

        <section className="mt-8 grid gap-8 lg:grid-cols-[0.72fr_1.28fr]">
          <aside className="gold-panel rounded-[28px] p-6 sm:p-8 lg:sticky lg:top-6 lg:self-start">
            <div className="gold-accent-text text-xs font-semibold uppercase tracking-[0.28em]">
              Resumo
            </div>
            <h2 className="mt-2 text-2xl font-bold text-zinc-50">Visao rapida</h2>

            <div className="mt-6 grid gap-4">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/55 p-5">
                <div className="text-sm text-zinc-400">Total de agendamentos</div>
                <div className="mt-2 text-4xl font-black text-zinc-50">{sorted.length}</div>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/55 p-5">
                <div className="text-sm text-zinc-400">Proximo horario</div>
                <div className="mt-2 text-xl font-semibold">
                  {sorted[0]?.time || "Sem horarios"}
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-amber-400/15 bg-amber-500/8 p-5 text-sm leading-6 text-zinc-300">
              Se voce estiver testando o app, pode apagar os agendamentos daqui sem
              precisar entrar no painel administrativo.
            </div>

            {sorted.length > 0 && (
              <button
                className="mt-6 w-full rounded-2xl bg-zinc-100 px-6 py-3 font-semibold text-zinc-950 hover:bg-white transition"
                onClick={() => void clearAll()}
              >
                Apagar todos
              </button>
            )}
          </aside>

          <div className="gold-panel-strong rounded-[28px] p-6 sm:p-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-zinc-50">Lista de agendamentos</h2>
                <p className="mt-2 text-zinc-400">
                  Os registros abaixo estao ordenados por data e horario.
                </p>
              </div>
            </div>

            <div className="mt-6">
              {loading ? (
                <div className="rounded-2xl border border-zinc-800 bg-zinc-950/55 px-5 py-4 text-zinc-300">
                  Carregando agendamentos...
                </div>
              ) : sorted.length === 0 ? (
                <div className="rounded-2xl border border-zinc-800 bg-zinc-950/55 px-5 py-10 text-center text-zinc-300">
                  <div>Nenhum agendamento encontrado neste navegador.</div>
                  <button
                    className="mt-5 rounded-2xl bg-zinc-100 px-5 py-3 font-semibold text-zinc-950 transition hover:bg-white"
                    onClick={() => router.push("/")}
                  >
                    Fazer novo agendamento
                  </button>
                </div>
              ) : (
                <div className="space-y-5">
                  {sorted.map((booking) => (
                    <div
                      key={booking.id}
                      className="rounded-[24px] border border-zinc-800 bg-zinc-950/55 p-6"
                    >
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_0.8fr_0.8fr_auto] lg:items-center">
                        <div>
                          <div className="text-sm text-zinc-400">Servico</div>
                          <div className="text-lg font-semibold">{serviceTitle(booking)}</div>
                        </div>

                        <div>
                          <div className="text-sm text-zinc-400">Profissional</div>
                          <div className="text-lg font-semibold">
                            {booking.proName || "Nao informado"}
                          </div>
                        </div>

                        <div>
                          <div className="text-sm text-zinc-400">Data</div>
                          <div className="text-lg font-semibold">
                            {booking.date ? formatDateShortBR(booking.date) : "Nao informado"}
                          </div>
                        </div>

                        <div>
                          <div className="text-sm text-zinc-400">Status</div>
                          <div className="mt-2">
                            <span className="rounded-full bg-emerald-950/50 px-3 py-1 text-sm font-semibold text-emerald-200">
                              {statusLabel(booking.status)}
                            </span>
                          </div>
                        </div>

                        <div>
                          <div className="text-sm text-zinc-400">Horario</div>
                          <div className="text-lg font-semibold">
                            {booking.time || "Nao informado"}
                          </div>
                        </div>

                        <div className="lg:text-right">
                          <button
                            className="rounded-2xl bg-zinc-900 px-5 py-3 font-semibold text-zinc-100 hover:bg-zinc-800 transition"
                            onClick={() => void removeOne(booking.id)}
                          >
                            Apagar
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
