export interface PurchaseItem {
  productId: number;
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface Purchase {
  id: number;
  userId: number;
  total: number;
  createdAt: string;
  items: PurchaseItem[];
}
