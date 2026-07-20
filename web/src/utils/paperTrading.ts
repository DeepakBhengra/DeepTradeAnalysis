import type {
  CandleOHLC,
  FillRecord,
  PendingOrder,
  PlaceOrderInput,
  PlaceOrderResult,
  PnLSummary,
  PortfolioState,
  Position,
} from "../types/paperTrading";
import { INITIAL_CASH } from "../types/paperTrading";

let orderIdCounter = 0;

export function createOrderId(): string {
  orderIdCounter += 1;
  return `order-${orderIdCounter}-${Date.now()}`;
}

export function createInitialPortfolio(): PortfolioState {
  return {
    cash: INITIAL_CASH,
    position: { quantity: 0, avgPrice: 0 },
    pendingOrders: [],
    fills: [],
  };
}

export function getPositionSide(quantity: number): "Long" | "Short" | "Flat" {
  if (quantity > 0) {
    return "Long";
  }
  if (quantity < 0) {
    return "Short";
  }
  return "Flat";
}

export function computePnL(
  portfolio: PortfolioState,
  currentPrice: number | null,
): PnLSummary {
  const { cash, position } = portfolio;
  const price = currentPrice ?? position.avgPrice;

  const unrealizedPnL =
    position.quantity !== 0 && currentPrice != null
      ? position.quantity * (currentPrice - position.avgPrice)
      : 0;

  const equity = cash + position.quantity * price;
  const totalPnL = equity - INITIAL_CASH;
  const realizedPnL = totalPnL - unrealizedPnL;
  const returnPct = INITIAL_CASH > 0 ? (totalPnL / INITIAL_CASH) * 100 : 0;

  return {
    cash,
    equity,
    unrealizedPnL,
    realizedPnL,
    totalPnL,
    returnPct,
  };
}

function applyFill(
  portfolio: PortfolioState,
  side: "BUY" | "SELL",
  quantity: number,
  price: number,
  orderType: "MARKET" | "LIMIT" | "SL",
  sessionIndex: number,
): PortfolioState {
  const fill: FillRecord = {
    id: createOrderId(),
    side,
    orderType,
    quantity,
    price,
    sessionIndex,
  };

  const signedQty = side === "BUY" ? quantity : -quantity;
  const newPosition = updatePosition(portfolio.position, signedQty, price);
  const cashDelta = -signedQty * price;

  return {
    cash: portfolio.cash + cashDelta,
    position: newPosition,
    pendingOrders: portfolio.pendingOrders,
    fills: [...portfolio.fills, fill],
  };
}

export function updatePosition(
  position: Position,
  signedQtyDelta: number,
  fillPrice: number,
): Position {
  const { quantity, avgPrice } = position;
  const newQty = quantity + signedQtyDelta;

  if (newQty === 0) {
    return { quantity: 0, avgPrice: 0 };
  }

  if (quantity === 0) {
    return { quantity: newQty, avgPrice: fillPrice };
  }

  if (Math.sign(quantity) === Math.sign(signedQtyDelta)) {
    const totalCost =
      Math.abs(quantity) * avgPrice + Math.abs(signedQtyDelta) * fillPrice;
    return {
      quantity: newQty,
      avgPrice: totalCost / Math.abs(newQty),
    };
  }

  if (Math.sign(quantity) === Math.sign(newQty)) {
    return { quantity: newQty, avgPrice };
  }

  return { quantity: newQty, avgPrice: fillPrice };
}

function shouldFillPendingOrder(
  order: PendingOrder,
  candle: CandleOHLC,
): boolean {
  if (order.orderType === "LIMIT") {
    if (order.side === "BUY") {
      return candle.low <= order.price;
    }
    return candle.high >= order.price;
  }

  if (order.orderType === "SL") {
    if (order.side === "BUY") {
      return candle.high >= order.price;
    }
    return candle.low <= order.price;
  }

  return false;
}

