import type { OrderSide, OrderType } from "../types/paperTrading";
import { formatCurrency } from "../utils/paperTrading";

export interface OrderConfirmationDetails {
  side: OrderSide;
  orderType: OrderType;
  quantity: number;
  price: number;
  requiredCapital: number | null;
  status: "Filled" | "Pending";
  message: string;
}

interface OrderConfirmationDialogProps {
  details: OrderConfirmationDetails | null;
  onClose: () => void;
}

function orderTypeLabel(orderType: OrderType): string {
  if (orderType === "LIMIT") {
    return "Limit";
  }
  if (orderType === "SL") {
    return "Stop loss";
  }
  return "Market";
}

export function OrderConfirmationDialog({
  details,
  onClose,
}: OrderConfirmationDialogProps) {
  if (!details) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-confirmation-title"
        className="w-full max-w-sm border border-kite-border bg-kite-surface p-4 shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <h3
          id="order-confirmation-title"
          className="m-0 text-sm font-semibold text-kite-text"
        >
          Order {details.status === "Filled" ? "filled" : "placed"}
        </h3>
        <p className="mt-1 mb-0 text-xs text-kite-green">{details.message}</p>

        <dl className="mt-4 space-y-2 text-xs">
          <div className="flex justify-between gap-3">
            <dt className="text-kite-muted">Side</dt>
            <dd className="m-0 font-medium text-kite-text">{details.side}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-kite-muted">Order type</dt>
            <dd className="m-0 font-medium text-kite-text">
              {orderTypeLabel(details.orderType)}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-kite-muted">Quantity</dt>
            <dd className="m-0 font-medium tabular-nums text-kite-text">
              {details.quantity}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-kite-muted">Price</dt>
            <dd className="m-0 font-medium tabular-nums text-kite-text">
              {details.price.toFixed(2)}
            </dd>
          </div>
          {details.requiredCapital != null && (
            <div className="flex justify-between gap-3">
              <dt className="text-kite-muted">Capital required</dt>
              <dd className="m-0 font-medium tabular-nums text-kite-text">
                {formatCurrency(details.requiredCapital)}
              </dd>
            </div>
          )}
          <div className="flex justify-between gap-3">
            <dt className="text-kite-muted">Status</dt>
            <dd className="m-0 font-medium text-kite-text">{details.status}</dd>
          </div>
        </dl>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full cursor-pointer rounded-sm border border-kite-orange bg-kite-orange px-3 py-2 text-xs font-medium text-white hover:opacity-90"
        >
          OK
        </button>
      </div>
    </div>
  );
}
