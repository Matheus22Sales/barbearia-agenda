export type Service = {
  id: string;
  dbId: string;
  code: string;
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

export const OPEN_HOUR = 10;
export const CLOSE_HOUR = 19;
export const SLOT_STEP_MIN = 30;

export const SERVICES: Service[] = [
  {
    id: "corte",
    dbId: "7593961e-57cf-4c96-adfc-9255df9f8bb3",
    code: "corte",
    name: "Corte",
    minutes: 30,
    price: 55,
    description: "Corte profissional com acabamento impecavel",
    active: true,
  },
  {
    id: "combo",
    dbId: "2f3cb0d0-2c9d-439c-8731-df82e98a9fd8",
    code: "combo",
    name: "Corte + Barba",
    minutes: 60,
    price: 75,
    description: "Servico completo: corte e barba feita",
    active: true,
  },
];

export const PROFESSIONALS: Professional[] = [
  {
    id: "85ce3442-8b71-4727-af86-384cc38636c3",
    name: "Barbeiro 1",
    active: true,
  },
  {
    id: "ff57a32b-7ab2-483d-9b26-e1f1826afef0",
    name: "Barbeiro 2",
    active: true,
  },
  {
    id: "7b3a643a-3642-4859-90aa-21686b60c8f0",
    name: "Barbeiro 3",
    active: true,
  },
  {
    id: "f82b9888-5dbc-4d6e-821f-2100eb600d77",
    name: "Barbeiro 4",
    active: true,
  },
];

export const INSTAGRAM_HANDLE = "@barbeariagoldeninterlagos";
export const INSTAGRAM_URL = "https://instagram.com/barbeariagoldeninterlagos";
export const BUSINESS_NAME = "Barbearia Golden";
export const BUSINESS_HOURS_LABEL = "10h as 19h";
export const BUSINESS_SLOT_LABEL = "Slots de 30 minutos";
export const BUSINESS_BOOKING_LABEL = "Agendamento rapido e claro";
