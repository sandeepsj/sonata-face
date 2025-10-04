<script lang="ts">
	import { onMount } from 'svelte';
	import { currentStudentStore } from '$lib/stores/currentStudentStore';
	import { PaymentService } from '$lib/api/paymentService';
	import type { Student, Payment } from '$lib';
	import { Trash2, AlertTriangle } from 'lucide-svelte';

	export let student: Student;

	let loading = false;
	let error: string | null = null;
	let showConfirmDialog = false;
	let selectedPayment: Payment | null = null;
	let deactivating = false;

	$: currentStudent = student || $currentStudentStore.student;
	$: studentId = currentStudent?.admissionNo;
	$: activePayments = $currentStudentStore.payments.data.filter((p) => p.isActive);
	$: dues = $currentStudentStore.dues.data;

	onMount(async () => {
		if (studentId) {
			// Fetch both payments and dues to enable enrichment
			await Promise.all([
				currentStudentStore.fetchPayments(studentId, true),
				currentStudentStore.fetchDues(studentId, true)
			]);
		}
	});

	function openConfirmDialog(payment: Payment) {
		selectedPayment = payment;
		showConfirmDialog = true;
	}

	function closeConfirmDialog() {
		showConfirmDialog = false;
		selectedPayment = null;
	}

	async function handleDeactivatePayment() {
		if (!selectedPayment || !studentId) {
			console.error('Missing selectedPayment or studentId', { selectedPayment, studentId });
			return;
		}

		console.log('Deactivating payment:', selectedPayment.id);
		deactivating = true;
		error = null;

		try {
			console.log('Calling PaymentService.deactivatePayment...');
			const result = await PaymentService.deactivatePayment(selectedPayment.id);
			console.log('Payment deactivated successfully:', result);
			
			// Refresh both payments and dues
			console.log('Refreshing payments and dues...');
			await Promise.all([
				currentStudentStore.fetchPayments(studentId, true),
				currentStudentStore.fetchDues(studentId, true)
			]);
			console.log('Data refreshed successfully');

			closeConfirmDialog();
		} catch (err) {
			console.error('Failed to deactivate payment:', err);
			error = err instanceof Error ? err.message : 'Failed to deactivate payment';
		} finally {
			deactivating = false;
		}
	}

	function getPaymentDetails(payment: Payment) {
		// Try to find matching due for term/year/course info
		if (payment.feeStructure) {
			const matchingDue = dues.find(due => 
				due.feeStructureId === payment.feeStructure?.id
			);
			
			if (matchingDue) {
				return {
					termYear: matchingDue.termYear,
					termNumber: matchingDue.termNumber,
					courseName: matchingDue.courseName || payment.courseName
				};
			}
		}

		// Fallback to payment's own data
		return {
			termYear: null,
			termNumber: null,
			courseName: payment.courseName
		};
	}

	function formatDate(dateString: string): string {
		return new Date(dateString).toLocaleDateString('en-IN', {
			day: '2-digit',
			month: 'short',
			year: 'numeric'
		});
	}

	function formatCurrency(amount: number): string {
		return new Intl.NumberFormat('en-IN', {
			style: 'currency',
			currency: 'INR',
			minimumFractionDigits: 0,
			maximumFractionDigits: 0
		}).format(amount);
	}

	function getPaymentTypeLabel(type: string): string {
		const labels: Record<string, string> = {
			REGULAR: 'Regular',
			ADDITIONAL: 'Additional',
			OTHER: 'Other'
		};
		return labels[type] || type;
	}

	function getPaymentTypeBadge(type: string): string {
		const badges: Record<string, string> = {
			REGULAR: 'badge-primary',
			ADDITIONAL: 'badge-secondary',
			OTHER: 'badge-accent'
		};
		return badges[type] || 'badge-neutral';
	}
</script>

