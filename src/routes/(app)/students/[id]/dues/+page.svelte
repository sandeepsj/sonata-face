<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { 
		CreditCard, 
		AlertCircle, 
		CheckCircle, 
		Plus, 
		Calendar, 
		IndianRupee,
		Clock,
		Book,
		XCircle,
		AlertTriangle
	} from 'lucide-svelte';
	import { 
		currentStudentStore,
		FeeDuesService,
		type FeeDuesTrackerDTO,
		DuesStatus
	} from '$lib';
	import PaymentModal from './PaymentModal.svelte';
	import AdditionalPaymentModal from './AdditionalPaymentModal.svelte';

	// Get student ID from URL
	$: studentId = Number($page.params.id);

	// Subscribe to current student store
	$: currentStudentState = $currentStudentStore;
	$: student = currentStudentState.student;
	$: dues = currentStudentState.dues;
	$: sessions = currentStudentState.sessions;

	// Modal states
	let paymentModalOpen = false;
	let additionalPaymentModalOpen = false;
	let selectedDue: FeeDuesTrackerDTO | null = null;

	// Cancellation state
	let cancellingDueId: number | null = null;
	let showCancelConfirmModal = false;
	let dueToCancel: FeeDuesTrackerDTO | null = null;

	// Load dues and sessions on mount - always force refresh
	onMount(async () => {
		if (studentId) {
			// Force refresh to get latest dues and sessions data
			await Promise.all([
				currentStudentStore.fetchDues(studentId, true),
				currentStudentStore.fetchSessions(studentId, true)
			]);
		}
	});

	// Refresh dues function
	async function refreshDues() {
		if (studentId) {
			await currentStudentStore.fetchDues(studentId, true);
		}
	}

	// Filter dues by status
	$: pendingDues = dues.data.filter(due => 
		due.status === DuesStatus.DUE || 
		due.status === DuesStatus.OVERDUE || 
		due.status === DuesStatus.PARTIALLY_PAID
	);
	$: paidDues = dues.data.filter(due => due.status === DuesStatus.PAID);
	$: partiallyPaidDues = dues.data.filter(due => due.status === DuesStatus.PARTIALLY_PAID || due.status === DuesStatus.PARTIAL);
	$: cancelledDues = dues.data.filter(due => due.status === DuesStatus.STUDENT_LEFT_DUE_CANCELLED);
	
	// Separate current/past dues from future dues
	$: currentAndPastDues = pendingDues.filter(due => !isFutureDue(due));
	$: futureDues = pendingDues.filter(due => isFutureDue(due));
	
	// Only count current/past dues in the total (future dues are less urgent)
	$: totalDueAmount = currentAndPastDues.reduce((sum, due) => sum + (due.dueAmount || due.amountDue || 0), 0);

	// Format currency
	function formatCurrency(amount: number | undefined): string {
		if (amount === undefined || amount === null || isNaN(amount)) {
			return '₹0.00';
		}
		return new Intl.NumberFormat('en-IN', {
			style: 'currency',
			currency: 'INR',
		}).format(amount);
	}

	// Format date
	function formatDate(dateString: string | undefined): string {
		if (!dateString) {
			return 'N/A';
		}
		try {
			return new Date(dateString).toLocaleDateString('en-US', {
				year: 'numeric',
				month: 'short',
				day: 'numeric'
			});
		} catch {
			return dateString;
		}
	}

	// Get status styling
	function getStatusStyle(status: string) {
		switch (status) {
			case DuesStatus.DUE:
				return 'badge-warning';
			case DuesStatus.OVERDUE:
				return 'badge-error';
			case DuesStatus.PAID:
				return 'badge-success';
			case DuesStatus.PARTIAL:
			case DuesStatus.PARTIALLY_PAID:
				return 'badge-info';
			case DuesStatus.STUDENT_LEFT_DUE_CANCELLED:
				return 'badge-neutral';
			default:
				return 'badge-ghost';
		}
	}

	/**
	 * Determine which term we're currently in based on today's date
	 * Assumes Term 1 starts in January and terms are evenly distributed
	 */
	function getCurrentTerm(termsPerYear: number): { year: number; term: number } {
		const currentDate = new Date();
		const currentYear = currentDate.getFullYear();
		const currentMonth = currentDate.getMonth() + 1; // 1-12
		
		// Calculate which term we're in (each term covers 12/termsPerYear months)
		const monthsPerTerm = 12 / termsPerYear;
		const currentTerm = Math.ceil(currentMonth / monthsPerTerm);
		
		return { year: currentYear, term: Math.min(currentTerm, termsPerYear) };
	}
	
	/**
	 * Check if a due is for a future term (hasn't come yet)
	 */
	function isFutureDue(due: FeeDuesTrackerDTO): boolean {
		// Get total number of terms per year for this course
		// We'll assume 4 terms by default if we can't determine
		const termsPerYear = 4; // You can make this dynamic based on course if needed
		
		const current = getCurrentTerm(termsPerYear);
		
		// If due is from future year, it's a future due
		if (due.termYear > current.year) {
			return true;
		}
		
		// If same year but future term, it's a future due
		if (due.termYear === current.year && due.termNumber > current.term) {
			return true;
		}
		
		return false;
	}
	
	/**
	 * Check if due is overdue (past due date)
	 */
	function isOverdue(due: FeeDuesTrackerDTO): boolean {
		// Don't mark future dues as overdue
		if (isFutureDue(due)) {
			return false;
		}
		
		const termsPerYear = 4;
		const current = getCurrentTerm(termsPerYear);
		
		// If due is from previous year, it's overdue
		if (due.termYear < current.year) {
			return true;
		}
		
		// If same year, check if the term is past (but not current term)
		if (due.termYear === current.year) {
			// If it's before the current term, it's overdue
			return due.termNumber < current.term;
		}
		
		return false;
	}

	// Handle pay button click (opens payment modal)
	function handlePayDue(due: FeeDuesTrackerDTO) {
		selectedDue = due;
		paymentModalOpen = true;
	}

	// Handle additional payment button click (opens additional payment modal)
	function handleAdditionalPayment() {
		additionalPaymentModalOpen = true;
	}

	// Handle modal close events
	async function handlePaymentModalClose() {
		paymentModalOpen = false;
		selectedDue = null;
		
		// Refresh dues after payment to show updated status
		if (studentId) {
			await currentStudentStore.fetchDues(studentId, true);
		}
	}

	async function handleAdditionalPaymentModalClose() {
		additionalPaymentModalOpen = false;
		
		// Refresh dues after payment to show updated status
		if (studentId) {
			await currentStudentStore.fetchDues(studentId, true);
		}
	}

	/**
	 * Check if a due can be marked as cancelled (session is inactive)
	 */
	function canCancelDue(due: FeeDuesTrackerDTO): boolean {
		// Only DUE or PARTIALLY_PAID dues can be cancelled
		if (due.status !== DuesStatus.DUE && due.status !== DuesStatus.PARTIALLY_PAID && due.status !== DuesStatus.PARTIAL) {
			return false;
		}
		
		// Check if the session is inactive (has disjoining date)
		return !currentStudentStore.isSessionActive(due.sessionId);
	}

	/**
	 * Handle marking a due as cancelled because student left
	 */
	async function handleCancelDue(due: FeeDuesTrackerDTO) {
		dueToCancel = due;
		showCancelConfirmModal = true;
	}

	function closeCancelConfirmModal() {
		showCancelConfirmModal = false;
		dueToCancel = null;
		cancellingDueId = null;
	}

	async function confirmCancelDue() {
		if (!dueToCancel) return;

		try {
			cancellingDueId = dueToCancel.id;
			
			await FeeDuesService.markDueAsStudentLeftCancelled(dueToCancel.id);
			
			// Refresh dues to show updated status
			if (studentId) {
				await currentStudentStore.fetchDues(studentId, true);
			}
			
			// Close modal
			closeCancelConfirmModal();
			
		} catch (error) {
			console.error('Error cancelling due:', error);
			alert(error instanceof Error ? error.message : 'Failed to cancel due. Please try again.');
			cancellingDueId = null;
		}
	}
