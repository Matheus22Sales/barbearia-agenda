"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SERVICES, PROFESSIONALS } from "../lib/config";
import { formatDateShortBR } from "../lib/format";
import { supabase } from "../lib/supabaseClient";
import { trackBookingId } from "../lib/bookings";

type CreatedAppointment = {
  id?: string | number | null;
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

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return fallback;
}

export default function ConfirmarPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const serviceId = (sp.get("service") ?? "").toLowerCase();
  const proId = sp.get("proId") ?? "";
  const proNameFromUrl = sp.get("pro") ?? "";
  const date = sp.get("date") ?? "";
  const time = sp.get("time") ?? "";

  const service = SERVICES.find((s) => s.id === serviceId);
  const pro =
    PROFESSIONALS.find((p) => p.id === proId) ??
    (proNameFromUrl
      ? { id: proId || "pro-unknown", name: proNameFromUrl, active: true }
      : null);

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    setError(null);

    if (!service) {
      alert("Serviço inválido. Volte e selecione novamente.");
      router.push("/");
      return;
    }
    if (!pro) {
      alert("Profissional inválido. Volte e selecione novamente.");
      router.back();
      return;
    }
    if (!date || !time) {
      alert("Faltou data ou horário. Volte e selecione novamente.");
      router.back();
      return;
    }
    if (!customerName.trim()) {
      setError("Informe seu nome para confirmar o agendamento.");
      return;
    }

    setSubmitting(true);
    try {
      const payload: AppointmentPayload = {
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim() || null,
        service_id: service.dbId,
        professional_id: pro.id,
        service: service.name,
        professional_name: pro.name,
        date,
        time,
        start_time: time,
        status: "scheduled",
      };

      const { data, error: insertError } = await supabase
        .from("appointments")
        .insert(payload)
        .select("id")
        .single();

      if (insertError) throw insertError;

      const created = data as CreatedAppointment | null;
      const bookingId = created?.id == null ? "" : String(created.id);
      if (bookingId) {
        trackBookingId(bookingId);
      }

      alert("Agendamento confirmado!");
      router.push("/meus-agendamentos");
    } catch (submitError) {
      setError(getErrorMessage(submitError, "Erro ao confirmar agendamento."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-bold">Confirmar agendamento</h1>
        <p className="mt-3 text-zinc-300">Confira os dados e informe seus dados antes de confirmar.</p>

        <div className="mt-8 rounded-2xl bg-zinc-900 p-8">
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <div className="text-sm text-zinc-400">Serviço</div>
              <div className="text-lg font-semibold">
                {service?.name ?? "não informado"}
              </div>
            </div>

            <div>
              <div className="text-sm text-zinc-400">Profissional</div>
              <div className="text-lg font-semibold">
                {pro?.name ?? "não informado"}
              </div>
            </div>

            <div>
              <div className="text-sm text-zinc-400">Data</div>
              <div className="text-lg font-semibold">
                {date ? formatDateShortBR(date) : "não informado"}
              </div>
            </div>

            <div>
              <div className="text-sm text-zinc-400">Horário</div>
              <div className="text-lg font-semibold">
                {time || "não informado"}
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-4">
            <label className="grid gap-2">
              <span className="text-sm text-zinc-300">Seu nome</span>
              <input
                className="rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none focus:border-zinc-500"
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                placeholder="Ex: Matheus"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm text-zinc-300">Telefone (opcional)</span>
              <input
                className="rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none focus:border-zinc-500"
                value={customerPhone}
                onChange={(event) => setCustomerPhone(event.target.value)}
                placeholder="11999999999"
              />
            </label>
          </div>
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <div className="mt-8 flex gap-3">
          <button
            className="rounded-xl bg-zinc-100 px-5 py-3 font-semibold text-zinc-950 hover:bg-white transition disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-300"
            onClick={() => void handleConfirm()}
            disabled={submitting}
          >
            {submitting ? "Confirmando..." : "Confirmar"}
          </button>

          <button
            className="rounded-xl bg-zinc-900 px-5 py-3 font-semibold text-zinc-100 hover:bg-zinc-800 transition"
            onClick={() => router.back()}
            disabled={submitting}
          >
            Voltar
          </button>
        </div>
      </div>
    </main>
  );
}

