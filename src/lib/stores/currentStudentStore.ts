import { writable } from 'svelte/store';
import type { Student } from '../types/student.js';

interface CurrentStudentState {
	student: Student | null;
	loading: boolean;
	error: string | null;
}

const initialState: CurrentStudentState = {
	student: null,
	loading: false,
	error: null
};

function createCurrentStudentStore() {
	const { subscribe, set, update } = writable<CurrentStudentState>(initialState);

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
		}
	};
}

export const currentStudentStore = createCurrentStudentStore();