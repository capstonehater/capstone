export type InventoryItem = {
  id: number;
  name: string;
  categoryId?: number;
  category: string;
  type: "manufactured" | "retail";
  unit: string;
  expirationDate: string;
  sku: string;
  stock: number;
  unitPrice: number;
  totalValue: string;
  status: "In Stock" | "Low Stock" | "Out of Stock";
  lastRestocked: string;
  reorderPoint: number;
  supplierId?: number;
  supplier: string;
  isActive?: boolean;
};