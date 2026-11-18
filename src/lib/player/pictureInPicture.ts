export type WebKitVideo = HTMLVideoElement & {
  webkitSupportsPresentationMode?: (mode: "picture-in-picture") => boolean;
  webkitSetPresentationMode?: (mode: "picture-in-picture" | "inline") => void;
  webkitPresentationMode?: string;
};

export function isAppleMobile(navigator: Pick<Navigator, "userAgent" | "maxTouchPoints">): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
}

export function pictureInPictureMode(
  video: WebKitVideo | null,
  doc: Pick<Document, "pictureInPictureEnabled">,
  appleStandalone: boolean,
): "webkit" | "standard" | "safari" | null {
  if (video?.webkitSupportsPresentationMode && video.webkitSetPresentationMode) {
    if (video.webkitSupportsPresentationMode("picture-in-picture")) return "webkit";
    // WebKit can expose the standard API in home-screen apps even when the
    // video cannot enter PiP. Only interpret the native probe after metadata.
    if (appleStandalone) return video.readyState >= 1 && video.videoWidth > 0 ? "safari" : null;
  }
  return doc.pictureInPictureEnabled ? "standard" : null;
}
