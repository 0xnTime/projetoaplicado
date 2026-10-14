export type FormaPagamento = "CREDITO" | "DEBITO" | "PIX";

export interface Recarga {
  idRecarga: number;
  idUsuario: number;
  valor: number;
  formaPagamento: FormaPagamento;
  dataHora: string;
}
