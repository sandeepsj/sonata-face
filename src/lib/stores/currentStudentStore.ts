import { writable, get } from 'svelte/store';
import type { Student } from '../types/student.js';
import type { FeeDuesTrackerDTO } from '../types/feeDues.js';
import type { Payment } from '../types/payment.js';
import type { StudentSession } from '../types/studentSession.js';
import { FeeDuesService } from '../api/feeDuesService.js';
import { PaymentService } from '../api/paymentService.js';
import { StudentSessionService } from '../api/studentSessionService.js';

interface CurrentStudentState {
	student: Student | null;
	loading: boolean;
	error: string | null;
	dues: {
		data: FeeDuesTrackerDTO[];
		loading: boolean;
		error: string | null;
		lastFetched: Date | null;
		studentId: number | null; // Track which student's data this is
	};
	payments: {
		data: Payment[];
		loading: boolean;
		error: string | null;
		lastFetched: Date | null;
		studentId: number | null; // Track which student's data this is
	};
	sessions: {
		data: StudentSession[];
		loading: boolean;
		error: string | null;
		lastFetched: Date | null;
		studentId: number | null; // Track which student's data this is
	};
}

const initialState: CurrentStudentState = {
	student: null,
	loading: false,
	error: null,
	dues: {
		data: [],
		loading: false,
		error: null,
		lastFetched: null,
		studentId: null
	},
	payments: {
		data: [],
		loading: false,
		error: null,
		lastFetched: null,
		studentId: null
	},
	sessions: {
		data: [],
		loading: false,
		error: null,
		lastFetched: null,
		studentId: null
	}
};

