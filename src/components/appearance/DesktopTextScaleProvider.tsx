"use client";

import { useEffect } from "react";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import { desktopTextScaleOrDefault } from "@/lib/accessibility/textScale";
import "./desktop-text-scale.css";

export function DesktopTextScaleProvider() {
  const user = useCurrentUser();
  const scale = desktopTextScaleOrDefault(user?.desktopTextScale);
  const userId = user?.id;
  const loaded = user !== undefined;
  useEffect(() => {
    if (!loaded) return;
    const root = document.documentElement;
    if (userId && scale !== 100) root.dataset.desktopTextScale = String(scale);
    else delete root.dataset.desktopTextScale;
    return () => { delete root.dataset.desktopTextScale; };
  }, [userId, loaded, scale]);
  return null;
}
