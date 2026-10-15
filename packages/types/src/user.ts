export type Role = "ADMINISTRADOR" | "CONSUMIDOR";

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  balance: number;
  active: boolean;
  createdAt: string;
}
