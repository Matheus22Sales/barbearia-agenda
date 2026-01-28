export type Booking = {
  id: string;
  serviceId: string;
  serviceName: string;
  minutes: number;
  proId: string;
  proName: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  createdAt: number;
};

const STORAGE_KEY = "agendamentos";

function safeParse(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function genId() {
  // browsers modernos
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c: any = typeof crypto !== "undefined" ? crypto : null;
  if (c?.randomUUID) return c.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function timeToMinutes(t: string) {
  const [hh, mm] = t.split(":").map((x) => Number(x));
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return 0;
  return hh * 60 + mm;
}

function normalizeOne(item: any): Booking | null {
  if (!item || typeof item !== "object") return null;

  // suportar versões antigas (ex: só serviceId/date/time)
  const id = typeof item.id === "string" ? item.id : genId();
  const serviceId =
    typeof item.serviceId === "string"
      ? item.serviceId
      : typeof item.service === "string"
      ? item.service
      : "";

  const date = typeof item.date === "string" ? item.date : "";
  const time = typeof item.time === "string" ? item.time : "";

  if (!serviceId || !date || !time) return null;

  const serviceName =
    typeof item.serviceName === "string"
      ? item.serviceName
      : typeof item.service === "string"
      ? item.service
      : serviceId;

  const minutes =
    typeof item.minutes === "number" && Number.isFinite(item.minutes)
      ? item.minutes
      : 30;

  const proId =
    typeof item.proId === "string"
      ? item.proId
      : typeof item.professionalId === "string"
      ? item.professionalId
      : "pro-unknown";

  const proName =
    typeof item.proName === "string"
      ? item.proName
      : typeof item.pro === "string"
      ? item.pro
      : typeof item.professional === "string"
      ? item.professional
      : "não informado";

  const createdAt =
    typeof item.createdAt === "number" && Number.isFinite(item.createdAt)
      ? item.createdAt
      : Date.now();

  return {
    id,
    serviceId,
    serviceName,
    minutes,
    proId,
    proName,
    date,
    time,
    createdAt,
  };
}

export function readBookings(): Booking[] {
  if (typeof window === "undefined") return [];
  const parsed = safeParse(localStorage.getItem(STORAGE_KEY));

  if (!Array.isArray(parsed)) return [];

  const normalized = parsed
    .map(normalizeOne)
    .filter(Boolean) as Booking[];

  return normalized;
}

export function writeBookings(bookings: Booking[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bookings));
}

export function addBooking(input: Omit<Booking, "id" | "createdAt">): Booking {
  const current = readBookings();

  const booking: Booking = {
    ...input,
    id: genId(),
    createdAt: Date.now(),
  };

  current.push(booking);
  writeBookings(current);
  return booking;
}

export function removeBooking(id: string) {
  const current = readBookings();
  const next = current.filter((b) => b.id !== id);
  writeBookings(next);
}

export function clearBookings() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

export function isSlotBlocked(args: {
  proId: string;
  date: string;
  startTime: string; // HH:mm
  durationMin: number;
  ignoreId?: string;
}) {
  const { proId, date, startTime, durationMin, ignoreId } = args;

  if (!proId || !date || !startTime || !durationMin) return true;

  const start = timeToMinutes(startTime);
  const end = start + durationMin;

  const bookings = readBookings();

  return bookings.some((b) => {
    if (ignoreId && b.id === ignoreId) return false;
    if (b.proId !== proId) return false;
    if (b.date !== date) return false;

    const bStart = timeToMinutes(b.time);
    const bEnd = bStart + (b.minutes ?? 30);

    // overlap: start < bEnd && end > bStart
    return start < bEnd && end > bStart;
  });
}
