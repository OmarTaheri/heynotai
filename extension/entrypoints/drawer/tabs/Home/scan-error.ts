/** Map a backend/content-script error code to human-readable copy
 *  shown in the drawer's idle "scan failed" card.
 *
 *  Codes come from two sources:
 *  - Backend (server/scans.go): "youtube_too_long:<seconds>",
 *    "youtube_download_failed", "detection_failed", "auth_required",
 *    "rate_limited", "tokens_exhausted".
 *  - Content script: "cancelled" when the user disables the platform
 *    while a scan is in flight.
 *
 *  Anything we don't recognize falls back to the raw code so the user
 *  has *something* actionable to forward to support. */
export function describeScanError(code: string): {
  title: string;
  body: string;
} {
  if (code.startsWith('youtube_too_long')) {
    const sec = code.split(':')[1];
    const minutes = sec ? Math.round(parseInt(sec, 10) / 60) : null;
    return {
      title: 'Video is too long',
      body: minutes
        ? `This video runs about ${minutes} min. heynotai's video checker is capped at shorter clips for now — try a shorter excerpt.`
        : "This video is longer than heynotai's per-scan limit.",
    };
  }
  if (code === 'youtube_download_failed') {
    return {
      title: "Couldn't fetch the video",
      body: "YouTube refused the download — the video may be private, age-gated, region-locked, or just temporarily unavailable.",
    };
  }
  if (code === 'detection_failed') {
    return {
      title: 'Detection model failed',
      body: 'The detector couldn\'t produce a verdict. Retry, or try a different model under the Models tab.',
    };
  }
  if (code === 'auth_required') {
    return {
      title: 'Sign in required',
      body: 'Sign in from the Account tab to run scans.',
    };
  }
  if (code === 'rate_limited') {
    return {
      title: 'Too many scans',
      body: 'You\'re scanning faster than the backend allows. Wait a minute and try again.',
    };
  }
  if (code === 'tokens_exhausted') {
    return {
      title: 'Out of tokens',
      body: 'Your monthly token budget is used up. Upgrade your plan or wait for the next reset.',
    };
  }
  if (code === 'cancelled') {
    return {
      title: 'Scan cancelled',
      body: 'You disabled this platform while the scan was running.',
    };
  }
  if (code === 'content_script_missing') {
    return {
      title: 'Reload the page to scan',
      body: "heynotai's helper isn't running on this tab — that usually happens when the extension reloaded after the page was already open. Refresh the tab and try again.",
    };
  }
  if (code === 'container_not_found') {
    return {
      title: "Couldn't anchor the overlay",
      body: 'The page didn\'t expose a video player heynotai recognises. Refresh the tab and try again, or open the video on a fresh tab.',
    };
  }
  return {
    title: 'Scan failed',
    body: code,
  };
}
