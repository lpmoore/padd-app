import { useEffect, useState } from 'react';

import {
  SIGNED_URL_REFRESH_MARGIN_MS,
  SIGNED_URL_TTL_SECONDS,
  getImageUrl,
  peekImageUrl,
  toStoragePath,
} from '../lib/storage';

// Re-sign just before a cached link would be treated as expired
const REFRESH_AFTER_MS = SIGNED_URL_TTL_SECONDS * 1000 - SIGNED_URL_REFRESH_MARGIN_MS + 5000;

/**
 * The link to display for a stored image value (a bucket path, an older public
 * URL, or an external link). Returns null while a bucket image is being signed
 * or if it can't be. Links already signed are returned immediately, with no
 * loading flash, and are refreshed before they expire.
 */
export const useImageUrl = (value) => {
  const [resolved, setResolved] = useState({ value, url: peekImageUrl(value) });
  const [refreshCount, setRefreshCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getImageUrl(value).then((url) => {
      if (!cancelled) setResolved({ value, url });
    });
    return () => {
      cancelled = true;
    };
  }, [value, refreshCount]);

  useEffect(() => {
    if (toStoragePath(value) === null) return undefined; // external links don't expire
    const timer = setTimeout(() => setRefreshCount((n) => n + 1), REFRESH_AFTER_MS);
    return () => clearTimeout(timer);
  }, [value, refreshCount]);

  // If `value` just changed, don't show the previous image's link
  return resolved.value === value ? resolved.url : peekImageUrl(value);
};
