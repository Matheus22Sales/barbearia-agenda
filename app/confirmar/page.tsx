"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { SERVICES, PROFESSIONALS } from "../lib/config";
import { addBooking } from "../lib/bookings";
import { formatDateShortBR } from "../lib/format";

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
      ? { id: proId || "pro-unknown", name: proNameFromUrl }
      : null);

  const handleConfirm = () => {
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

    // BLOQUEIO final (segurança extra)
    // Se você quiser, dá pra checar com isSlotBlocked aqui também.

    addBooking({
      serviceId: service.id,
      serviceName: service.name,
      minutes: service.minutes,
      proId: pro.id,
      proName: pro.name,
      date,
      time,
    });

    alert("Agendamento confirmado!");
    router.push("/meus-agendamentos");
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-bold">Confirmar agendamento</h1>
        <p className="mt-3 text-zinc-300">Confira os dados antes de confirmar:</p>

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
        </div>

        <div className="mt-8 flex gap-3">
          <button
            className="rounded-xl bg-zinc-100 px-5 py-3 font-semibold text-zinc-950 hover:bg-white transition"
            onClick={handleConfirm}
          >
            Confirmar
          </button>

          <button
            className="rounded-xl bg-zinc-900 px-5 py-3 font-semibold text-zinc-100 hover:bg-zinc-800 transition"
            onClick={() => router.back()}
          >
            Voltar
          </button>
        </div>
      </div>
    </main>
  );
}
