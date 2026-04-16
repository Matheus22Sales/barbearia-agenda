"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

type AppointmentRow = {
  id: string | number;
  customer_name?: string | null;
  customer_phone?: string | null;
  service?: string | null;
  professional_name?: string | null;
  date?: string | null;
  time?: string | null;
  start_time?: string | null;
  status?: string | null;
};

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function todayISO() {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

function addDaysISO(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function formatDateBR(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
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

  return status || "Agendado";
}

export default function AdminPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadAppointments(date: string) {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from("appointments")
        .select(
          "id,customer_name,customer_phone,service,professional_name,date,time,start_time,status"
        )
        .eq("date", date);

      if (fetchError) throw fetchError;

      setAppointments((data ?? []) as AppointmentRow[]);
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Erro ao carregar agendamentos."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setIsAuthorized(sessionStorage.getItem("admin-authorized") === "true");
  }, []);

  useEffect(() => {
    if (!isAuthorized) return;
    void loadAppointments(selectedDate);
  }, [isAuthorized, selectedDate]);

  const sortedAppointments = useMemo(() => {
    return [...appointments].sort((a, b) => {
      const aTime = a.start_time ?? a.time ?? "";
      const bTime = b.start_time ?? b.time ?? "";
      return timeToMinutes(aTime) - timeToMinutes(bTime);
    });
  }, [appointments]);

  async function deleteAppointment(id: string) {
    const confirmed = window.confirm("Apagar este agendamento?");
    if (!confirmed) return;

    setDeletingId(id);
    setError(null);

    try {
      const { error: deleteError } = await supabase
        .from("appointments")
        .delete()
        .eq("id", id);

      if (deleteError) throw deleteError;

      setAppointments((current) =>
        current.filter((appointment) => String(appointment.id) !== id)
      );
    } catch (deleteError) {
      setError(getErrorMessage(deleteError, "Erro ao apagar agendamento."));
    } finally {
      setDeletingId(null);
    }
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginError(null);
    setLoggingIn(true);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        setLoginError("Senha inválida.");
        return;
      }

      sessionStorage.setItem("admin-authorized", "true");
      setIsAuthorized(true);
      setPassword("");
    } catch {
      setLoginError("Não foi possível validar a senha.");
    } finally {
      setLoggingIn(false);
    }
  }

  function handleLogout() {
    sessionStorage.removeItem("admin-authorized");
    setIsAuthorized(false);
    setAppointments([]);
  }

  if (isAuthorized === null) {
    return (
      <main className="grid min-h-screen place-items-center bg-zinc-950 text-zinc-100">
        <div className="text-zinc-400">Carregando...</div>
      </main>
    );
  }

  if (!isAuthorized) {
    return (
      <main className="grid min-h-screen place-items-center bg-zinc-950 px-6 text-zinc-100">
        <form
          className="w-full max-w-md rounded-3xl bg-zinc-900/70 p-8 ring-1 ring-zinc-800"
          onSubmit={(event) => void handleLogin(event)}
        >
          <div className="text-sm font-semibold uppercase tracking-[0.25em] text-zinc-500">
            Administração
          </div>
          <h1 className="mt-3 text-3xl font-bold">Entrar no painel</h1>
          <p className="mt-3 text-zinc-300">
            Informe a senha administrativa para acessar os agendamentos.
          </p>

          <label className="mt-8 grid gap-2">
            <span className="text-sm font-semibold text-zinc-300">Senha</span>
            <input
              className="rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-4 text-zinc-100 outline-none transition focus:border-zinc-400"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoFocus
            />
          </label>

          {loginError && (
            <div className="mt-4 rounded-xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-sm text-red-200">
              {loginError}
            </div>
          )}

          <div className="mt-8 flex gap-3">
            <button
              className="rounded-xl bg-zinc-100 px-5 py-3 font-semibold text-zinc-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loggingIn || !password}
              type="submit"
            >
              {loggingIn ? "Entrando..." : "Entrar"}
            </button>
            <button
              className="rounded-xl bg-zinc-800 px-5 py-3 font-semibold text-zinc-100 transition hover:bg-zinc-700"
              type="button"
              onClick={() => router.push("/")}
            >
              Voltar
            </button>
          </div>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.25em] text-zinc-500">
              Administração
            </div>
            <h1 className="mt-3 text-4xl font-bold">Agenda da barbearia</h1>
            <p className="mt-3 max-w-2xl text-zinc-300">
              Visualize os horários confirmados no Supabase e remova
              agendamentos de teste quando necessário.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              className="rounded-xl bg-zinc-900 px-5 py-3 font-semibold text-zinc-100 transition hover:bg-zinc-800"
              onClick={handleLogout}
            >
              Sair
            </button>
            <button
              className="rounded-xl bg-zinc-900 px-5 py-3 font-semibold text-zinc-100 transition hover:bg-zinc-800"
              onClick={() => router.push("/")}
            >
              Site
            </button>
            <button
              className="rounded-xl bg-zinc-100 px-5 py-3 font-semibold text-zinc-950 transition hover:bg-white"
              onClick={() => void loadAppointments(selectedDate)}
            >
              Atualizar
            </button>
          </div>
        </div>

        <section className="mt-10 rounded-3xl bg-zinc-900/70 p-6 ring-1 ring-zinc-800">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="grid gap-3">
              <div>
                <div className="text-sm font-semibold text-zinc-300">
                  Filtrar por data
                </div>
                <p className="mt-1 text-sm text-zinc-500">
                  Clique no campo ou no ícone de calendário para escolher outro
                  dia.
                </p>
              </div>

              <label className="relative block max-w-[280px]">
                <span className="sr-only">Escolher data</span>
                <input
                  className="w-full cursor-pointer rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-4 pr-12 text-lg font-semibold text-zinc-100 outline-none transition hover:border-zinc-500 focus:border-zinc-400"
                  type="date"
                  value={selectedDate}
                  onChange={(event) => setSelectedDate(event.target.value)}
                />
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xl">
                  📅
                </span>
              </label>

              <div className="flex flex-wrap gap-2">
                <button
                  className="rounded-full bg-zinc-800 px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-700"
                  onClick={() => setSelectedDate(todayISO())}
                >
                  Hoje
                </button>
                <button
                  className="rounded-full bg-zinc-800 px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-700"
                  onClick={() => setSelectedDate(addDaysISO(1))}
                >
                  Amanhã
                </button>
              </div>
            </div>

            <div className="text-sm text-zinc-400">
              {selectedDate ? formatDateBR(selectedDate) : "Selecione uma data"}
            </div>
          </div>
        </section>

        {error && (
          <div className="mt-6 rounded-xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <section className="mt-8 rounded-3xl bg-zinc-900/60 p-6 ring-1 ring-zinc-800">
          {loading ? (
            <div className="py-10 text-center text-zinc-300">Carregando...</div>
          ) : sortedAppointments.length === 0 ? (
            <div className="py-10 text-center text-zinc-300">
              Nenhum agendamento encontrado para esta data.
            </div>
          ) : (
            <div className="space-y-4">
              {sortedAppointments.map((appointment) => {
                const id = String(appointment.id);
                const time = appointment.start_time ?? appointment.time ?? "";

                return (
                  <div
                    key={id}
                    className="grid gap-4 rounded-2xl bg-zinc-950/70 p-5 ring-1 ring-zinc-800 md:grid-cols-[0.7fr_1fr_1fr_1fr_0.8fr_auto] md:items-center"
                  >
                    <div>
                      <div className="text-sm text-zinc-500">Horário</div>
                      <div className="text-2xl font-bold">{time || "--:--"}</div>
                    </div>

                    <div>
                      <div className="text-sm text-zinc-500">Cliente</div>
                      <div className="font-semibold">
                        {appointment.customer_name || "Não informado"}
                      </div>
                      {appointment.customer_phone && (
                        <div className="mt-1 text-sm text-zinc-400">
                          {appointment.customer_phone}
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="text-sm text-zinc-500">Serviço</div>
                      <div className="font-semibold">
                        {appointment.service || "Não informado"}
                      </div>
                    </div>

                    <div>
                      <div className="text-sm text-zinc-500">Profissional</div>
                      <div className="font-semibold">
                        {appointment.professional_name || "Não informado"}
                      </div>
                    </div>

                    <div>
                      <div className="text-sm text-zinc-500">Status</div>
                      <div className="font-semibold">
                        {statusLabel(appointment.status)}
                      </div>
                    </div>

                    <button
                      className="rounded-xl bg-zinc-800 px-5 py-3 font-semibold text-zinc-100 transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={deletingId === id}
                      onClick={() => void deleteAppointment(id)}
                    >
                      {deletingId === id ? "Apagando..." : "Apagar"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
