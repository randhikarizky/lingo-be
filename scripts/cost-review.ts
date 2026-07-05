import "dotenv/config";

import { costAnalyticsService } from "../src/features/admin/application/cost-analytics.service";

function formatUsd(value: number) {
  return `$${value.toFixed(4)}`;
}

async function main() {
  const days = Number(process.argv[2] ?? 30);
  const report = await costAnalyticsService.getCostReview(days);

  console.log("\n=== Lingora Cost Review ===");
  console.log(`Generated: ${report.generatedAt}`);
  console.log(`Period: last ${report.periodDays} days`);
  console.log(`Total users: ${report.totalUsers}`);
  console.log(`Active users (with usage): ${report.activeUsersWithUsage}`);
  console.log("");

  console.log("Usage totals (all time):");
  console.log(`  AI chat:     ${report.usageTotals.aiRequests}`);
  console.log(`  STT:         ${report.usageTotals.sttRequests}`);
  console.log(`  TTS:         ${report.usageTotals.ttsRequests}`);
  console.log(`  Speaking min ${report.usageTotals.speakingMinutes}`);
  console.log("");

  console.log("Estimated provider cost (USD):");
  console.log(`  Chat:     ${formatUsd(report.costBreakdown.chatUsd)}`);
  console.log(`  STT:      ${formatUsd(report.costBreakdown.sttUsd)}`);
  console.log(`  TTS:      ${formatUsd(report.costBreakdown.ttsUsd)}`);
  console.log(`  Speaking: ${formatUsd(report.costBreakdown.speakingUsd)}`);
  console.log(`  TOTAL:    ${formatUsd(report.costBreakdown.totalUsd)}`);
  console.log("");

  console.log("Cost by plan:");
  for (const plan of report.costByPlan) {
    console.log(
      `  ${plan.label.padEnd(10)} users=${String(plan.users).padStart(3)} cost=${formatUsd(plan.costUsd)} avg/user=${formatUsd(plan.avgCostPerUserUsd)}`,
    );
  }
  console.log("");

  console.log("Insights:");
  console.log(
    `  Free plan cost:      ${formatUsd(report.insights.freePlanCostUsd)}`,
  );
  console.log(
    `  Paid plan cost:      ${formatUsd(report.insights.paidPlanCostUsd)}`,
  );
  console.log(
    `  Avg / active user:   ${formatUsd(report.insights.avgCostPerActiveUserUsd)}`,
  );
  console.log(
    `  Projected monthly:   ${formatUsd(report.insights.projectedMonthlyCostUsd)}`,
  );
  console.log(`  Dominant driver:     ${report.insights.dominantCostDriver}`);
  console.log("");

  console.log("Top spenders:");
  for (const user of report.topSpenders) {
    console.log(
      `  ${user.email.padEnd(28)} [${user.plan}] ${formatUsd(user.estimatedCostUsd)}`,
    );
  }

  if (report.dailyTrend.length > 0) {
    console.log("\nDaily trend (last entries):");
    for (const day of report.dailyTrend.slice(-7)) {
      console.log(`  ${day.date}  ${formatUsd(day.costUsd)}`);
    }
  }

  console.log("\nRates (override via env):");
  console.log(
    `  CHAT=${report.costRates.rates.chat} STT=${report.costRates.rates.stt} TTS=${report.costRates.rates.tts} SPEAKING=${report.costRates.rates.speakingMinute}`,
  );
  console.log("");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
