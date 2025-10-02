import { apiRequest, API_CONFIG } from './config.js';
import type { 
	StudentSession, 
	CreateStudentSessionRequest, 
	StudentSessionSearchParams 
} from '../types/studentSession.js';

/**
 * Student Session API service - handles all student session related API calls
 */
export class StudentSessionService {
	/**
	 * Create a new student session (enroll student in course)
	 */
	static async createSession(request: CreateStudentSessionRequest): Promise<StudentSession> {
		const endpoint = `${API_CONFIG.ENDPOINTS.STUDENT_SESSIONS}`;
		return apiRequest<StudentSession>(endpoint, {
			method: 'POST',
			body: JSON.stringify(request)
		});
	}

	/**
	 * Get a specific session by ID
	 */
	static async getSession(sessionId: number): Promise<StudentSession> {
		const endpoint = `${API_CONFIG.ENDPOINTS.STUDENT_SESSIONS}/${sessionId}`;
		return apiRequest<StudentSession>(endpoint);
	}

	/**
	 * Get all sessions (active and inactive) for a specific student
	 */
	static async getAllSessionsByStudent(studentId: number): Promise<StudentSession[]> {
		try {
			const endpoint = `${API_CONFIG.ENDPOINTS.STUDENT_SESSIONS}/all/student/${studentId}`;
			return await apiRequest<StudentSession[]>(endpoint);
		} catch (error) {
			// Handle the specific "no sessions found" case - the /all endpoint returns empty array instead of 404
			if (error instanceof Error && (
				error.message.includes('No sessions found') || 
				error.message.includes('Student not found')
			)) {
				return []; // Return empty array instead of throwing error
			}
			throw error; // Re-throw other errors
		}
	}

	/**
	 * Get all active sessions for a specific student
	 */
	static async getActiveSessionsByStudent(studentId: number): Promise<StudentSession[]> {
		try {
			const endpoint = `${API_CONFIG.ENDPOINTS.STUDENT_SESSIONS}/all?studentId=${studentId}&active=true`;
			return await apiRequest<StudentSession[]>(endpoint);
		} catch (error) {
			// Handle the specific "no sessions found" case
			if (error instanceof Error && (
				error.message.includes('No sessions found') || 
				error.message.includes('Student not found')
			)) {
				return []; // Return empty array instead of throwing error
			}
			throw error; // Re-throw other errors
		}
	}

	/**
	 * Get all inactive sessions for a specific student
	 */
	static async getInactiveSessionsByStudent(studentId: number): Promise<StudentSession[]> {
		try {
			const endpoint = `${API_CONFIG.ENDPOINTS.STUDENT_SESSIONS}/all?studentId=${studentId}&active=false`;
			return await apiRequest<StudentSession[]>(endpoint);
		} catch (error) {
			// Handle the specific "no sessions found" case
			if (error instanceof Error && (
				error.message.includes('No sessions found') || 
				error.message.includes('Student not found')
			)) {
				return []; // Return empty array instead of throwing error
			}
			throw error; // Re-throw other errors
		}
	}

	/**
	 * Get all active sessions for a specific course
	 */
	static async getActiveSessionsByCourse(courseName: string): Promise<StudentSession[]> {
		const encodedCourseName = encodeURIComponent(courseName);
		const endpoint = `${API_CONFIG.ENDPOINTS.STUDENT_SESSIONS}/all?courseName=${encodedCourseName}&active=true`;
		return apiRequest<StudentSession[]>(endpoint);
	}

	/**
	 * Get all sessions (active and inactive) for a specific course
	 */
	static async getAllSessionsByCourse(courseName: string): Promise<StudentSession[]> {
		const encodedCourseName = encodeURIComponent(courseName);
		const endpoint = `${API_CONFIG.ENDPOINTS.STUDENT_SESSIONS}/all/course/${encodedCourseName}`;
		return apiRequest<StudentSession[]>(endpoint);
	}

	/**
	 * Get all inactive sessions for a specific course (completed/dropped students)
	 */
	static async getInactiveSessionsByCourse(courseName: string): Promise<StudentSession[]> {
		const encodedCourseName = encodeURIComponent(courseName);
		const endpoint = `${API_CONFIG.ENDPOINTS.STUDENT_SESSIONS}/all?courseName=${encodedCourseName}&active=false`;
		return apiRequest<StudentSession[]>(endpoint);
	}

	/**
	 * Get all active sessions system-wide
	 */
	static async getAllActiveSessions(): Promise<StudentSession[]> {
		const endpoint = `${API_CONFIG.ENDPOINTS.STUDENT_SESSIONS}/all?active=true`;
		return apiRequest<StudentSession[]>(endpoint);
	}

	/**
	 * Get all inactive sessions system-wide
	 */
	static async getAllInactiveSessions(): Promise<StudentSession[]> {
		const endpoint = `${API_CONFIG.ENDPOINTS.STUDENT_SESSIONS}/all?active=false`;
		return apiRequest<StudentSession[]>(endpoint);
	}

	/**
	 * Mark a session as disjoined (student leaves course)
	 */
	static async disjoinSession(sessionId: number): Promise<StudentSession> {
		const endpoint = `${API_CONFIG.ENDPOINTS.STUDENT_SESSIONS}/${sessionId}/disjoin`;
		return apiRequest<StudentSession>(endpoint, {
			method: 'PATCH'
		});
	}

	/**
	 * Check if a session is active (no disjoin date)
	 */
	static isSessionActive(session: StudentSession): boolean {
		return session.dateOfDisjoining === null;
	}

	/**
	 * Calculate session duration in human readable format
	 */
	static calculateSessionDuration(session: StudentSession): string {
		const startDate = new Date(session.dateOfJoining);
		const endDate = session.dateOfDisjoining ? new Date(session.dateOfDisjoining) : new Date();
		
		const diffInMs = endDate.getTime() - startDate.getTime();
		const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
		
		if (diffInDays < 30) {
			return `${diffInDays} day${diffInDays !== 1 ? 's' : ''}`;
		} else if (diffInDays < 365) {
			const months = Math.floor(diffInDays / 30);
			return `${months} month${months !== 1 ? 's' : ''}`;
		} else {
			const years = Math.floor(diffInDays / 365);
			const remainingMonths = Math.floor((diffInDays % 365) / 30);
			let result = `${years} year${years !== 1 ? 's' : ''}`;
			if (remainingMonths > 0) {
				result += `, ${remainingMonths} month${remainingMonths !== 1 ? 's' : ''}`;
			}
			return result;
		}
	}

	/**
	 * Format date for display
	 */
	static formatDate(dateString: string): string {
		const date = new Date(dateString);
		return date.toLocaleDateString('en-IN', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}

	/**
	 * Group sessions by status (active/inactive)
	 */
	static groupSessionsByStatus(sessions: StudentSession[]): {
		active: StudentSession[];
		inactive: StudentSession[];
	} {
		const active: StudentSession[] = [];
		const inactive: StudentSession[] = [];

		sessions.forEach(session => {
			if (this.isSessionActive(session)) {
				active.push(session);
			} else {
				inactive.push(session);
			}
		});

		// Sort by date - newest first
		active.sort((a, b) => new Date(b.dateOfJoining).getTime() - new Date(a.dateOfJoining).getTime());
		inactive.sort((a, b) => {
			const aEndDate = a.dateOfDisjoining ? new Date(a.dateOfDisjoining) : new Date(0);
			const bEndDate = b.dateOfDisjoining ? new Date(b.dateOfDisjoining) : new Date(0);
			return bEndDate.getTime() - aEndDate.getTime();
		});

		return { active, inactive };
	}
}