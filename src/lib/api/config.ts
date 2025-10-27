// API configuration and base URL
export const API_CONFIG = {
	BASE_URL: 'https://sonata-brain.onrender.com',
	ENDPOINTS: {
		STUDENTS: '/api/students',
		COURSES: '/api/courses',
		FEE_STRUCTURES: '/api/fee-structures',
		STUDENT_SESSIONS: '/api/student-sessions',
		REPORTS: '/api/reports',
		DUES: '/api/dues',
		PAYMENTS: '/api/payments',
		HEARTBEAT: '/heartbeat',
		AUTH: {
			SIGNUP: '/api/users/signup',
			LOGIN: '/api/auth/login',
			REFRESH: '/api/auth/refresh',
		},
	},
	DEFAULT_PAGE_SIZE: 10,
	HEARTBEAT_INTERVAL: 25000, // 25 seconds
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

// Flag to prevent infinite refresh loops
let isRefreshing = false;

// Get access token (will be set by authStore)
let getAccessToken: (() => string | null) | null = null;
let refreshTokenFn: (() => Promise<boolean>) | null = null;

/**
 * Set authentication functions from authStore
 * This avoids circular dependencies
 */
export function setAuthFunctions(
	tokenGetter: () => string | null,
	tokenRefresher: () => Promise<boolean>
) {
	getAccessToken = tokenGetter;
	refreshTokenFn = tokenRefresher;
}

// Generic fetch wrapper with error handling and automatic token injection
export async function apiRequest<T>(
	endpoint: string,
	options: RequestInit = {},
	skipAuth: boolean = false
): Promise<T> {
	const url = `${API_CONFIG.BASE_URL}${endpoint}`;
	
	// Add Authorization header if token is available and not skipped
	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
	};

	// Merge existing headers
	if (options.headers) {
		const existingHeaders = new Headers(options.headers);
		existingHeaders.forEach((value, key) => {
			headers[key] = value;
		});
	}

	if (!skipAuth && getAccessToken) {
		const token = getAccessToken();
		if (token) {
			headers['Authorization'] = `Bearer ${token}`;
		}
	}
	
	try {
		const response = await fetch(url, {
			headers,
			...options,
		});

		// Handle 403 Forbidden - try to refresh token
		if (response.status === 403 && !skipAuth && !isRefreshing && refreshTokenFn) {
			isRefreshing = true;
			console.log('[API] 403 Forbidden - attempting token refresh');
			
			try {
				const refreshed = await refreshTokenFn();
				isRefreshing = false;
				
				if (refreshed) {
					// Retry the original request with new token
					console.log('[API] Token refreshed successfully, retrying request');
					return apiRequest<T>(endpoint, options, skipAuth);
				} else {
					// Refresh failed, redirect will be handled by authStore
					throw new ApiError('Session expired. Please login again.', 403, 'Forbidden');
				}
			} catch (refreshError) {
				isRefreshing = false;
				throw new ApiError('Session expired. Please login again.', 403, 'Forbidden');
			}
		}

		if (!response.ok) {
			// Try to get the error message from response body
			let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
			try {
				const errorBody = await response.json();
				if (errorBody.message) {
					errorMessage = errorBody.message;
				}
			} catch {
				// If parsing JSON fails, use the default message
			}
			
			throw new ApiError(
				errorMessage,
				response.status,
				response.statusText
			);
		}

		// Get raw text first to log it
		const rawText = await response.text();
		console.log('[API] Raw response for', endpoint, ':', rawText.substring(0, 500));
		
		try {
			return JSON.parse(rawText);
		} catch (jsonError) {
			console.error('[API] JSON parse error for', endpoint);
			console.error('[API] Raw response:', rawText);
			throw new ApiError(
				`Invalid JSON response: ${jsonError instanceof Error ? jsonError.message : 'Unknown error'}`
			);
		}
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