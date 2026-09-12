export type InterfaceDataMode = "optimized";

export function getInterfaceDataMode(): InterfaceDataMode {
  // Legacy compatibility preferences are deliberately ignored: optimized is
  // now the sole interface loading behavior for every installation.
  return "optimized";
}

export function isOptimizedInterfaceDataEnabled(): boolean {
  return true;
}
