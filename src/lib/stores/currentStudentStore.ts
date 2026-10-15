import { writable, get } from 'svelte/store';
import { dues as duesApi, payments as paymentsApi, sessions as sessionsApi, errorMessage } from '$lib/api/client';
import { features } from '$lib/config/features';
import type { Due, Payment, Student, StudentSession, Waiver } from '$lib/api/types';

interface Slice<T> {
	data: T[];
	loading: boolean;
	error: string | null;
	lastFetched: Date | null;
	/** Which student's data this is */
	studentId: number | null;
}

export interface CurrentStudentState {
	student: Student | null;
	loading: boolean;
	error: string | null;
	dues: Slice<Due>;
	payments: Slice<Payment>;
	sessions: Slice<StudentSession>;
	waivers: Slice<Waiver>;
}

const emptySlice = <T>(): Slice<T> => ({ data: [], loading: false, error: null, lastFetched: null, studentId: null });

const initialState = (): CurrentStudentState => ({
	student: null,
	loading: false,
	error: null,
	dues: emptySlice(),
	payments: emptySlice(),
	sessions: emptySlice(),
	waivers: emptySlice()
});

const STALE_MS = 5 * 60 * 1000;

type SliceKey = 'dues' | 'payments' | 'sessions' | 'waivers';

function createCurrentStudentStore() {
	const store = writable<CurrentStudentState>(initialState());
	const { subscribe, set, update } = store;

	async function load<K extends SliceKey>(
		key: K,
		studentId: number,
		force: boolean,
		fetcher: () => Promise<CurrentStudentState[K]['data']>
	) {
		const slice = get(store)[key];
		const fresh =
			slice.studentId === studentId && slice.lastFetched && Date.now() - slice.lastFetched.getTime() < STALE_MS;
		if (!force && fresh) return;

		update((s) => ({ ...s, [key]: { ...s[key], loading: true, error: null } }));
		try {
			const data = await fetcher();
			update((s) => ({
				...s,
				[key]: { data, loading: false, error: null, lastFetched: new Date(), studentId }
			}));
		} catch (e) {
			update((s) => ({ ...s, [key]: { ...s[key], loading: false, error: errorMessage(e) } }));
		}
	}

	const api = {
		subscribe,

		setStudent(student: Student) {
			update((s) => ({ ...s, student, loading: false, error: null }));
		},

		updateStudent(student: Student) {
			update((s) => ({ ...s, student }));
		},

		setLoading(loading: boolean) {
			update((s) => ({ ...s, loading }));
		},

		setError(error: string) {
			update((s) => ({ ...s, error, loading: false }));
		},

		reset() {
			set(initialState());
		},

		fetchDues(studentId: number, force = false) {
			return load('dues', studentId, force, () => duesApi.list({ studentId }));
		},

		fetchPayments(studentId: number, force = false) {
			return load('payments', studentId, force, () => paymentsApi.list({ studentId }));
		},

		fetchSessions(studentId: number, force = false) {
			return load('sessions', studentId, force, () => sessionsApi.list({ studentId }));
		},

		fetchWaivers(studentId: number, force = false) {
			return load('waivers', studentId, force, () => duesApi.waivers(studentId));
		},

		/**
		 * Dues are rebuilt in the background after a payment, session or waiver change.
		 * Re-read them every second (up to ~10s) until they differ from what we had.
		 */
		async refreshDuesUntilChanged(studentId: number, timeoutMs = 10_000) {
			const before = JSON.stringify(get(store).dues.data);
			const started = Date.now();
			while (Date.now() - started < timeoutMs) {
				await new Promise((r) => setTimeout(r, 1000));
				try {
					const data = await duesApi.list({ studentId });
					if (JSON.stringify(data) !== before) {
						update((s) => ({
							...s,
							dues: { data, loading: false, error: null, lastFetched: new Date(), studentId }
						}));
						return true;
					}
				} catch {
					break;
				}
			}
			await api.fetchDues(studentId, true);
			return false;
		},

		/** Refresh everything that a write may have changed. */
		async refreshAfterWrite(studentId: number) {
			// Payments, dues and waivers aren't on backend `self-service` yet
			if (!features.legacyFeeModel) return api.fetchSessions(studentId, true);
			await Promise.all([
				api.fetchPayments(studentId, true),
				api.fetchSessions(studentId, true),
				api.fetchWaivers(studentId, true)
			]);
			await api.refreshDuesUntilChanged(studentId);
		},

		isSessionActive(sessionId: number): boolean {
			const session = get(store).sessions.data.find((s) => s.id === sessionId);
			return session ? !session.dateOfDisjoining : false;
		},

		getSessionById(sessionId: number): StudentSession | undefined {
			return get(store).sessions.data.find((s) => s.id === sessionId);
		}
	};
	return api;
}

export const currentStudentStore = createCurrentStudentStore();
