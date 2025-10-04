// Payment API service
import { apiRequest } from './config';
import type { Payment, PaymentHistoryResponse } from '$lib/types/payment';

export interface DateRangeParams {
	startDate: string; // ISO 8601 format
	endDate: string;   // ISO 8601 format
}

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

	/**
	 * Get all active payments in a date range
	 * @param params - Start and end date in ISO format
	 * @returns Array of active payment records
	 */
	static async getPaymentsByDateRange(params: DateRangeParams): Promise<Payment[]> {
		try {
			const queryParams = new URLSearchParams({
				startDate: params.startDate,
				endDate: params.endDate
			});
			const response = await apiRequest<Payment[]>(
				`/api/payments/date-range?${queryParams}`,
				{
					method: 'GET'
				}
			);
			return response || [];
		} catch (error) {
			console.error('Error fetching payments by date range:', error);
			throw error;
		}
	}

	/**
	 * Get payments by course name in a date range
	 * @param courseName - The course name (e.g., VOCAL, PIANO, GUITAR)
	 * @param params - Start and end date
	 * @returns Array of active payment records for the course
	 */
	static async getPaymentsByCourse(courseName: string, params: DateRangeParams): Promise<Payment[]> {
		try {
			const queryParams = new URLSearchParams({
				startDate: params.startDate,
				endDate: params.endDate
			});
			const response = await apiRequest<Payment[]>(
				`/api/payments/date-range/course/${courseName}?${queryParams}`,
				{
					method: 'GET'
				}
			);
			return response || [];
		} catch (error) {
			console.error('Error fetching payments by course:', error);
			throw error;
		}
	}

	/**
	 * Get payments by payment type in a date range
	 * @param paymentType - REGULAR or ADDITIONAL
	 * @param params - Start and end date
	 * @returns Array of active payment records for the type
	 */
	static async getPaymentsByType(paymentType: string, params: DateRangeParams): Promise<Payment[]> {
		try {
			const queryParams = new URLSearchParams({
				startDate: params.startDate,
				endDate: params.endDate
			});
			const response = await apiRequest<Payment[]>(
				`/api/payments/date-range/type/${paymentType}?${queryParams}`,
				{
					method: 'GET'
				}
			);
			return response || [];
		} catch (error) {
			console.error('Error fetching payments by type:', error);
			throw error;
		}
	}

	/**
	 * Get payments by term (fee structure ID) in a date range
	 * @param termId - The fee structure/term ID
	 * @param params - Start and end date
	 * @returns Array of active payment records for the term
	 */
	static async getPaymentsByTerm(termId: number, params: DateRangeParams): Promise<Payment[]> {
		try {
			const queryParams = new URLSearchParams({
				startDate: params.startDate,
				endDate: params.endDate
			});
			const response = await apiRequest<Payment[]>(
				`/api/payments/date-range/term/${termId}?${queryParams}`,
				{
					method: 'GET'
				}
			);
			return response || [];
		} catch (error) {
			console.error('Error fetching payments by term:', error);
			throw error;
		}
	}

	/**
	 * Get student payments in a date range
	 * @param studentId - The student ID
	 * @param params - Start and end date
	 * @returns Array of active payment records for the student
	 */
	static async getStudentPaymentsByDateRange(studentId: number, params: DateRangeParams): Promise<Payment[]> {
		try {
			const queryParams = new URLSearchParams({
				startDate: params.startDate,
				endDate: params.endDate
			});
			const response = await apiRequest<Payment[]>(
				`/api/payments/student/${studentId}/date-range?${queryParams}`,
				{
					method: 'GET'
				}
			);
			return response || [];
		} catch (error) {
			console.error('Error fetching student payments by date range:', error);
			throw error;
		}
	}

	/**
	 * Deactivate a payment record
	 * @param paymentId - The payment ID to deactivate
	 * @returns The deactivated payment record
	 */
	static async deactivatePayment(paymentId: number): Promise<Payment> {
		try {
			const response = await apiRequest<Payment>(
				`/api/payments/${paymentId}/deactivate`,
				{
					method: 'PATCH'
				}
			);
			return response;
		} catch (error) {
			console.error('Error deactivating payment:', error);
			throw error;
		}
	}
}
