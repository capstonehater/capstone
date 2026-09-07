"use client";

import { useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import type {
  ConfiguredPosCartItemInput,
  PosCartItem,
  PosCartModifierSelection,
  PosMenuModifier,
  PosMenuModifierGroup,
  PosMenuProduct,
} from "@/lib/pos";
import { decimalToNumber, formatPeso } from "@/lib/pos-utils";
import Modal from "./Modal";

type Props = {
  product: PosMenuProduct;
  onClose: () => void;
  onSubmit: (payload: ConfiguredPosCartItemInput) => void;
  submitLabel: string;
  initialItem?: PosCartItem | null;
};

function groupHint(group: PosMenuModifierGroup) {
  if (group.selectionMode === "SINGLE") {
    return group.isRequired
      ? "Choose one option"
      : "Choose one option or leave blank";
  }

  if (group.minSelect === 0 && group.maxSelect === 0) {
    return "Optional add-ons";
  }

  return `Select ${group.minSelect} to ${group.maxSelect} option${
    group.maxSelect === 1 ? "" : "s"
  }`;
}

function availabilityLabel(blockingReason?: string | null) {
  switch (blockingReason) {
    case "NO_RECIPE":
      return "No recipe";
    case "INSUFFICIENT_STOCK":
      return "Out of stock";
    case "NO_VALID_REQUIRED_MODIFIER":
      return "Required option unavailable";
    case "DISABLED_PRODUCT":
    case "DISABLED_VARIANT":
      return "Disabled";
    default:
      return "Unavailable";
  }
}

export default function ProductConfiguratorModal({
  product,
  onClose,
  onSubmit,
  submitLabel,
  initialItem,
}: Props) {
  const defaultVariant =
    product.variants.find((variant) => variant.id === initialItem?.productVariantId) ??
    product.variants.find((variant) => variant.availability?.isSellable) ??
    product.variants[0];

  const [selectedVariantId, setSelectedVariantId] = useState(defaultVariant?.id ?? "");
  const [modifierQuantities, setModifierQuantities] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      (initialItem?.modifierSelections ?? []).map((modifier) => [
        modifier.modifierId,
        modifier.quantity,
      ])
    )
  );
  const [note, setNote] = useState(initialItem?.note ?? "");
  const [error, setError] = useState<string | null>(null);

  const selectedVariant = useMemo(
    () => product.variants.find((variant) => variant.id === selectedVariantId) ?? null,
    [product.variants, selectedVariantId]
  );

  const selectedModifiers = useMemo<PosCartModifierSelection[]>(() => {
    return product.modifierGroups.flatMap((group) =>
      group.modifiers
        .filter((modifier) => (modifierQuantities[modifier.id] ?? 0) > 0)
        .map((modifier) => ({
          modifierGroupId: group.modifierGroupId,
          modifierGroupName: group.name,
          modifierId: modifier.id,
          name: modifier.name,
          quantity: modifierQuantities[modifier.id] ?? 0,
          unitPriceAdjustment: decimalToNumber(modifier.priceAdjustment),
        }))
    );
  }, [modifierQuantities, product.modifierGroups]);

  const unitModifierTotal = selectedModifiers.reduce(
    (sum, modifier) => sum + modifier.unitPriceAdjustment * modifier.quantity,
    0
  );
  const basePrice = decimalToNumber(selectedVariant?.price ?? 0);
  const liveUnitPrice = basePrice + unitModifierTotal;

  const getGroupSelectionCount = (group: PosMenuModifierGroup) =>
    group.modifiers.filter((modifier) => (modifierQuantities[modifier.id] ?? 0) > 0).length;

  const setGroupSingleSelection = (group: PosMenuModifierGroup, modifierId: string, quantity: number) => {
    setModifierQuantities((current) => {
      const next = { ...current };
      for (const modifier of group.modifiers) {
        next[modifier.id] = modifier.id === modifierId ? quantity : 0;
      }
      return next;
    });
  };

  const toggleModifier = (group: PosMenuModifierGroup, modifier: PosMenuModifier) => {
    if (!modifier.isAvailable) return;

    const currentQuantity = modifierQuantities[modifier.id] ?? 0;

    if (group.selectionMode === "SINGLE") {
      setGroupSingleSelection(group, modifier.id, currentQuantity > 0 ? 0 : 1);
      return;
    }

    const selectedCount = getGroupSelectionCount(group);
    if (currentQuantity > 0) {
      setModifierQuantities((current) => ({ ...current, [modifier.id]: 0 }));
      return;
    }

    if (group.maxSelect > 0 && selectedCount >= group.maxSelect) {
      return;
    }

    setModifierQuantities((current) => ({ ...current, [modifier.id]: 1 }));
  };

  const changeModifierQuantity = (
    group: PosMenuModifierGroup,
    modifier: PosMenuModifier,
    direction: "increase" | "decrease"
  ) => {
    if (!modifier.isAvailable) return;

    const currentQuantity = modifierQuantities[modifier.id] ?? 0;
    if (direction === "decrease") {
      const nextQuantity = Math.max(currentQuantity - 1, 0);
      if (group.selectionMode === "SINGLE" && nextQuantity > 0) {
        setGroupSingleSelection(group, modifier.id, nextQuantity);
        return;
      }
      setModifierQuantities((current) => ({ ...current, [modifier.id]: nextQuantity }));
      return;
    }

    if (group.selectionMode === "SINGLE") {
      setGroupSingleSelection(group, modifier.id, Math.max(currentQuantity, 0) + 1);
      return;
    }

    if (currentQuantity === 0) {
      const selectedCount = getGroupSelectionCount(group);
      if (group.maxSelect > 0 && selectedCount >= group.maxSelect) {
        return;
      }
    }

    setModifierQuantities((current) => ({
      ...current,
      [modifier.id]: Math.max(currentQuantity, 0) + 1,
    }));
  };

  const handleSubmit = () => {
    if (!selectedVariant) {
      setError("Choose a sellable variant before adding this item.");
      return;
    }

    if (!selectedVariant.isEnabled || selectedVariant.availability?.isSellable === false) {
      setError(
        `The selected variant is unavailable: ${availabilityLabel(
          selectedVariant.availability?.blockingReason
        )}.`
      );
      return;
    }

    for (const group of product.modifierGroups) {
      const count = getGroupSelectionCount(group);
      if (count < group.minSelect || (group.maxSelect > 0 && count > group.maxSelect)) {
        setError(`${group.name}: ${groupHint(group)}.`);
        return;
      }
    }

    setError(null);
    onSubmit({
      productId: product.id,
      productName: product.name,
      categoryName: product.category.name,
      productVariantId: selectedVariant.id,
      variantName: selectedVariant.name,
      sku: selectedVariant.sku,
      note,
      basePrice,
      modifierSelections: selectedModifiers,
    });
  };

  return (
    <Modal title={`Configure ${product.name}`} onClose={onClose} wide>
      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-4">
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Category: {product.category.name}</p>
            <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Live Unit Price
            </p>
            <p className="mt-1 text-3xl font-bold text-[#f45a1f]">
              {formatPeso(liveUnitPrice)}
            </p>
            <div className="mt-3 space-y-1 text-sm text-slate-600">
              <div className="flex justify-between">
                <span>Variant base price</span>
                <span>{formatPeso(basePrice)}</span>
              </div>
              <div className="flex justify-between">
                <span>Modifier total</span>
                <span>{formatPeso(unitModifierTotal)}</span>
              </div>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold">Variant</label>
            <div className="grid gap-2">
              {product.variants.map((variant) => {
                const disabled =
                  !variant.isEnabled || variant.availability?.isSellable === false;

                return (
                  <button
                    key={variant.id}
                    type="button"
                    onClick={() => {
                      if (!disabled) setSelectedVariantId(variant.id);
                    }}
                    disabled={disabled}
                    className={`rounded-2xl border px-4 py-3 text-left transition ${
                      selectedVariantId === variant.id
                        ? "border-[#f45a1f] bg-orange-50 text-slate-900"
                        : "border-slate-200 bg-white text-slate-700"
                    } ${disabled ? "cursor-not-allowed opacity-60" : "hover:border-[#f45a1f]/60"}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold">{variant.name}</div>
                        <div className="mt-1 text-xs text-slate-500">{variant.sku}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">{formatPeso(variant.price)}</div>
                        {disabled ? (
                          <div className="mt-1 text-xs text-rose-600">
                            {availabilityLabel(variant.availability?.blockingReason)}
                          </div>
                        ) : variant.availability?.availableBaseQty !== undefined ? (
                          <div className="mt-1 text-xs text-emerald-700">
                            {variant.availability.availableBaseQty} available
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold">Item Notes</label>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={4}
              placeholder="Example: less sugar, no straw"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#f45a1f]"
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Modifier Groups</h3>
              <p className="text-sm text-slate-500">
                Required groups and availability rules follow the backend menu.
              </p>
            </div>
            {error ? (
              <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">
                Fix selections
              </span>
            ) : null}
          </div>

          {product.modifierGroups.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
              This product has no modifier groups.
            </div>
          ) : (
            product.modifierGroups.map((group) => {
              const selectedCount = getGroupSelectionCount(group);

              return (
                <section key={group.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <h4 className="font-semibold text-slate-900">{group.name}</h4>
                      <p className="mt-1 text-xs text-slate-500">{groupHint(group)}</p>
                    </div>
                    <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                      {selectedCount} selected
                    </div>
                  </div>

                  <div className="space-y-2">
                    {group.modifiers.map((modifier) => {
                      const quantity = modifierQuantities[modifier.id] ?? 0;
                      const active = quantity > 0;

                      return (
                        <div
                          key={modifier.id}
                          className={`rounded-2xl border px-4 py-3 ${
                            active
                              ? "border-[#f45a1f] bg-orange-50"
                              : "border-slate-200 bg-white"
                          } ${!modifier.isAvailable ? "opacity-60" : ""}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <button
                              type="button"
                              disabled={!modifier.isAvailable}
                              onClick={() => toggleModifier(group, modifier)}
                              className="flex-1 text-left"
                            >
                              <div className="font-medium text-slate-900">{modifier.name}</div>
                              <div className="mt-1 text-xs text-slate-500">
                                {decimalToNumber(modifier.priceAdjustment) > 0
                                  ? `+${formatPeso(modifier.priceAdjustment)}`
                                  : "No extra charge"}
                              </div>
                              {!modifier.isAvailable ? (
                                <div className="mt-1 text-xs font-semibold text-rose-600">
                                  Currently unavailable
                                </div>
                              ) : null}
                            </button>

                            {group.allowQuantity ? (
                              <div className="inline-flex items-center rounded-2xl border border-slate-200 bg-white">
                                <button
                                  type="button"
                                  onClick={() =>
                                    changeModifierQuantity(group, modifier, "decrease")
                                  }
                                  className="px-3 py-2 text-slate-600 hover:bg-slate-50"
                                  disabled={!modifier.isAvailable}
                                >
                                  <Minus className="h-4 w-4" />
                                </button>
                                <span className="min-w-10 text-center text-sm font-semibold">
                                  {quantity}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    changeModifierQuantity(group, modifier, "increase")
                                  }
                                  className="px-3 py-2 text-slate-600 hover:bg-slate-50"
                                  disabled={!modifier.isAvailable}
                                >
                                  <Plus className="h-4 w-4" />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                disabled={!modifier.isAvailable}
                                onClick={() => toggleModifier(group, modifier)}
                                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                                  active
                                    ? "bg-[#f45a1f] text-white"
                                    : "border border-slate-200 text-slate-700"
                                }`}
                              >
                                {active ? "Selected" : "Select"}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })
          )}

          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <button
          onClick={onClose}
          type="button"
          className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium"
        >
          Cancel
        </button>

        <button
          onClick={handleSubmit}
          type="button"
          className="rounded-2xl bg-[#f45a1f] px-4 py-2 text-sm font-medium text-white hover:bg-[#d94f1a]"
        >
          {submitLabel} • {formatPeso(liveUnitPrice)}
        </button>
      </div>
    </Modal>
  );
}
