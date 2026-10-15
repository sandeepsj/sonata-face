// The one module that talks to the sonata-brain API.
// Contract: sonata-brain `docs/api/openapi.json` (branch `self-service`). Types: ./types.ts, built on the
// generated ./schema.d.ts (`npm run api:types`).
// Groups marked "not on backend `self-service`" are only used by screens behind `features.legacyFeeModel`.

import { config as appConfig } from '$lib/config';
import type {
	AggregateGroupBy,
	AggregateRow,
	ApiErrorBody,
	BillingPeriod,
	ConvertRequest,
	Course,
	Due,
	DuesQuery,
	DuesSummary,
	FeeStructure,
	FeeStructureRequest,
	FieldErrorBody,
	IsoDate,
	IsoDateTime,
	LegacyComparison,
	Me,
	PageResponse,
	Payment,
	PaymentCreateRequest,
	PaymentQuery,
	RebuildJob,
	RebuildSchedule,
	RebuildScope,
	Role,
	RoleRequest,
	SessionCreateRequest,
	SessionQuery,
	Student,
	StudentInput,
	StudentSearchParams,
	StudentSession,
	TimelineEntry,
	TimelineRequest,
	TokenResponse,
	UserAccount,
	Waiver,
	WaiverRequest
} from './types';

export const BASE_URL = appConfig.apiBaseUrl;

// ---------- errors ----------

/** Error from the API. `message` is the server's message; `details` are per-field problems. */
export class ApiError extends Error {
	constructor(
		message: string,
		public status: number = 0,
		public details: FieldErrorBody[] = [],
		/** The response's `X-Request-Id`, for finding the request in the backend's `log` table. */
		public requestId: string | null = null
	) {
		super(message);
		this.name = 'ApiError';
	}

	get isUnauthorized() {
		return this.status === 401;
	}
	get isForbidden() {
		return this.status === 403;
	}
	get isNotFound() {
		return this.status === 404;
	}
	get isConflict() {
		return this.status === 409;
	}

	/** `{field: message}` for putting errors next to form fields. */
	fieldErrors(): Record<string, string> {
		const out: Record<string, string> = {};
		for (const d of this.details) {
			if (d.field && !out[d.field]) out[d.field] = d.message;
		}
		return out;
	}
}

export const FORBIDDEN_MESSAGE = "You don't have permission to do that.";

/** Message to show for any thrown value. API errors end with the request id: "… (ref 3f2a1b9c)". */
export function errorMessage(e: unknown, fallback = 'Something went wrong'): string {
	if (e instanceof ApiError) {
		const msg = e.isForbidden ? FORBIDDEN_MESSAGE : e.message || fallback;
		return e.requestId ? `${msg} (ref ${e.requestId.slice(0, 8)})` : msg;
	}
	if (e instanceof Error) return e.message || fallback;
	return fallback;
}

/** Field errors of a thrown value, or `{}`. */
export function fieldErrors(e: unknown): Record<string, string> {
	return e instanceof ApiError ? e.fieldErrors() : {};
}

// ---------- auth wiring (set by authStore, avoids a circular import) ----------

interface AuthHooks {
	getAccessToken: () => string | null;
	/** Returns true when a new access token was stored. */
	refresh: () => Promise<boolean>;
	/** Called when the session can't be recovered (refresh failed). */
	onAuthLost: () => void;
	/** Called on every 403, e.g. to show a toast. */
	onForbidden?: (err: ApiError) => void;
}

let hooks: AuthHooks | null = null;
let refreshing: Promise<boolean> | null = null;

export function configureAuth(h: AuthHooks) {
	hooks = h;
}

function refreshOnce(): Promise<boolean> {
	if (!hooks) return Promise.resolve(false);
	if (!refreshing) {
		refreshing = hooks.refresh().finally(() => {
			refreshing = null;
		});
	}
	return refreshing;
}

// ---------- logging headers (REQ-008) ----------

const SESSION_KEY = 'sid';
let memorySessionId: string | null = null;

