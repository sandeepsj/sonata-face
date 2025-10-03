import { writable, get } from 'svelte/store';
import type { Student } from '../types/student.js';
import type { FeeDuesTrackerDTO } from '../types/feeDues.js';
import { FeeDuesService } from '../api/feeDuesService.js';

interface CurrentStudentState {
	student: Student | null;
	loading: boolean;
	error: string | null;
	dues: {
		data: FeeDuesTrackerDTO[];
		loading: boolean;
		error: string | null;
		lastFetched: Date | null;
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
		lastFetched: null
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
			// Check if we need to fetch (no data, force refresh, or data is stale)
			const currentState = get(store);
			const shouldFetch = forceRefresh || 
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
						lastFetched: new Date()
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
					lastFetched: null
				}
			}));
		}
	};
}

export const currentStudentStore = createCurrentStudentStore();

// Export types for use in components
export type { CurrentStudentState };