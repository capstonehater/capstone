"use client";

type Props = {
  message: string;
  onRetry?: () => void;
};

export default function ProductDetailError({ message, onRetry }: Props) {
  return (
    <div className="rounded-[28px] border border-rose-200 bg-rose-50 p-6 text-rose-800 shadow-sm">
      <h2 className="text-lg font-semibold text-rose-900">Unable to load this product</h2>
      <p className="mt-2 text-sm">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-full border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-800"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}

