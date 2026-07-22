"use client";

import { useEffect } from "react";

/** Registers the PWA shell service worker so Movviz is installable on desktop and mobile. */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
