import type { DashboardLayout } from "@/lib/dashboard/types";

/** Never adopt a layout cached for a previous authenticated profile. */
export function isPremiumAppearance(userId: string | null, response: { userId?: string; layout?: Pick<DashboardLayout, "mode"> } | undefined): boolean {
  return !!userId && response?.userId === userId && response.layout?.mode === "beta";
}
