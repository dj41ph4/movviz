"use client";

import { useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

let appReduce = false;
if (typeof document !== "undefined") {
  appReduce = document.documentElement.classList.contains("reduce-motion");
}

let subscribers: Array<(v: boolean) => void> = [];

function notify() {
  appReduce = document.documentElement.classList.contains("reduce-motion");
  for (const fn of subscribers) fn(appReduce);
}

if (typeof MutationObserver !== "undefined") {
  const mo = new MutationObserver(notify);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
}

/** Réglage « Sans animation » seul : les vidéos d'arrière-plan en dépendent, pas
 *  la préférence système, qui ne demande pas de couper une vidéo. */
export function useNoAnimations() {
  const [app, setApp] = useState(() => appReduce);

  useEffect(() => {
    subscribers.push(setApp);
    return () => { subscribers = subscribers.filter((f) => f !== setApp); };
  }, []);

  return app;
}

export function useShouldReduceMotion() {
  const osPrefers = useReducedMotion();
  const app = useNoAnimations();

  return osPrefers || app;
}
