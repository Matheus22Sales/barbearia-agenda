export function formatDateShortBR(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);

  const weekday = dt
    .toLocaleDateString("pt-BR", { weekday: "short" })
    .replace(".", "")
    .toLowerCase();

  const day = String(d).padStart(2, "0");
  const month = String(m).padStart(2, "0");

  return `${weekday}, ${day}/${month}`;
}

export function moneyBRL(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}
