// Payment related types

export interface PaymentStudent {
	id: number;
	name: string;
}

export interface PaymentFeeStructure {
	id: number;
	termName: string;
}

export interface PaymentDiscount {
	id: number;
	discountAmount: number;
	label: string;
	remarks?: string | null;
}

export const PaymentTypeEnum = {
	REGULAR: 'REGULAR',
	ADDITIONAL: 'ADDITIONAL',
	OTHER: 'OTHER'
} as const;

export type PaymentTypeType = typeof PaymentTypeEnum[keyof typeof PaymentTypeEnum];

export interface Payment {
	id: number;
	student: PaymentStudent;
	date: string; // ISO datetime
	remarks?: string | null;
	label?: string | null;
	discountAmount: number;
	amountPaid: number;
	feeStructure?: PaymentFeeStructure | null;
	paymentType: PaymentTypeType;
	courseName?: string | null;
	discounts: PaymentDiscount[];
	isActive: boolean;
	createdAt: string;
	updatedAt: string;
}

export type PaymentHistoryResponse = Payment[];

// Helper functions
export function calculateTotalDiscount(payment: Payment): number {
	if (!payment.discounts || payment.discounts.length === 0) {
		return payment.discountAmount || 0;
	}
	return payment.discounts.reduce((sum, discount) => sum + discount.discountAmount, 0);
}

export function calculateAmountCleared(payment: Payment): number {
	// Amount cleared = Amount paid + Total discount
	return payment.amountPaid + calculateTotalDiscount(payment);
}

export function formatPaymentType(type: PaymentTypeType): string {
	switch (type) {
		case 'REGULAR':
			return 'Term Payment';
		case 'ADDITIONAL':
			return 'Additional Payment';
		case 'OTHER':
			return 'Other Payment';
		default:
			return type;
	}
}
