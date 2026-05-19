"use client";

import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CLOSE_HOUR,
  OPEN_HOUR,
  PROFESSIONALS,
  SERVICES,
  SLOT_STEP_MIN,
} from "../lib/config";
import { supabase } from "../lib/supabaseClient";

type AppointmentRow = {
  id: string | number;
  customer_name?: string | null;
  customer_phone?: string | null;
  service?: string | null;
  service_id?: string | null;
  professional_name?: string | null;
  professional_id?: string | null;
  date?: string | null;
  time?: string | null;
  start_time?: string | null;
  status?: string | null;
};

type EntryType = "booking" | "block";
type BlockMode = "single" | "range" | "full-day";
type BlockGroup = {
  key: string;
  ids: string[];
  professionalName: string;
  note: string;
  service: string;
  start: string;
  end: string;
  totalSlots: number;
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

function minutesToTime(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${pad2(hours)}:${pad2(minutes)}`;
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

function inferEntryType(appointment: AppointmentRow): EntryType {
  const normalizedStatus = (appointment.status ?? "").toLowerCase();
  const normalizedService = (appointment.service ?? "").toLowerCase();
  const hasCustomer = Boolean(appointment.customer_name?.trim());

  if (
    normalizedStatus.includes("block") ||
    normalizedStatus.includes("blocked") ||
    normalizedStatus.includes("unavailable") ||
    normalizedService.includes("bloqueio")
  ) {
    return "block";
  }

  return hasCustomer ? "booking" : "block";
}

function inferDuration(appointment: AppointmentRow) {
  const serviceId = (appointment.service_id ?? "").toLowerCase();
  const serviceName = (appointment.service ?? "").toLowerCase();

  const matchedService = SERVICES.find((service) => {
    const currentId = service.id.toLowerCase();
    return (
      currentId === serviceId ||
      service.dbId === serviceId ||
      service.name.toLowerCase() === serviceName
    );
  });

  return matchedService?.minutes ?? 30;
}

function buildSlots(durationMinutes = 30) {
  const openMinutes = OPEN_HOUR * 60;
  const closeMinutes = CLOSE_HOUR * 60;
  const lastStart = closeMinutes - durationMinutes;

  const slots: string[] = [];
  for (let current = openMinutes; current <= lastStart; current += SLOT_STEP_MIN) {
    slots.push(minutesToTime(current));
  }

  return slots;
}

function displayTimeSummary(time: string) {
  return time === "--:--" ? "Sem horários" : time;
}

export default function AdminPage() {
  const router = useRouter();
  const dateInputRef = useRef<HTMLInputElement>(null);

  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [selectedProfessionalFilter, setSelectedProfessionalFilter] = useState("");
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [blockMode, setBlockMode] = useState<BlockMode>("single");
  const [blockProfessionalId, setBlockProfessionalId] = useState("");
  const [blockTime, setBlockTime] = useState("");
  const [blockDurationMinutes, setBlockDurationMinutes] = useState("60");
  const [blockNote, setBlockNote] = useState("");
  const [blocking, setBlocking] = useState(false);
  const [blockFeedback, setBlockFeedback] = useState<string | null>(null);

  async function loadAppointments(date: string) {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from("appointments")
        .select(
          "id,customer_name,customer_phone,service,service_id,professional_name,professional_id,date,time,start_time,status"
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

  useEffect(() => {
    setBlockTime("");
    setBlockDurationMinutes("60");
    setBlockFeedback(null);
  }, [selectedDate, blockProfessionalId]);

  const sortedAppointments = useMemo(() => {
    return [...appointments].sort((a, b) => {
      const aTime = a.start_time ?? a.time ?? "";
      const bTime = b.start_time ?? b.time ?? "";
      return timeToMinutes(aTime) - timeToMinutes(bTime);
    });
  }, [appointments]);

  const filteredAppointments = useMemo(() => {
    if (!selectedProfessionalFilter) return sortedAppointments;

    return sortedAppointments.filter(
      (appointment) => appointment.professional_id === selectedProfessionalFilter
    );
  }, [selectedProfessionalFilter, sortedAppointments]);

  const daySummary = useMemo(() => {
    if (filteredAppointments.length === 0) {
      return {
        total: 0,
        first: "--:--",
        last: "--:--",
      };
    }

    const firstAppointment = filteredAppointments[0];
    const lastAppointment = filteredAppointments[filteredAppointments.length - 1];

    return {
      total: filteredAppointments.length,
      first: firstAppointment.start_time ?? firstAppointment.time ?? "--:--",
      last: lastAppointment.start_time ?? lastAppointment.time ?? "--:--",
    };
  }, [filteredAppointments]);

  const bookingAppointments = useMemo(() => {
    return filteredAppointments.filter((appointment) => inferEntryType(appointment) === "booking");
  }, [filteredAppointments]);

  const blockedAppointments = useMemo(() => {
    return filteredAppointments.filter((appointment) => inferEntryType(appointment) === "block");
  }, [filteredAppointments]);

  const groupedBlockedAppointments = useMemo(() => {
    const sortedBlocks = [...blockedAppointments].sort((a, b) => {
      const professionalCompare = (a.professional_name ?? "").localeCompare(
        b.professional_name ?? "",
        "pt-BR"
      );
      if (professionalCompare !== 0) return professionalCompare;

      const noteCompare = (a.customer_name ?? "").localeCompare(b.customer_name ?? "", "pt-BR");
      if (noteCompare !== 0) return noteCompare;

      const serviceCompare = (a.service ?? "").localeCompare(b.service ?? "", "pt-BR");
      if (serviceCompare !== 0) return serviceCompare;

      const aTime = a.start_time ?? a.time ?? "";
      const bTime = b.start_time ?? b.time ?? "";
      return timeToMinutes(aTime) - timeToMinutes(bTime);
    });

    const groups: BlockGroup[] = [];

    for (const appointment of sortedBlocks) {
      const id = String(appointment.id);
      const start = appointment.start_time ?? appointment.time ?? "";
      const note = appointment.customer_name?.trim() || "Bloqueio manual";
      const service = appointment.service || "Bloqueio manual";
      const professionalName = appointment.professional_name || "Não informado";
      const duration = inferDuration(appointment);
      const end = minutesToTime(timeToMinutes(start) + duration);

      const previous = groups[groups.length - 1];
      const canMerge =
        previous &&
        previous.professionalName === professionalName &&
        previous.note === note &&
        previous.service === service &&
        previous.end === start;

      if (canMerge) {
        previous.ids.push(id);
        previous.end = end;
        previous.totalSlots += 1;
        continue;
      }

      groups.push({
        key: `${professionalName}-${note}-${start}`,
        ids: [id],
        professionalName,
        note,
        service,
        start,
        end,
        totalSlots: 1,
      });
    }

    return groups;
  }, [blockedAppointments]);

  const availableBlockSlots = useMemo(() => {
    if (!blockProfessionalId) return [];

    const professionalAppointments = sortedAppointments.filter(
      (appointment) => appointment.professional_id === blockProfessionalId
    );

    const occupiedRanges = professionalAppointments.map((appointment) => {
      const rawTime = appointment.start_time ?? appointment.time ?? "";
      const start = timeToMinutes(String(rawTime).slice(0, 5));
      return { start, end: start + inferDuration(appointment) };
    });

    return buildSlots(30).filter((slot) => {
      const start = timeToMinutes(slot);
      const end = start + 30;
      return !occupiedRanges.some((range) => !(end <= range.start || start >= range.end));
    });
  }, [blockProfessionalId, sortedAppointments]);

  const availableRangeDurations = useMemo(() => {
    if (!blockTime) return [];

    const allSlots = buildSlots(30);
    const startIndex = allSlots.indexOf(blockTime);
    if (startIndex < 0) return [];

    const availableSet = new Set(availableBlockSlots);
    let contiguousSlots = 0;

    for (let index = startIndex; index < allSlots.length; index += 1) {
      const slot = allSlots[index];
      if (!availableSet.has(slot)) break;
      contiguousSlots += 1;
    }

    const durationOptions = [
      { value: "60", label: "1 hora", slots: 2 },
      { value: "90", label: "1h30", slots: 3 },
      { value: "120", label: "2 horas", slots: 4 },
      { value: "150", label: "2h30", slots: 5 },
      { value: "180", label: "3 horas", slots: 6 },
      { value: "210", label: "3h30", slots: 7 },
      { value: "240", label: "4 horas", slots: 8 },
    ];

    return durationOptions.filter((option) => option.slots <= contiguousSlots);
  }, [availableBlockSlots, blockTime]);

  async function deleteAppointments(ids: string[], confirmationMessage: string, deletingToken: string) {
    const confirmed = window.confirm(confirmationMessage);
    if (!confirmed) return;

    setDeletingKey(deletingToken);
    setError(null);
    setBlockFeedback(null);

    try {
      const { error: deleteError } =
        ids.length === 1
          ? await supabase.from("appointments").delete().eq("id", ids[0])
          : await supabase.from("appointments").delete().in("id", ids);

      if (deleteError) throw deleteError;

      setAppointments((current) =>
        current.filter((appointment) => !ids.includes(String(appointment.id)))
      );
    } catch (deleteError) {
      setError(getErrorMessage(deleteError, "Erro ao apagar agendamento."));
    } finally {
      setDeletingKey(null);
    }
  }

  async function deleteAppointment(id: string) {
    await deleteAppointments([id], "Apagar este agendamento?", id);
  }

  async function deleteBlockGroup(group: BlockGroup) {
    const label = `${group.start} às ${group.end}`;
    await deleteAppointments(
      group.ids,
      `Apagar o bloqueio de ${group.professionalName} no período ${label}?`,
      group.key
    );
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

  async function handleCreateBlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBlockFeedback(null);

    if (!blockProfessionalId) {
      setError("Selecione um profissional para bloquear o horário.");
      return;
    }

    if (!blockTime) {
      setError("Selecione um horário disponível para criar o bloqueio.");
      return;
    }

    const professional = PROFESSIONALS.find((item) => item.id === blockProfessionalId);
    if (!professional) {
      setError("Profissional inválido para o bloqueio.");
      return;
    }

    setBlocking(true);

    try {
      let payload: object | object[] = {
        customer_name: blockNote.trim() || null,
        customer_phone: null,
        service_id: null,
        professional_id: professional.id,
        service: "Bloqueio manual",
        professional_name: professional.name,
        date: selectedDate,
        time: blockTime,
        start_time: blockTime,
        status: "scheduled",
      };

      if (blockMode === "range") {
        const duration = Number(blockDurationMinutes);
        const steps = Math.floor(duration / SLOT_STEP_MIN);

        if (!Number.isFinite(duration) || steps < 2) {
          setError("Selecione uma duração válida para o bloqueio por período.");
          setBlocking(false);
          return;
        }

        const allSlots = buildSlots(30);
        const startIndex = allSlots.indexOf(blockTime);
        const selectedSlots = allSlots.slice(startIndex, startIndex + steps);
        const availableSet = new Set(availableBlockSlots);
        const hasUnavailableSlot = selectedSlots.some((slot) => !availableSet.has(slot));

        if (selectedSlots.length !== steps || hasUnavailableSlot) {
          setError("Esse período possui conflito com outro agendamento ou bloqueio.");
          setBlocking(false);
          return;
        }

        payload = selectedSlots.map((slot) => ({
          customer_name: blockNote.trim() || "Bloqueio de período",
          customer_phone: null,
          service_id: null,
          professional_id: professional.id,
          service: "Bloqueio manual",
          professional_name: professional.name,
          date: selectedDate,
          time: slot,
          start_time: slot,
          status: "scheduled",
        }));
      }

      const { error: insertError } = await supabase.from("appointments").insert(payload);
      if (insertError) throw insertError;

      setBlockFeedback(
        blockMode === "range"
          ? "Período bloqueado com sucesso."
          : "Horário bloqueado com sucesso."
      );
      setBlockTime("");
      setBlockDurationMinutes("60");
      setBlockNote("");
      await loadAppointments(selectedDate);
    } catch (createError) {
      setError(getErrorMessage(createError, "Erro ao bloquear horário."));
    } finally {
      setBlocking(false);
    }
  }

  async function handleCreateFullDayBlock() {
    setError(null);
    setBlockFeedback(null);

    if (!blockProfessionalId) {
      setError("Selecione um profissional para bloquear o dia inteiro.");
      return;
    }

    if (availableBlockSlots.length === 0) {
      setError("Não há horários livres para bloquear neste dia.");
      return;
    }

    const professional = PROFESSIONALS.find((item) => item.id === blockProfessionalId);
    if (!professional) {
      setError("Profissional inválido para o bloqueio.");
      return;
    }

    const confirmed = window.confirm(
      `Bloquear o dia inteiro de ${professional.name} em ${selectedDate}?`
    );
    if (!confirmed) return;

    setBlocking(true);

    try {
      const payload = availableBlockSlots.map((slot) => ({
        customer_name: blockNote.trim() || "Folga",
        customer_phone: null,
        service_id: null,
        professional_id: professional.id,
        service: "Bloqueio manual",
        professional_name: professional.name,
        date: selectedDate,
        time: slot,
        start_time: slot,
        status: "scheduled",
      }));

      const { error: insertError } = await supabase.from("appointments").insert(payload);
      if (insertError) throw insertError;

      setBlockFeedback("Dia inteiro bloqueado com sucesso.");
      setBlockTime("");
      setBlockNote("");
      await loadAppointments(selectedDate);
    } catch (createError) {
      setError(getErrorMessage(createError, "Erro ao bloquear o dia inteiro."));
    } finally {
      setBlocking(false);
    }
  }

  function handleLogout() {
    sessionStorage.removeItem("admin-authorized");
    setIsAuthorized(false);
    setAppointments([]);
  }

  function openDatePicker() {
    const input = dateInputRef.current;
    if (!input) return;

    input.focus();
    input.showPicker?.();
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
              Visualize os horários confirmados no Supabase, crie bloqueios e remova
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
                <div className="text-sm font-semibold text-zinc-300">Filtrar por data</div>
                <p className="mt-1 text-sm text-zinc-500">
                  Escolha uma data pelo botão abaixo ou clicando direto no campo do
                  calendário.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <label className="relative block max-w-[280px]">
                  <span className="sr-only">Escolher data</span>
                  <input
                    ref={dateInputRef}
                    className="w-full cursor-pointer rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-4 text-lg font-semibold text-zinc-100 outline-none transition hover:border-zinc-500 focus:border-zinc-400"
                    type="date"
                    value={selectedDate}
                    onChange={(event) => setSelectedDate(event.target.value)}
                  />
                </label>

                <button
                  className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 font-semibold text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-800"
                  onClick={openDatePicker}
                  type="button"
                >
                  Abrir calendário
                </button>
              </div>

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

            <div className="grid gap-3 md:min-w-[280px]">
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-zinc-300">
                  Filtrar por barbeiro
                </span>
                <select
                  className="rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none transition hover:border-zinc-500 focus:border-zinc-400"
                  value={selectedProfessionalFilter}
                  onChange={(event) => setSelectedProfessionalFilter(event.target.value)}
                >
                  <option value="">Todos os profissionais</option>
                  {PROFESSIONALS.map((professional) => (
                    <option key={professional.id} value={professional.id}>
                      {professional.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="text-sm text-zinc-400">
                {selectedDate ? formatDateBR(selectedDate) : "Selecione uma data"}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-3xl bg-zinc-900/60 p-6 ring-1 ring-zinc-800">
          <div className="mb-5">
            <h2 className="text-xl font-semibold">Bloquear horário</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Reserve horários internamente para impedir novos agendamentos pelo site.
            </p>
          </div>

          <div className="mb-5 flex flex-wrap gap-2">
            <button
              className={[
                "rounded-full px-4 py-2 text-sm font-semibold transition",
                blockMode === "single"
                  ? "bg-zinc-100 text-zinc-950"
                  : "bg-zinc-800 text-zinc-200 hover:bg-zinc-700",
              ].join(" ")}
              type="button"
              onClick={() => setBlockMode("single")}
            >
              Horário
            </button>
            <button
              className={[
                "rounded-full px-4 py-2 text-sm font-semibold transition",
                blockMode === "range"
                  ? "bg-zinc-100 text-zinc-950"
                  : "bg-zinc-800 text-zinc-200 hover:bg-zinc-700",
              ].join(" ")}
              type="button"
              onClick={() => setBlockMode("range")}
            >
              Período
            </button>
            <button
              className={[
                "rounded-full px-4 py-2 text-sm font-semibold transition",
                blockMode === "full-day"
                  ? "bg-zinc-100 text-zinc-950"
                  : "bg-zinc-800 text-zinc-200 hover:bg-zinc-700",
              ].join(" ")}
              type="button"
              onClick={() => setBlockMode("full-day")}
            >
              Dia inteiro
            </button>
          </div>

          <form
            className={[
              "grid gap-4 md:items-end",
              blockMode === "range"
                ? "md:grid-cols-[1fr_1fr_1fr_1.2fr_auto]"
                : "md:grid-cols-[1fr_1fr_1.2fr_auto]",
            ].join(" ")}
            onSubmit={(event) => void handleCreateBlock(event)}
          >
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-zinc-300">Profissional</span>
              <select
                className="rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-4 text-zinc-100 outline-none transition hover:border-zinc-500 focus:border-zinc-400"
                value={blockProfessionalId}
                onChange={(event) => setBlockProfessionalId(event.target.value)}
              >
                <option value="">Selecione...</option>
                {PROFESSIONALS.map((professional) => (
                  <option key={professional.id} value={professional.id}>
                    {professional.name}
                  </option>
                ))}
              </select>
            </label>

            {blockMode !== "full-day" && (
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-zinc-300">
                  {blockMode === "range" ? "Início" : "Horário"}
                </span>
                <select
                  className="rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-4 text-zinc-100 outline-none transition hover:border-zinc-500 focus:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-50"
                  value={blockTime}
                  onChange={(event) => setBlockTime(event.target.value)}
                  disabled={!blockProfessionalId || availableBlockSlots.length === 0}
                >
                  <option value="">
                    {!blockProfessionalId
                      ? "Escolha um profissional"
                      : availableBlockSlots.length === 0
                      ? "Sem horários livres"
                      : "Selecione..."}
                  </option>
                  {availableBlockSlots.map((slot) => (
                    <option key={slot} value={slot}>
                      {slot}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {blockMode === "range" && (
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-zinc-300">Duração</span>
                <select
                  className="rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-4 text-zinc-100 outline-none transition hover:border-zinc-500 focus:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-50"
                  value={blockDurationMinutes}
                  onChange={(event) => setBlockDurationMinutes(event.target.value)}
                  disabled={!blockTime || availableRangeDurations.length === 0}
                >
                  <option value="">
                    {!blockTime ? "Selecione um início" : "Selecione..."}
                  </option>
                  {availableRangeDurations.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="grid gap-2">
              <span className="text-sm font-semibold text-zinc-300">Observação opcional</span>
              <input
                className="rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-4 text-zinc-100 outline-none transition hover:border-zinc-500 focus:border-zinc-400"
                value={blockNote}
                onChange={(event) => setBlockNote(event.target.value)}
                placeholder="Ex: almoço, reunião, encaixe interno"
              />
            </label>

            <div className="flex flex-col gap-3">
              {blockMode === "full-day" ? (
                <button
                  className="rounded-xl bg-zinc-100 px-5 py-4 font-semibold text-zinc-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={blocking || !blockProfessionalId || availableBlockSlots.length === 0}
                  type="button"
                  onClick={() => void handleCreateFullDayBlock()}
                >
                  {blocking ? "Bloqueando..." : "Bloquear dia inteiro"}
                </button>
              ) : (
                <button
                  className="rounded-xl bg-zinc-100 px-5 py-4 font-semibold text-zinc-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={
                    blocking ||
                    !blockProfessionalId ||
                    !blockTime ||
                    (blockMode === "range" && !blockDurationMinutes)
                  }
                  type="submit"
                >
                  {blocking
                    ? "Bloqueando..."
                    : blockMode === "range"
                    ? "Bloquear período"
                    : "Bloquear horário"}
                </button>
              )}
            </div>
          </form>

          {blockFeedback && (
            <div className="mt-4 rounded-xl border border-emerald-500/40 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-200">
              {blockFeedback}
            </div>
          )}
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl bg-zinc-900/60 p-5 ring-1 ring-zinc-800">
            <div className="text-sm text-zinc-500">Agendamentos do dia</div>
            <div className="mt-2 text-3xl font-bold">{daySummary.total}</div>
          </div>

          <div className="rounded-2xl bg-zinc-900/60 p-5 ring-1 ring-zinc-800">
            <div className="text-sm text-zinc-500">Com cliente</div>
            <div className="mt-2 text-3xl font-bold">{bookingAppointments.length}</div>
          </div>

          <div className="rounded-2xl bg-zinc-900/60 p-5 ring-1 ring-zinc-800">
            <div className="text-sm text-zinc-500">Bloqueios</div>
            <div className="mt-2 text-3xl font-bold">{blockedAppointments.length}</div>
          </div>

          <div className="rounded-2xl bg-zinc-900/60 p-5 ring-1 ring-zinc-800">
            <div className="text-sm text-zinc-500">Primeiro horário</div>
            <div className="mt-2 text-3xl font-bold">{displayTimeSummary(daySummary.first)}</div>
          </div>
        </section>

        <section className="mt-4">
          <div className="rounded-2xl bg-zinc-900/60 p-5 ring-1 ring-zinc-800">
            <div className="text-sm text-zinc-500">Último horário ocupado</div>
            <div className="mt-2 text-3xl font-bold">{displayTimeSummary(daySummary.last)}</div>
          </div>
        </section>

        {error && (
          <div className="mt-6 rounded-xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <section className="mt-8 space-y-6">
          {loading ? (
            <div className="rounded-3xl bg-zinc-900/60 p-10 text-center text-zinc-300 ring-1 ring-zinc-800">
              Carregando...
            </div>
          ) : sortedAppointments.length === 0 ? (
            <div className="rounded-3xl bg-zinc-900/60 p-10 text-center text-zinc-300 ring-1 ring-zinc-800">
              Nenhum agendamento encontrado para esta data.
            </div>
          ) : (
            <>
              <AppointmentSection
                title="Agendamentos"
                subtitle="Clientes com horário confirmado para este dia."
                items={bookingAppointments}
                deletingKey={deletingKey}
                onDelete={deleteAppointment}
                emptyMessage="Nenhum agendamento para esta data."
              />

              <BlockedSection
                title="Bloqueios de horário"
                subtitle="Horários reservados internamente, agrupados por faixa."
                items={groupedBlockedAppointments}
                deletingKey={deletingKey}
                onDelete={deleteBlockGroup}
                emptyMessage="Nenhum bloqueio encontrado para esta data."
              />
            </>
          )}
        </section>
      </div>
    </main>
  );
}

function AppointmentSection({
  title,
  subtitle,
  items,
  deletingKey,
  onDelete,
  emptyMessage = "Nenhum item encontrado para esta seção.",
}: {
  title: string;
  subtitle: string;
  items: AppointmentRow[];
  deletingKey: string | null;
  onDelete: (id: string) => Promise<void>;
  emptyMessage?: string;
}) {
  return (
    <div className="rounded-3xl bg-zinc-900/60 p-6 ring-1 ring-zinc-800">
      <div className="mb-5">
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-zinc-400">{subtitle}</p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl bg-zinc-950/50 px-5 py-6 text-sm text-zinc-400 ring-1 ring-zinc-800">
          {emptyMessage}
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((appointment) => {
            const id = String(appointment.id);
            const time = appointment.start_time ?? appointment.time ?? "";
            const isBlock = inferEntryType(appointment) === "block";

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
                  <div className="text-sm text-zinc-500">{isBlock ? "Observação" : "Cliente"}</div>
                  <div className="font-semibold">
                    {appointment.customer_name || (isBlock ? "Bloqueio manual" : "Não informado")}
                  </div>
                  {appointment.customer_phone && (
                    <div className="mt-1 text-sm text-zinc-400">{appointment.customer_phone}</div>
                  )}
                </div>

                <div>
                  <div className="text-sm text-zinc-500">Serviço</div>
                  <div className="font-semibold">{appointment.service || "Não informado"}</div>
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
                    {isBlock ? "Bloqueado" : statusLabel(appointment.status)}
                  </div>
                </div>

                <button
                  className="rounded-xl bg-zinc-800 px-5 py-3 font-semibold text-zinc-100 transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={deletingKey === id}
                  onClick={() => void onDelete(id)}
                >
                  {deletingKey === id ? "Apagando..." : "Apagar"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BlockedSection({
  title,
  subtitle,
  items,
  deletingKey,
  onDelete,
  emptyMessage = "Nenhum item encontrado para esta seção.",
}: {
  title: string;
  subtitle: string;
  items: BlockGroup[];
  deletingKey: string | null;
  onDelete: (group: BlockGroup) => Promise<void>;
  emptyMessage?: string;
}) {
  return (
    <div className="rounded-3xl bg-zinc-900/60 p-6 ring-1 ring-zinc-800">
      <div className="mb-5">
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-zinc-400">{subtitle}</p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl bg-zinc-950/50 px-5 py-6 text-sm text-zinc-400 ring-1 ring-zinc-800">
          {emptyMessage}
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((group) => (
            <div
              key={group.key}
              className="grid gap-4 rounded-2xl bg-zinc-950/70 p-5 ring-1 ring-zinc-800 md:grid-cols-[1fr_1fr_1fr_0.8fr_auto] md:items-center"
            >
              <div>
                <div className="text-sm text-zinc-500">Faixa bloqueada</div>
                <div className="text-2xl font-bold">
                  {group.start} às {group.end}
                </div>
                <div className="mt-1 text-sm text-zinc-400">
                  {group.totalSlots} slot{group.totalSlots > 1 ? "s" : ""}
                </div>
              </div>

              <div>
                <div className="text-sm text-zinc-500">Observação</div>
                <div className="font-semibold">{group.note}</div>
              </div>

              <div>
                <div className="text-sm text-zinc-500">Profissional</div>
                <div className="font-semibold">{group.professionalName}</div>
              </div>

              <div>
                <div className="text-sm text-zinc-500">Status</div>
                <div className="font-semibold">Bloqueado</div>
              </div>

              <button
                className="rounded-xl bg-zinc-800 px-5 py-3 font-semibold text-zinc-100 transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={deletingKey === group.key}
                onClick={() => void onDelete(group)}
              >
                {deletingKey === group.key ? "Apagando..." : "Apagar bloco"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
