const g = globalThis as typeof globalThis & { __movvizFactoryResetActive?: boolean };

export function factoryResetActive(): boolean {
  return g.__movvizFactoryResetActive === true;
}

export function beginFactoryReset(): boolean {
  if (factoryResetActive()) return false;
  g.__movvizFactoryResetActive = true;
  return true;
}

export function endFactoryReset(): void {
  g.__movvizFactoryResetActive = false;
}
