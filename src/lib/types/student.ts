// Student-related types
export interface Student {
	admissionNo?: number;  // Primary admission identifier
	studentName?: string;
	admissionDate?: string;
	contactNo?: string;
	className?: string;
	status?: string;
	school?: string;
	remarks?: string;
	address?: string;
	pinCode?: string;
	dob?: string;
	// Add other student fields as needed
	[key: string]: any; // Allow additional fields
}

// Spring Boot Page response structure
export interface PageResponse<T> {
	content: T[];
	totalElements: number;
	totalPages: number;
	size: number;
	number: number;
	first: boolean;
	last: boolean;
	sort: {
		sorted: boolean;
		unsorted: boolean;
		empty: boolean;
	};
	numberOfElements: number;
	empty: boolean;
}

// Specific type for student page response
export type StudentPageResponse = PageResponse<Student>;

// Search parameters for student API
export interface StudentSearchParams {
	page?: number;
	size?: number;
	search?: string;
	sortBy?: string;
	sortDirection?: 'asc' | 'desc';
}

// Advanced search parameters for student API
export interface StudentAdvancedSearchParams {
	// Individual field searches
	name?: string;
	contactNo?: string;
	admissionNo?: string;
	school?: string;
	className?: string;
	pinCode?: string;
	
	// Date range search
	admissionDate?: string;
	admissionDateFrom?: string;
	admissionDateTo?: string;
	
	// Pagination
	page?: number;
	size?: number;
	sortBy?: string;
	sortDirection?: 'asc' | 'desc';
}