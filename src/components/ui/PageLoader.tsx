"use client";

import { createContext, useContext, useRef, useState, useCallback, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

interface PageLoaderCtx {
  start: () => void;
  done: () => void;
}

const Ctx = createContext<PageLoaderCtx>({ start: () => {}, done: () => {} });

export function PageLoaderProvider({ children }: { children: React.ReactNode }) {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const t1Ref = useRef<ReturnType<typeof setTimeout> | null>(null);
  const t2Ref = useRef<ReturnType<typeof setTimeout> | null>(null);
  const decRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const show = useCallback(() => {
    setVisible(true);
    setProgress(10);
    if (t1Ref.current != null) clearTimeout(t1Ref.current);
    if (t2Ref.current != null) clearTimeout(t2Ref.current);
    t1Ref.current = setTimeout(() => setProgress(30), 150);
    t2Ref.current = setTimeout(() => setProgress(60), 400);
  }, []);

  const hide = useCallback(() => {
    setProgress(100);
    if (decRef.current != null) clearTimeout(decRef.current);
    decRef.current = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 300);
  }, []);

  useEffect(() => {
    show();
    const t = setTimeout(hide, 1200);
    return () => clearTimeout(t);
  }, [pathname, searchParams, show, hide]);

  useEffect(() => {
    return () => {
      if (t1Ref.current != null) clearTimeout(t1Ref.current);
      if (t2Ref.current != null) clearTimeout(t2Ref.current);
      if (decRef.current != null) clearTimeout(decRef.current);
    };
  }, []);

  return (
    <Ctx.Provider value={{ start: show, done: hide }}>
      {children}
      {visible && (
        <div className="pointer-events-none fixed inset-x-0 top-0 z-[9999] h-0.5">
          <div
            className="h-full bg-brand-glow shadow-[0_0_8px_rgba(168,130,255,0.4)] transition-all duration-300 ease-out"
            style={{ width: `${progress}%`, transitionTimingFunction: progress === 100 ? "cubic-bezier(0,0,0.2,1)" : "cubic-bezier(0.2,0,0,1)" }}
          />
        </div>
      )}
    </Ctx.Provider>
  );
}

export function usePageLoader() {
  return useContext(Ctx);
}
