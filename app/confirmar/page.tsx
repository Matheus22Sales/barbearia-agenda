"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { type Professional, type Service } from "../lib/config";
import { findProfessionalByParam, findServiceByParam, getCatalog } from "../lib/catalog";
import { formatDateShortBR, moneyBRL } from "../lib/format";
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

function ConfirmarPageContent() {
  const router = useRouter();
  const sp = useSearchParams();

  const serviceId = (sp.get("service") ?? "").toLowerCase();
  const proId = sp.get("proId") ?? "";
  const proNameFromUrl = sp.get("pro") ?? "";
  const date = sp.get("date") ?? "";
  const time = sp.get("time") ?? "";

  const [services, setServices] = useState<Service[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadCatalog() {
      setCatalogLoading(true);
      try {
        const catalog = await getCatalog();
        setServices(catalog.services);
        setProfessionals(catalog.professionals);
      } finally {
        setCatalogLoading(false);
      }
    }

    void loadCatalog();
  }, []);

  const service = useMemo(() => findServiceByParam(services, serviceId), [services, serviceId]);
  const pro = useMemo(
    () =>
      findProfessionalByParam(professionals, proId) ??
      (proNameFromUrl
        ? { id: proId || "pro-unknown", name: proNameFromUrl, active: true }
        : null),
    [proId, proNameFromUrl, professionals],
  );

  const handleConfirm = async () => {
    setError(null);

    if (catalogLoading) {
      setError("Ainda estamos carregando os dados do catalogo. Tente novamente em alguns segundos.");
      return;
    }
    if (!service) {
      alert("Servico invalido. Volte e selecione novamente.");
      router.push("/");
      return;
    }
    if (!pro) {
      alert("Profissional invalido. Volte e selecione novamente.");
      router.back();
      return;
    }
    if (!date || !time) {
      alert("Faltou data ou horario. Volte e selecione novamente.");
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

      router.push(`/meus-agendamentos?created=${encodeURIComponent(bookingId || "1")}`);
    } catch (submitError) {
      setError(getErrorMessage(submitError, "Erro ao confirmar agendamento."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen text-zinc-100">
      <div className="mx-auto max-w-5xl px-6 py-8 sm:py-10">
        <header className="gold-panel rounded-[28px] px-6 py-6 sm:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="gold-accent-text text-xs font-semibold uppercase tracking-[0.28em]">
                Passo 3
              </div>
              <h1 className="mt-3 text-4xl font-black tracking-tight text-zinc-50 sm:text-5xl">
                Confira os dados antes de confirmar.
              </h1>
              <p className="mt-4 text-base leading-7 text-zinc-300 sm:text-lg">
                Revise servico, barbeiro, dia e horario antes de finalizar.
              </p>
            </div>

            <button
              className="rounded-2xl border border-zinc-700 bg-zinc-950/70 px-5 py-3 font-semibold text-zinc-100 hover:border-zinc-500 hover:bg-zinc-900"
              onClick={() => router.back()}
              disabled={submitting}
            >
              Voltar
            </button>
          </div>
        </header>

        <section className="mt-8 grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="gold-panel-strong rounded-[28px] p-6 sm:p-8">
            <h2 className="text-2xl font-bold text-zinc-50">Resumo do atendimento</h2>
            <p className="mt-2 text-zinc-400">
              Esse e o resumo do horario que voce escolheu.
            </p>

            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              <div>
                <div className="text-sm text-zinc-400">Servico</div>
                <div className="text-lg font-semibold">
                  {catalogLoading ? "Carregando..." : service?.name ?? "Nao informado"}
                </div>
              </div>

              <div>
                <div className="text-sm text-zinc-400">Profissional</div>
                <div className="text-lg font-semibold">
                  {catalogLoading ? "Carregando..." : pro?.name ?? "Nao informado"}
                </div>
              </div>

              <div>
                <div className="text-sm text-zinc-400">Data</div>
                <div className="text-lg font-semibold">
                  {date ? formatDateShortBR(date) : "Nao informado"}
                </div>
              </div>

              <div>
                <div className="text-sm text-zinc-400">Horario</div>
                <div className="text-lg font-semibold">{time || "Nao informado"}</div>
              </div>

              <div>
                <div className="text-sm text-zinc-400">Duracao</div>
                <div className="text-lg font-semibold">
                  {catalogLoading ? "Carregando..." : service ? `${service.minutes} minutos` : "Nao informado"}
                </div>
              </div>

              <div>
                <div className="text-sm text-zinc-400">Valor</div>
                <div className="text-lg font-semibold">
                  {catalogLoading ? "Carregando..." : service ? moneyBRL(service.price) : "Nao informado"}
                </div>
              </div>
            </div>
          </div>

          <div className="gold-panel rounded-[28px] p-6 sm:p-8 lg:sticky lg:top-6 lg:self-start">
            <h2 className="text-2xl font-bold text-zinc-50">Dados do cliente</h2>
            <p className="mt-2 text-zinc-400">
              Preencha seus dados para concluir o agendamento.
            </p>

            <div className="mt-8 grid gap-4">
              <label className="grid gap-2">
                <span className="text-sm text-zinc-300">Seu nome</span>
                <input
                  className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none focus:border-zinc-500"
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  placeholder="Ex: Matheus"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm text-zinc-300">Telefone (opcional)</span>
                <input
                  className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none focus:border-zinc-500"
                  value={customerPhone}
                  onChange={(event) => setCustomerPhone(event.target.value)}
                  placeholder="11999999999"
                />
              </label>
            </div>

            {error && (
              <div className="mt-6 rounded-2xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            )}

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                className="rounded-2xl bg-zinc-100 px-5 py-3 font-semibold text-zinc-950 hover:bg-white transition disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-300"
                onClick={() => void handleConfirm()}
                disabled={submitting || catalogLoading}
              >
                {submitting ? "Confirmando..." : "Confirmar agendamento"}
              </button>

              <button
                className="rounded-2xl bg-zinc-900 px-5 py-3 font-semibold text-zinc-100 hover:bg-zinc-800 transition"
                onClick={() => router.back()}
                disabled={submitting}
              >
                Voltar
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export default function ConfirmarPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen text-zinc-100">
          <div className="mx-auto max-w-5xl px-6 py-8 sm:py-10">
            <section className="gold-panel rounded-[28px] px-6 py-10 sm:px-8">
              <div className="gold-accent-text text-xs font-semibold uppercase tracking-[0.28em]">
                Passo 3
              </div>
              <h1 className="mt-3 text-3xl font-black tracking-tight text-zinc-50 sm:text-4xl">
                Carregando confirmacao...
              </h1>
              <p className="mt-4 text-base leading-7 text-zinc-300">
                Estamos carregando o resumo do seu agendamento.
              </p>
            </section>
          </div>
        </main>
      }
    >
      <ConfirmarPageContent />
    </Suspense>
  );
}
