import { useMemo, useState, type FormEvent } from "react";

import type { OrderSide, OrderType } from "../types/paperTrading";
import {
  computeRequiredCapital,
  describeOrderPlacement,
  formatCurrency,
  validateOrderCapital,
} from "../utils/paperTrading";
import {
  OrderConfirmationDialog,
  type OrderConfirmationDetails,
} from "./OrderConfirmationDialog";

const DEFAULT_QUANTITY = "1";

interface OrderEntryFormProps {
  currentPrice: number | null;
  availableCash: number;
  canTrade: boolean;
  lastError: string | null;
  onPlaceOrder: (input: {
    side: OrderSide;
    orderType: OrderType;
    quantity: number;
    price?: number;
  }) => boolean;
}

export function OrderEntryForm({
  currentPrice,
  availableCash,
  canTrade,
  lastError,
  onPlaceOrder,
}: OrderEntryFormProps) {
  const [side, setSide] = useState<OrderSide>("BUY");
  const [orderType, setOrderType] = useState<OrderType>("MARKET");
  const [quantity, setQuantity] = useState(DEFAULT_QUANTITY);
  const [price, setPrice] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<OrderConfirmationDetails | null>(
    null,
  );

  const showPrice = orderType === "LIMIT" || orderType === "SL";
  const priceLabel = orderType === "LIMIT" ? "Limit price" : "Stop price";

  const parsedQty = Number.parseInt(quantity, 10);
  const parsedPrice = Number.parseFloat(price);
  const hasValidQty = Number.isInteger(parsedQty) && parsedQty > 0;
  const hasValidPrice =
    !showPrice || (Number.isFinite(parsedPrice) && parsedPrice > 0);

  const draftOrder = useMemo(() => {
    if (!hasValidQty) {
      return null;
    }

    return {
      side,
      orderType,
      quantity: parsedQty,
      price: showPrice && hasValidPrice ? parsedPrice : undefined,
    };
  }, [hasValidPrice, hasValidQty, orderType, parsedPrice, parsedQty, showPrice, side]);

  const requiredCapital =
    draftOrder != null
      ? computeRequiredCapital(draftOrder, currentPrice)
      : null;

  const capitalExceeded =
    requiredCapital != null && requiredCapital > availableCash;

  const resetFields = () => {
    setQuantity(DEFAULT_QUANTITY);
    setPrice("");
    setLocalError(null);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setLocalError(null);

    if (!hasValidQty) {
      setLocalError("Quantity must be a positive integer.");
      return;
    }

    if (showPrice && !hasValidPrice) {
      setLocalError(`${priceLabel} must be greater than zero.`);
      return;
    }

    if (!canTrade) {
      setLocalError("Start simulation before placing orders.");
      return;
    }

    const orderInput = {
      side,
      orderType,
      quantity: parsedQty,
      price: showPrice ? parsedPrice : undefined,
    };

    const capitalError = validateOrderCapital(
      orderInput,
      currentPrice,
      availableCash,
    );
    if (capitalError) {
      setLocalError(capitalError);
      return;
    }

    const referencePrice =
      orderType === "MARKET" ? currentPrice! : parsedPrice;

    const success = onPlaceOrder(orderInput);
    if (!success) {
      return;
    }

    setConfirmation({
      side,
      orderType,
      quantity: parsedQty,
      price: referencePrice,
      requiredCapital,
      status: orderType === "MARKET" ? "Filled" : "Pending",
      message: describeOrderPlacement(orderInput, referencePrice),
    });
    resetFields();
  };

  const errorMessage = localError ?? lastError;

  return (
    <>
      <section className="border border-kite-border bg-kite-surface p-3">
        <h2 className="m-0 text-xs font-semibold uppercase tracking-wide text-kite-muted">
          Place Order
        </h2>

        <form className="mt-3 space-y-3" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1 block text-xs text-kite-muted">Side</label>
            <div className="flex gap-2">
              {(["BUY", "SELL"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setSide(option)}
                  className={`cursor-pointer rounded-sm border px-3 py-1.5 text-xs font-medium ${
                    side === option
                      ? option === "BUY"
                        ? "border-kite-green bg-kite-green/10 text-kite-green"
                        : "border-kite-red bg-kite-red/10 text-kite-red"
                      : "border-kite-border bg-kite-bg text-kite-text hover:bg-kite-surface"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="order-type" className="mb-1 block text-xs text-kite-muted">
              Order type
            </label>
            <select
              id="order-type"
              value={orderType}
              onChange={(event) => setOrderType(event.target.value as OrderType)}
              className="w-full border border-kite-border bg-kite-bg px-2 py-1.5 text-sm text-kite-text outline-none focus:border-kite-orange"
            >
              <option value="MARKET">Market</option>
              <option value="LIMIT">Limit</option>
              <option value="SL">Stop loss</option>
            </select>
          </div>

          <div>
            <label htmlFor="order-qty" className="mb-1 block text-xs text-kite-muted">
              Quantity
            </label>
            <input
              id="order-qty"
              type="number"
              min={1}
              step={1}
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              className="w-full border border-kite-border bg-kite-bg px-2 py-1.5 text-sm tabular-nums text-kite-text outline-none focus:border-kite-orange"
            />
          </div>

          {showPrice && (
            <div>
              <label htmlFor="order-price" className="mb-1 block text-xs text-kite-muted">
                {priceLabel}
              </label>
              <input
                id="order-price"
                type="number"
                min={0}
                step={0.05}
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                className="w-full border border-kite-border bg-kite-bg px-2 py-1.5 text-sm tabular-nums text-kite-text outline-none focus:border-kite-orange"
              />
            </div>
          )}

          <div>
            <span className="mb-1 block text-xs text-kite-muted">Current price</span>
            <span className="text-sm font-medium tabular-nums text-kite-text">
              {currentPrice != null ? currentPrice.toFixed(2) : "—"}
            </span>
          </div>

          <div className="space-y-2 rounded-sm border border-kite-border bg-kite-bg px-2 py-2">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="text-kite-muted">Available cash</span>
              <span className="font-medium tabular-nums text-kite-text">
                {formatCurrency(availableCash)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="text-kite-muted">Capital required</span>
              <span
                className={`font-medium tabular-nums ${
                  capitalExceeded
                    ? "text-kite-red"
                    : requiredCapital != null
                      ? "text-kite-text"
                      : "text-kite-muted"
                }`}
              >
                {side === "SELL"
                  ? "Not required"
                  : requiredCapital != null
                    ? formatCurrency(requiredCapital)
                    : "—"}
              </span>
            </div>
          </div>

          {errorMessage && (
            <p className="m-0 text-xs text-kite-red">{errorMessage}</p>
          )}

          <button
            type="submit"
            disabled={!canTrade || capitalExceeded}
            className="w-full cursor-pointer rounded-sm border border-kite-orange bg-kite-orange px-3 py-2 text-xs font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Place order
          </button>
        </form>
      </section>

      <OrderConfirmationDialog
        details={confirmation}
        onClose={() => setConfirmation(null)}
      />
    </>
  );
}
