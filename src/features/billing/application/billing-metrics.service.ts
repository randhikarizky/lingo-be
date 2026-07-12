import { prisma } from "@/global/database/prisma";

export class BillingMetricsService {
  async getSummary() {
    const [paidTransactions, totalTransactions, activeSubscriptions] =
      await Promise.all([
        prisma.paymentTransaction.findMany({
          where: { status: "PAID" },
          select: { amount: true, userId: true },
        }),
        prisma.paymentTransaction.count(),
        prisma.userPlan.count({
          where: { status: "ACTIVE", plan: { not: "FREE" } },
        }),
      ]);

    const totalRevenue = paidTransactions.reduce(
      (sum, item) => sum + item.amount,
      0,
    );
    const payingUsers = new Set(paidTransactions.map((item) => item.userId)).size;
    const totalUsers = await prisma.user.count();

    return {
      totalRevenue,
      activeSubscriptions,
      conversionRate:
        totalUsers > 0 ? Math.round((payingUsers / totalUsers) * 100) : 0,
      averageRevenuePerUser:
        payingUsers > 0 ? Math.round(totalRevenue / payingUsers) : 0,
      paymentSuccessRate:
        totalTransactions > 0
          ? Math.round((paidTransactions.length / totalTransactions) * 100)
          : 0,
    };
  }
}

export const billingMetricsService = new BillingMetricsService();
