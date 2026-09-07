"use client";

type Props = {
  page: number;
  totalPages: number;
  totalItems: number;
  onPageChange: (page: number) => void;
};

export default function ProductPagination({
  page,
  totalPages,
  totalItems,
  onPageChange,
}: Props) {
  if (totalPages <= 1) {
    return (
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{totalItems} total products</span>
        <span>Page 1 of 1</span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Previous
      </button>
      <div className="text-center text-xs text-slate-500">
        <p>{totalItems} total products</p>
        <p>
          Page {page} of {totalPages}
        </p>
      </div>
      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Next
      </button>
    </div>
  );
}

