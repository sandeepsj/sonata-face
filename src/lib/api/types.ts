// Types for the sonata-brain API (branch `self-service`).
//
// The contract is sonata-brain `docs/api/openapi.json`; ./schema.d.ts is generated from it
// (`npm run api:types`). The shapes below alias the generated schemas. The spec marks every field
// optional, so fields the backend always sends are made required here.
//
// Types further down marked "not on backend `self-service`" belong to screens hidden behind
// `features.legacyFeeModel` (see $lib/config/features.ts); they are kept for when those endpoints return.
//
// Dates: `LocalDate` fields are 'YYYY-MM-DD'; `LocalDateTime` fields are 'YYYY-MM-DDTHH:mm:ss'.
// Money arrives as JSON numbers.

import type { components } from './schema';

type Schemas = components['schemas'];
/** Make the listed keys required and non-null. */
type With<T, K extends keyof T> = Omit<T, K> & { [P in K]-?: NonNullable<T[P]> };
/** Replace the types of some keys (e.g. nested arrays whose items are made strict here). */
type Override<T, O> = Omit<T, keyof O> & O;

export type IsoDate = string;
export type IsoDateTime = string;

// ---------- errors ----------

export type FieldErrorBody = With<Schemas['FieldProblem'], 'field' | 'message'>;

/** Standard error body (REQ-005). Payment create/deactivate errors have no `details`. */
export type ApiErrorBody = Schemas['ApiError'];

// ---------- access ----------

/** The route catalogue (REQ-011), in catalogue order. */
export const ROUTE_PATHS = [
	'/api/students/**',
	'/api/student-sessions/**',
	'/api/courses/**',
	'/api/fee-structures/**',
	'/api/payments/**',
	'/api/discounts/**',
	'/api/dues/**',
	'/api/users/**',
	'/api/roles/**',
	'/api/logging/**'
] as const;
export type RoutePath = (typeof ROUTE_PATHS)[number];
export type AccessLevel = 'read' | 'write';

export type RouteAccess = With<Schemas['RouteAccess'], 'path' | 'read' | 'write'>;

export type TokenResponse = Override<
	With<Schemas['TokenResponse'], 'accessToken' | 'refreshToken'>,
	{ routes?: RouteAccess[] }
>;

export type RoleRef = With<Schemas['RoleRef'], 'id' | 'name'>;

export type Me = Override<With<Schemas['MeResponse'], 'id' | 'email'>, { roles: RoleRef[]; routes: RouteAccess[] }>;

export type UserAccount = Override<With<Schemas['UserResponse'], 'id' | 'email'>, { roles: RoleRef[] }>;

/** `routes` lists every catalogue path, with false flags where nothing is granted. */
export type Role = Override<
	With<Schemas['RoleResponse'], 'id' | 'name' | 'builtIn'>,
	{ description?: string | null; routes: RouteAccess[] }
>;

export type RoleRequest = Override<
	Schemas['RoleRequest'],
	{ name: string; description?: string | null; routes: RouteAccess[] }
>;

// ---------- students ----------

export type StudentStatus = NonNullable<Schemas['Student']['status']>;

// Optional fields may also come back as null.
export type Student = With<Schemas['Student'], 'admissionNo' | 'studentName'>;

/** Form values hold the pin code and status as typed text; they are sent as-is. */
export type StudentInput = Partial<Override<Student, { pinCode?: number | string; status?: string }>>;

export type PageResponse<T> = Omit<Schemas['PageStudent'], 'content'> & {
	content: T[];
	totalElements: number;
	totalPages: number;
	number: number;
	size: number;
};

/** Query of GET /api/students/search (values may be form text: they go into the query string as-is) */
export type StudentSearchParams = {
	[K in keyof NonNullable<import('./schema').operations['searchStudents']['parameters']['query']>]?:
		| NonNullable<import('./schema').operations['searchStudents']['parameters']['query']>[K]
		| string;
};

// ---------- courses ----------

/** Not on backend `self-service`: courses have no status there. */
export type CourseStatus = 'ACTIVE' | 'CLOSED';

export type Course = With<Schemas['Course'], 'name'> & {
	/** not on backend `self-service` */
	status?: CourseStatus;
	/** not on backend `self-service` */
	closedAt?: IsoDateTime | null;
};

// ---------- sessions ----------

export type StudentSession = Override<
	Schemas['StudentSession'],
	{
		id: number;
		student: Student;
		course: Course;
		dateOfJoining: IsoDateTime;
		dateOfDisjoining?: IsoDateTime | null;
	}
>;

export type SessionCreateRequest = Schemas['StudentSessionCreateRequest'] & {
	studentId: number;
	courseName: string;
};

/** Query of GET /api/student-sessions/all */
export type SessionQuery = NonNullable<
	import('./schema').operations['getAllSessions']['parameters']['query']
> & {
	/** sessions that overlap this date; not on backend `self-service` */
	activeOn?: IsoDate;
};

// ---------- fee structures & timeline (not on backend `self-service`) ----------

export const TERMS_PER_YEAR = [1, 2, 3, 4, 6, 12] as const;

export interface TermAmount {
	termNumber: number;
	amount: number;
}

