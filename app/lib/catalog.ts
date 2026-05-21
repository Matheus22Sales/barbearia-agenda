import { PROFESSIONALS, SERVICES, type Professional, type Service } from "./config";
import { supabase } from "./supabaseClient";

type RawService = {
  id?: string | null;
  code?: string | null;
  service_name?: string | null;
  name?: string | null;
  title?: string | null;
  minutes?: number | string | null;
  price?: number | string | null;
  description?: string | null;
  active?: boolean | null;
  is_active?: boolean | null;
};

type RawProfessional = {
  id?: string | null;
  professional_name?: string | null;
  name?: string | null;
  title?: string | null;
  active?: boolean | null;
  is_active?: boolean | null;
};

type CatalogData = {
  services: Service[];
  professionals: Professional[];
};

let catalogPromise: Promise<CatalogData> | null = null;

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function asNumber(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function getServiceName(row: RawService) {
  return row.service_name ?? row.name ?? row.title ?? "Servico";
}

function getProfessionalName(row: RawProfessional) {
  return row.professional_name ?? row.name ?? row.title ?? "Profissional";
}

function normalizeService(row: RawService) {
  const serviceName = getServiceName(row);
  const matchedFallback =
    SERVICES.find((service) => service.dbId === row.id) ??
    SERVICES.find((service) => service.name.toLowerCase() === serviceName.toLowerCase()) ??
    null;

  return {
    id: slugify(serviceName) || matchedFallback?.id || String(row.id ?? "servico"),
    dbId: String(row.id ?? matchedFallback?.dbId ?? slugify(serviceName)),
    code: row.code?.trim() || matchedFallback?.code || slugify(serviceName) || "servico",
    name: serviceName,
    minutes: asNumber(row.minutes, matchedFallback?.minutes ?? 30),
    price: asNumber(row.price, matchedFallback?.price ?? 0),
    description:
      row.description?.trim() ||
      matchedFallback?.description ||
      "Servico disponivel para agendamento online",
    active: row.active ?? row.is_active ?? matchedFallback?.active ?? true,
  } satisfies Service;
}

function normalizeProfessional(row: RawProfessional) {
  const professionalName = getProfessionalName(row);
  const matchedFallback =
    PROFESSIONALS.find((professional) => professional.id === row.id) ??
    PROFESSIONALS.find(
      (professional) => professional.name.toLowerCase() === professionalName.toLowerCase(),
    ) ??
    null;

  return {
    id: String(row.id ?? matchedFallback?.id ?? slugify(professionalName)),
    name: professionalName,
    active: row.active ?? row.is_active ?? matchedFallback?.active ?? true,
  } satisfies Professional;
}

function sortByName<T extends { name: string }>(items: T[]) {
  return items.slice().sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

async function fetchCatalogFromSupabase(): Promise<CatalogData> {
  const [{ data: servicesData, error: servicesError }, { data: professionalsData, error: professionalsError }] =
    await Promise.all([
      supabase.from("services").select("*"),
      supabase.from("professionals").select("*"),
    ]);

  if (servicesError) throw servicesError;
  if (professionalsError) throw professionalsError;

  const normalizedServices = sortByName(
    ((servicesData ?? []) as RawService[])
      .map(normalizeService)
      .filter((service) => service.active),
  );

  const normalizedProfessionals = sortByName(
    ((professionalsData ?? []) as RawProfessional[])
      .map(normalizeProfessional)
      .filter((professional) => professional.active),
  );

  if (normalizedServices.length === 0 || normalizedProfessionals.length === 0) {
    throw new Error("Catalogo incompleto no Supabase.");
  }

  return {
    services: normalizedServices,
    professionals: normalizedProfessionals,
  };
}

function fallbackCatalog(): CatalogData {
  return {
    services: SERVICES.filter((service) => service.active),
    professionals: PROFESSIONALS.filter((professional) => professional.active),
  };
}

export async function getCatalog(forceRefresh = false): Promise<CatalogData> {
  if (forceRefresh || !catalogPromise) {
    catalogPromise = fetchCatalogFromSupabase().catch(() => fallbackCatalog());
  }

  return catalogPromise;
}

export function findServiceByParam(services: Service[], value: string) {
  const normalized = value.trim().toLowerCase();
  return (
    services.find(
      (service) =>
        service.id.toLowerCase() === normalized || service.dbId.toLowerCase() === normalized,
    ) ?? null
  );
}

export function findProfessionalByParam(professionals: Professional[], value: string) {
  return professionals.find((professional) => professional.id === value) ?? null;
}
