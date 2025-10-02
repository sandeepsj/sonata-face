// API configuration and base URL
export const API_CONFIG = {
	BASE_URL: 'http://localhost:8080',
	ENDPOINTS: {
		STUDENTS: '/api/students',
		COURSES: '/api/courses',
		FEE_STRUCTURES: '/api/fee-structures',
		REPORTS: '/api/reports',
	},
	DEFAULT_PAGE_SIZE: 10,
} as const;

// Common API error class
export class ApiError extends Error {
	constructor(
		message: string,
		public status?: number,
		public statusText?: string
	) {
		super(message);
		this.name = 'ApiError';
	}
}

// Generic fetch wrapper with error handling
export async function apiRequest<T>(
	endpoint: string,
	options: RequestInit = {}
): Promise<T> {
	const url = `${API_CONFIG.BASE_URL}${endpoint}`;
	
	try {
		const response = await fetch(url, {
			headers: {
				'Content-Type': 'application/json',
				...options.headers,
			},
			...options,
		});

		if (!response.ok) {
			throw new ApiError(
				`HTTP ${response.status}: ${response.statusText}`,
				response.status,
				response.statusText
			);
		}

		return await response.json();
	} catch (error) {
		if (error instanceof ApiError) {
			throw error;
		}
		
		// Network or other errors
		throw new ApiError(
			error instanceof Error ? error.message : 'Unknown API error'
		);
	}
}