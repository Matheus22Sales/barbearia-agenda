// app/lib/config.ts

export type Service = {
  id: string;
  name: string;
  minutes: number;
  price: number;
  description: string;
  active: boolean;
};

export type Professional = {
  id: string;
  name: string;
  active: boolean;
};

// Horário de funcionamento (ajuste se quiser)
export const OPEN_HOUR = 10;
export const CLOSE_HOUR = 19;

// Intervalo dos slots (grade de horários)
export const SLOT_STEP_MIN = 30;

// Serviços (por enquanto só os 2 que você pediu)
export const SERVICES: Service[] = [
  {
    id: "corte",
    name: "Corte",
    minutes: 30,
    price: 55,
    description: "Corte profissional com acabamento impecável",
    active: true,
  },
  {
    id: "combo",
    name: "Corte + Barba",
    minutes: 60,
    price: 75,
    description: "Serviço completo: corte e barba feita",
    active: true,
  },
];

// Profissionais (exemplo)
export const PROFESSIONALS: Professional[] = [
  { id: "Barbeiro 1", name: "Barbeiro 1", active: true },
  { id: "Barbeiro 2", name: "Barbeiro 2", active: true },
  { id: "Barbeiro 3", name: "Barbeiro 3", active: true },
  { id: "Barbeiro 4", name: "Barbeiro 4", active: true },
];

// Social (p/ home/footer)
export const INSTAGRAM_HANDLE = "@barbeariagoldeninterlagos";
export const INSTAGRAM_URL = "https://instagram.com/barbeariagoldeninterlagos";
