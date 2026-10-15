export type ReportGrouping = "day" | "month" | "year";

export interface SalesPeriod {
  period: string;
  revenue: number;
  salesCount: number;
}

export interface SalesReport {
  revenue: number;
  salesCount: number;
  periods: SalesPeriod[];
}

export interface ProductSales {
  productId: number;
  name: string;
  category: string;
  quantity: number;
  revenue: number;
}

export interface ConsumptionReport {
  user: { id: number; name: string; email: string };
  total: number;
  purchaseCount: number;
  products: ProductSales[];
}
