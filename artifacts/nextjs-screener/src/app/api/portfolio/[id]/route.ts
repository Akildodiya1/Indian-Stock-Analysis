import { NextRequest, NextResponse } from "next/server";
import { db, isDatabaseConfigured } from "@workspace/db";
import { portfolioTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const { id } = await params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  await db.delete(portfolioTable).where(eq(portfolioTable.id, numId));
  return NextResponse.json({ success: true });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const { id } = await params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  const body = (await req.json()) as {
    quantity?: number;
    avgPrice?: number;
    purchaseDate?: string;
    notes?: string;
  };
  const [updated] = await db
    .update(portfolioTable)
    .set({ ...body })
    .where(eq(portfolioTable.id, numId))
    .returning();
  return NextResponse.json(updated);
}
