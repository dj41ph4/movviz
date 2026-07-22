"use client";

import { createContext, useContext } from "react";

const VersionContext = createContext<string>("0.0.0");

export function VersionProvider({ version, children }: { version: string; children: React.ReactNode }) {
  return <VersionContext.Provider value={version}>{children}</VersionContext.Provider>;
}

export function useVersion() {
  return useContext(VersionContext);
}
