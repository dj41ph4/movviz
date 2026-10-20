"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import { DESIGN_MODE, type DesignMode } from "@/lib/appearance/designMode";
import "./premium.css";
import "./salle-obscure.css";
import "./design-beta.css";
import "./design-classic.css";

type DesignContextValue = { mode: DesignMode };
const DesignContext = createContext<DesignContextValue | null>(null);

export function useDesignMode() {
  const context = useContext(DesignContext);
  if (!context) throw new Error("useDesignMode requires AppearanceProvider");
  return context;
}

/** Beta is the only design: no per-user choice, no switch after first paint. */
export function AppearanceProvider({ children }: { children: ReactNode; initialDesignMode?: DesignMode }) {
  const mode = DESIGN_MODE;

  useEffect(() => {
    document.documentElement.dataset.movvizDesign = mode;
  }, [mode]);

  return <DesignContext.Provider value={{ mode }}>{children}</DesignContext.Provider>;
}
