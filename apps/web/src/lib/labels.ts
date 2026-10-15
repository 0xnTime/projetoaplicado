import type { PaymentMethod, ReportGrouping, Role } from "@cantina/types";

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  CREDITO: "Cartão de crédito",
  DEBITO: "Cartão de débito",
  PIX: "Pix",
};

export const roleLabels: Record<Role, string> = {
  ADMINISTRADOR: "Administrador",
  CONSUMIDOR: "Consumidor",
};

const monthNames = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function formatPeriod(period: string, groupBy: ReportGrouping) {
  const [year, month, day] = period.split("-");
  if (groupBy === "year") return year!;
  if (groupBy === "month") return `${monthNames[Number(month) - 1]}/${year}`;
  return `${day}/${month}/${year}`;
}

export function formatDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export function formatTime(value: string) {
  return new Date(value).toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });
}
