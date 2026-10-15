export type PaymentMethod = "CREDITO" | "DEBITO" | "PIX";

export interface Topup {
  id: number;
  userId: number;
  amount: number;
  paymentMethod: PaymentMethod;
  createdAt: string;
}
