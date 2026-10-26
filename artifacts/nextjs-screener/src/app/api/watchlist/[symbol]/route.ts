import { NextRequest, NextResponse } from "next/server";
import { db, isDatabaseConfigured } from "@workspace/db";
import { watchlistTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  try {
    const { symbol } = await params;
    if (!symbol) return NextResponse.json({ error: "symbol required" }, { status: 400 });
    await db.delete(watchlistTable).where(eq(watchlistTable.symbol, symbol));
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("watchlist DELETE error", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
