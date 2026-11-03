const CONNECTION_ERROR_CODES = new Set([
  "3D000",
  "28P01",
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "ENOTFOUND",
]);

function getDatabaseErrorCode(error: unknown): string | undefined {
  let current = error;
  for (let depth = 0; depth < 4; depth += 1) {
    if (typeof current !== "object" || current === null) return undefined;
    if ("code" in current && typeof current.code === "string") {
      return current.code;
    }
    current = "cause" in current ? current.cause : undefined;
  }
  return undefined;
}

export function getWatchlistDatabaseError(error: unknown): {
  error: string;
  status: number;
} {
  const code = getDatabaseErrorCode(error);
  if (code === "42P01") {
    return {
      error: "Watchlist table is missing. Run `pnpm --filter @workspace/db push`.",
      status: 503,
    };
  }
  if (code && CONNECTION_ERROR_CODES.has(code)) {
    return {
      error: "Unable to connect to the configured PostgreSQL database. Check DATABASE_URL and start the database on its configured host and port.",
      status: 503,
    };
  }
  return { error: "Internal server error", status: 500 };
}
