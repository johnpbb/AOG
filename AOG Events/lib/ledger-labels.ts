const CATEGORY_LABELS: Record<string, string> = {
  "very-large-church": "VL Church",
  "large-church": "L Church",
  "medium-church": "M Church",
  "small-church": "Small Church",
  individual: "Individual",
  overseas: "Overseas",
  "gala-seat": "Gala",
  "gala-table": "Gala",
};

export function ledgerCategoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}

// Church name for church registrations; registrant's name for Individual /
// Overseas / Gala (whose formData carries firstName/lastName).
export function ledgerDisplayName(
  churchName: string | null | undefined,
  formData: unknown,
  email: string
): string {
  if (churchName) return churchName;
  const d = (formData ?? {}) as Record<string, string>;
  return (
    d.churchName ||
    `${d.firstName ?? ""} ${d.lastName ?? ""}`.trim() ||
    d.registrarName ||
    email
  );
}
