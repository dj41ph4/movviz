"use client";

import { useCdnImages } from "./useCdnImages";
import { useLocalNetworkPriority } from "./useLocalNetworkPriority";
import { useIsLocalNetwork } from "@/lib/network/useIsLocalNetwork";

/** Single source of truth for "should this image try TMDb's CDN first" —
 *  combines both Experience toggles with the live network context so
 *  TmdbImage/AdaptiveTitleLogo/TrailerHeader never each reimplement this
 *  condition. See docs on useCdnImages/useLocalNetworkPriority/
 *  isLocalRequest for what each piece means. */
export function useShouldUseCdn(): boolean {
  const { enabled: cdnEnabled } = useCdnImages();
  const { enabled: localPriorityEnabled } = useLocalNetworkPriority();
  const isLocal = useIsLocalNetwork(cdnEnabled && localPriorityEnabled);
  if (!cdnEnabled) return false;
  if (localPriorityEnabled && isLocal) return false;
  return true;
}
