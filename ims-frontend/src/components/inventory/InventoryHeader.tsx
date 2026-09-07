import {
  LayoutGrid,
  List,
  Plus,
  Download,
  Boxes,
  TriangleAlert,
  PackageX,
  Warehouse,
  Search,
} from "lucide-react";

type Props = {
  view: "grid" | "list";
  setView: (view: "grid" | "list") => void;
  onAddItem: () => void;
  summary: {
    totalProducts: number;
    inStock: number;
    lowStock: number;
    outOfStock: number;
  };
  search: string;
  setSearch: (v: string) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  categoryFilter: string;
  setCategoryFilter: (v: string) => void;
  sortBy: string;
  setSortBy: (v: string) => void;
};

export default function InventoryHeader({
  view,
  setView,
  onAddItem,
  summary,
  search,
  setSearch,
  statusFilter,
  setStatusFilter,
  categoryFilter,
  setCategoryFilter,
  sortBy,
  setSortBy,
}: Props) {
  return (
    <div className="mb-6 space-y-5">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold">INVENTORY</h1>
          <p className="text-sm text-neutral-600">
            Manage and track all your products
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 shadow-sm"
          >
            <Download size={16} />
            Export
          </button>

          <button
            type="button"
            onClick={onAddItem}
            className="flex items-center gap-2 rounded-xl bg-[#f45a1f] px-4 py-2 text-white"
          >
            <Plus size={16} />
            Add Item
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm text-neutral-500">Total Products</p>
            <Boxes size={18} />
          </div>
          <p className="text-3xl font-bold">{summary.totalProducts}</p>
        </div>

        <div className="rounded-2xl bg-[#a8d4f5] p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm text-neutral-700">In Stock</p>
            <Warehouse size={18} />
          </div>
          <p className="text-3xl font-bold">{summary.inStock}</p>
        </div>

        <div className="rounded-2xl bg-[#efe47a] p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm text-neutral-700">Low Stock</p>
            <TriangleAlert size={18} />
          </div>
          <p className="text-3xl font-bold">{summary.lowStock}</p>
        </div>

        <div className="rounded-2xl bg-[#f5d4d4] p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm text-neutral-700">Out of Stock</p>
            <PackageX size={18} />
          </div>
          <p className="text-3xl font-bold">{summary.outOfStock}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-white p-3 shadow-sm">
        <div className="relative min-w-[220px] flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or category..."
            className="w-full rounded-lg border px-3 py-2 pl-9 text-sm"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm"
        >
          <option value="All">All Status</option>
          <option value="In Stock">In Stock</option>
          <option value="Low Stock">Low Stock</option>
          <option value="Out of Stock">Out of Stock</option>
        </select>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm"
        >
          <option value="All">All Categories</option>
          <option value="Food">Food</option>
          <option value="Beverage">Beverage</option>
        </select>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm"
        >
          <option value="name-asc">Name (A-Z)</option>
          <option value="stock-asc">Stock (low to high)</option>
          <option value="stock-desc">Stock (high to low)</option>
          <option value="price-asc">Price (low to high)</option>
          <option value="price-desc">Price (high to low)</option>
        </select>

        <div className="ml-auto flex gap-1">
          <button
            type="button"
            onClick={() => setView("grid")}
            className={`rounded-lg p-2 ${
              view === "grid" ? "bg-[#f45a1f] text-white" : "bg-gray-100"
            }`}
          >
            <LayoutGrid size={18} />
          </button>

          <button
            type="button"
            onClick={() => setView("list")}
            className={`rounded-lg p-2 ${
              view === "list" ? "bg-[#f45a1f] text-white" : "bg-gray-100"
            }`}
          >
            <List size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}