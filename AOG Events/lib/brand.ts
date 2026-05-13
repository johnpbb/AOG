export const brand = {
  orange: "var(--brand-orange)",
  yellow: "var(--brand-yellow)",
  black: "var(--brand-black)",
  white: "var(--brand-white)",
  faithBlue: "var(--brand-faith-blue)",
  teal: "var(--brand-teal)",
  jordanBlue: "var(--brand-jordan-blue)",
};

// Colours are hardcoded hex in this SVG data URI — CSS variables don't resolve
// inside data URIs. Update these manually if --brand-orange or --brand-yellow change.
export const tapaPattern = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Crect width='40' height='40' fill='%23FF6C00'/%3E%3Crect x='15' y='0' width='10' height='10' fill='%23000' opacity='0.55'/%3E%3Crect x='0' y='15' width='10' height='10' fill='%23000' opacity='0.55'/%3E%3Crect x='30' y='15' width='10' height='10' fill='%23000' opacity='0.55'/%3E%3Crect x='15' y='30' width='10' height='10' fill='%23000' opacity='0.55'/%3E%3Crect x='15' y='15' width='10' height='10' fill='%23000' opacity='0.3'/%3E%3Cpolygon points='0,0 8,0 0,8' fill='%23000' opacity='0.4'/%3E%3Cpolygon points='40,0 32,0 40,8' fill='%23000' opacity='0.4'/%3E%3Cpolygon points='0,40 8,40 0,32' fill='%23000' opacity='0.4'/%3E%3Cpolygon points='40,40 32,40 40,32' fill='%23000' opacity='0.4'/%3E%3C/svg%3E")`;
