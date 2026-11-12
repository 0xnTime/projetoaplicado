export function formatDateTime(value: string | Date): string {
  return new Date(value).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function isValidCpf(value: string): boolean {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const digits = cpf.split("").map(Number);
  const checkDigit = (length: number) => {
    const sum = digits.slice(0, length).reduce((acc, digit, i) => acc + digit * (length + 1 - i), 0);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return checkDigit(9) === digits[9] && checkDigit(10) === digits[10];
}

export function formatCpf(value: string): string {
  const cpf = onlyDigits(value).slice(0, 11);
  return cpf
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
}

const MAX_CURRENCY_DIGITS = 8;

export function maskCurrency(value: string): string {
  const digits = value.replace(/\D/g, "").replace(/^0+/, "").slice(0, MAX_CURRENCY_DIGITS);
  if (!digits) return "";
  return (Number(digits) / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function parseCurrency(value: string): number {
  const digits = value.replace(/\D/g, "");
  return digits ? Number(digits) / 100 : 0;
}

export function toCurrencyInput(value: number): string {
  if (value === 0) return "0,00";
  return maskCurrency(Math.round(value * 100).toString());
}

export function maskInteger(value: string, maxDigits = 6): string {
  return value.replace(/\D/g, "").slice(0, maxDigits);
}
