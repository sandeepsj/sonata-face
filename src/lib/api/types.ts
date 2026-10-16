// Types for the sonata-brain API (branch `main`).
//
// The contract is sonata-brain `docs/api/openapi.json`; ./schema.d.ts is generated from it
// (`npm run api:types`). The shapes below alias the generated schemas. The spec marks every field
// optional, so fields the backend always sends are made required here.
//
// Types marked "not on backend" belong to screens hidden behind `features.missingEndpoints`
// (see $lib/config/features.ts); they are kept for when those endpoints come back.
//
// Dates: `LocalDate` fields are 'YYYY-MM-DD'; `LocalDateTime` fields are 'YYYY-MM-DDTHH:mm:ss'.
// Money arrives as JSON numbers.

import type { components, paths } from './schema';

type Schemas = components['schemas'];
type Paths = paths;
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
	'/api/fee-timeline/**',
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
	[K in keyof NonNullable<Paths['/api/students/search']['get']['parameters']['query']>]?:
		| NonNullable<Paths['/api/students/search']['get']['parameters']['query']>[K]
		| string;
};

// ---------- courses ----------

export type CourseStatus = 'ACTIVE' | 'CLOSED';

/** A closed course takes no new sessions, course fees or conversions (409). */
export type Course = Override<With<Schemas['Course'], 'name'>, { status: CourseStatus; closedAt?: IsoDateTime | null }>;

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

/** Query of GET /api/student-sessions (`activeOn`: sessions that overlap that date) */
export type SessionQuery = NonNullable<Paths['/api/student-sessions']['get']['parameters']['query']>;

// ---------- fee structures & timeline (school-wide) ----------

export type FeeAmount = With<Schemas['FeeAmount'], 'courseName' | 'amount'>;

/** One structure covers every course; a course left out isn't billed while it applies. */
export type FeeStructure = Override<
	With<Schemas['StructureResponse'], 'id' | 'name' | 'termMonths' | 'usedInTimeline'>,
	{ amounts: FeeAmount[] }
>;

export type FeeStructureRequest = Override<
	Schemas['StructureRequest'],
	{ name: string; termMonths: number; amounts: FeeAmount[] }
>;

/** Runs from `effectiveFrom` until the next entry starts (`effectiveTo` is null for the last one). */
export type TimelineEntry = Override<
	With<Schemas['EntryResponse'], 'id' | 'feeStructureId' | 'feeStructureName' | 'termMonths' | 'effectiveFrom'>,
	{ effectiveTo?: IsoDate | null }
>;

export type TimelineRequest = With<Schemas['EntryRequest'], 'feeStructureId' | 'effectiveFrom'>;

/** What a fee change does to everyone's dues (also returned by a `?dryRun=true` request, which saves nothing). */
export type Impact = With<
	Schemas['Impact'],
	'students' | 'inserted' | 'updated' | 'deleted' | 'outstandingBefore' | 'outstandingAfter' | 'outstandingChange'
>;

/** Timeline add/change/delete response */
export type TimelineChange = Override<TimelineEntry, { dryRun?: boolean; recalculation?: Impact | null }>;

/** Structure update response; `recalculation` is null when the structure isn't on the timeline */
export type FeeStructureChange = Override<FeeStructure, { dryRun?: boolean; recalculation?: Impact | null }>;

/** One term the timeline produces (GET /api/fee-timeline/preview) */
export type PreviewTerm = Override<
	With<Schemas['PreviewTerm'], 'periodStart' | 'periodEnd' | 'feeStructureId' | 'feeStructureName'>,
	{ amounts: FeeAmount[] }
>;

// ---------- payments ----------

export type PaymentType = NonNullable<Schemas['Payment']['paymentType']>;

export type DiscountInput = With<Schemas['DiscountCreateRequest'], 'discountAmount' | 'label'>;

export type Discount = With<Schemas['Discount'], 'id' | 'discountAmount' | 'label'>;

export type Payment = Override<
	With<Schemas['Payment'], 'id' | 'paymentType' | 'amountPaid' | 'date' | 'isActive'>,
	{ student: Student; discounts: Discount[]; discountAmount: number; label: string }
>;

/** `regularPayment` and `validZeroPayment` in the spec are internal helpers: never sent. */
export type PaymentCreateRequest = Override<
	Omit<Schemas['PaymentCreateRequest'], 'regularPayment' | 'validZeroPayment'>,
	{ discounts?: DiscountInput[] }
>;

export interface ConvertRequest {
	/** Needed when the payment has no course */
	courseName?: string;
}

/** Query of GET /api/payments */
export type PaymentQuery = NonNullable<Paths['/api/payments']['get']['parameters']['query']>;

// ---------- dues (calculated, never edited) ----------

export const DUE_STATUSES = ['DUE', 'PARTIALLY_PAID', 'PAID'] as const;
export type DueStatus = (typeof DUE_STATUSES)[number];

export type Due = With<
	Schemas['DueResponse'],
	| 'id'
	| 'studentId'
	| 'courseName'
	| 'periodStart'
	| 'periodEnd'
	| 'amount'
	| 'paidAmount'
	| 'discountAmount'
	| 'balance'
	| 'status'
>;

/** Query of GET /api/dues */
export type DuesQuery = NonNullable<Paths['/api/dues']['get']['parameters']['query']>;

export type CourseDuesSummary = With<
	Schemas['CourseSummary'],
	'courseName' | 'amount' | 'paid' | 'discount' | 'balance' | 'credit'
>;

/** `credit` is money paid beyond what is due; it pays new terms as they start. */
export type DuesSummary = Override<
	With<Schemas['Summary'], 'amount' | 'paid' | 'discount' | 'balance' | 'credit'>,
	{ courses: CourseDuesSummary[] }
>;

export type RebuildScope = 'ALL' | 'STUDENT';
export type RebuildStatus = 'RUNNING' | 'DONE' | 'FAILED';

export type RebuildJob = Override<
	With<Schemas['Job'], 'jobId'>,
	{
		status: RebuildStatus;
		scope?: string;
		students?: number;
		changes?: { inserted?: number; updated?: number; deleted?: number };
		errors?: string[];
	}
>;

// ---------- not on backend (only used by screens behind features.missingEndpoints) ----------

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

/** The waiver screens read a due's session, which DueResponse no longer has */
export type WaiverDue = Due & { sessionId: number };

export interface WaiverRequest {
	sessionId: number;
	periodStart: IsoDate;
	reason: string;
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