</script>

<svelte:head>
	<title>Fee Dues - {student?.studentName || 'Student'} - Revathi Arts and Music School</title>
</svelte:head>

<div class="space-y-6">
	<!-- Page Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold flex items-center">
				<CreditCard class="w-6 h-6 mr-3 text-primary" />
				Fee Dues & Payments
			</h1>
			<p class="text-base-content/70 mt-1">
				Manage fee dues and payments for {student?.studentName || 'this student'}
			</p>
		</div>
		
		<!-- Quick Actions -->
		<div class="flex space-x-2">
			<button 
				class="btn btn-outline btn-sm"
				on:click={refreshDues}
				disabled={dues.loading}
			>
				{#if dues.loading}
					<span class="loading loading-spinner loading-xs"></span>
				{/if}
				Refresh
			</button>
			
			<button 
				class="btn btn-primary btn-sm"
				on:click={handleAdditionalPayment}
			>
				<Plus class="w-4 h-4 mr-1" />
				Add Payment
			</button>
		</div>
	</div>

	<!-- Loading State -->
	{#if dues.loading}
		<div class="flex justify-center items-center py-12">
			<span class="loading loading-spinner loading-lg"></span>
		</div>
	{/if}

	<!-- Error State -->
	{#if dues.error}
		<div class="alert alert-error">
			<AlertCircle class="w-5 h-5" />
			<span>{dues.error}</span>
			<button class="btn btn-sm btn-ghost" on:click={refreshDues}>
				Try Again
			</button>
		</div>
	{/if}

	<!-- Content -->
	{#if !dues.loading && !dues.error}
		<!-- Summary Cards -->
		<div class="grid grid-cols-1 md:grid-cols-4 gap-4">
			<!-- Total Due Amount (Current & Past Only) -->
			<div class="stat bg-base-100 rounded-lg shadow-sm">
				<div class="stat-figure text-error">
					<IndianRupee class="w-8 h-8" />
				</div>
				<div class="stat-title">Current Due Amount</div>
				<div class="stat-value text-error text-2xl">
					{formatCurrency(totalDueAmount)}
				</div>
				<div class="stat-desc">
					{currentAndPastDues.length} pending due{currentAndPastDues.length !== 1 ? 's' : ''}
					{#if partiallyPaidDues.length > 0}
						<span class="text-info">({partiallyPaidDues.length} partial)</span>
					{/if}
					{#if futureDues.length > 0}
						<span class="text-base-content/50">+ {futureDues.length} future</span>
					{/if}
				</div>
			</div>

			<!-- Paid Dues Count -->
			<div class="stat bg-base-100 rounded-lg shadow-sm">
				<div class="stat-figure text-success">
					<CheckCircle class="w-8 h-8" />
				</div>
				<div class="stat-title">Paid Dues</div>
				<div class="stat-value text-success text-2xl">
					{paidDues.length}
				</div>
				<div class="stat-desc">
					Successfully paid
				</div>
			</div>

			<!-- Cancelled Dues Count -->
			<div class="stat bg-base-100 rounded-lg shadow-sm">
				<div class="stat-figure text-neutral">
					<XCircle class="w-8 h-8" />
				</div>
				<div class="stat-title">Cancelled Dues</div>
				<div class="stat-value text-neutral text-2xl">
					{cancelledDues.length}
				</div>
				<div class="stat-desc">
					Student left course
				</div>
			</div>

			<!-- Overdue Count -->
			<div class="stat bg-base-100 rounded-lg shadow-sm">
				<div class="stat-figure text-warning">
					<Clock class="w-8 h-8" />
				</div>
				<div class="stat-title">Overdue</div>
				<div class="stat-value text-warning text-2xl">
					{currentAndPastDues.filter(due => isOverdue(due)).length}
				</div>
				<div class="stat-desc">
					Past due date
				</div>
			</div>
		</div>

		<!-- Pending Dues -->
		{#if currentAndPastDues.length > 0}
			<div class="card bg-base-100 shadow-sm">
				<div class="card-body">
					<h2 class="card-title text-lg mb-4 flex items-center">
						<AlertCircle class="w-5 h-5 mr-2 text-warning" />
						Current & Pending Dues ({currentAndPastDues.length})
					</h2>
					
					<div class="overflow-x-auto">
						<table class="table table-zebra">
							<thead>
								<tr>
									<th>Course</th>
									<th>Term</th>
									<th>Amount Due</th>
									<th>Created Date</th>
									<th>Status</th>
									<th>Actions</th>
								</tr>
							</thead>
							<tbody>
								{#each currentAndPastDues as due}
									<tr 
										class:bg-error={isOverdue(due) && due.status !== DuesStatus.PAID && due.status !== DuesStatus.PARTIALLY_PAID && due.status !== DuesStatus.PARTIAL} 
										class:bg-opacity-10={isOverdue(due)}
									>
										<td>
											<div class="flex items-center space-x-2">
												<Book class="w-4 h-4 text-primary" />
												<span class="font-medium">{due.courseName}</span>
											</div>
										</td>
										<td>
											<div class="text-sm">
												<div>Year {due.termYear}</div>
												<div class="text-base-content/70">Term {due.termNumber}</div>
											</div>
										</td>
										<td>
											<div>
												{#if due.status === DuesStatus.PARTIALLY_PAID || due.status === DuesStatus.PARTIAL}
													<span class="font-bold text-lg text-info">
														{formatCurrency(due.dueAmount)}
													</span>
													<div class="text-xs text-base-content/60">Remaining</div>
												{:else}
													<span class="font-bold text-lg">
														{formatCurrency(due.dueAmount)}
													</span>
												{/if}
											</div>
										</td>
										<td>
											<div class="flex items-center space-x-2">
												<Calendar class="w-4 h-4" />
												<span class:text-error={isOverdue(due)}>
													{formatDate(due.createdAt)}
												</span>
											</div>
										</td>
										<td>
											<div class="badge {getStatusStyle(due.status)}">
												{due.status === DuesStatus.PARTIALLY_PAID ? 'PARTIAL' : due.status}
											</div>
											{#if isOverdue(due)}
												<div class="badge badge-error badge-sm mt-1">
													OVERDUE
												</div>
											{/if}
										</td>
										<td>
											<div class="flex gap-2">
												<button 
													class="btn btn-primary btn-sm"
													on:click={() => handlePayDue(due)}
												>
													<CreditCard class="w-4 h-4 mr-1" />
													{due.status === DuesStatus.PARTIALLY_PAID || due.status === DuesStatus.PARTIAL ? 'Pay Remaining' : 'Pay Now'}
												</button>
												
												{#if canCancelDue(due)}
													<button 
														class="btn btn-error btn-sm btn-outline"
														on:click={() => handleCancelDue(due)}
														disabled={cancellingDueId === due.id}
														title="Mark as cancelled - Student left course"
													>
														{#if cancellingDueId === due.id}
															<span class="loading loading-spinner loading-xs"></span>
														{:else}
															<XCircle class="w-4 h-4" />
														{/if}
													</button>
												{/if}
											</div>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			</div>
		{/if}

		<!-- Future Dues (Less Prominent) -->
		{#if futureDues.length > 0}
			<div class="card bg-base-100 shadow-sm opacity-60">
				<div class="card-body">
					<h2 class="card-title text-lg mb-4 flex items-center text-base-content/60">
						<Clock class="w-5 h-5 mr-2" />
						Upcoming Dues ({futureDues.length})
						<span class="badge badge-ghost badge-sm">Future Terms</span>
					</h2>
					
					<div class="overflow-x-auto">
						<table class="table table-zebra">
							<thead>
								<tr class="text-base-content/60">
									<th>Course</th>
									<th>Term</th>
									<th>Amount Due</th>
									<th>Created Date</th>
									<th>Status</th>
									<th>Actions</th>
								</tr>
							</thead>
							<tbody>
								{#each futureDues as due}
									<tr class="text-base-content/60">
										<td>
											<div class="flex items-center space-x-2">
												<Book class="w-4 h-4 opacity-50" />
												<span>{due.courseName}</span>
											</div>
										</td>
										<td>
											<div class="text-sm">
												<div>Year {due.termYear}</div>
												<div class="text-base-content/50">Term {due.termNumber}</div>
											</div>
										</td>
										<td>
											<div>
												{#if due.status === DuesStatus.PARTIALLY_PAID || due.status === DuesStatus.PARTIAL}
													<span class="font-semibold text-info">
														{formatCurrency(due.dueAmount)}
													</span>
													<div class="text-xs text-base-content/50">Remaining</div>
												{:else}
													<span class="font-semibold">
														{formatCurrency(due.dueAmount)}
													</span>
												{/if}
											</div>
										</td>
										<td>
											<div class="flex items-center space-x-2">
												<Calendar class="w-4 h-4 opacity-50" />
												<span>
													{formatDate(due.createdAt)}
												</span>
											</div>
										</td>
										<td>
											<div class="badge badge-ghost badge-sm">
												{due.status === DuesStatus.PARTIALLY_PAID ? 'PARTIAL' : due.status}
											</div>
										</td>
										<td>
											<button 
												class="btn btn-outline btn-sm opacity-70"
												on:click={() => handlePayDue(due)}
											>
												<CreditCard class="w-4 h-4 mr-1" />
												{due.status === DuesStatus.PARTIALLY_PAID || due.status === DuesStatus.PARTIAL ? 'Pay Remaining' : 'Pay Advance'}
											</button>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
					<p class="text-sm text-base-content/50 mt-2">
						<AlertCircle class="w-4 h-4 inline mr-1" />
						These are dues for upcoming terms. You can pay them in advance if needed.
					</p>
				</div>
			</div>
		{/if}

		<!-- No Pending Dues Message -->
		{#if currentAndPastDues.length === 0 && futureDues.length === 0}
			<div class="card bg-base-100 shadow-sm">
				<div class="card-body text-center py-12">
					<CheckCircle class="w-16 h-16 mx-auto text-success mb-4" />
					<h2 class="text-xl font-bold text-success mb-2">All Dues Cleared!</h2>
					<p class="text-base-content/70 mb-4">
						{student?.studentName || 'This student'} has no pending dues at the moment.
					</p>
					<button 
						class="btn btn-primary"
						on:click={handleAdditionalPayment}
					>
						<Plus class="w-4 h-4 mr-2" />
						Make Additional Payment
					</button>
				</div>
			</div>
		{/if}

		<!-- Payment History (if any paid dues exist) -->
		{#if paidDues.length > 0}
			<div class="card bg-base-100 shadow-sm">
				<div class="card-body">
					<h2 class="card-title text-lg mb-4 flex items-center">
						<CheckCircle class="w-5 h-5 mr-2 text-success" />
						Recent Payments ({paidDues.length})
					</h2>
					
					<div class="overflow-x-auto">
						<table class="table table-zebra">
							<thead>
								<tr>
									<th>Course</th>
									<th>Term</th>
									<th>Payment Date</th>
									<th>Status</th>
								</tr>
							</thead>
							<tbody>
								{#each paidDues.slice(0, 5) as due}
									<tr>
										<td>
											<div class="flex items-center space-x-2">
												<Book class="w-4 h-4 text-primary" />
												<span class="font-medium">{due.courseName}</span>
											</div>
										</td>
										<td>
											<div class="text-sm">
												<div>Year {due.termYear}</div>
												<div class="text-base-content/70">Term {due.termNumber}</div>
											</div>
										</td>
										<td>
											<div class="flex items-center space-x-2">
												<Calendar class="w-4 h-4" />
												<span>{formatDate(due.updatedAt)}</span>
											</div>
										</td>
										<td>
											<div class="badge {getStatusStyle(due.status)}">
												{due.status}
											</div>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
					
					{#if paidDues.length > 5}
						<div class="text-center mt-4">
							<span class="text-sm text-base-content/70">
								Showing recent 5 payments. Total paid: {paidDues.length}
							</span>
						</div>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Cancelled Dues (if any cancelled dues exist) -->
		{#if cancelledDues.length > 0}
			<div class="card bg-base-100 shadow-sm border border-neutral/20">
				<div class="card-body">
					<h2 class="card-title text-lg mb-4 flex items-center">
						<XCircle class="w-5 h-5 mr-2 text-neutral" />
						Cancelled Dues ({cancelledDues.length})
						<div class="badge badge-neutral badge-sm">Student Left Course</div>
					</h2>
					
					<div class="overflow-x-auto">
						<table class="table table-zebra">
							<thead>
								<tr>
									<th>Course</th>
									<th>Term</th>
									<th>Amount</th>
									<th>Cancelled Date</th>
									<th>Status</th>
								</tr>
							</thead>
							<tbody>
								{#each cancelledDues as due}
									<tr class="opacity-70">
										<td>
											<div class="flex items-center space-x-2">
												<Book class="w-4 h-4 text-neutral" />
												<span class="font-medium">{due.courseName}</span>
											</div>
										</td>
										<td>
											<div class="text-sm">
												<div>Year {due.termYear}</div>
												<div class="text-base-content/70">Term {due.termNumber}</div>
											</div>
										</td>
										<td>
											<div class="font-semibold text-neutral">
												{formatCurrency(due.dueAmount || due.amountDue || 0)}
											</div>
										</td>
										<td>
											<div class="flex items-center space-x-2">
												<Calendar class="w-4 h-4" />
												<span>{formatDate(due.updatedAt)}</span>
											</div>
										</td>
										<td>
											<div class="badge {getStatusStyle(due.status)} badge-sm">
												CANCELLED
											</div>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
					
					<div class="alert alert-info mt-4">
						<AlertCircle class="w-5 h-5" />
						<div class="text-sm">
							These dues were cancelled because the student left the course before the term was due. 
							No payment is required for these dues.
						</div>
					</div>
				</div>
			</div>
		{/if}
	{/if}
</div>

<!-- Payment Modals -->
<PaymentModal 
	bind:isOpen={paymentModalOpen}
	{studentId}
	due={selectedDue}
	on:close={handlePaymentModalClose}
/>

<AdditionalPaymentModal 
	bind:isOpen={additionalPaymentModalOpen}
	{studentId}
	studentName={student?.studentName || ''}
	on:close={handleAdditionalPaymentModalClose}
/>

<!-- Cancel Due Confirmation Modal -->
{#if showCancelConfirmModal && dueToCancel}
	<div class="modal modal-open">
		<div class="modal-box">
			<div class="flex items-start gap-4">
				<div class="flex-shrink-0">
					<XCircle class="w-12 h-12 text-error" />
				</div>
				<div class="flex-1">
					<h3 class="font-bold text-lg text-base-content mb-3">Cancel Due Confirmation</h3>
					<p class="text-base-content/80 mb-4">
						Are you sure you want to mark this due as cancelled? This action <strong>cannot be undone</strong>.
					</p>
					
					<!-- Due Details Card -->
					<div class="bg-base-200 p-4 rounded-lg mb-4">
						<div class="space-y-3">
							<div class="flex items-center justify-between">
								<span class="text-sm text-base-content/70">Course:</span>
								<span class="font-semibold flex items-center gap-2">
									<Book class="w-4 h-4 text-primary" />
									{dueToCancel.courseName}
								</span>
							</div>
							<div class="flex items-center justify-between">
								<span class="text-sm text-base-content/70">Term:</span>
								<span class="font-semibold">
									{dueToCancel.termYear} - Term {dueToCancel.termNumber}
								</span>
							</div>
							<div class="flex items-center justify-between">
								<span class="text-sm text-base-content/70">Amount:</span>
								<span class="font-bold text-lg text-error">
									{formatCurrency(dueToCancel.dueAmount || dueToCancel.amountDue || 0)}
								</span>
							</div>
							<div class="flex items-center justify-between">
								<span class="text-sm text-base-content/70">Current Status:</span>
								<div class="badge {getStatusStyle(dueToCancel.status)}">
									{dueToCancel.status === DuesStatus.PARTIALLY_PAID ? 'PARTIAL' : dueToCancel.status}
								</div>
							</div>
						</div>
					</div>

					<!-- Warning Alert -->
					<div class="alert alert-warning">
						<AlertTriangle class="w-5 h-5" />
						<div class="text-sm">
							<div class="font-semibold">Reason for Cancellation:</div>
							<div class="mt-1">Student has left the course (inactive session detected)</div>
						</div>
					</div>
				</div>
			</div>

			<div class="modal-action">
				<button 
					class="btn btn-ghost"
					on:click={closeCancelConfirmModal}
					disabled={cancellingDueId !== null}
				>
					No, Keep Due
				</button>
				<button 
					class="btn btn-error"
					on:click={confirmCancelDue}
					disabled={cancellingDueId !== null}
				>
					{#if cancellingDueId !== null}
						<span class="loading loading-spinner loading-sm"></span>
					{:else}
						<XCircle class="w-4 h-4" />
					{/if}
					Yes, Cancel Due
				</button>
			</div>
		</div>
		<div class="modal-backdrop bg-black/50"></div>
	</div>
{/if}