export interface FeeStructure {
	id: number;
	name: string;
	courseName: string;
	termsPerYear: number;
	terms: TermAmount[];
	usedInTimeline: boolean;
}

export interface FeeStructureRequest {
	name: string;
	courseName: string;
	termsPerYear: number;
	terms: TermAmount[];
}

export interface TimelineEntry {
	id: number;
	courseName: string;
	feeStructureId: number;
	feeStructureName: string;
	effectiveFrom: IsoDate;
	effectiveTo: IsoDate | null;
}

export interface TimelineRequest {
	courseName: string;
	feeStructureId: number;
	effectiveFrom: IsoDate;
	effectiveTo: IsoDate | null;
}

export interface BillingPeriod {
	periodStart: IsoDate;
	periodEnd: IsoDate;
	termNumber: number;
	termsPerYear: number;
	amount: number;
	feeStructureId: number;
}

// ---------- payments (new shape; not on backend `self-service`) ----------

export type PaymentType = 'REGULAR' | 'ADDITIONAL';

export interface DiscountInput {
	discountAmount: number;
	label: string;
	remarks?: string;
}

export interface Discount {
	id: number;
	discountAmount: number;
	label: string;
	remarks: string | null;
}

export interface Payment {
	id: number;
	studentId: number;
	studentName: string;
	paymentType: PaymentType;
	courseName: string | null;
	periodDate: IsoDate | null;
	amountPaid: number;
	discountAmount: number;
	discounts: Discount[];
	label: string;
	remarks: string | null;
	date: IsoDateTime;
	isActive: boolean;
	originalType: PaymentType | null;
	convertedAt: IsoDateTime | null;
	convertedBy: string | null;
	createdAt: IsoDateTime | null;
}

export interface PaymentCreateRequest {
	studentId: number;
	paymentType: PaymentType;
	/** required for REGULAR, optional for ADDITIONAL */
	courseName?: string;
	/** REGULAR only: any date inside the term being paid */
	periodDate?: IsoDate;
	amountPaid: number;
	label: string;
	remarks?: string;
	date?: IsoDateTime;
	discounts?: DiscountInput[];
}

export interface PaymentQuery {
	studentId?: number;
	courseName?: string;
	type?: PaymentType;
	active?: boolean;
	/** payment date, inclusive */
	from?: IsoDate;
	to?: IsoDate;
	/** REGULAR payments for the billing period containing this date */
	periodDate?: IsoDate;
}

export interface ConvertRequest {
	courseName?: string;
	periodDate: IsoDate;
}

// ---------- dues (not on backend `self-service`) ----------

export const DUE_STATUSES = ['DUE', 'PARTIALLY_PAID', 'PAID', 'OVERPAID', 'WAIVED'] as const;
export type DueStatus = (typeof DUE_STATUSES)[number];

export interface Due {
	id: number;
	studentId: number;
	studentName: string;
	sessionId: number;
	courseName: string;
	periodStart: IsoDate;
	periodEnd: IsoDate;
	termNumber: number;
	termsPerYear: number;
	feeStructureId: number;
	amount: number;
	paidAmount: number;
	discountAmount: number;
	balance: number;
	overpaidAmount: number;
	status: DueStatus;
}

export interface DuesQuery {
	studentId?: number;
	courseName?: string;
	status?: DueStatus;
	/** by period start, inclusive */
	from?: IsoDate;
	to?: IsoDate;
}

export interface DuesSummary {
	amount: number;
	paid: number;
	discount: number;
	balance: number;
	overpaid: number;
	counts: Record<DueStatus, number>;
}

export type AggregateGroupBy = 'course' | 'month' | 'status';

export interface AggregateRow {
	key: string;
	count: number;
	amount: number;
	balance: number;
}

export interface Waiver {
	id: number;
	sessionId: number;
	periodStart: IsoDate;
	reason: string;
	createdBy: string;
	createdAt: IsoDateTime;
}

export interface WaiverRequest {
	sessionId: number;
	periodStart: IsoDate;
	reason: string;
}

export type RebuildScope = 'ALL' | 'COURSE' | 'STUDENT';
export type RebuildStatus = 'RUNNING' | 'DONE' | 'FAILED';

export interface RebuildChange {
	action: 'CREATE' | 'UPDATE' | 'DELETE' | string;
	studentId: number;
	sessionId: number;
	periodStart: IsoDate;
}

export interface RebuildJob {
	jobId: number;
	scope: RebuildScope;
	scopeId: string | null;
	status: RebuildStatus;
	dryRun: boolean;
	created: number;
	updated: number;
	deleted: number;
	errors: unknown[];
	changes: RebuildChange[];
	startedAt: IsoDateTime | null;
	finishedAt: IsoDateTime | null;
}

export interface RebuildSchedule {
	cron: string;
	nextRunAt: IsoDateTime;
}

export interface LegacyStudentComparison {
	studentId: number;
	legacyBilled: number;
	newBilled: number;
	legacyOutstanding: number;
	newOutstanding: number;
	match: boolean;
}

export interface LegacyComparison {
	students: LegacyStudentComparison[];
	totals: { legacyBilled: number; newBilled: number; legacyOutstanding: number; newOutstanding: number };
	mismatches: number;
}
