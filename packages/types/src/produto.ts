export interface Produto {
  idProduto: number;
  nome: string;
  categoria: string;
  preco: number;
  estoque: number;
  codigoBarras: string;
  foto: string | null;
  ativo: boolean;
}
