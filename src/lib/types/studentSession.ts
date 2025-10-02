import type { Student } from './student.js';
import type { Course } from './course.js';

/**
 * Student Session represents a period when a student is enrolled in a course
 */
export interface StudentSession {
	id: number;
	student: Student;
	course: Course;
	dateOfJoining: string; // ISO 8601 format
	dateOfDisjoining: string | null; // null means active session
}

/**
 * Request payload for creating a new student session
 */
export interface CreateStudentSessionRequest {
	studentId: number;
	courseName: string;
	dateOfJoining?: string; // Optional, defaults to current time if not provided
	dateOfDisjoining?: string; // Optional, for historical data entry
}

/**
 * Student session search and filter parameters
 */
export interface StudentSessionSearchParams {
	studentId?: number;
	courseName?: string;
	isActive?: boolean; // Filter for active/inactive sessions
	startDate?: string;
	endDate?: string;
}

/**
 * Computed properties for session status
 */
export interface StudentSessionWithStatus extends StudentSession {
	isActive: boolean;
	duration: string; // Human readable duration
}