// Feature flags.
//
// missingEndpoints: screens whose endpoints are not on backend `main`. While false they are hidden from
// navigation (direct URLs show a "not available" panel) and the code is kept as-is:
//   the global Dues overview (aggregate reports, per-course summary), waivers (replaced by ₹0 payments with a
//   discount), dues-rebuild schedule and legacy comparison.
export const features = {
	missingEndpoints: false
} as const;
