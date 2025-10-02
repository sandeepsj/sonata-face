import { apiRequest, API_CONFIG } from './config.js';
import type { Course } from '../types/course.js';

/**
 * Course API service - handles all course related API calls
 */
export class CourseService {
	/**
	 * Get all courses
	 */
	static async getCourses(): Promise<Course[]> {
		const endpoint = API_CONFIG.ENDPOINTS.COURSES;
		return apiRequest<Course[]>(endpoint);
	}

	/**
	 * Get a specific course by ID
	 */
	static async getCourse(id: string): Promise<Course> {
		const encodedId = encodeURIComponent(id);
		const endpoint = `${API_CONFIG.ENDPOINTS.COURSES}/${encodedId}`;
		return apiRequest<Course>(endpoint);
	}
}