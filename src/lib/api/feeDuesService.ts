// Fee dues API service
import { ApiError, apiRequest, API_CONFIG } from './config';
import type { FeeDuesTrackerDTO, FeeDuesResponse, PaymentCreateRequest } from '../types/feeDues';
import type { DuesFilterParams } from '../types/duesAggregate';

export class FeeDuesService {
	/**
	 * Get all dues for a specific student
	 */
	static async getStudentDues(studentId: number): Promise<FeeDuesTrackerDTO[]> {
		if (!studentId) {
			throw new ApiError('Student ID is required');
		}

		try {
			const response = await apiRequest<FeeDuesResponse>(
				`${API_CONFIG.ENDPOINTS.DUES}/student/${studentId}`,
				{
					method: 'GET',
				}
			);

			return response;
		} catch (error) {
			console.error('Error fetching student dues:', error);
			throw error;
		}
	}

	/**
	 * Get pending dues (DUE or PARTIALLY_PAID) with optional filters
	 */
	static async getPendingDues(params: Omit<DuesFilterParams, 'statuses'> = {}): Promise<FeeDuesTrackerDTO[]> {
		const queryParams = new URLSearchParams();
		
		if (params.year !== undefined && params.year !== null) queryParams.append('year', params.year.toString());
		if (params.termNumber !== undefined && params.termNumber !== null) queryParams.append('termNumber', params.termNumber.toString());
		if (params.course) queryParams.append('course', params.course);

		const url = `${API_CONFIG.ENDPOINTS.DUES}/pending${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
		return apiRequest<FeeDuesTrackerDTO[]>(url);
	}

	/**
	 * Get dues with custom status filters
	 */
	static async getDuesWithFilters(params: DuesFilterParams = {}): Promise<FeeDuesTrackerDTO[]> {
		const queryParams = new URLSearchParams();
		
		if (params.statuses) queryParams.append('statuses', params.statuses);
		if (params.year !== undefined && params.year !== null) queryParams.append('year', params.year.toString());
		if (params.termNumber !== undefined && params.termNumber !== null) queryParams.append('termNumber', params.termNumber.toString());
		if (params.course) queryParams.append('course', params.course);

		const url = `${API_CONFIG.ENDPOINTS.DUES}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
		return apiRequest<FeeDuesTrackerDTO[]>(url);
	}

	/**
	 * Create a new payment
	 */
	static async createPayment(paymentRequest: PaymentCreateRequest): Promise<any> {
		// Allow amountPaid to be 0 (in case of 100% discount)
		if (!paymentRequest.studentId || paymentRequest.amountPaid === undefined || paymentRequest.amountPaid === null) {
			throw new ApiError('Student ID and amount are required');
		}

		try {
			const response = await apiRequest(
				API_CONFIG.ENDPOINTS.PAYMENTS,
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify(paymentRequest),
				}
			);

			return response;
		} catch (error) {
			console.error('Error creating payment:', error);
			throw error;
		}
	}

	/**
	 * Get payment history for a student (future implementation)
	 */
	static async getStudentPayments(studentId: number): Promise<any[]> {
		if (!studentId) {
			throw new ApiError('Student ID is required');
		}

		try {
			const response = await apiRequest<any[]>(
				`${API_CONFIG.ENDPOINTS.PAYMENTS}/student/${studentId}`,
				{
					method: 'GET',
				}
			);

			return response;
		} catch (error) {
			console.error('Error fetching student payments:', error);
			throw error;
		}
	}
}