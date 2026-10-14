export interface ItemCompra {
  idProduto: number;
  nome: string;
  quantidade: number;
  valorUnitario: number;
}

export interface Compra {
  idCompra: number;
  idUsuario: number;
  valorTotal: number;
  dataHora: string;
  itens: ItemCompra[];
}
