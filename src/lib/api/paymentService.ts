// Payment API service
import { apiRequest } from './config';
import type { Payment, PaymentHistoryResponse } from '$lib/types/payment';

export class PaymentService {
	/**
	 * Get all payment records for a specific student
	 * @param studentId - The student ID
	 * @returns Array of payment records with discounts
	 */
	static async getPaymentsByStudentId(studentId: number): Promise<Payment[]> {
		try {
			const response = await apiRequest<PaymentHistoryResponse>(
				`/api/payments/student/${studentId}`,
				{
					method: 'GET'
				}
			);
			return response || [];
		} catch (error) {
			console.error('Error fetching payment history:', error);
			throw error;
		}
	}

	/**
	 * Get only active payment records for a specific student
	 * @param studentId - The student ID
	 * @returns Array of active payment records
	 */
	static async getActivePaymentsByStudentId(studentId: number): Promise<Payment[]> {
		try {
			const response = await apiRequest<PaymentHistoryResponse>(
				`/api/payments/student/${studentId}/active`,
				{
					method: 'GET'
				}
			);
			return response || [];
		} catch (error) {
			console.error('Error fetching active payment history:', error);
			throw error;
		}
	}
}
