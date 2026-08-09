import DOMPurify from "isomorphic-dompurify";

// Sanitizes admin-authored rich text (event description, schedule table)
// before it's rendered with dangerouslySetInnerHTML on public pages —
// defense in depth in case an admin account is ever compromised, since this
// HTML is served to every visitor, not just other admins.
export function sanitizeRichText(html: string | null | undefined): string {
  if (!html) return "";
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "p", "br", "strong", "em", "u", "s", "a",
      "h1", "h2", "h3", "ul", "ol", "li",
      "table", "thead", "tbody", "tr", "th", "td",
    ],
    ALLOWED_ATTR: ["href", "rel", "target", "colspan", "rowspan", "style"],
  });
  // TipTap's empty-editor output is "<p></p>", not "" — treat that (and
  // anything else with no visible text or table cells) as no content, so
  // callers can hide the section instead of rendering an empty shell.
  const hasVisibleContent = /[^\s]/.test(clean.replace(/<[^>]*>/g, ""));
  return hasVisibleContent ? clean : "";
}
