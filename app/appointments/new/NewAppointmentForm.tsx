"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type Service = {
  id: string;
  name: string;
  minutes: number;
  price: number;
};

type Professional = {
  id: string;
  name: string;
};

type AppointmentRow = {
  start_time: string; // "HH:MM"
  minutes: number;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function timeToMinutes(t: string) {
  const [hh, mm] = t.split(":").map((x) => parseInt(x, 10));
  return hh * 60 + mm;
}

function minutesToTime(m: number) {
  const hh = Math.floor(m / 60);
  const mm = m % 60;
  return `${pad2(hh)}:${pad2(mm)}`;
}

/**
 * Gera slots 30/30: 09:00 -> 19:00 (último início 18:30)
 * Ajuste se quiser.
 */
function buildBaseSlots() {
  const slots: string[] = [];
  const start = 9 * 60;
  const end = 19 * 60;
  const step = 30;

  for (let m = start; m < end; m += step) {
    slots.push(minutesToTime(m));
  }
  return slots;
}

export default function NewAppointmentForm({
  services,
  professionals,
}: {
  services: Service[];
  professionals: Professional[];
}) {
  const baseSlots = useMemo(() => buildBaseSlots(), []);

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  const [serviceId, setServiceId] = useState("");
  const [professionalId, setProfessionalId] = useState("");
  const [date, setDate] = useState(""); // yyyy-mm-dd
  const [startTime, setStartTime] = useState("");

  const selectedService = useMemo(
    () => services.find((s) => s.id === serviceId) ?? null,
    [services, serviceId]
  );

  const selectedProfessional = useMemo(
    () => professionals.find((p) => p.id === professionalId) ?? null,
    [professionals, professionalId]
  );

  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [loadingTimes, setLoadingTimes] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  // Carrega horários disponíveis (baseado no que já está ocupado)
  useEffect(() => {
    let isMounted = true;

    async function loadTimes() {
      setFormError(null);
      setOkMsg(null);
      setStartTime("");
      setAvailableTimes([]);

      if (!date || !professionalId || !selectedService) return;

      setLoadingTimes(true);

      try {
        // Busca agendamentos do dia + profissional
        const res = await supabase
          .from("appointments")
          .select("start_time,minutes")
          .eq("professional_id", professionalId)
          .eq("date", date);

        if (res.error) throw res.error;

        const rows = (res.data ?? []) as AppointmentRow[];

        // Cria intervalos ocupados
        const occupied: Array<{ start: number; end: number }> = rows
          .filter((r) => r.start_time && typeof r.minutes === "number")
          .map((r) => {
            const s = timeToMinutes(r.start_time);
            const e = s + r.minutes;
            return { start: s, end: e };
          });

        // Para o serviço atual, bloqueia qualquer slot que sobreponha.
        const serviceLen = selectedService.minutes;

        const filtered = baseSlots.filter((slot) => {
          const s = timeToMinutes(slot);
          const e = s + serviceLen;

          // não deixa passar do fim do expediente
          const lastAllowed = 19 * 60;
          if (e > lastAllowed) return false;

          // checa overlap
          const overlaps = occupied.some((o) => !(e <= o.start || s >= o.end));
          return !overlaps;
        });

        if (!isMounted) return;
        setAvailableTimes(filtered);
      } catch (err: any) {
        if (!isMounted) return;
        setFormError(err?.message ?? "Erro ao carregar horários.");
      } finally {
        if (!isMounted) return;
        setLoadingTimes(false);
      }
    }

    loadTimes();
    return () => {
      isMounted = false;
    };
  }, [date, professionalId, selectedService, baseSlots]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setOkMsg(null);

    if (!customerName.trim()) {
      setFormError("Informe o nome do cliente.");
      return;
    }
    if (!selectedService) {
      setFormError("Selecione um serviço.");
      return;
    }
    if (!selectedProfessional) {
      setFormError("Selecione um profissional.");
      return;
    }
    if (!date) {
      setFormError("Selecione a data.");
      return;
    }
    if (!startTime) {
      setFormError("Selecione o horário.");
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim() || null,

        service_id: selectedService.id,
        service_name: selectedService.name,
        minutes: selectedService.minutes,

        professional_id: selectedProfessional.id,
        professional_name: selectedProfessional.name,

        date, // yyyy-mm-dd
        start_time: startTime, // HH:MM

        status: "scheduled",
        kind: "client",
      };

      const res = await supabase.from("appointments").insert(payload);

      if (res.error) throw res.error;

      setOkMsg("Agendamento criado ✅");
      setCustomerName("");
      setCustomerPhone("");
      setServiceId("");
      setProfessionalId("");
      setDate("");
      setStartTime("");
      setAvailableTimes([]);
    } catch (err: any) {
      setFormError(err?.message ?? "Erro ao criar agendamento.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: 16 }}>
      {formError && (
        <div
          style={{
            border: "1px solid #f5a3a3",
            background: "#fff1f1",
            padding: 12,
            borderRadius: 8,
            marginBottom: 12,
          }}
        >
          {formError}
        </div>
      )}

      {okMsg && (
        <div
          style={{
            border: "1px solid #8bd3a7",
            background: "#f0fff5",
            padding: 12,
            borderRadius: 8,
            marginBottom: 12,
          }}
        >
          {okMsg}
        </div>
      )}

      <div style={{ display: "grid", gap: 12 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span>Nome do cliente</span>
          <input
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Ex: Matheus"
            style={{ padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span>Telefone (opcional)</span>
          <input
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            placeholder="11999999999"
            style={{ padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span>Serviço</span>
          <select
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}
            style={{ padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
          >
            <option value="">Selecione...</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.minutes} min) - R$ {s.price}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span>Profissional</span>
          <select
            value={professionalId}
            onChange={(e) => setProfessionalId(e.target.value)}
            style={{ padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
          >
            <option value="">Selecione...</option>
            {professionals.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span>Data</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{ padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>Horário</span>
            <select
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              disabled={!date || !professionalId || !selectedService || loadingTimes}
              style={{ padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
            >
              <option value="">
                {loadingTimes ? "Carregando..." : "Selecione..."}
              </option>
              {availableTimes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        </div>

        <button
          type="submit"
          disabled={submitting}
          style={{
            padding: 12,
            borderRadius: 10,
            border: "none",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          {submitting ? "Criando..." : "Criar agendamento"}
        </button>
      </div>
    </form>
  );
}
