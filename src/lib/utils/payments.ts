import type { Due, Payment } from '$lib/api/types';
import { formatDate, formatDateTime, formatPeriod } from './format';

/** The due whose period contains the payment's periodDate (same course), if known. */
export function dueForPayment(p: Payment, dues: Due[]): Due | undefined {
	if (!p.periodDate) return undefined;
	return dues.find(
		(d) => d.courseName === p.courseName && d.periodStart <= p.periodDate! && p.periodDate! <= d.periodEnd
	);
}

/** 'Jan–Mar 2025' for a course-fee payment, '—' for an additional one. */
export function paymentPeriodLabel(p: Payment, dues: Due[] = []): string {
	if (!p.periodDate) return '—';
	const d = dueForPayment(p, dues);
	return d ? formatPeriod(d.periodStart, d.periodEnd) : `period of ${formatDate(p.periodDate)}`;
}

/** 'Converted from additional by x@y on 4 Oct 2026, 10:30', or '' */
export function conversionNote(p: Payment): string {
	if (!p.originalType || !p.convertedAt) return '';
	return `Converted from ${p.originalType === 'ADDITIONAL' ? 'additional' : p.originalType.toLowerCase()} payment by ${p.convertedBy ?? 'unknown'} on ${formatDateTime(p.convertedAt)}`;
}

/** Amount paid plus discounts: what the payment settles. */
export function amountCleared(p: Payment): number {
	return (p.amountPaid || 0) + (p.discountAmount || 0);
}
