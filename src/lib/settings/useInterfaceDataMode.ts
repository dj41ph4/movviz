"use client";

export function useInterfaceDataMode() {
  return {
    mode: "optimized" as const,
    optimized: true,
    ready: true,
    isLoading: false,
    error: undefined,
  };
}
