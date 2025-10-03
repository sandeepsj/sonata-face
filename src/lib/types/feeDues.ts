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

export interface PaymentCreateRequest {
	studentId: number;
	termId?: number | null;
	amount: number;
	paymentType: PaymentTypeType;
	reference?: string;
	paidAt?: string; // ISO datetime string
	recurring?: boolean;
	description?: string;
}

// API response types
export type FeeDuesResponse = FeeDuesTrackerDTO[];

// UI state types
export interface FeeDuesPageState {
	dues: FeeDuesTrackerDTO[];
	loading: boolean;
	error: string | null;
}