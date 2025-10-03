<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { 
		CreditCard, 
		AlertCircle, 
		CheckCircle, 
		Plus, 
		Calendar, 
		DollarSign,
		Clock,
		Book
	} from 'lucide-svelte';
	import { 
		currentStudentStore,
		type FeeDuesTrackerDTO,
		DuesStatus
	} from '$lib';

	// Get student ID from URL
	$: studentId = Number($page.params.id);

	// Subscribe to current student store
	$: currentStudentState = $currentStudentStore;
	$: student = currentStudentState.student;
	$: dues = currentStudentState.dues;

	// Load dues on mount
	onMount(() => {
		if (studentId) {
			currentStudentStore.fetchDues(studentId);
		}
	});

	// Refresh dues function
	async function refreshDues() {
		if (studentId) {
			await currentStudentStore.fetchDues(studentId, true);
		}
	}

	// Filter dues by status
	$: pendingDues = dues.data.filter(due => due.status === DuesStatus.DUE || due.status === DuesStatus.OVERDUE);
	$: paidDues = dues.data.filter(due => due.status === DuesStatus.PAID);
	$: totalDueAmount = pendingDues.reduce((sum, due) => sum + due.dueAmount, 0);

	// Format currency
	function formatCurrency(amount: number): string {
		return new Intl.NumberFormat('en-IN', {
			style: 'currency',
			currency: 'INR',
		}).format(amount);
	}

	// Format date
	function formatDate(dateString: string): string {
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
				return 'badge-info';
			default:
				return 'badge-ghost';
		}
	}

	// Check if due is overdue (since API doesn't provide dueDate, we'll use createdAt + some logic)
	function isOverdue(due: FeeDuesTrackerDTO): boolean {
		// For now, we'll consider dues overdue if they're from previous year or more than 3 months old
		const currentDate = new Date();
		const currentYear = currentDate.getFullYear();
		const currentMonth = currentDate.getMonth() + 1; // 0-indexed
		
		// If due is from previous year, it's overdue
		if (due.termYear < currentYear) {
			return true;
		}
		
		// If same year, check if term is significantly behind current time
		if (due.termYear === currentYear) {
			// Rough estimation: term 1 = Jan-Mar, term 2 = Apr-Jun, term 3 = Jul-Sep, term 4 = Oct-Dec
			const termEndMonth = due.termNumber * 3;
			return currentMonth > termEndMonth + 1; // 1 month grace period
		}
		
		return false;
	}

	// Handle pay button click (Phase 2 implementation)
	function handlePayDue(due: FeeDuesTrackerDTO) {
		// TODO: Phase 2 - Implement payment flow
		alert(`Payment functionality coming in Phase 2!\nDue: ${due.courseName} - ${formatCurrency(due.dueAmount)}`);
	}

	// Handle additional payment button click (Phase 2 implementation)
	function handleAdditionalPayment() {
		// TODO: Phase 2 - Implement additional payment flow
		alert('Additional payment functionality coming in Phase 2!');
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
		<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
			<!-- Total Due Amount -->
			<div class="stat bg-base-100 rounded-lg shadow-sm">
				<div class="stat-figure text-error">
					<DollarSign class="w-8 h-8" />
				</div>
				<div class="stat-title">Total Due</div>
				<div class="stat-value text-error text-2xl">
					{formatCurrency(totalDueAmount)}
				</div>
				<div class="stat-desc">
					{pendingDues.length} pending due{pendingDues.length !== 1 ? 's' : ''}
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

			<!-- Overdue Count -->
			<div class="stat bg-base-100 rounded-lg shadow-sm">
				<div class="stat-figure text-warning">
					<Clock class="w-8 h-8" />
				</div>
				<div class="stat-title">Overdue</div>
				<div class="stat-value text-warning text-2xl">
					{pendingDues.filter(due => isOverdue(due)).length}
				</div>
				<div class="stat-desc">
					Past due date
				</div>
			</div>
		</div>

		<!-- Pending Dues -->
		{#if pendingDues.length > 0}
			<div class="card bg-base-100 shadow-sm">
				<div class="card-body">
					<h2 class="card-title text-lg mb-4 flex items-center">
						<AlertCircle class="w-5 h-5 mr-2 text-warning" />
						Pending Dues ({pendingDues.length})
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
								{#each pendingDues as due}
									<tr class:bg-warning={isOverdue(due) && due.status !== DuesStatus.PAID}>
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
											<span class="font-bold text-lg">
												{formatCurrency(due.dueAmount)}
											</span>
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
												{due.status}
											</div>
											{#if isOverdue(due)}
												<div class="badge badge-error badge-sm mt-1">
													OVERDUE
												</div>
											{/if}
										</td>
										<td>
											<button 
												class="btn btn-primary btn-sm"
												on:click={() => handlePayDue(due)}
											>
												<CreditCard class="w-4 h-4 mr-1" />
												Pay Now
											</button>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			</div>
		{:else}
			<!-- No Pending Dues -->
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
									<th>Amount Paid</th>
									<th>Created Date</th>
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
											<span class="font-bold text-success">
												{formatCurrency(due.dueAmount)}
											</span>
										</td>
										<td>
											<div class="flex items-center space-x-2">
												<Calendar class="w-4 h-4" />
												<span>{formatDate(due.createdAt)}</span>
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
	{/if}
</div>