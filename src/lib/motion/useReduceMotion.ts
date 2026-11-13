"use client";

import { useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { KEEP_VIDEOS_CLASS } from "@/lib/gpu/reduceMotionInit";

/** Vidéos d'ambiance coupées : animations coupées ET pas de niveau intermédiaire. */
const readVideosOff = () => {
  const classes = document.documentElement.classList;
  return classes.contains("reduce-motion") && !classes.contains(KEEP_VIDEOS_CLASS);
};

let appReduce = false;
let appVideosOff = false;
if (typeof document !== "undefined") {
  appReduce = document.documentElement.classList.contains("reduce-motion");
  appVideosOff = readVideosOff();
}

let subscribers: Array<(v: boolean) => void> = [];
let videoSubscribers: Array<(v: boolean) => void> = [];

function notify() {
  appReduce = document.documentElement.classList.contains("reduce-motion");
  appVideosOff = readVideosOff();
  for (const fn of subscribers) fn(appReduce);
  for (const fn of videoSubscribers) fn(appVideosOff);
}

if (typeof MutationObserver !== "undefined") {
  const mo = new MutationObserver(notify);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
}

/** Vidéos d'ambiance coupées (bande-annonce du Hero et de la fiche, aperçu au
 *  survol des cartes) : vrai au niveau « Fluide » seulement. Le niveau
 *  intermédiaire coupe les animations mais garde ces vidéos ; la préférence
 *  système, elle, ne demande pas de couper une vidéo. */
export function useNoAnimations() {
  const [off, setOff] = useState(() => appVideosOff);

  useEffect(() => {
    videoSubscribers.push(setOff);
    return () => { videoSubscribers = videoSubscribers.filter((f) => f !== setOff); };
  }, []);

  return off;
}

/** Animations coupées par le réglage de l'appareil (niveaux intermédiaire et fluide). */
function useAppReducedMotion() {
  const [app, setApp] = useState(() => appReduce);

  useEffect(() => {
    subscribers.push(setApp);
    return () => { subscribers = subscribers.filter((f) => f !== setApp); };
  }, []);

  return app;
}

export function useShouldReduceMotion() {
  const osPrefers = useReducedMotion();
  const app = useAppReducedMotion();

  return osPrefers || app;
}

/** Rotation automatique du Hero : c'est du contenu qui change, pas une animation
 *  de décor. Elle tourne aux niveaux Complet et Équilibré, et s'arrête au niveau
 *  Fluide ou si le système demande de réduire les mouvements. */
export function useAutoRotationOff() {
  const osPrefers = useReducedMotion();
  const videosOff = useNoAnimations();

  return !!osPrefers || videosOff;
}
