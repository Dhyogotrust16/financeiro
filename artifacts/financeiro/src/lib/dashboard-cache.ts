import type { CashflowMonth, DashboardSummary } from "@workspace/api-client-react";

const SUMMARY_PREFIX = "financeiro-dashboard-summary";
const CASHFLOW_KEY = "financeiro-dashboard-cashflow";

function summaryKey(year: number, month: number) {
  return `${SUMMARY_PREFIX}-${year}-${month}`;
}

function readJson<T>(key: string): T | undefined {
  if (typeof window === "undefined") return undefined;

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function getCachedDashboardSummary(year: number, month: number) {
  return readJson<DashboardSummary>(summaryKey(year, month));
}

export function saveCachedDashboardSummary(year: number, month: number, summary: DashboardSummary) {
  writeJson(summaryKey(year, month), summary);
}

export function getCachedDashboardCashflow() {
  return readJson<CashflowMonth[]>(CASHFLOW_KEY);
}

export function saveCachedDashboardCashflow(cashflow: CashflowMonth[]) {
  writeJson(CASHFLOW_KEY, cashflow);
}

export function applyDashboardRevenueSnapshot(dateString: string, amount: number) {
  const [yearValue, monthValue] = dateString.split("-").map(Number);
  const now = new Date();
  const year = Number.isFinite(yearValue) ? yearValue : now.getFullYear();
  const month = Number.isFinite(monthValue) ? monthValue : now.getMonth() + 1;

  const currentSummary = getCachedDashboardSummary(year, month);
  if (currentSummary) {
    saveCachedDashboardSummary(year, month, {
      ...currentSummary,
      totalRevenue: Number(currentSummary.totalRevenue ?? 0) + amount,
      balance: Number(currentSummary.balance ?? 0) + amount,
    });
  }

  const currentCashflow = getCachedDashboardCashflow();
  if (currentCashflow) {
    saveCachedDashboardCashflow(
      currentCashflow.map((entry) =>
        Number(entry.year) === year && Number(entry.month) === month
          ? {
              ...entry,
              revenue: Number(entry.revenue ?? 0) + amount,
              balance: Number(entry.balance ?? 0) + amount,
            }
          : entry,
      ),
    );
  }
}
