// Feature flags.
//
// legacyFeeModel: screens built for the fee-timeline / period-based dues model, whose endpoints are not on
// backend branch `self-service` (fee timeline, fee structures list/clone/edit/delete, course close/reopen,
// dues list/summary/aggregate, waivers, dues rebuild & legacy comparison, filtered payment list, payment
// create with periodDate, payment convert-to-course-fee, disjoin at a past date, roster as of a date).
// While false they are hidden from navigation and their routes show a "not available" panel. The code is kept
// as-is until the backend decides whether those features come back.
export const features = {
	legacyFeeModel: false
} as const;