<div class="container mx-auto p-6 max-w-6xl">
	<!-- Header -->
	<div class="mb-6">
		<h1 class="text-3xl font-bold mb-2">Manage Payments</h1>
		<p class="text-base-content/70">
			Deactivate payment records that were created in error. This action cannot be undone.
		</p>
	</div>

	<!-- Warning Alert -->
	<div class="alert alert-warning mb-6">
		<AlertTriangle class="h-5 w-5" />
		<div>
			<h3 class="font-bold">Warning</h3>
			<div class="text-sm">
				Deactivating a payment is permanent and cannot be undone. It will also trigger dues
				recalculation for regular payments.
			</div>
		</div>
	</div>

	<!-- Error Alert -->
	{#if error}
		<div class="alert alert-error mb-6">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="h-6 w-6 shrink-0 stroke-current"
				fill="none"
				viewBox="0 0 24 24"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
				/>
			</svg>
			<span>{error}</span>
		</div>
	{/if}

	<!-- Loading State -->
	{#if $currentStudentStore.payments.loading}
		<div class="flex justify-center items-center py-12">
			<span class="loading loading-spinner loading-lg"></span>
		</div>
	{:else if activePayments.length === 0}
		<!-- Empty State -->
		<div class="card bg-base-100 shadow-xl">
			<div class="card-body items-center text-center py-12">
				<div class="text-base-content/40 mb-4">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-24 w-24"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
				</div>
				<h3 class="text-xl font-bold mb-2">No Active Payments</h3>
				<p class="text-base-content/70">
					There are no active payment records for this student.
				</p>
			</div>
		</div>
	{:else}
		<!-- Active Payments Table -->
		<div class="card bg-base-100 shadow-xl">
			<div class="card-body">
				<h2 class="card-title mb-4">Active Payments ({activePayments.length})</h2>
				
				<div class="overflow-x-auto">
					<table class="table table-zebra">
						<thead>
							<tr>
								<th>Date</th>
								<th>Label</th>
								<th>Type</th>
								<th>Course</th>
								<th>Year / Term</th>
								<th class="text-right">Amount Paid</th>
								<th class="text-right">Discount</th>
								<th class="text-right">Total</th>
								<th class="text-center">Action</th>
							</tr>
						</thead>
						<tbody>
							{#each activePayments as payment}
								{@const details = getPaymentDetails(payment)}
								<tr>
									<td>
										<div class="font-medium">{formatDate(payment.date)}</div>
										<div class="text-xs text-base-content/70">
											{new Date(payment.date).toLocaleTimeString('en-IN', {
												hour: '2-digit',
												minute: '2-digit'
											})}
										</div>
									</td>
									<td>
										<div class="font-medium">{payment.label || 'N/A'}</div>
									</td>
									<td>
										<span class="badge {getPaymentTypeBadge(payment.paymentType)}">
											{getPaymentTypeLabel(payment.paymentType)}
										</span>
									</td>
									<td>
										<div class="font-medium">{details.courseName || 'N/A'}</div>
									</td>
									<td>
										{#if details.termYear && details.termNumber}
											<div class="font-medium">Year {details.termYear}</div>
											<div class="text-xs text-base-content/70">Term {details.termNumber}</div>
										{:else if payment.feeStructure?.termName}
											<div class="font-medium">{payment.feeStructure.termName}</div>
										{:else}
											<div class="text-base-content/70">N/A</div>
										{/if}
									</td>
									<td class="text-right font-mono">
										{formatCurrency(payment.amountPaid)}
									</td>
									<td class="text-right font-mono">
										{formatCurrency(payment.discountAmount || 0)}
									</td>
									<td class="text-right font-mono font-bold">
										{formatCurrency(payment.amountPaid + (payment.discountAmount || 0))}
									</td>
									<td class="text-center">
										<button
											class="btn btn-sm btn-error btn-outline"
											on:click={() => openConfirmDialog(payment)}
											disabled={deactivating}
										>
											<Trash2 class="h-4 w-4" />
											Deactivate
										</button>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	{/if}
</div>

<!-- Confirmation Dialog -->
{#if showConfirmDialog && selectedPayment}
	{@const details = getPaymentDetails(selectedPayment)}
	<dialog class="modal modal-open">
		<div class="modal-box">
			<h3 class="font-bold text-lg mb-4">Confirm Payment Deactivation</h3>
			
			<div class="alert alert-warning mb-4">
				<AlertTriangle class="h-5 w-5" />
				<span>This action cannot be undone!</span>
			</div>

			<div class="space-y-2 mb-6">
				<div class="flex justify-between">
					<span class="text-base-content/70">Date:</span>
					<span class="font-medium">{formatDate(selectedPayment.date)}</span>
				</div>
				<div class="flex justify-between">
					<span class="text-base-content/70">Label:</span>
					<span class="font-medium">{selectedPayment.label || 'N/A'}</span>
				</div>
				<div class="flex justify-between">
					<span class="text-base-content/70">Type:</span>
					<span class="badge {getPaymentTypeBadge(selectedPayment.paymentType)}">
						{getPaymentTypeLabel(selectedPayment.paymentType)}
					</span>
				</div>
				<div class="flex justify-between">
					<span class="text-base-content/70">Course:</span>
					<span class="font-medium">{details.courseName || 'N/A'}</span>
				</div>
				{#if details.termYear && details.termNumber}
					<div class="flex justify-between">
						<span class="text-base-content/70">Year:</span>
						<span class="font-medium">Year {details.termYear}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-base-content/70">Term:</span>
						<span class="font-medium">Term {details.termNumber}</span>
					</div>
				{:else if selectedPayment.feeStructure?.termName}
					<div class="flex justify-between">
						<span class="text-base-content/70">Term:</span>
						<span class="font-medium">{selectedPayment.feeStructure.termName}</span>
					</div>
				{/if}
				<div class="flex justify-between">
					<span class="text-base-content/70">Amount Paid:</span>
					<span class="font-mono font-bold">{formatCurrency(selectedPayment.amountPaid)}</span>
				</div>
				{#if selectedPayment.discountAmount > 0}
					<div class="flex justify-between">
						<span class="text-base-content/70">Discount:</span>
						<span class="font-mono">{formatCurrency(selectedPayment.discountAmount)}</span>
					</div>
				{/if}
			</div>

			<p class="text-sm text-base-content/70 mb-6">
				Are you sure you want to deactivate this payment? 
				{#if selectedPayment.paymentType === 'REGULAR'}
					This will also trigger dues recalculation.
				{/if}
			</p>

			<div class="modal-action">
				<button 
					type="button"
					class="btn btn-ghost" 
					on:click={closeConfirmDialog} 
					disabled={deactivating}
				>
					Cancel
				</button>
				<button
					type="button"
					class="btn btn-error"
					on:click={handleDeactivatePayment}
					disabled={deactivating}
				>
					{#if deactivating}
						<span class="loading loading-spinner loading-sm"></span>
						Deactivating...
					{:else}
						<Trash2 class="h-4 w-4" />
						Deactivate Payment
					{/if}
				</button>
			</div>
		</div>
		<form method="dialog" class="modal-backdrop">
			<button type="button" on:click={closeConfirmDialog}>close</button>
		</form>
	</dialog>
{/if}