function newId(): string {
	return typeof crypto !== 'undefined' && 'randomUUID' in crypto
		? crypto.randomUUID()
		: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/** One id per browser tab, sent as `X-Session-Id` on every request. */
export function sessionId(): string {
	try {
		let id = sessionStorage.getItem(SESSION_KEY);
		if (!id) {
			id = newId();
			sessionStorage.setItem(SESSION_KEY, id);
		}
		return id;
	} catch {
		// SSR, or storage blocked
		return (memorySessionId ??= newId());
	}
}

// ---------- request ----------

type Query = Record<string, string | number | boolean | null | undefined>;

/** Build a query string, leaving out empty values. */
export function qs(params: Query = {}): string {
	const sp = new URLSearchParams();
	for (const [k, v] of Object.entries(params)) {
		if (v === undefined || v === null || v === '') continue;
		sp.append(k, String(v));
	}
	const s = sp.toString();
	return s ? `?${s}` : '';
}

interface RequestOptions {
	method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
	body?: unknown;
	/** Don't send the access token (login, signup) */
	anonymous?: boolean;
	/** Send this bearer token instead of the access token (refresh) */
	bearer?: string;
	/** Internal: this is the retry after a refresh */
	retried?: boolean;
}

const GENERIC_MESSAGES: Record<number, string> = {
	400: 'The request was invalid.',
	401: 'Please log in again.',
	403: FORBIDDEN_MESSAGE,
	404: 'Not found.',
	409: 'That conflicts with existing data.'
};

/**
 * Error body is `{status, error, message, details[], timestamp}`. Payment create/deactivate leave out
 * `details`, and some older endpoints answer 400/404 with an empty body.
 */
async function toApiError(res: Response): Promise<ApiError> {
	let body: Partial<ApiErrorBody> = {};
	try {
		const parsed = await res.json();
		if (parsed && typeof parsed === 'object') body = parsed;
	} catch {
		// empty or non-JSON body
	}
	const message =
		(typeof body.message === 'string' && body.message) ||
		GENERIC_MESSAGES[res.status] ||
		(res.status >= 500 ? 'The server had a problem. Try again.' : `Request failed (${res.status})`);
	const details = Array.isArray(body.details)
		? body.details.filter((d): d is FieldErrorBody => !!d && typeof d.message === 'string')
		: [];
	return new ApiError(message, res.status, details, res.headers.get('X-Request-Id'));
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
	const headers: Record<string, string> = { Accept: 'application/json', 'X-Session-Id': sessionId() };
	if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
	const token = opts.bearer ?? (opts.anonymous ? null : hooks?.getAccessToken());
	if (token) headers['Authorization'] = `Bearer ${token}`;

	let res: Response;
	try {
		res = await fetch(`${BASE_URL}${path}`, {
			method: opts.method ?? 'GET',
			headers,
			body: opts.body === undefined ? undefined : JSON.stringify(opts.body)
		});
	} catch (e) {
		throw new ApiError(e instanceof Error ? `Network error: ${e.message}` : 'Network error');
	}

	if (res.status === 401 && !opts.anonymous && !opts.bearer) {
		if (!opts.retried && (await refreshOnce())) {
			return request<T>(path, { ...opts, retried: true });
		}
		const err = await toApiError(res);
		hooks?.onAuthLost();
		throw err;
	}

	if (!res.ok) {
		const err = await toApiError(res);
		if (err.isForbidden) hooks?.onForbidden?.(err);
		throw err;
	}

	const text = await res.text();
	if (!text) return undefined as T;
	try {
		return JSON.parse(text) as T;
	} catch {
		// e.g. GET /heartbeat → "OK"
		return text as unknown as T;
	}
}

const get = <T>(path: string) => request<T>(path);
const post = <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body });
const put = <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body });
const patch = <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body });
const del = (path: string) => request<void>(path, { method: 'DELETE' });
const enc = encodeURIComponent;

// ---------- platform ----------

export const platform = {
	/** GET /heartbeat (no token) → true when the server answers 200 */
	async heartbeat(): Promise<boolean> {
		try {
			const res = await fetch(`${BASE_URL}/heartbeat`, {
				cache: 'no-store',
				headers: { 'X-Session-Id': sessionId() }
			});
			return res.ok;
		} catch {
			return false;
		}
	}
};

// ---------- auth & users ----------

export const auth = {
	login: (email: string, password: string) =>
		request<TokenResponse>('/api/auth/login', { method: 'POST', body: { email, password }, anonymous: true }),
	/** POST /api/auth/refresh with the refresh token as bearer */
	refresh: (refreshToken: string) =>
		request<TokenResponse>('/api/auth/refresh', { method: 'POST', bearer: refreshToken }),
	/** 201 {id, email, roles: []}. No tokens: log in afterwards. */
	signup: (email: string, password: string) =>
		request<UserAccount>('/api/users/signup', { method: 'POST', body: { email, password }, anonymous: true })
};

export const users = {
	me: () => get<Me>('/api/users/me'),
	list: () => get<UserAccount[]>('/api/users'),
	setRoles: (id: number, roleIds: number[]) => put<UserAccount>(`/api/users/${id}/roles`, { roleIds })
};

export const roles = {
	list: (name?: string) => get<Role[]>(`/api/roles${qs({ name })}`),
	get: (id: number) => get<Role>(`/api/roles/${id}`),
	create: (body: RoleRequest) => post<Role>('/api/roles', body),
	update: (id: number, body: RoleRequest) => put<Role>(`/api/roles/${id}`, body),
	remove: (id: number) => del(`/api/roles/${id}`)
};

// ---------- students ----------

export const students = {
	page: (page = 0, size = 10) => get<PageResponse<Student>>(`/api/students${qs({ page, size })}`),
	/** GET /api/students/search: all students matching every given filter (no paging) */
	search: (params: StudentSearchParams = {}) =>
		get<Student[]>(`/api/students/search${qs(params as Query)}`),
	get: (admissionNo: number) => get<Student>(`/api/students/${admissionNo}`),
	create: (body: StudentInput) => post<Student>('/api/students', body),
	update: (admissionNo: number, body: StudentInput) => put<Student>(`/api/students/${admissionNo}`, body)
};

