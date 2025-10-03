import { writable } from 'svelte/store';
import type { FeeStructure } from '../types/course.js';
import { FeeStructureService } from '../api/feeStructureService.js';

interface FeeStructureCache {
	byYear: Map<number, FeeStructure[]>;
	byCourse: Map<string, FeeStructure[]>;
	byCourseAndYear: Map<string, FeeStructure[]>; // key: `${courseId}-${year}`
	byCoursYearTerm: Map<string, FeeStructure>; // key: `${courseId}-${year}-${term}`
	all: FeeStructure[];
	lastFetchedAll: Date | null;
}

interface FeeStructureStoreState {
	cache: FeeStructureCache;
	loading: boolean;
	error: string | null;
}

const initialState: FeeStructureStoreState = {
	cache: {
		byYear: new Map(),
		byCourse: new Map(),
		byCourseAndYear: new Map(),
		byCoursYearTerm: new Map(),
		all: [],
		lastFetchedAll: null
	},
	loading: false,
	error: null
};

function createFeeStructureStore() {
	const { subscribe, set, update } = writable<FeeStructureStoreState>(initialState);

	return {
		subscribe,

		/**
		 * Get fee structures by year (with caching)
		 */
		async getByYear(year: number, forceRefresh = false): Promise<FeeStructure[]> {
			const currentState = await new Promise<FeeStructureStoreState>((resolve) => {
				let unsubscribeFn: (() => void) | undefined;
				unsubscribeFn = subscribe((state) => {
					if (unsubscribeFn) unsubscribeFn();
					resolve(state);
				});
			});

			// Return cached data if available and not forcing refresh
			if (!forceRefresh && currentState.cache.byYear.has(year)) {
				return currentState.cache.byYear.get(year)!;
			}

			// Fetch from API
			update(state => ({ ...state, loading: true, error: null }));

			try {
				const feeStructures = await FeeStructureService.getFeeStructuresByYear(year);
				
				update(state => {
					const newCache = { ...state.cache };
					newCache.byYear.set(year, feeStructures);
					
					// Also cache individual course-year combinations
					feeStructures.forEach(fs => {
						const key = `${fs.course.id}-${fs.year}`;
						const yearTermKey = `${fs.course.id}-${fs.year}-${fs.term}`;
						
						if (!newCache.byCourseAndYear.has(key)) {
							newCache.byCourseAndYear.set(key, []);
						}
						newCache.byCourseAndYear.get(key)!.push(fs);
						newCache.byCoursYearTerm.set(yearTermKey, fs);
					});

					return {
						...state,
						cache: newCache,
						loading: false,
						error: null
					};
				});

				return feeStructures;
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : 'Failed to fetch fee structures';
				update(state => ({
					...state,
					loading: false,
					error: errorMessage
				}));
				throw error;
			}
		},

		/**
		 * Get fee structures by course (with caching)
		 */
		async getByCourse(courseId: string, forceRefresh = false): Promise<FeeStructure[]> {
			const currentState = await new Promise<FeeStructureStoreState>((resolve) => {
				let unsubscribeFn: (() => void) | undefined;
				unsubscribeFn = subscribe((state) => {
					if (unsubscribeFn) unsubscribeFn();
					resolve(state);
				});
			});

			// Return cached data if available
			if (!forceRefresh && currentState.cache.byCourse.has(courseId)) {
				return currentState.cache.byCourse.get(courseId)!;
			}

			// Fetch from API
			update(state => ({ ...state, loading: true, error: null }));

			try {
				const feeStructures = await FeeStructureService.getFeeStructuresByCourse(courseId);
				
				update(state => {
					const newCache = { ...state.cache };
					newCache.byCourse.set(courseId, feeStructures);
					
					// Also cache individual course-year combinations
					feeStructures.forEach(fs => {
						const key = `${fs.course.id}-${fs.year}`;
						const yearTermKey = `${fs.course.id}-${fs.year}-${fs.term}`;
						
						if (!newCache.byCourseAndYear.has(key)) {
							newCache.byCourseAndYear.set(key, []);
						}
						newCache.byCourseAndYear.get(key)!.push(fs);
						newCache.byCoursYearTerm.set(yearTermKey, fs);
					});

					return {
						...state,
						cache: newCache,
						loading: false,
						error: null
					};
				});

				return feeStructures;
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : 'Failed to fetch fee structures';
				update(state => ({
					...state,
					loading: false,
					error: errorMessage
				}));
				throw error;
			}
		},

		/**
		 * Get fee structures by course and year (with caching)
		 */
		async getByCourseAndYear(courseId: string, year: number, forceRefresh = false): Promise<FeeStructure[]> {
			const key = `${courseId}-${year}`;
			const currentState = await new Promise<FeeStructureStoreState>((resolve) => {
				let unsubscribeFn: (() => void) | undefined;
				unsubscribeFn = subscribe((state) => {
					if (unsubscribeFn) unsubscribeFn();
					resolve(state);
				});
			});

			// Return cached data if available
			if (!forceRefresh && currentState.cache.byCourseAndYear.has(key)) {
				return currentState.cache.byCourseAndYear.get(key)!;
			}

			// Fetch from API
			update(state => ({ ...state, loading: true, error: null }));

			try {
				const feeStructures = await FeeStructureService.getFeeStructuresByCourseAndYear(courseId, year);
				
				update(state => {
					const newCache = { ...state.cache };
					newCache.byCourseAndYear.set(key, feeStructures);
					
					// Also cache individual term lookups
					feeStructures.forEach(fs => {
						const yearTermKey = `${fs.course.id}-${fs.year}-${fs.term}`;
						newCache.byCoursYearTerm.set(yearTermKey, fs);
					});

					return {
						...state,
						cache: newCache,
						loading: false,
						error: null
					};
				});

				return feeStructures;
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : 'Failed to fetch fee structures';
				update(state => ({
					...state,
					loading: false,
					error: errorMessage
				}));
				throw error;
			}
		},

		/**
		 * Get specific fee structure by course, year, and term (with caching)
		 */
		async getSpecific(courseId: string, year: number, term: number, forceRefresh = false): Promise<FeeStructure> {
			const key = `${courseId}-${year}-${term}`;
			const currentState = await new Promise<FeeStructureStoreState>((resolve) => {
				let unsubscribeFn: (() => void) | undefined;
				unsubscribeFn = subscribe((state) => {
					if (unsubscribeFn) unsubscribeFn();
					resolve(state);
				});
			});

			// Return cached data if available
			if (!forceRefresh && currentState.cache.byCoursYearTerm.has(key)) {
				return currentState.cache.byCoursYearTerm.get(key)!;
			}

			// Fetch from API
			update(state => ({ ...state, loading: true, error: null }));

			try {
				const feeStructure = await FeeStructureService.getSpecificFeeStructure(courseId, year, term);
				
				update(state => {
					const newCache = { ...state.cache };
					newCache.byCoursYearTerm.set(key, feeStructure);

					return {
						...state,
						cache: newCache,
						loading: false,
						error: null
					};
				});

				return feeStructure;
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : 'Failed to fetch fee structure';
				update(state => ({
					...state,
					loading: false,
					error: errorMessage
				}));
				throw error;
			}
		},

		/**
		 * Find fee structure ID by course name, year, and term
		 * This is useful for getting the correct termId for payments
		 */
		async getFeeStructureId(courseName: string, year: number, term: number): Promise<number | null> {
			try {
				// courseName is actually the courseId in the API
				const feeStructure = await this.getSpecific(courseName, year, term);
				return feeStructure.id;
			} catch (error) {
				console.error(`Error getting fee structure ID for ${courseName} - Term ${term}, ${year}:`, error);
				return null;
			}
		},

		/**
		 * Get all unique courses from cache
		 */
		getUniqueCourses(): string[] {
			let allFeeStructures: FeeStructure[] = [];
			let unsubscribeFn: (() => void) | undefined;
			
			unsubscribeFn = subscribe((state) => {
				state.cache.byYear.forEach(structures => {
					allFeeStructures = [...allFeeStructures, ...structures];
				});
				state.cache.byCourse.forEach(structures => {
					allFeeStructures = [...allFeeStructures, ...structures];
				});
			});
			
			if (unsubscribeFn) {
				unsubscribeFn();
			}

			return FeeStructureService.getUniqueCoursesFromFeeStructures(allFeeStructures);
		},

		/**
		 * Get all unique years from cache
		 */
		getUniqueYears(): number[] {
			let allFeeStructures: FeeStructure[] = [];
			let unsubscribeFn: (() => void) | undefined;
			
			unsubscribeFn = subscribe((state) => {
				state.cache.byYear.forEach(structures => {
					allFeeStructures = [...allFeeStructures, ...structures];
				});
			});
			
			if (unsubscribeFn) {
				unsubscribeFn();
			}

			return FeeStructureService.getUniqueYearsFromFeeStructures(allFeeStructures);
		},

		/**
		 * Calculate yearly fee for a course
		 */
		async getYearlyFee(courseId: string, year: number): Promise<number> {
			const termFees = await this.getByCourseAndYear(courseId, year);
			return FeeStructureService.calculateYearlyFee(termFees);
		},

		/**
		 * Get terms per year for a course
		 */
		async getTermsPerYear(courseId: string, year: number): Promise<number> {
			const termFees = await this.getByCourseAndYear(courseId, year);
			return termFees.length;
		},

		/**
		 * Clear all cache
		 */
		clearCache() {
			set(initialState);
		},

		/**
		 * Clear cache for a specific year
		 */
		clearYearCache(year: number) {
			update(state => {
				const newCache = { ...state.cache };
				newCache.byYear.delete(year);
				
				// Also clear related course-year combinations
				const keysToDelete: string[] = [];
				newCache.byCourseAndYear.forEach((_, key) => {
					if (key.endsWith(`-${year}`)) {
						keysToDelete.push(key);
					}
				});
				keysToDelete.forEach(key => newCache.byCourseAndYear.delete(key));

				return {
					...state,
					cache: newCache
				};
			});
		},

		/**
		 * Clear cache for a specific course
		 */
		clearCourseCache(courseId: string) {
			update(state => {
				const newCache = { ...state.cache };
				newCache.byCourse.delete(courseId);
				
				// Also clear related course-year combinations
				const keysToDelete: string[] = [];
				newCache.byCourseAndYear.forEach((_, key) => {
					if (key.startsWith(`${courseId}-`)) {
						keysToDelete.push(key);
					}
				});
				keysToDelete.forEach(key => newCache.byCourseAndYear.delete(key));

				return {
					...state,
					cache: newCache
				};
			});
		}
	};
}

export const feeStructureStore = createFeeStructureStore();
export type { FeeStructureStoreState, FeeStructureCache };
