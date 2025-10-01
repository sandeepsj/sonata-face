import { apiRequest, API_CONFIG } from './config.js';
import type { Student, StudentPageResponse, StudentSearchParams, StudentAdvancedSearchParams } from '../types/student.js';

/**
 * Student API service - handles all student-related API calls
 */
export class StudentService {
	/**
	 * Fetch paginated list of students
	 */
	static async getStudents(params: StudentSearchParams = {}): Promise<StudentPageResponse> {
		const {
			page = 0,
			size = API_CONFIG.DEFAULT_PAGE_SIZE,
			search,
			sortBy,
			sortDirection = 'asc'
		} = params;

		// Build query parameters
		const searchParams = new URLSearchParams({
			page: page.toString(),
			size: size.toString(),
		});

		if (search?.trim()) {
			searchParams.append('search', search.trim());
		}

		if (sortBy) {
			searchParams.append('sort', `${sortBy},${sortDirection}`);
		}

		const endpoint = `${API_CONFIG.ENDPOINTS.STUDENTS}?${searchParams}`;
		const response = await apiRequest<StudentPageResponse | Student[]>(endpoint);

		// Handle both paginated and array responses
		if (Array.isArray(response)) {
			// Convert simple array to paginated response
			return {
				content: response,
				totalElements: response.length,
				totalPages: 1,
				size: response.length,
				number: 0,
				first: true,
				last: true,
				sort: { sorted: false, unsorted: true, empty: true },
				numberOfElements: response.length,
				empty: response.length === 0,
			};
		}

		return response as StudentPageResponse;
	}

	/**
	 * Get a single student by ID
	 */
	static async getStudent(id: number): Promise<Student> {
		const endpoint = `${API_CONFIG.ENDPOINTS.STUDENTS}/${id}`;
		return apiRequest<Student>(endpoint);
	}

	/**
	 * Create a new student
	 */
	static async createStudent(student: Omit<Student, 'admissionId'>): Promise<Student> {
		const endpoint = API_CONFIG.ENDPOINTS.STUDENTS;
		return apiRequest<Student>(endpoint, {
			method: 'POST',
			body: JSON.stringify(student),
		});
	}

	/**
	 * Update an existing student
	 */
	static async updateStudent(id: number, student: Partial<Student>): Promise<Student> {
		const endpoint = `${API_CONFIG.ENDPOINTS.STUDENTS}/${id}`;
		return apiRequest<Student>(endpoint, {
			method: 'PUT',
			body: JSON.stringify(student),
		});
	}

	/**
	 * Delete a student
	 */
	static async deleteStudent(id: number): Promise<void> {
		const endpoint = `${API_CONFIG.ENDPOINTS.STUDENTS}/${id}`;
		await apiRequest<void>(endpoint, {
			method: 'DELETE',
		});
	}

	/**
	 * Search students by name or contact
	 */
	static async searchStudents(
		query: string,
		page = 0,
		size = API_CONFIG.DEFAULT_PAGE_SIZE
	): Promise<StudentPageResponse> {
		return this.getStudents({ search: query, page, size });
	}

	/**
	 * Advanced search students with multiple parameters
	 */
	static async advancedSearchStudents(params: StudentAdvancedSearchParams = {}): Promise<StudentPageResponse> {
		const {
			page = 0,
			size = API_CONFIG.DEFAULT_PAGE_SIZE,
			sortBy,
			sortDirection = 'asc',
			...searchFields
		} = params;

		// Check if we have specific search parameters
		const hasSearchParams = Object.values(searchFields).some(v => v !== undefined && v !== null && v !== '');
		
		if (hasSearchParams) {
			// For search endpoint, only pass search parameters (no pagination)
			const searchParams = new URLSearchParams();

			// Add individual search fields only
			Object.entries(searchFields).forEach(([key, value]) => {
				if (value !== undefined && value !== null && value !== '') {
					searchParams.append(key, value.toString());
				}
			});

			const endpoint = `${API_CONFIG.ENDPOINTS.STUDENTS}/search?${searchParams}`;
			const response = await apiRequest<StudentPageResponse | Student[]>(endpoint);

			// Handle both paginated and array responses
			if (Array.isArray(response)) {
				// Convert simple array to paginated response
				return {
					content: response,
					totalElements: response.length,
					totalPages: 1,
					size: response.length,
					number: 0,
					first: true,
					last: true,
					sort: { sorted: false, unsorted: true, empty: true },
					numberOfElements: response.length,
					empty: response.length === 0,
				};
			}

			return response as StudentPageResponse;
		} else {
			// No search parameters, use regular endpoint with pagination
			const searchParams = new URLSearchParams({
				page: page.toString(),
				size: size.toString(),
			});

			// Add sort parameters
			if (sortBy) {
				searchParams.append('sort', `${sortBy},${sortDirection}`);
			}

			const endpoint = `${API_CONFIG.ENDPOINTS.STUDENTS}?${searchParams}`;
			const response = await apiRequest<StudentPageResponse | Student[]>(endpoint);

			// Handle both paginated and array responses
			if (Array.isArray(response)) {
				// Convert simple array to paginated response
				return {
					content: response,
					totalElements: response.length,
					totalPages: 1,
					size: response.length,
					number: 0,
					first: true,
					last: true,
					sort: { sorted: false, unsorted: true, empty: true },
					numberOfElements: response.length,
					empty: response.length === 0,
				};
			}

			return response as StudentPageResponse;
		}
	}
}