// ---------- courses ----------

export const courses = {
	list: () => get<Course[]>('/api/courses'),
	create: (name: string) => post<Course>('/api/courses', { name }),
	/** Not on backend `self-service` */
	close: (name: string) => patch<Course>(`/api/courses/${enc(name)}/close`),
	/** Not on backend `self-service` */
	reopen: (name: string) => patch<Course>(`/api/courses/${enc(name)}/reopen`)
};

// ---------- sessions ----------

export const sessions = {
	/** GET /api/student-sessions/all, filtered by any of studentId, courseName, active */
	list: (q: SessionQuery = {}) => get<StudentSession[]>(`/api/student-sessions/all${qs(q as Query)}`),
	get: (id: number) => get<StudentSession>(`/api/student-sessions/${id}`),
	create: (body: SessionCreateRequest) => post<StudentSession>('/api/student-sessions', body),
	/** Disjoin now. A past `date` (YYYY-MM-DDTHH:mm:ss) is not on backend `self-service`, which takes no body. */
	disjoin: (id: number, date?: IsoDateTime) =>
		patch<StudentSession>(`/api/student-sessions/${id}/disjoin`, date ? { date } : undefined)
};

// ---------- fee structures & timeline (not on backend `self-service`) ----------

export const feeStructures = {
	list: (courseName?: string) => get<FeeStructure[]>(`/api/fee-structures${qs({ courseName })}`),
	get: (id: number) => get<FeeStructure>(`/api/fee-structures/${id}`),
	create: (body: FeeStructureRequest) => post<FeeStructure>('/api/fee-structures', body),
	update: (id: number, body: FeeStructureRequest) => put<FeeStructure>(`/api/fee-structures/${id}`, body),
	clone: (id: number, name: string) => post<FeeStructure>(`/api/fee-structures/${id}/clone`, { name }),
	/** 409 when the structure is used in the timeline */
	remove: (id: number) => del(`/api/fee-structures/${id}`)
};

export const feeTimeline = {
	list: (courseName: string) => get<TimelineEntry[]>(`/api/fee-timeline${qs({ courseName })}`),
	create: (body: TimelineRequest) => post<TimelineEntry>('/api/fee-timeline', body),
	update: (id: number, body: TimelineRequest) => put<TimelineEntry>(`/api/fee-timeline/${id}`, body),
	remove: (id: number) => del(`/api/fee-timeline/${id}`),
	/** Billing periods the current timeline produces that overlap [from, to] */
	preview: (courseName: string, from: IsoDate, to: IsoDate) =>
		get<BillingPeriod[]>(`/api/fee-timeline/preview${qs({ courseName, from, to })}`)
};

// ---------- payments (new shape; not on backend `self-service`) ----------

export const payments = {
	/** Newest first */
	list: (q: PaymentQuery = {}) => get<Payment[]>(`/api/payments${qs(q as Query)}`),
	get: (id: number) => get<Payment>(`/api/payments/${id}`),
	create: (body: PaymentCreateRequest) => post<Payment>('/api/payments', body),
	/** 409 when already inactive */
	deactivate: (id: number) => patch<Payment>(`/api/payments/${id}/deactivate`),
	convertToCourseFee: (id: number, body: ConvertRequest) =>
		post<Payment>(`/api/payments/${id}/convert-to-course-fee`, body)
};

// ---------- dues (not on backend `self-service`) ----------

export const dues = {
	list: (q: DuesQuery = {}) => get<Due[]>(`/api/dues${qs(q as Query)}`),
	/** Needs studentId or courseName */
	summary: (q: { studentId?: number; courseName?: string }) => get<DuesSummary>(`/api/dues/summary${qs(q)}`),
	aggregate: (groupBy: AggregateGroupBy, from?: IsoDate, to?: IsoDate) =>
		get<AggregateRow[]>(`/api/dues/aggregate${qs({ groupBy, from, to })}`),
	waivers: (studentId: number) => get<Waiver[]>(`/api/dues/waivers${qs({ studentId })}`),
	/** The session must be disjoined (409 otherwise) */
	createWaiver: (body: WaiverRequest) => post<Waiver>('/api/dues/waivers', body),
	removeWaiver: (id: number) => del(`/api/dues/waivers/${id}`),
	/** 202 {jobId} */
	rebuild: (scope: RebuildScope, id?: string | number, dryRun = false) =>
		post<{ jobId: number }>(`/api/dues/rebuild${qs({ scope, id, dryRun })}`),
	rebuildJob: (jobId: number) => get<RebuildJob>(`/api/dues/rebuild/${jobId}`),
	rebuildSchedule: () => get<RebuildSchedule>('/api/dues/rebuild/schedule'),
	/** 404 once the legacy tables are gone */
	legacyComparison: () => get<LegacyComparison>('/api/dues/legacy-comparison')
};
