// Fee dues API service
import { ApiError, apiRequest, API_CONFIG } from './config';
import type { FeeDuesTrackerDTO, FeeDuesResponse, PaymentCreateRequest } from '../types/feeDues';

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
	 * Create a new payment
	 */
	static async createPayment(paymentRequest: PaymentCreateRequest): Promise<any> {
		if (!paymentRequest.studentId || !paymentRequest.amountPaid) {
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