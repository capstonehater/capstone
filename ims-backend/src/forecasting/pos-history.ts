import { Prisma } from '@prisma/client';

export async function loadPosHistory(tx: Prisma.TransactionClient, startDate: string, capturedAt: Date) {
  // Forecast dates are Philippine calendar dates. Never train on the forecast period.
  const cutoff = new Date(`${startDate}T00:00:00+08:00`);
  const rows = await tx.$queryRaw<{ materialId: string; date: string; quantity: Prisma.Decimal }[]>`
    SELECT l.raw_material_id AS "materialId",
      to_char(o.completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD') AS date,
      SUM(-l.quantity_delta) AS quantity
    FROM inventory_transaction_lines l
    JOIN inventory_transactions t ON t.id = l.inventory_transaction_id
    JOIN order_items i ON i.id = l.order_item_id
    JOIN orders o ON o.id = i.order_id
    WHERE t.type = 'CHECKOUT' AND o.status = 'COMPLETED'
      AND l.quantity_delta < 0 AND o.completed_at < ${cutoff} AND o.completed_at <= ${capturedAt}
    GROUP BY l.raw_material_id, date ORDER BY date, l.raw_material_id
  `;
  // Retain dates of refunded/voided orders, so CSV data cannot restore their demand.
  const dates = await tx.$queryRaw<{ date: string }[]>`
    SELECT DISTINCT to_char(completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD') AS date
    FROM orders WHERE completed_at < ${cutoff} AND completed_at <= ${capturedAt}
    ORDER BY date
  `;
  return { posHistory: rows.map((row) => ({ ...row, quantity: Number(row.quantity) })), posDates: dates.map((row) => row.date), capturedAt: capturedAt.toISOString() };
}
