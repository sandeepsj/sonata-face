import type { Payment } from '$lib/api/types';
import { formatDateTime } from './format';

/** 'Converted from additional payment #12 by x@y on 4 Oct 2026, 10:30', or '' */
export function conversionNote(p: Payment): string {
	if (!p.originalType || !p.convertedAt) return '';
	const what = p.originalType === 'ADDITIONAL' ? 'additional' : p.originalType.toLowerCase();
	const from = p.convertedFrom ? `part of ${what} payment #${p.convertedFrom}` : `${what} payment`;
	return `Converted from ${from} by ${p.convertedBy ?? 'unknown'} on ${formatDateTime(p.convertedAt)}`;
}

/** Amount paid plus discounts: what the payment settles. */
export function amountCleared(p: Payment): number {
	return (p.amountPaid || 0) + (p.discountAmount || 0);
}
