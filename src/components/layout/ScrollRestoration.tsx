"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

export function ScrollRestoration() {
  const pathname = usePathname();
  const isPop = useRef(false);

  useEffect(() => {
    const onPop = () => { isPop.current = true; };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    if (isPop.current) {
      isPop.current = false;
      return; // Back/forward — let the browser restore scroll naturally
    }
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}