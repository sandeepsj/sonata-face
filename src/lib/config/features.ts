// Feature flags.
//
// missingEndpoints: screens whose endpoints are not on backend `main`. While false they are hidden from
// navigation (direct URLs show a "not available" panel) and the code is kept as-is until the backend decides
// whether those features come back:
//   course close/reopen and course status, course roster as of a date, ending a session on a past date,
//   the global Dues page (aggregates, per-course summary), the global Payments page (filtered list),
//   waivers (replaced by ₹0 payments with a discount), dues-rebuild COURSE scope / dry run / schedule /
//   legacy comparison.
export const features = {
	missingEndpoints: false
} as const;
