export interface PortfolioInput {
  symbol: string;
  name: string;
  exchange: string;
  quantity: number;
  avgPrice: number;
  purchaseDate: string | null;
  notes: string | null;
}

export interface PortfolioUpdate {
  quantity?: number;
  avgPrice?: number;
  purchaseDate?: string | null;
  notes?: string | null;
}

type ValidationResult<T> = { value: T } | { error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidSymbol(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[A-Za-z0-9.^&=_-]{1,50}$/.test(value.trim())
  );
}

function isPositiveFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isValidPurchaseDate(value: unknown): value is string | null {
  if (value === null) return true;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isOptionalText(
  value: unknown,
  maxLength: number,
): value is string | null | undefined {
  return (
    value === undefined ||
    value === null ||
    (typeof value === "string" && value.length <= maxLength)
  );
}

export function validatePortfolioInput(
  input: unknown,
): ValidationResult<PortfolioInput> {
  if (!isRecord(input)) return { error: "Request body must be an object" };
  if (!isValidSymbol(input.symbol)) {
    return { error: "symbol must be a valid stock symbol" };
  }
  if (!isPositiveFiniteNumber(input.quantity)) {
    return { error: "quantity must be a positive finite number" };
  }
  if (!isPositiveFiniteNumber(input.avgPrice)) {
    return { error: "avgPrice must be a positive finite number" };
  }
  if (!isOptionalText(input.name, 120)) {
    return { error: "name must be 120 characters or fewer" };
  }
  if (!isOptionalText(input.exchange, 30)) {
    return { error: "exchange must be 30 characters or fewer" };
  }
  if (!isValidPurchaseDate(input.purchaseDate ?? null)) {
    return { error: "purchaseDate must be a valid YYYY-MM-DD date or null" };
  }
  const purchaseDate = input.purchaseDate;
  if (!isOptionalText(input.notes, 2000)) {
    return { error: "notes must be 2000 characters or fewer" };
  }
  const notes = input.notes;

  const symbol = input.symbol.trim().toUpperCase();
  return {
    value: {
      symbol,
      name: typeof input.name === "string" ? input.name.trim() || symbol : symbol,
      exchange:
        typeof input.exchange === "string" ? input.exchange.trim() || "NSE" : "NSE",
      quantity: input.quantity,
      avgPrice: input.avgPrice,
      purchaseDate: typeof purchaseDate === "string" ? purchaseDate : null,
      notes: typeof notes === "string" ? notes : null,
    },
  };
}

export function validatePortfolioUpdate(
  input: unknown,
): ValidationResult<PortfolioUpdate> {
  if (!isRecord(input)) return { error: "Request body must be an object" };
  const allowedFields = new Set(["quantity", "avgPrice", "purchaseDate", "notes"]);
  const fields = Object.keys(input);
  if (fields.length === 0 || fields.some((field) => !allowedFields.has(field))) {
    return { error: "Provide only quantity, avgPrice, purchaseDate, or notes" };
  }

  const update: PortfolioUpdate = {};
  if ("quantity" in input) {
    if (!isPositiveFiniteNumber(input.quantity)) {
      return { error: "quantity must be a positive finite number" };
    }
    update.quantity = input.quantity;
  }
  if ("avgPrice" in input) {
    if (!isPositiveFiniteNumber(input.avgPrice)) {
      return { error: "avgPrice must be a positive finite number" };
    }
    update.avgPrice = input.avgPrice;
  }
  if ("purchaseDate" in input) {
    if (!isValidPurchaseDate(input.purchaseDate)) {
      return { error: "purchaseDate must be a valid YYYY-MM-DD date or null" };
    }
    update.purchaseDate = input.purchaseDate;
  }
  if ("notes" in input) {
    if (!isOptionalText(input.notes, 2000)) {
      return { error: "notes must be 2000 characters or fewer" };
    }
    update.notes = input.notes ?? null;
  }
  return { value: update };
}

export function parsePortfolioId(value: string): number | null {
  if (!/^[1-9]\d*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}
