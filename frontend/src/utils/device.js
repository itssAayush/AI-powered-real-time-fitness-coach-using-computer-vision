/**
 * Best-effort mobile / touch-phone detection for camera UX.
 * Order: User-Agent Client Hints → UA string → coarse pointer + viewport.
 */

export function isMobileDevice() {
  if (typeof navigator === "undefined") return false;

  const uaData = navigator.userAgentData;
  if (uaData && typeof uaData.mobile === "boolean") {
    return uaData.mobile;
  }

  const ua = navigator.userAgent || "";
  if (/Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
    return true;
  }
  // iPadOS 13+ often reports as Macintosh with touch
  if (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1) {
    return true;
  }

  if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const narrow = window.matchMedia("(max-width: 768px)").matches;
    if (coarse && narrow) return true;
  }

  return false;
}
