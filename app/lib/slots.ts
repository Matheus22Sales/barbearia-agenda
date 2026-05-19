// app/lib/slots.ts
export type SlotConfig = { start: string; end: string; stepMinutes: number };

export const DEFAULT_SLOTS: SlotConfig = {
  start: "10:00",
  end: "22:00",
  stepMinutes: 30,
};

function assertValidTimeFormat(time: string): void {
  if (typeof time !== "string") {
    throw new Error("Horário inválido: esperado string no formato HH:mm.");
  }

  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!match) {
    throw new Error(
      `Horário inválido: "${time}". Use o formato HH:mm (00:00–23:59).`
    );
  }
}

export function timeToMinutes(time: string): number {
  assertValidTimeFormat(time);
  const [hours, minutes] = time.split(":");
  return Number(hours) * 60 + Number(minutes);
}

export function minutesToTime(totalMinutes: number): string {
  if (!Number.isFinite(totalMinutes)) {
    throw new Error("Minutos inválidos: esperado número finito.");
  }
  if (totalMinutes < 0) {
    throw new Error("Minutos inválidos: valor não pode ser negativo.");
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 23) {
    throw new Error(
      "Minutos inválidos: valor excede o limite diário (23:59)."
    );
  }

  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function generateSlots(
  config: SlotConfig = DEFAULT_SLOTS
): string[] {
  if (!config || typeof config !== "object") {
    throw new Error("Configuração inválida: esperado objeto SlotConfig.");
  }

  const { start, end, stepMinutes } = config;

  if (!Number.isInteger(stepMinutes) || stepMinutes <= 0) {
    throw new Error(
      "Configuração inválida: stepMinutes deve ser um inteiro positivo."
    );
  }

  const startMinutes = timeToMinutes(start);
  const endMinutes = timeToMinutes(end);

  if (startMinutes >= endMinutes) {
    throw new Error(
      "Configuração inválida: 'start' deve ser menor que 'end'."
    );
  }

  const slots: string[] = [];
  for (
    let current = startMinutes;
    current + stepMinutes <= endMinutes;
    current += stepMinutes
  ) {
    slots.push(minutesToTime(current));
  }

  return slots;
}
