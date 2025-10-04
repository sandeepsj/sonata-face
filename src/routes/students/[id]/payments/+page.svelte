<script lang="ts">
	import { onMount } from 'svelte';
	import type { Payment, Student } from '$lib';
	import { currentStudentStore, calculateAmountCleared, formatPaymentType } from '$lib';
	import { 
		Loader2, 
		AlertCircle, 
		Receipt, 
		Calendar, 
		DollarSign, 
		ChevronDown, 
		ChevronRight,
		Tag,
		FileText,
		TrendingUp
	} from 'lucide-svelte';

	// Receive student from layout slot prop (optional, might be null initially)
	export let student: Student | undefined = undefined;

	// Subscribe to store for all data
	$: currentStudentState = $currentStudentStore;
	$: currentStudent = student || currentStudentState.student; // Use prop first, fallback to store
	$: payments = currentStudentState.payments.data;
	$: loading = currentStudentState.payments.loading;
	$: error = currentStudentState.payments.error;
	$: dues = currentStudentState.dues.data;

	// State
	let expandedPaymentIds = new Set<number>();

	// Filter states
	let showInactive = false;
	let selectedPaymentType: string = 'ALL';

	// Reactive filtered payments
	$: filteredPayments = payments.filter(payment => {
		// Filter by active status
		if (!showInactive && !payment.isActive) return false;
		
		// Filter by payment type
		if (selectedPaymentType !== 'ALL' && payment.paymentType !== selectedPaymentType) {
			return false;
		}
		
		return true;
	});

	// Statistics
	$: totalPayments = filteredPayments.length;
	$: totalAmountPaid = filteredPayments.reduce((sum, p) => sum + p.amountPaid, 0);
	$: totalDiscounts = filteredPayments.reduce((sum, p) => sum + (p.discountAmount || 0), 0);
	$: totalAmountCleared = filteredPayments.reduce((sum, p) => sum + calculateAmountCleared(p), 0);

	onMount(async () => {
		// Get student from prop or store
		const studentData = currentStudent;
		
		if (!studentData || !studentData.admissionNo) {
			console.error('Student data not available - prop:', student, 'store:', currentStudentState.student);
			return;
		}

		console.log('Fetching payment history for student:', studentData.admissionNo, studentData.studentName);

		// Always force refresh dues on page entry
		console.log('Fetching dues for enrichment...');
		await currentStudentStore.fetchDues(studentData.admissionNo, true);
		
		// Always force refresh payments on page entry
		console.log('Fetching payments...');
		await currentStudentStore.fetchPayments(studentData.admissionNo, true);
		console.log('Payments fetched:', $currentStudentStore.payments.data.length);
	});

	async function fetchPaymentHistory() {
		const student = $currentStudentStore.student;
		if (student && student.admissionNo) {
			await currentStudentStore.fetchPayments(student.admissionNo, true);
		}
	}

	function togglePaymentExpansion(paymentId: number) {
		if (expandedPaymentIds.has(paymentId)) {
			expandedPaymentIds.delete(paymentId);
		} else {
			expandedPaymentIds.add(paymentId);
		}
		expandedPaymentIds = expandedPaymentIds; // Trigger reactivity
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

	function formatDate(dateStr: string): string {
		const date = new Date(dateStr);
		return date.toLocaleDateString('en-IN', { 
			day: '2-digit', 
			month: 'short', 
			year: 'numeric' 
		});
	}

	function formatDateTime(dateStr: string): string {
		const date = new Date(dateStr);
		return date.toLocaleString('en-IN', { 
			day: '2-digit', 
			month: 'short', 
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function formatCurrency(amount: number): string {
		return new Intl.NumberFormat('en-IN', {
			style: 'currency',
			currency: 'INR',
			minimumFractionDigits: 2
		}).format(amount);
	}

	function getPaymentTypeStyle(type: string): string {
		switch (type) {
			case 'REGULAR':
				return 'badge-primary';
			case 'ADDITIONAL':
				return 'badge-secondary';
			case 'OTHER':
				return 'badge-accent';
			default:
				return 'badge-ghost';
		}
	}
</script>

<div class="container mx-auto p-6 space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold flex items-center gap-3">
				<Receipt class="w-8 h-8 text-primary" />
				Payment History
			</h1>
			{#if currentStudent}
				<p class="text-base-content/70 mt-2">
					Complete payment records for {currentStudent.studentName}
				</p>
			{/if}
		</div>
	</div>

	<!-- Statistics Cards -->
	<div class="grid grid-cols-1 md:grid-cols-4 gap-4">
		<div class="card bg-primary text-primary-content shadow-md">
			<div class="card-body">
				<div class="flex items-center justify-between">
					<div>
						<p class="text-primary-content/70 text-sm">Total Payments</p>
						<p class="text-3xl font-bold">{totalPayments}</p>
					</div>
					<Receipt class="w-10 h-10 opacity-70" />
				</div>
			</div>
		</div>

		<div class="card bg-success text-success-content shadow-md">
			<div class="card-body">
				<div class="flex items-center justify-between">
					<div>
						<p class="text-success-content/70 text-sm">Amount Paid</p>
						<p class="text-2xl font-bold">{formatCurrency(totalAmountPaid)}</p>
					</div>
					<DollarSign class="w-10 h-10 opacity-70" />
				</div>
			</div>
		</div>

		<div class="card bg-warning text-warning-content shadow-md">
			<div class="card-body">
				<div class="flex items-center justify-between">
					<div>
						<p class="text-warning-content/70 text-sm">Total Discounts</p>
						<p class="text-2xl font-bold">{formatCurrency(totalDiscounts)}</p>
					</div>
					<Tag class="w-10 h-10 opacity-70" />
				</div>
			</div>
		</div>

		<div class="card bg-info text-info-content shadow-md">
			<div class="card-body">
				<div class="flex items-center justify-between">
					<div>
						<p class="text-info-content/70 text-sm">Amount Cleared</p>
						<p class="text-2xl font-bold">{formatCurrency(totalAmountCleared)}</p>
					</div>
					<TrendingUp class="w-10 h-10 opacity-70" />
				</div>
			</div>
		</div>
	</div>

	<!-- Filters -->
	<div class="card bg-base-100 shadow-sm">
		<div class="card-body">
			<div class="flex flex-wrap gap-4 items-center">
				<div class="form-control">
					<label class="label cursor-pointer gap-2">
						<input 
							type="checkbox" 
							class="checkbox checkbox-primary" 
							bind:checked={showInactive}
						/>
						<span class="label-text">Show Inactive Payments</span>
					</label>
				</div>

				<div class="form-control">
					<label class="label" for="payment-type-filter">
						<span class="label-text font-semibold">Payment Type</span>
					</label>
					<select 
						id="payment-type-filter"
						class="select select-bordered select-sm" 
						bind:value={selectedPaymentType}
					>
						<option value="ALL">All Types</option>
						<option value="REGULAR">Term Payments</option>
						<option value="ADDITIONAL">Additional Payments</option>
						<option value="OTHER">Other Payments</option>
					</select>
				</div>
			</div>
		</div>
	</div>

	<!-- Loading State -->
	{#if loading}
		<div class="flex items-center justify-center py-12">
			<Loader2 class="w-8 h-8 animate-spin text-primary" />
			<span class="ml-3 text-lg">Loading payment history...</span>
		</div>
	{/if}

	<!-- Error State -->
	{#if error}
		<div class="alert alert-error shadow-lg">
			<AlertCircle class="w-6 h-6" />
			<div>
				<h3 class="font-bold">Error Loading Payment History</h3>
				<div class="text-sm">{error}</div>
			</div>
			<button class="btn btn-sm btn-ghost" on:click={fetchPaymentHistory}>
				Retry
			</button>
		</div>
	{/if}

	<!-- Payments List -->
	{#if !loading && !error}
		{#if filteredPayments.length === 0}
			<div class="card bg-base-100 shadow-sm">
				<div class="card-body items-center text-center py-12">
					<Receipt class="w-16 h-16 text-base-content/30 mb-4" />
					<h3 class="text-xl font-semibold text-base-content/70">No Payment Records</h3>
					<p class="text-base-content/50">
						{showInactive 
							? 'No payments found matching the selected filters.' 
							: 'No active payments found. Try including inactive payments.'}
					</p>
				</div>
			</div>
		{:else}
			<div class="space-y-4">
				{#each filteredPayments as payment (payment.id)}
					{@const isExpanded = expandedPaymentIds.has(payment.id)}
					{@const amountCleared = calculateAmountCleared(payment)}
					{@const totalDiscount = payment.discountAmount || 0}
					{@const hasDiscounts = payment.discounts && payment.discounts.length > 0}
					{@const paymentDetails = getPaymentDetails(payment)}

					<div class="card bg-base-100 shadow-md border-l-4 {payment.isActive ? 'border-l-success' : 'border-l-base-300'}">
						<div class="card-body">
							<!-- Payment Header -->
							<div class="flex flex-wrap items-start justify-between gap-4">
								<div class="flex-1 min-w-0">
									<div class="flex items-center gap-3 mb-2">
										<h3 class="text-lg font-bold truncate">
											{payment.label || `Payment #${payment.id}`}
										</h3>
										<div class="badge {getPaymentTypeStyle(payment.paymentType)}">
											{formatPaymentType(payment.paymentType)}
										</div>
										{#if !payment.isActive}
											<div class="badge badge-ghost">Inactive</div>
										{/if}
									</div>
									
									{#if paymentDetails.courseName}
										<p class="text-sm text-base-content/70 mb-1">
											<span class="font-semibold">Course:</span> {paymentDetails.courseName}
										</p>
									{/if}
									
									{#if paymentDetails.termYear && paymentDetails.termNumber}
										<p class="text-sm text-base-content/70">
											<span class="font-semibold">Term:</span> Year {paymentDetails.termYear}, Term {paymentDetails.termNumber}
										</p>
									{:else if payment.feeStructure}
										<p class="text-sm text-base-content/70">
											<span class="font-semibold">Term:</span> {payment.feeStructure.termName}
										</p>
									{/if}
								</div>

								<div class="text-right">
									<div class="flex items-center gap-2 text-sm text-base-content/70 mb-1">
										<Calendar class="w-4 h-4" />
										<span>{formatDate(payment.date)}</span>
									</div>
									<div class="text-xs text-base-content/50">
										Created: {formatDateTime(payment.createdAt)}
									</div>
								</div>
							</div>

							<!-- Payment Amounts -->
							<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
								<div class="bg-success/10 rounded-lg p-3">
									<p class="text-xs text-base-content/70 mb-1">Amount Paid</p>
									<p class="text-xl font-bold text-success">
										{formatCurrency(payment.amountPaid)}
									</p>
								</div>

								{#if totalDiscount > 0}
									<div class="bg-warning/10 rounded-lg p-3">
										<p class="text-xs text-base-content/70 mb-1">Total Discount</p>
										<p class="text-xl font-bold text-warning">
											{formatCurrency(totalDiscount)}
										</p>
									</div>
								{/if}

								<div class="bg-info/10 rounded-lg p-3">
									<p class="text-xs text-base-content/70 mb-1">Amount Cleared</p>
									<p class="text-xl font-bold text-info">
										{formatCurrency(amountCleared)}
									</p>
								</div>
							</div>

							<!-- Remarks -->
							{#if payment.remarks}
								<div class="mt-3 flex items-start gap-2">
									<FileText class="w-4 h-4 mt-1 text-base-content/50" />
									<div class="flex-1">
										<p class="text-sm text-base-content/70">
											<span class="font-semibold">Remarks:</span> {payment.remarks}
										</p>
									</div>
								</div>
							{/if}

							<!-- Discount Details (Expandable) -->
							{#if hasDiscounts}
								<div class="mt-4">
									<button 
										class="btn btn-sm btn-ghost gap-2"
										on:click={() => togglePaymentExpansion(payment.id)}
									>
										{#if isExpanded}
											<ChevronDown class="w-4 h-4" />
										{:else}
											<ChevronRight class="w-4 h-4" />
										{/if}
										Discount Details ({payment.discounts.length})
									</button>

									{#if isExpanded}
										<div class="mt-3 bg-base-200 rounded-lg p-4">
											<div class="overflow-x-auto">
												<table class="table table-sm">
													<thead>
														<tr>
															<th>Discount Label</th>
															<th>Amount</th>
															<th>Remarks</th>
														</tr>
													</thead>
													<tbody>
														{#each payment.discounts as discount}
															<tr>
																<td class="text-sm">
																	{discount.label || 'Discount'}
																</td>
																<td class="font-bold text-warning">
																	{formatCurrency(discount.discountAmount)}
																</td>
																<td class="text-sm text-base-content/70">
																	{discount.remarks || '-'}
																</td>
															</tr>
														{/each}
													</tbody>
													<tfoot>
														<tr class="font-bold">
															<td>Total Discount</td>
															<td class="text-warning">
																{formatCurrency(totalDiscount)}
															</td>
															<td></td>
														</tr>
													</tfoot>
												</table>
											</div>
										</div>
									{/if}
								</div>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	{/if}
</div>