export function processPendingOrders(
  portfolio: PortfolioState,
  candle: CandleOHLC,
  sessionIndex: number,
): PortfolioState {
  let current = portfolio;
  const remaining: PendingOrder[] = [];

  for (const order of current.pendingOrders) {
    if (shouldFillPendingOrder(order, candle)) {
      if (order.side === "BUY" && current.cash < order.quantity * order.price) {
        remaining.push(order);
        continue;
      }

      current = applyFill(
        { ...current, pendingOrders: remaining },
        order.side,
        order.quantity,
        order.price,
        order.orderType,
        sessionIndex,
      );
    } else {
      remaining.push(order);
    }
  }

  return { ...current, pendingOrders: remaining };
}

export function computeRequiredCapital(
  input: PlaceOrderInput,
  currentPrice: number | null,
): number | null {
  if (input.side !== "BUY") {
    return null;
  }

  if (input.orderType === "MARKET") {
    return currentPrice != null ? input.quantity * currentPrice : null;
  }

  return input.price != null && input.price > 0
    ? input.quantity * input.price
    : null;
}

export function validateOrderCapital(
  input: PlaceOrderInput,
  currentPrice: number | null,
  availableCash: number,
): string | null {
  const required = computeRequiredCapital(input, currentPrice);
  if (required == null) {
    return null;
  }

  if (required > availableCash) {
    return `Insufficient funds. Required ${formatCurrency(required)}, available ${formatCurrency(availableCash)}.`;
  }

  return null;
}

export function placeOrder(
  portfolio: PortfolioState,
  input: PlaceOrderInput,
  currentPrice: number | null,
  sessionIndex: number,
): PlaceOrderResult {
  const { side, orderType, quantity, price } = input;

  if (quantity <= 0 || !Number.isInteger(quantity)) {
    return { success: false, error: "Quantity must be a positive integer.", portfolio };
  }

  if (currentPrice == null) {
    return {
      success: false,
      error: "Start simulation before placing orders.",
      portfolio,
    };
  }

  if (orderType === "MARKET") {
    const capitalError = validateOrderCapital(
      input,
      currentPrice,
      portfolio.cash,
    );
    if (capitalError) {
      return { success: false, error: capitalError, portfolio };
    }

    const updated = applyFill(
      portfolio,
      side,
      quantity,
      currentPrice,
      "MARKET",
      sessionIndex,
    );
    return { success: true, portfolio: updated };
  }

  if (price == null || price <= 0) {
    return {
      success: false,
      error: "Price is required for limit and stop-loss orders.",
      portfolio,
    };
  }

  const capitalError = validateOrderCapital(input, currentPrice, portfolio.cash);
  if (capitalError) {
    return { success: false, error: capitalError, portfolio };
  }

  const pendingOrder: PendingOrder = {
    id: createOrderId(),
    side,
    orderType,
    quantity,
    price,
    placedAtSessionIndex: sessionIndex,
  };

  return {
    success: true,
    portfolio: {
      ...portfolio,
      pendingOrders: [...portfolio.pendingOrders, pendingOrder],
    },
  };
}

export function cancelPendingOrder(
  portfolio: PortfolioState,
  orderId: string,
): PortfolioState {
  return {
    ...portfolio,
    pendingOrders: portfolio.pendingOrders.filter((order) => order.id !== orderId),
  };
}

export function describeOrderPlacement(
  input: PlaceOrderInput,
  referencePrice: number,
): string {
  if (input.orderType === "MARKET") {
    return `${input.side} ${input.quantity} filled at ${referencePrice.toFixed(2)} (Market)`;
  }

  const typeLabel = input.orderType === "LIMIT" ? "Limit" : "Stop loss";
  return `${typeLabel} ${input.side} ${input.quantity} placed at ${referencePrice.toFixed(2)} — pending`;
}

export function describeFill(fill: FillRecord): string {
  const typeLabel =
    fill.orderType === "SL"
      ? "Stop loss"
      : fill.orderType === "LIMIT"
        ? "Limit"
        : "Market";
  return `${fill.side} ${fill.quantity} filled at ${fill.price.toFixed(2)} (${typeLabel})`;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPnL(value: number): string {
  const prefix = value >= 0 ? "+" : "";
  return `${prefix}${formatCurrency(value)}`;
}
