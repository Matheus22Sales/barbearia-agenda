"use client";

import React, { useEffect, useMemo, useState } from "react";
import { getCatalog } from "../../lib/catalog";
import { supabase } from "../../lib/supabaseClient";

type Service = {
  id: string;
  service_name?: string;
  name?: string;
  title?: string;
  minutes?: number;
  price?: number;
};

type Professional = {
  id: string;
  professional_name?: string;
  name?: string;
  title?: string;
};

type AppointmentRow = {
  time?: string | null;
  start_time?: string | null;
  hour?: string | null;
};

type AppointmentPayload = {
  customer_name: string;
  customer_phone: string | null;
  service_id: string;
  professional_id: string;
  service: string;
  professional_name: string;
  date: string;
  time: string;
  start_time: string;
  status: string;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toHHMM(totalMinutes: number) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${pad2(h)}:${pad2(m)}`;
}

function getServiceLabel(service: Service) {
  return service.service_name ?? service.name ?? service.title ?? service.id;
}

function getProfessionalLabel(professional: Professional) {
  return professional.professional_name ?? professional.name ?? professional.title ?? professional.id;
}

function buildSlots(opts: {
  openHHMM: string;
  closeHHMM: string;
  stepMinutes: number;
  serviceMinutes: number;
  takenTimes: Set<string>;
}) {
  const [oh, om] = opts.openHHMM.split(":").map(Number);
  const [ch, cm] = opts.closeHHMM.split(":").map(Number);

  const open = oh * 60 + om;
  const close = ch * 60 + cm;
  const slots: string[] = [];

  for (let t = open; t + opts.serviceMinutes <= close; t += opts.stepMinutes) {
    const hhmm = toHHMM(t);
    if (!opts.takenTimes.has(hhmm)) slots.push(hhmm);
  }

  return slots;
}

export default function NewAppointmentPage() {
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<Service[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [professionalId, setProfessionalId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [times, setTimes] = useState<string[]>([]);
  const [timesLoading, setTimesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const OPEN_HHMM = "09:00";
  const CLOSE_HHMM = "20:00";
  const STEP_MINUTES = 30;

  const selectedService = useMemo(
    () => services.find((service) => service.id === serviceId) || null,
    [services, serviceId],
  );

  const selectedProfessional = useMemo(
    () => professionals.find((professional) => professional.id === professionalId) || null,
    [professionals, professionalId],
  );

  const serviceName = useMemo(() => {
    if (!selectedService) return "";
    return getServiceLabel(selectedService);
  }, [selectedService]);

  const professionalName = useMemo(() => {
    if (!selectedProfessional) return "";
    return getProfessionalLabel(selectedProfessional);
  }, [selectedProfessional]);

  const serviceMinutes = useMemo(() => {
    if (!selectedService) return 30;
    if (typeof selectedService.minutes === "number") return selectedService.minutes;

    const name = getServiceLabel(selectedService).toLowerCase();
    const match = name.match(/(\d+)\s*min/);
    if (match) return Number(match[1]) || 30;

    return 30;
  }, [selectedService]);

  useEffect(() => {
    async function loadBaseData() {
      setLoading(true);
      setError(null);

      try {
        const catalog = await getCatalog();
        setServices(
          catalog.services.map((service) => ({
            id: service.dbId,
            service_name: service.name,
            minutes: service.minutes,
            price: service.price,
          })),
        );
        setProfessionals(
          catalog.professionals.map((professional) => ({
            id: professional.id,
            professional_name: professional.name,
          })),
        );
      } catch (loadFailure) {
        const message =
          loadFailure && typeof loadFailure === "object" && "message" in loadFailure
            ? String((loadFailure as { message?: unknown }).message ?? "Erro ao carregar dados.")
            : "Erro ao carregar dados.";
        setError(message);
      } finally {
        setLoading(false);
      }
    }

    void loadBaseData();
  }, []);

  useEffect(() => {
    async function loadTimes() {
      setTimes([]);
      setTime("");
      setOk(null);
      setError(null);

      if (!date || !professionalId || !serviceId) return;

      setTimesLoading(true);
      try {
        const { data, error: appointmentsError } = await supabase
          .from("appointments")
          .select("*")
          .eq("professional_id", professionalId)
          .eq("date", date);

        if (appointmentsError) throw appointmentsError;

        const rows = (data ?? []) as AppointmentRow[];
        const taken = new Set<string>();

        for (const row of rows) {
          const raw =
            (typeof row.time === "string" && row.time) ||
            (typeof row.start_time === "string" && row.start_time) ||
            (typeof row.hour === "string" && row.hour) ||
            "";

          const current = raw ? String(raw).slice(0, 5) : "";
          if (current) taken.add(current);
        }

        const slots = buildSlots({
          openHHMM: OPEN_HHMM,
          closeHHMM: CLOSE_HHMM,
          stepMinutes: STEP_MINUTES,
          serviceMinutes,
          takenTimes: taken,
        });

        setTimes(slots);
      } catch (loadFailure) {
        const message =
          loadFailure && typeof loadFailure === "object" && "message" in loadFailure
            ? String((loadFailure as { message?: unknown }).message ?? "Erro ao carregar horarios.")
            : "Erro ao carregar horarios.";
        setError(message);
      } finally {
        setTimesLoading(false);
      }
    }

    void loadTimes();
  }, [date, professionalId, serviceId, serviceMinutes]);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setOk(null);

    if (!customerName.trim()) return setError("Preencha o nome do cliente.");
    if (!serviceId) return setError("Selecione um servico.");
    if (!professionalId) return setError("Selecione um profissional.");
    if (!date) return setError("Selecione uma data.");
    if (!time) return setError("Selecione um horario.");

    const payload: AppointmentPayload = {
      customer_name: customerName.trim(),
      customer_phone: customerPhone.trim() || null,
      service_id: serviceId,
      professional_id: professionalId,
      service: serviceName,
      professional_name: professionalName,
      date,
      time,
      start_time: time,
      status: "scheduled",
    };

    try {
      const { error: insertError } = await supabase.from("appointments").insert(payload);
      if (insertError) throw insertError;

      setOk("Agendamento criado com sucesso.");
      setCustomerName("");
      setCustomerPhone("");
      setServiceId("");
      setProfessionalId("");
      setDate("");
      setTime("");
      setTimes([]);
    } catch (createFailure) {
      const message =
        createFailure && typeof createFailure === "object" && "message" in createFailure
          ? String((createFailure as { message?: unknown }).message ?? "Erro ao criar agendamento.")
          : "Erro ao criar agendamento.";
      setError(message);
    }
  }

  return (
    <main className="min-h-screen text-zinc-100">
      <div className="mx-auto max-w-5xl px-6 py-8 sm:py-10">
        <header className="gold-panel rounded-[28px] px-6 py-6 sm:px-8">
          <div className="max-w-2xl">
            <div className="gold-accent-text text-xs font-semibold uppercase tracking-[0.28em]">
              Operacao interna
            </div>
            <h1 className="mt-3 text-4xl font-black tracking-tight text-zinc-50 sm:text-5xl">
              Criacao manual de agendamentos.
            </h1>
            <p className="mt-4 text-base leading-7 text-zinc-300 sm:text-lg">
              Use esta tela para cadastrar agendamentos diretamente no sistema quando precisar
              montar a agenda sem passar pelo fluxo publico.
            </p>
          </div>
        </header>

        {error && (
          <div className="mt-6 rounded-2xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        {ok && (
          <div className="mt-6 rounded-2xl border border-emerald-500/40 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-200">
            {ok}
          </div>
        )}

        <section className="mt-8 grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="gold-panel-strong rounded-[28px] p-6 sm:p-8">
            <h2 className="text-2xl font-bold text-zinc-50">Novo agendamento</h2>
            <p className="mt-2 text-zinc-400">
              Selecione servico, profissional, data e horario para registrar o atendimento.
            </p>

            {loading ? (
              <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950/55 px-5 py-4 text-zinc-300">
                Carregando dados base...
              </div>
            ) : (
              <form onSubmit={handleCreate} className="mt-8 grid gap-4">
                <label className="grid gap-2">
                  <span className="text-sm text-zinc-300">Nome do cliente</span>
                  <input
                    value={customerName}
                    onChange={(event) => setCustomerName(event.target.value)}
                    className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none focus:border-zinc-500"
                    placeholder="Ex: Matheus"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm text-zinc-300">Telefone (opcional)</span>
                  <input
                    value={customerPhone}
                    onChange={(event) => setCustomerPhone(event.target.value)}
                    className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none focus:border-zinc-500"
                    placeholder="11999999999"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm text-zinc-300">Servico</span>
                  <select
                    value={serviceId}
                    onChange={(event) => setServiceId(event.target.value)}
                    className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none focus:border-zinc-500"
                  >
                    <option value="">Selecione...</option>
                    {services.map((service) => (
                      <option key={service.id} value={service.id}>
                        {getServiceLabel(service)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-2">
                  <span className="text-sm text-zinc-300">Profissional</span>
                  <select
                    value={professionalId}
                    onChange={(event) => setProfessionalId(event.target.value)}
                    className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none focus:border-zinc-500"
                  >
                    <option value="">Selecione...</option>
                    {professionals.map((professional) => (
                      <option key={professional.id} value={professional.id}>
                        {getProfessionalLabel(professional)}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-sm text-zinc-300">Data</span>
                    <input
                      type="date"
                      value={date}
                      onChange={(event) => setDate(event.target.value)}
                      className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none focus:border-zinc-500"
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="text-sm text-zinc-300">Horario</span>
                    <select
                      value={time}
                      onChange={(event) => setTime(event.target.value)}
                      disabled={!date || !serviceId || !professionalId || timesLoading}
                      className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none focus:border-zinc-500 disabled:cursor-not-allowed disabled:text-zinc-500"
                    >
                      <option value="">
                        {timesLoading
                          ? "Carregando horarios..."
                          : !date || !serviceId || !professionalId
                            ? "Selecione data + servico + profissional"
                            : times.length === 0
                              ? "Sem horarios disponiveis"
                              : "Selecione..."}
                      </option>
                      {times.map((current) => (
                        <option key={current} value={current}>
                          {current}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <button
                  type="submit"
                  className="mt-2 rounded-2xl bg-zinc-100 px-5 py-3 font-semibold text-zinc-950 hover:bg-white transition"
                >
                  Criar agendamento
                </button>
              </form>
            )}
          </div>

          <aside className="gold-panel rounded-[28px] p-6 sm:p-8">
            <div className="gold-accent-text text-xs font-semibold uppercase tracking-[0.28em]">
              Resumo
            </div>
            <h2 className="mt-2 text-2xl font-bold text-zinc-50">Contexto do cadastro</h2>

            <div className="mt-6 grid gap-4">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/55 p-5">
                <div className="text-sm text-zinc-400">Servico escolhido</div>
                <div className="mt-2 text-xl font-semibold">
                  {serviceName || "Selecione um servico"}
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/55 p-5">
                <div className="text-sm text-zinc-400">Profissional</div>
                <div className="mt-2 text-xl font-semibold">
                  {professionalName || "Selecione um profissional"}
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/55 p-5">
                <div className="text-sm text-zinc-400">Duracao</div>
                <div className="mt-2 text-xl font-semibold">{serviceMinutes} minutos</div>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-amber-400/15 bg-amber-500/8 p-5 text-sm leading-6 text-zinc-300">
              Esta tela e util para lancamento manual, encaixes ou organizacao interna quando a
              barbearia quiser registrar um horario sem usar o fluxo publico.
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
