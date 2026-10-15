export interface Product {
  id: number;
  name: string;
  category: string;
  price: number;
  stock: number;
  photo: string | null;
  active: boolean;
}
