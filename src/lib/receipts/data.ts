// The variables a receipt template can use (sonata-brain docs/requirements/90-receipts.md). The frontend owns this
// list: Handlebars fills `{{…}}` from this object, and template scripts read the same object as `window.receipt`.
// Amounts are formatted for India without ₹ (1,23,450); dates look like "18 Oct 2026".

import type { Payment } from '$lib/api/types';

export interface ReceiptDiscount {
	label: string;
	amount: string;
}

export interface ReceiptPayment {
	date: string;
	courseName: string;
	label: string;
	/** Before discount */
	fee: string;
	/** '' when there is none */
	discount: string;
	amountPaid: string;
	hasDiscounts: boolean;
	discounts: ReceiptDiscount[];
}

export interface ReceiptData {
	receipt: { id: string; printedDate: string };
	student: { name: string; admissionNo: string };
	payments: ReceiptPayment[];
	totals: { fee: string; discount: string; paid: string };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const amount = (n: number) => (Number.isFinite(n) ? n : 0).toLocaleString('en-IN');

/** 'YYYY-MM-DD' (or a full ISO timestamp, or a Date) → "18 Oct 2026", without timezone shifts for plain dates */
export function receiptDate(d: string | Date): string {
	const m = typeof d === 'string' ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(d) : null;
	const date = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(d);
	if (isNaN(date.getTime())) return typeof d === 'string' ? d : '';
	// Fixed month names: en-IN would write "Sept"
	return `${String(date.getDate()).padStart(2, '0')} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

type ReceiptStudent = { studentName?: string | null; admissionNo?: number | string | null };

/** The variables for a receipt of `payments` (any order; shown oldest first) */
export function buildReceiptData(student: ReceiptStudent, payments: Payment[], printedOn: Date = new Date()): ReceiptData {
	const sorted = [...payments].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
	let fee = 0;
	let discount = 0;
	let paid = 0;
	const rows = sorted.map((p): ReceiptPayment => {
		const discounts = p.discounts ?? [];
		const d = p.discountAmount ?? discounts.reduce((s, x) => s + (x.discountAmount || 0), 0);
		fee += p.amountPaid + d;
		discount += d;
		paid += p.amountPaid;
		return {
			date: receiptDate(p.date),
			courseName: p.courseName || 'Fee Payment',
			label: p.label || '',
			fee: amount(p.amountPaid + d),
			discount: d ? amount(d) : '',
			amountPaid: amount(p.amountPaid),
			hasDiscounts: discounts.length > 0,
			discounts: discounts.map((x) => ({ label: x.label, amount: amount(x.discountAmount) }))
		};
	});
	return {
		receipt: { id: `R-${sorted.map((p) => p.id).sort((a, b) => a - b).join('-')}`, printedDate: receiptDate(printedOn) },
		student: { name: student.studentName ?? '', admissionNo: student.admissionNo != null ? String(student.admissionNo) : '' },
		payments: rows,
		totals: { fee: amount(fee), discount: amount(discount), paid: amount(paid) }
	};
}

/** Sample receipt for the template editor's preview */
export const SAMPLE_RECEIPT: ReceiptData = {
	receipt: { id: 'R-101-102', printedDate: receiptDate(new Date()) },
	student: { name: 'Anjali Krishnan', admissionNo: '1024' },
	payments: [
		{
			date: '05 Jun 2026',
			courseName: 'Veena',
			label: 'Jun–Aug 2026',
			fee: '3,000',
			discount: '',
			amountPaid: '3,000',
			hasDiscounts: false,
			discounts: []
		},
		{
			date: '04 Sep 2026',
			courseName: 'Vocal',
			label: 'Sep–Nov 2026',
			fee: '2,500',
			discount: '700',
			amountPaid: '1,800',
			hasDiscounts: true,
			discounts: [
				{ label: 'Sibling', amount: '500' },
				{ label: 'Early payment', amount: '200' }
			]
		}
	],
	totals: { fee: '5,500', discount: '700', paid: '4,800' }
};

export interface ReceiptVariable {
	/** What is inserted at the cursor */
	insert: string;
	/** Shown on the chip */
	label: string;
	meaning: string;
}

const v = (expr: string, meaning: string): ReceiptVariable => ({ insert: `{{${expr}}}`, label: expr, meaning });

export const RECEIPT_VARIABLES: { group: string; items: ReceiptVariable[] }[] = [
	{
		group: 'Receipt',
		items: [
			v('receipt.id', 'Receipt number'),
			v('receipt.printedDate', 'Date the receipt is printed'),
			v('student.name', 'Student name'),
			v('student.admissionNo', 'Admission number'),
			v('totals.fee', 'Sum of fees before discount'),
			v('totals.discount', 'Sum of discounts'),
			v('totals.paid', 'Sum of cash paid')
		]
	},
	{
		group: 'Payments (inside each payments)',
		items: [
			{
				insert: '{{#each payments}}\n  {{date}} {{courseName}} {{label}} {{amountPaid}}\n{{/each}}',
				label: '#each payments',
				meaning: 'Repeat for every payment, oldest first'
			},
			v('date', 'Payment date'),
			v('courseName', 'Course ("Fee Payment" when none)'),
			v('label', 'Payment label'),
			v('fee', 'Fee before discount'),
			v('discount', 'Discount (empty when none)'),
			v('amountPaid', 'Cash paid'),
			{
				insert: '{{#if hasDiscounts}}\n  {{#each discounts}}{{label}} ({{amount}}){{#unless @last}}, {{/unless}}{{/each}}\n{{/if}}',
				label: '#each discounts',
				meaning: 'The discounts of a payment, each with label and amount'
			}
		]
	}
];
