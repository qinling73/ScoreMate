/**
 * Ultra-reliable multi-tiered clipboard copy utility
 * Designed to work seamlessly in restricted iframes, Safari/iOS, Android Webview, HTTPS and HTTP.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  // Tier 1: Modern navigator.clipboard API (Preferred if allowed and secure)
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn('[Clipboard] navigator.clipboard.writeText failed or blocked by iframe permissions, trying fallback...', err);
    }
  }

  // Tier 2: Hidden textarea with document.execCommand('copy')
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    // Set position and styling to ensure it's not visible and doesn't disrupt scroll
    textarea.style.position = 'fixed';
    textarea.style.top = '0';
    textarea.style.left = '0';
    textarea.style.width = '2em';
    textarea.style.height = '2em';
    textarea.style.padding = '0';
    textarea.style.border = 'none';
    textarea.style.outline = 'none';
    textarea.style.boxShadow = 'none';
    textarea.style.background = 'transparent';
    textarea.style.opacity = '0.01';
    textarea.style.zIndex = '-9999';
    textarea.setAttribute('readonly', '');

    document.body.appendChild(textarea);

    // Focus and select for iOS Safari and desktop browsers
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);

    const successful = document.execCommand('copy');
    document.body.removeChild(textarea);

    if (successful) {
      return true;
    }
  } catch (fallbackErr) {
    console.error('[Clipboard] execCommand fallback failed:', fallbackErr);
  }

  // Tier 3: Selection API on a temporary DOM element
  try {
    const span = document.createElement('span');
    span.textContent = text;
    span.style.whiteSpace = 'pre';
    span.style.position = 'fixed';
    span.style.top = '0';
    span.style.left = '0';
    span.style.opacity = '0.01';
    span.style.pointerEvents = 'none';
    document.body.appendChild(span);

    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(span);
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);
      const successful = document.execCommand('copy');
      selection.removeAllRanges();
      document.body.removeChild(span);
      if (successful) return true;
    } else {
      document.body.removeChild(span);
    }
  } catch (e) {
    console.error('[Clipboard] Selection fallback failed:', e);
  }

  return false;
}
