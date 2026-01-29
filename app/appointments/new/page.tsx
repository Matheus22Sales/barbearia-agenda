"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type Service = {
  id: string;
  service_name?: string;
  name?: string;
  title?: string;
  minutes?: number; // isso é na tabela services (pode existir)
  price?: number;
};

type Professional = {
  id: string;
  professional_name?: string;
  name?: string;
  title?: string;
};

// appointments: vamos usar select("*") então não precisa tipar perfeito
type AppointmentRow = Record<string, any>;

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toHHMM(totalMinutes: number) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${pad2(h)}:${pad2(m)}`;
}

function getServiceLabel(s: Service) {
  return s.service_name ?? s.name ?? s.title ?? s.id;
}

function getProfessionalLabel(p: Professional) {
  return p.professional_name ?? p.name ?? p.title ?? p.id;
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

  const [date, setDate] = useState(""); // YYYY-MM-DD
  const [time, setTime] = useState(""); // HH:MM

  const [times, setTimes] = useState<string[]>([]);
  const [timesLoading, setTimesLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // Ajuste se quiser
  const OPEN_HHMM = "09:00";
  const CLOSE_HHMM = "20:00";
  const STEP_MINUTES = 30;

  const selectedService = useMemo(() => {
    return services.find((s) => s.id === serviceId) || null;
  }, [services, serviceId]);

  const selectedProfessional = useMemo(() => {
    return professionals.find((p) => p.id === professionalId) || null;
  }, [professionals, professionalId]);

  const serviceName = useMemo(() => {
    if (!selectedService) return "";
    return getServiceLabel(selectedService);
  }, [selectedService]);

  const professionalName = useMemo(() => {
    if (!selectedProfessional) return "";
    return getProfessionalLabel(selectedProfessional);
  }, [selectedProfessional]);

  // Duração vem do SERVICES (não do APPOINTMENTS!)
  const serviceMinutes = useMemo(() => {
    if (!selectedService) return 30;
    if (typeof selectedService.minutes === "number") return selectedService.minutes;

    const nm = getServiceLabel(selectedService).toLowerCase();
    const match = nm.match(/(\d+)\s*min/);
    if (match) return Number(match[1]) || 30;

    return 30;
  }, [selectedService]);

  // Carrega serviços e profissionais (SEM order no banco)
  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);

      try {
        const { data: sData, error: sErr } = await supabase
          .from("services")
          .select("*");
        if (sErr) throw sErr;

        const { data: pData, error: pErr } = await supabase
          .from("professionals")
          .select("*");
        if (pErr) throw pErr;

        const sArr = ((sData ?? []) as Service[]).slice().sort((a, b) =>
          getServiceLabel(a).localeCompare(getServiceLabel(b), "pt-BR")
        );

        const pArr = ((pData ?? []) as Professional[]).slice().sort((a, b) =>
          getProfessionalLabel(a).localeCompare(getProfessionalLabel(b), "pt-BR")
        );

        setServices(sArr);
        setProfessionals(pArr);
      } catch (e: any) {
        setError(e?.message ?? "Erro ao carregar dados.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Carrega horários quando tiver (date + professional + service)
  useEffect(() => {
    (async () => {
      setTimes([]);
      setTime("");
      setOk(null);
      setError(null);

      if (!date || !professionalId || !serviceId) return;

      setTimesLoading(true);
      try {
        // IMPORTANTÍSSIMO: select("*") para não quebrar por coluna inexistente
        const { data, error: aErr } = await supabase
          .from("appointments")
          .select("*")
          .eq("professional_id", professionalId)
          .eq("date", date);

        if (aErr) throw aErr;

        const rows = (data ?? []) as AppointmentRow[];

        const taken = new Set<string>();

        for (const r of rows) {
          // tenta pegar o horário de qualquer coluna que você tenha no banco
          const raw =
            (typeof r.time === "string" && r.time) ||
            (typeof r.start_time === "string" && r.start_time) ||
            (typeof r.hour === "string" && r.hour) ||
            "";

          const t = raw ? String(raw).slice(0, 5) : "";
          if (t) taken.add(t);
        }

        const slots = buildSlots({
          openHHMM: OPEN_HHMM,
          closeHHMM: CLOSE_HHMM,
          stepMinutes: STEP_MINUTES,
          serviceMinutes,
          takenTimes: taken,
        });

        setTimes(slots);
      } catch (e: any) {
        setError(e?.message ?? "Erro ao carregar horários.");
      } finally {
        setTimesLoading(false);
      }
    })();
  }, [date, professionalId, serviceId, serviceMinutes]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);

    if (!customerName.trim()) return setError("Preencha o nome do cliente.");
    if (!serviceId) return setError("Selecione um serviço.");
    if (!professionalId) return setError("Selecione um profissional.");
    if (!date) return setError("Selecione uma data.");
    if (!time) return setError("Selecione um horário.");

    // NÃO manda minutes porque appointments NÃO tem essa coluna
    const payload: any = {
      customer_name: customerName.trim(),
      customer_phone: customerPhone.trim() || null,

      service_id: serviceId,
      professional_id: professionalId,

      // campos texto (pra não estourar NOT NULL de professional_name e etc)
      service: serviceName,
      professional_name: professionalName,

      date,

      // mantém os dois porque teu schema pode ter um ou outro
      time,
      start_time: time,

      status: "scheduled",
    };

    try {
      const { error: insErr } = await supabase.from("appointments").insert(payload);
      if (insErr) throw insErr;

      setOk("Agendamento criado com sucesso ✅");
      setCustomerName("");
      setCustomerPhone("");
      setServiceId("");
      setProfessionalId("");
      setDate("");
      setTime("");
      setTimes([]);
    } catch (e: any) {
      setError(e?.message ?? "Erro ao criar agendamento.");
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <h2>Novo agendamento</h2>
        <p>Carregando...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 720 }}>
      <h2>Novo agendamento</h2>
      <p style={{ opacity: 0.8 }}>Página /appointments/new funcionando ✅</p>

      {error && (
        <div
          style={{
            border: "1px solid #ff6b6b",
            background: "#ffecec",
            color: "#b00020",
            padding: 12,
            borderRadius: 8,
            marginBottom: 12,
          }}
        >
          {error}
        </div>
      )}

      {ok && (
        <div
          style={{
            border: "1px solid #2ecc71",
            background: "#eafff1",
            color: "#0f6b2f",
            padding: 12,
            borderRadius: 8,
            marginBottom: 12,
          }}
        >
          {ok}
        </div>
      )}

      <form onSubmit={handleCreate} style={{ display: "grid", gap: 12 }}>
        <div>
          <label>Nome do cliente</label>
          <input
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            style={{ width: "100%", padding: 10, marginTop: 6 }}
            placeholder="Ex: Matheus"
          />
        </div>

        <div>
          <label>Telefone (opcional)</label>
          <input
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            style={{ width: "100%", padding: 10, marginTop: 6 }}
            placeholder="11999999999"
          />
        </div>

        <div>
          <label>Serviço</label>
          <select
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}
            style={{ width: "100%", padding: 10, marginTop: 6 }}
          >
            <option value="">Selecione...</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {getServiceLabel(s)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label>Profissional</label>
          <select
            value={professionalId}
            onChange={(e) => setProfessionalId(e.target.value)}
            style={{ width: "100%", padding: 10, marginTop: 6 }}
          >
            <option value="">Selecione...</option>
            {professionals.map((p) => (
              <option key={p.id} value={p.id}>
                {getProfessionalLabel(p)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label>Data</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{ width: "100%", padding: 10, marginTop: 6 }}
          />
        </div>

        <div>
          <label>Horário</label>
          <select
            value={time}
            onChange={(e) => setTime(e.target.value)}
            style={{ width: "100%", padding: 10, marginTop: 6 }}
            disabled={!date || !serviceId || !professionalId || timesLoading}
          >
            <option value="">
              {timesLoading
                ? "Carregando horários..."
                : !date || !serviceId || !professionalId
                ? "Selecione data + serviço + profissional"
                : times.length === 0
                ? "Sem horários disponíveis"
                : "Selecione..."}
            </option>

            {times.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          <div style={{ fontSize: 12, opacity: 0.75, marginTop: 6 }}>
            Duração do serviço: <b>{serviceMinutes} min</b> (horário é o <b>início</b>)
          </div>
        </div>

        <button
          type="submit"
          style={{
            padding: 12,
            borderRadius: 10,
            border: "none",
            cursor: "pointer",
            fontWeight: 700,
          }}
        >
          Criar agendamento
        </button>
      </form>
    </div>
  );
}
