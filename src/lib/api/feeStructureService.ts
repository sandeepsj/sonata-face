import { apiRequest, API_CONFIG } from './config.js';
import type { FeeStructure, FeeStructureSearchParams } from '../types/course.js';

/**
 * Fee Structure API service - handles all fee structure related API calls
 */
export class FeeStructureService {
	/**
	 * Get all fee structures for a specific year
	 */
	static async getFeeStructuresByYear(year: number): Promise<FeeStructure[]> {
		const endpoint = `${API_CONFIG.ENDPOINTS.FEE_STRUCTURES}/by-year/${year}`;
		return apiRequest<FeeStructure[]>(endpoint);
	}

	/**
	 * Get all fee structures for a specific course across all years
	 */
	static async getFeeStructuresByCourse(courseId: string): Promise<FeeStructure[]> {
		// URL encode the course name to handle spaces
		const encodedCourseId = encodeURIComponent(courseId);
		const endpoint = `${API_CONFIG.ENDPOINTS.FEE_STRUCTURES}/by-course/${encodedCourseId}`;
		return apiRequest<FeeStructure[]>(endpoint);
	}

	/**
	 * Get all term fees for a specific course in a specific year
	 */
	static async getFeeStructuresByCourseAndYear(courseId: string, year: number): Promise<FeeStructure[]> {
		const encodedCourseId = encodeURIComponent(courseId);
		const endpoint = `${API_CONFIG.ENDPOINTS.FEE_STRUCTURES}/by-course/${encodedCourseId}/year/${year}`;
		return apiRequest<FeeStructure[]>(endpoint);
	}

	/**
	 * Get specific fee structure for a course, year, and term combination
	 */
	static async getSpecificFeeStructure(courseId: string, year: number, term: number): Promise<FeeStructure> {
		const encodedCourseId = encodeURIComponent(courseId);
		const endpoint = `${API_CONFIG.ENDPOINTS.FEE_STRUCTURES}/by-course/${encodedCourseId}/year/${year}/term/${term}`;
		return apiRequest<FeeStructure>(endpoint);
	}

	/**
	 * Get unique courses from fee structures data
	 */
	static getUniqueCoursesFromFeeStructures(feeStructures: FeeStructure[]): string[] {
		const uniqueCourses = new Set(feeStructures.map(fs => fs.course.id));
		return Array.from(uniqueCourses).sort();
	}

	/**
	 * Get unique years from fee structures data
	 */
	static getUniqueYearsFromFeeStructures(feeStructures: FeeStructure[]): number[] {
		const uniqueYears = new Set(feeStructures.map(fs => fs.year));
		return Array.from(uniqueYears).sort((a, b) => b - a); // Descending order
	}

	/**
	 * Group fee structures by course
	 */
	static groupFeeStructuresByCourse(feeStructures: FeeStructure[]): Map<string, FeeStructure[]> {
		const grouped = new Map<string, FeeStructure[]>();
		
		feeStructures.forEach(fs => {
			const courseId = fs.course.id;
			if (!grouped.has(courseId)) {
				grouped.set(courseId, []);
			}
			grouped.get(courseId)!.push(fs);
		});
		
		// Sort each group by term
		grouped.forEach(courseFeatures => {
			courseFeatures.sort((a, b) => a.term - b.term);
		});
		
		return grouped;
	}

	/**
	 * Calculate total yearly fee for a course
	 */
	static calculateYearlyFee(termFees: FeeStructure[]): number {
		return termFees.reduce((total, fee) => total + fee.amount, 0);
	}
}