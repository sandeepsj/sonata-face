import type { DiscountInput } from '$lib/api/types';

export function totalDiscount(discounts?: { discountAmount: number }[] | null): number {
	if (!discounts) return 0;
	return discounts.reduce((sum, d) => sum + (Number(d.discountAmount) || 0), 0);
}

/** Discount rows the user has started to fill in (both empty rows are ignored). */
export function filledDiscounts(discounts: DiscountInput[]): DiscountInput[] {
	return discounts.filter((d) => (Number(d.discountAmount) || 0) !== 0 || d.label.trim() !== '');
}

/** Client-side check mirroring the API: amount > 0 and a label for each discount. */
export function discountProblem(discounts: DiscountInput[]): string | null {
	for (const d of filledDiscounts(discounts)) {
		if (!(Number(d.discountAmount) > 0)) return 'Each discount needs an amount above 0';
		if (!d.label.trim()) return 'Each discount needs a label';
	}
	return null;
}
