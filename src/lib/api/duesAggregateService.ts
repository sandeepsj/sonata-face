import { apiRequest } from './config';
import type {
	DuesAggregateResponse,
	CourseAggregate,
	YearAggregate,
	TermAggregate,
	DuesFilterParams
} from '$lib/types/duesAggregate';

export class DuesAggregateService {
	/**
	 * Get simple aggregate with filters
	 */
	static async getAggregate(params: DuesFilterParams = {}): Promise<DuesAggregateResponse> {
		const queryParams = new URLSearchParams();
		
		if (params.statuses) queryParams.append('statuses', params.statuses);
		if (params.year !== undefined && params.year !== null) queryParams.append('year', params.year.toString());
		if (params.termNumber !== undefined && params.termNumber !== null) queryParams.append('termNumber', params.termNumber.toString());
		if (params.course) queryParams.append('course', params.course);

		const url = `/api/dues/aggregate${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
		return apiRequest<DuesAggregateResponse>(url);
	}

	/**
	 * Get pending dues aggregate (convenience API)
	 */
	static async getPendingAggregate(params: Omit<DuesFilterParams, 'statuses'> = {}): Promise<DuesAggregateResponse> {
		const queryParams = new URLSearchParams();
		
		if (params.year !== undefined && params.year !== null) queryParams.append('year', params.year.toString());
		if (params.termNumber !== undefined && params.termNumber !== null) queryParams.append('termNumber', params.termNumber.toString());
		if (params.course) queryParams.append('course', params.course);

		const url = `/api/dues/aggregate/pending${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
		return apiRequest<DuesAggregateResponse>(url);
	}

	/**
	 * Get aggregates grouped by course
	 */
	static async getAggregateByCourse(params: Omit<DuesFilterParams, 'course'> = {}): Promise<CourseAggregate[]> {
		const queryParams = new URLSearchParams();
		
		if (params.statuses) queryParams.append('statuses', params.statuses);
		if (params.year !== undefined && params.year !== null) queryParams.append('year', params.year.toString());
		if (params.termNumber !== undefined && params.termNumber !== null) queryParams.append('termNumber', params.termNumber.toString());

		const url = `/api/dues/aggregate/by-course${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
		return apiRequest<CourseAggregate[]>(url);
	}

	/**
	 * Get aggregates grouped by year
	 */
	static async getAggregateByYear(params: Omit<DuesFilterParams, 'year'> = {}): Promise<YearAggregate[]> {
		const queryParams = new URLSearchParams();
		
		if (params.statuses) queryParams.append('statuses', params.statuses);
		if (params.course) queryParams.append('course', params.course);
		if (params.termNumber !== undefined && params.termNumber !== null) queryParams.append('termNumber', params.termNumber.toString());

		const url = `/api/dues/aggregate/by-year${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
		return apiRequest<YearAggregate[]>(url);
	}

	/**
	 * Get aggregates grouped by term (year + term number)
	 */
	static async getAggregateByTerm(params: Omit<DuesFilterParams, 'year' | 'termNumber'> = {}): Promise<TermAggregate[]> {
		const queryParams = new URLSearchParams();
		
		if (params.statuses) queryParams.append('statuses', params.statuses);
		if (params.course) queryParams.append('course', params.course);

		const url = `/api/dues/aggregate/by-term${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
		return apiRequest<TermAggregate[]>(url);
	}
}
