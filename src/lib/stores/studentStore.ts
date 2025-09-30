import { writable } from 'svelte/store';
import type { Student, StudentPageResponse } from '../types/student.js';
import { StudentService } from '../api/studentService.js';

// Student store state
interface StudentStoreState {
	students: Student[];
	currentPage: number;
	pageSize: number;
	totalElements: number;
	totalPages: number;
	loading: boolean;
	error: string;
	searchQuery: string;
}

// Initial state
const initialState: StudentStoreState = {
	students: [],
	currentPage: 0,
	pageSize: 10,
	totalElements: 0,
	totalPages: 0,
	loading: false,
	error: '',
	searchQuery: '',
};

// Create the store
function createStudentStore() {
	const { subscribe, set, update } = writable<StudentStoreState>(initialState);

	return {
		subscribe,
		
		// Actions
		async fetchStudents(page = 0, size = 10, search = '') {
			update(state => ({ ...state, loading: true, error: '' }));
			
			try {
				const response = await StudentService.getStudents({ page, size, search });
				
				update(state => ({
					...state,
					students: response.content,
					currentPage: response.number,
					pageSize: response.size,
					totalElements: response.totalElements,
					totalPages: response.totalPages,
					searchQuery: search,
					loading: false,
				}));
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : 'Failed to fetch students';
				update(state => ({
					...state,
					students: [],
					totalElements: 0,
					totalPages: 0,
					loading: false,
					error: errorMessage,
				}));
			}
		},

		async searchStudents(query: string) {
			return this.fetchStudents(0, undefined, query);
		},

		async goToPage(page: number) {
			const state = get(studentStore);
			return this.fetchStudents(page, state.pageSize, state.searchQuery);
		},

		async changePageSize(size: number) {
			const state = get(studentStore);
			return this.fetchStudents(0, size, state.searchQuery);
		},

		// Reset store to initial state
		reset() {
			set(initialState);
		},

		// Clear errors
		clearError() {
			update(state => ({ ...state, error: '' }));
		},
	};
}

// Export the store instance
export const studentStore = createStudentStore();

// Helper to get current state (for use in functions)
export function get<T>(store: { subscribe: (fn: (value: T) => void) => () => void }): T {
	let value: T;
	const unsubscribe = store.subscribe((val: T) => { value = val; });
	unsubscribe();
	return value!;
}