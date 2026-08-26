/**
 * Escapes the five HTML-significant characters in untrusted user input
 * before it is interpolated into a mail's `.html()` body.
 *
 * registerSchema only bounds firstName/lastName by length (README's Auth
 * Model column widths), not by character set, so a value like
 * `<img src=x onerror=alert(1)>` passes validation and would otherwise
 * render live in whatever HTML-capable client opens the mail, Mailhog in
 * every environment this project runs in. The `.text()` body next to it
 * needs no escaping, plain text has no markup to inject into.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
