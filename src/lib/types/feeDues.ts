// Fee dues related types

export interface FeeDuesTrackerDTO {
	id: number;
	studentId: number;
	studentName: string;
	sessionId: number;
	courseName: string;
	feeStructureId: number;
	termYear: number;
	termNumber: number;
	dueAmount: number;
	status: DuesStatusType;
	remarks?: string | null;
	createdAt: string;
	updatedAt: string;
	[key: string]: any; // Allow additional fields
}


export const DuesStatus = {
	DUE: 'DUE',
	PAID: 'PAID',
	PARTIAL: 'PARTIAL',
	OVERDUE: 'OVERDUE'
} as const;

export type DuesStatusType = typeof DuesStatus[keyof typeof DuesStatus];

export const PaymentType = {
	TUITION: 'TUITION',
	ADDITIONAL: 'ADDITIONAL',
	OTHER: 'OTHER',
	FINE: 'FINE',
	TRANSPORT: 'TRANSPORT'
} as const;

export type PaymentTypeType = typeof PaymentType[keyof typeof PaymentType];

export interface PaymentDiscount {
	discountAmount: number;
	label: string;
	remarks?: string;
}

export interface PaymentCreateRequest {
	studentId: number;
	termId?: number | null;
	amountPaid: number;
	discounts?: PaymentDiscount[];
	courseName?: string;
	label?: string;
	remarks?: string;
	date?: string; // ISO datetime string
}

// Helper functions for discount calculations
export function calculateTotalDiscount(discounts?: PaymentDiscount[]): number {
	if (!discounts || discounts.length === 0) return 0;
	return discounts.reduce((sum, discount) => sum + discount.discountAmount, 0);
}

export function calculateNetAmount(amount: number, discounts?: PaymentDiscount[]): number {
	if (!amount) return 0;
	const totalDiscount = calculateTotalDiscount(discounts);
	const net = amount - totalDiscount;
	
	// Ensure net amount is not negative
	if (net < 0) return 0;
	
	// Round to 2 decimal places
	return Math.round(net * 100) / 100;
}

export function validateDiscounts(amount: number, discounts?: PaymentDiscount[]): { valid: boolean; error?: string } {
	if (!discounts || discounts.length === 0) {
		return { valid: true };
	}

	// Check each discount is positive
	for (const discount of discounts) {
		if (discount.discountAmount < 0) {
			return { valid: false, error: 'Discount amounts must be positive' };
		}
		if (!discount.label || discount.label.trim() === '') {
			return { valid: false, error: 'Each discount must have a label' };
		}
	}

	// Check total discount doesn't exceed amount
	const totalDiscount = calculateTotalDiscount(discounts);
	if (totalDiscount >= amount) {
		return { valid: false, error: 'Total discount cannot be greater than or equal to the payment amount' };
	}

	return { valid: true };
}

// API response types
export type FeeDuesResponse = FeeDuesTrackerDTO[];

// UI state types
export interface FeeDuesPageState {
	dues: FeeDuesTrackerDTO[];
	loading: boolean;
	error: string | null;
}