function createCurrentStudentStore() {
	const { subscribe, set, update } = writable<CurrentStudentState>(initialState);
	const store = { subscribe, set, update };

	return {
		subscribe,

		// Set student data (from load function or API)
		setStudent(student: Student) {
			update(state => ({
				...state,
				student,
				loading: false,
				error: null
			}));
		},

		// Update student data (after edit operations)
		updateStudent(updatedStudent: Student) {
			update(state => ({
				...state,
				student: updatedStudent
			}));
		},

		// Set loading state
		setLoading(loading: boolean) {
			update(state => ({
				...state,
				loading
			}));
		},

		// Set error state
		setError(error: string) {
			update(state => ({
				...state,
				error,
				loading: false
			}));
		},

		// Clear store
		reset() {
			set(initialState);
		},

		// Dues-related methods
		async fetchDues(studentId: number, forceRefresh = false) {
			// Check if we need to fetch (no data, force refresh, different student, or data is stale)
			const currentState = get(store);
			const isDifferentStudent = currentState.dues.studentId !== studentId;
			const shouldFetch = forceRefresh || 
				isDifferentStudent ||
				currentState.dues.data.length === 0 || 
				!currentState.dues.lastFetched ||
				(Date.now() - currentState.dues.lastFetched.getTime()) > 5 * 60 * 1000; // 5 minutes

			if (!shouldFetch) {
				return;
			}

			update(state => ({
				...state,
				dues: {
					...state.dues,
					loading: true,
					error: null
				}
			}));

			try {
				const dues = await FeeDuesService.getStudentDues(studentId);
				update(state => ({
					...state,
					dues: {
						data: dues,
						loading: false,
						error: null,
						lastFetched: new Date(),
						studentId: studentId
					}
				}));
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : 'Failed to load dues';
				update(state => ({
					...state,
					dues: {
						...state.dues,
						loading: false,
						error: errorMessage
					}
				}));
			}
		},

		// Set dues loading state
		setDuesLoading(loading: boolean) {
			update(state => ({
				...state,
				dues: {
					...state.dues,
					loading
				}
			}));
		},

		// Update a specific due (after payment)
		updateDue(updatedDue: FeeDuesTrackerDTO) {
			update(state => ({
				...state,
				dues: {
					...state.dues,
					data: state.dues.data.map(due => 
						due.id === updatedDue.id ? updatedDue : due
					)
				}
			}));
		},

		// Add a new due (after creating additional payment)
		addDue(newDue: FeeDuesTrackerDTO) {
			update(state => ({
				...state,
				dues: {
					...state.dues,
					data: [...state.dues.data, newDue]
				}
			}));
		},

		// Clear dues data
		clearDues() {
			update(state => ({
				...state,
				dues: {
					data: [],
					loading: false,
					error: null,
					lastFetched: null,
					studentId: null
				}
			}));
		},

		// Payment-related methods
		async fetchPayments(studentId: number, forceRefresh = false) {
			console.log('[Store] fetchPayments called for studentId:', studentId, 'forceRefresh:', forceRefresh);
			
			// Check if we need to fetch (no data, force refresh, different student, or data is stale)
			const currentState = get(store);
			const isDifferentStudent = currentState.payments.studentId !== studentId;
			const shouldFetch = forceRefresh || 
				isDifferentStudent ||
				currentState.payments.data.length === 0 || 
				!currentState.payments.lastFetched ||
				(Date.now() - currentState.payments.lastFetched.getTime()) > 5 * 60 * 1000; // 5 minutes

			console.log('[Store] Should fetch payments?', shouldFetch, {
				isDifferentStudent,
				hasData: currentState.payments.data.length > 0,
				lastFetched: currentState.payments.lastFetched
			});

			if (!shouldFetch) {
				console.log('[Store] Using cached payments, count:', currentState.payments.data.length);
				return;
			}

			console.log('[Store] Setting loading state...');
			update(state => ({
				...state,
				payments: {
					...state.payments,
					loading: true,
					error: null
				}
			}));

			try {
				console.log('[Store] Calling PaymentService.getPaymentsByStudentId...');
				const payments = await PaymentService.getPaymentsByStudentId(studentId);
				console.log('[Store] Received payments:', payments.length, 'records');
				
				update(state => ({
					...state,
					payments: {
						data: payments,
						loading: false,
						error: null,
						lastFetched: new Date(),
						studentId: studentId
					}
				}));
				console.log('[Store] Payment data stored successfully');
			} catch (error) {
				console.error('[Store] Error fetching payments:', error);
				const errorMessage = error instanceof Error ? error.message : 'Failed to load payment history';
				update(state => ({
					...state,
					payments: {
						...state.payments,
						loading: false,
						error: errorMessage
					}
				}));
			}
		},

		// Set payments loading state
		setPaymentsLoading(loading: boolean) {
			update(state => ({
				...state,
				payments: {
					...state.payments,
					loading
				}
			}));
		},

		// Clear payments data
		clearPayments() {
			update(state => ({
				...state,
				payments: {
					data: [],
					loading: false,
					error: null,
					lastFetched: null,
					studentId: null
				}
			}));
		},

		// Helper to get payment details with enriched data from dues
		getEnrichedPayments() {
			const currentState = get(store);
			const { payments, dues } = currentState;

			return payments.data.map(payment => {
				// If payment has feeStructure, try to find matching due
				if (payment.feeStructure) {
					const matchingDue = dues.data.find(due => 
						due.feeStructureId === payment.feeStructure?.id
					);
					
					if (matchingDue) {
						return {
							...payment,
							enrichedData: {
								termYear: matchingDue.termYear,
								termNumber: matchingDue.termNumber,
								courseName: matchingDue.courseName
							}
						};
					}
				}

				// For payments without feeStructure or no matching due, use payment's own data
				return {
					...payment,
					enrichedData: {
						termYear: null,
						termNumber: null,
						courseName: payment.courseName || null
					}
				};
			});
		},

		// Session-related methods
		async fetchSessions(studentId: number, forceRefresh = false) {
			// Check if we need to fetch (no data, force refresh, different student, or data is stale)
			const currentState = get(store);
			const isDifferentStudent = currentState.sessions.studentId !== studentId;
			const shouldFetch = forceRefresh || 
				isDifferentStudent ||
				currentState.sessions.data.length === 0 || 
				!currentState.sessions.lastFetched ||
				(Date.now() - currentState.sessions.lastFetched.getTime()) > 5 * 60 * 1000; // 5 minutes

			if (!shouldFetch) {
				return;
			}

			update(state => ({
				...state,
				sessions: {
					...state.sessions,
					loading: true,
					error: null
				}
			}));

			try {
				const sessions = await StudentSessionService.getAllSessionsByStudent(studentId);
				update(state => ({
					...state,
					sessions: {
						data: sessions,
						loading: false,
						error: null,
						lastFetched: new Date(),
						studentId: studentId
					}
				}));
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : 'Failed to load sessions';
				update(state => ({
					...state,
					sessions: {
						...state.sessions,
						loading: false,
						error: errorMessage
					}
				}));
			}
		},

		// Set sessions loading state
		setSessionsLoading(loading: boolean) {
			update(state => ({
				...state,
				sessions: {
					...state.sessions,
					loading
				}
			}));
		},

		// Update a specific session (after ending session)
		updateSession(updatedSession: StudentSession) {
			update(state => ({
				...state,
				sessions: {
					...state.sessions,
					data: state.sessions.data.map(session => 
						session.id === updatedSession.id ? updatedSession : session
					)
				}
			}));
		},

		// Add a new session (after creating)
		addSession(newSession: StudentSession) {
			update(state => ({
				...state,
				sessions: {
					...state.sessions,
					data: [...state.sessions.data, newSession]
				}
			}));
		},

		// Clear sessions data
		clearSessions() {
			update(state => ({
				...state,
				sessions: {
					data: [],
					loading: false,
					error: null,
					lastFetched: null,
					studentId: null
				}
			}));
		},

		// Helper to check if a session is active by sessionId
		isSessionActive(sessionId: number): boolean {
			const currentState = get(store);
			const session = currentState.sessions.data.find(s => s.id === sessionId);
			return session ? StudentSessionService.isSessionActive(session) : false;
		},

		// Helper to get a session by ID
		getSessionById(sessionId: number): StudentSession | undefined {
			const currentState = get(store);
			return currentState.sessions.data.find(s => s.id === sessionId);
		}
	};
}

export const currentStudentStore = createCurrentStudentStore();

// Export types for use in components
export type { CurrentStudentState };