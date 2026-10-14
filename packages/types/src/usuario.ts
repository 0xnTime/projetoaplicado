export type Perfil = "ADMINISTRADOR" | "CONSUMIDOR";

export interface Usuario {
  idUsuario: number;
  nome: string;
  email: string;
  perfil: Perfil;
  saldo: number;
  ativo: boolean;
  dataCadastro: string;
}
