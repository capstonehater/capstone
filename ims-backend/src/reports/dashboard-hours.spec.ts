import { Prisma } from '@prisma/client';
import { ReportsService } from './reports.service';

describe('Dashboard chart business hours', () => {
  const service = Object.create(ReportsService.prototype) as {
    buildDashboardTrend: (range: { from: Date; to: Date }, orders: Array<{ completedAt: Date; totalAmount: Prisma.Decimal }>) => {
      points: Array<{ bucketKey: string; netSales: Prisma.Decimal; transactionCount: number }>;
    };
  };
  const orders = ['12:59:59', '13:00:00', '22:59:59', '23:00:00'].map((time) => ({
    completedAt: new Date(`2026-09-23T${time}+08:00`), totalAmount: new Prisma.Decimal(100),
  }));
  it('keeps ten hourly buckets and excludes orders outside 1 PM–10 PM', () => {
    const result = service.buildDashboardTrend({ from: new Date('2026-09-23T00:00:00+08:00'), to: new Date('2026-09-23T23:59:59+08:00') }, orders);
    expect(result.points).toHaveLength(10);
    expect(result.points[0].bucketKey).toBe('hour:13');
    expect(result.points[9].bucketKey).toBe('hour:22');
    expect(result.points.reduce((sum, point) => sum + Number(point.netSales), 0)).toBe(200);
  });
  it('combines multiple dates into the same ten hourly buckets', () => {
    const result = service.buildDashboardTrend({ from: new Date('2026-09-23T00:00:00+08:00'), to: new Date('2026-09-24T23:59:59+08:00') }, [...orders,
      { completedAt: new Date('2026-09-24T13:30:00+08:00'), totalAmount: new Prisma.Decimal(50) },
      { completedAt: new Date('2026-09-25T13:30:00+08:00'), totalAmount: new Prisma.Decimal(500) },
    ]);
    expect(result.points).toHaveLength(10);
    expect(Number(result.points[0].netSales)).toBe(150);
    expect(result.points[0].transactionCount).toBe(2);
    expect(result.points.reduce((sum, point) => sum + Number(point.netSales), 0)).toBe(250);
  });
});
