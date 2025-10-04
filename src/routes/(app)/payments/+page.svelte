<script lang="ts">
	import { onMount } from 'svelte';
	import { PaymentService, type DateRangeParams } from '$lib/api/paymentService';
	import type { Payment } from '$lib/types/payment';
	import { IndianRupee, Calendar, Filter, TrendingUp, BarChart3, Download } from 'lucide-svelte';

	// Date range state
	let startDate = '';
	let endDate = '';
	
	// Filter state
	let selectedCourse: string | null = null;
	let selectedType: string | null = null;
	let selectedTerm: number | null = null;
	
	// Data state
	let payments: Payment[] = [];
	let loading = false;
	let error: string | null = null;
	
	// Available filter options
	let courses: string[] = [];
	let paymentTypes = ['REGULAR', 'ADDITIONAL'];
	
	// Aggregated data
	let totalAmount = 0;
	let totalPayments = 0;
	let totalCollected = 0;
	let totalDiscount = 0;
	let totalFeeCleared = 0;
	let additionalPaymentData: { remark: string; amount: number; count: number }[] = [];
	let courseData: { course: string; amount: number; count: number }[] = [];
	
	// Initialize with current month
	onMount(() => {
		const now = new Date();
		const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
		const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
		
		startDate = formatDateForInput(firstDay);
		endDate = formatDateForInput(lastDay);
		
		loadPayments();
	});
	
	function formatDateForInput(date: Date): string {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	}
	
	function toISOString(dateStr: string, isEnd = false): string {
		const [year, month, day] = dateStr.split('-');
		if (isEnd) {
			return `${year}-${month}-${day}T23:59:59`;
		}
		return `${year}-${month}-${day}T00:00:00`;
	}
	
	async function loadPayments() {
		if (!startDate || !endDate) return;
		
		loading = true;
		error = null;
		
		try {
			const params: DateRangeParams = {
				startDate: toISOString(startDate),
				endDate: toISOString(endDate, true)
			};
			
			// Call appropriate API based on filters
			if (selectedCourse) {
				payments = await PaymentService.getPaymentsByCourse(selectedCourse, params);
			} else if (selectedType) {
				payments = await PaymentService.getPaymentsByType(selectedType, params);
			} else if (selectedTerm) {
				payments = await PaymentService.getPaymentsByTerm(selectedTerm, params);
			} else {
				payments = await PaymentService.getPaymentsByDateRange(params);
			}
			
			// Extract unique courses
			courses = [...new Set(payments.map(p => p.courseName).filter(Boolean) as string[])];
			
			// Calculate aggregations
			calculateAggregations();
		} catch (err) {
			error = 'Failed to load payments. Please try again.';
			console.error('Error loading payments:', err);
		} finally {
			loading = false;
		}
	}
	
	function calculateAggregations() {
		// Total calculations
		totalPayments = payments.length;
		totalAmount = payments.reduce((sum, p) => sum + p.amountPaid + (p.discountAmount || 0), 0);
		totalCollected = payments.reduce((sum, p) => sum + p.amountPaid, 0);
		totalDiscount = payments.reduce((sum, p) => sum + (p.discountAmount || 0), 0);
		totalFeeCleared = totalCollected + totalDiscount;
		
		// Additional payment aggregation by remarks
		const additionalMap = new Map<string, { amount: number; count: number }>();
		payments
			.filter(payment => payment.paymentType === 'ADDITIONAL')
			.forEach(payment => {
				const remark = payment.remarks || 'No Remarks';
				const existing = additionalMap.get(remark) || { amount: 0, count: 0 };
				existing.amount += payment.amountPaid + (payment.discountAmount || 0);
				existing.count += 1;
				additionalMap.set(remark, existing);
			});
		
		additionalPaymentData = Array.from(additionalMap.entries())
			.map(([remark, value]) => ({ remark, ...value }))
			.sort((a, b) => b.amount - a.amount);
		
		// Course aggregation
		const courseMap = new Map<string, { amount: number; count: number }>();
		payments.forEach(payment => {
			const course = payment.courseName || 'Other';
			const existing = courseMap.get(course) || { amount: 0, count: 0 };
			existing.amount += payment.amountPaid + (payment.discountAmount || 0);
			existing.count += 1;
			courseMap.set(course, existing);
		});
		
		courseData = Array.from(courseMap.entries())
			.map(([course, value]) => ({ course, ...value }))
			.sort((a, b) => b.amount - a.amount);
	}
	
	function formatCurrency(amount: number): string {
		return amount.toLocaleString('en-IN');
	}
	
	function formatDate(dateStr: string): string {
		const date = new Date(dateStr);
		return date.toLocaleDateString('en-IN', { 
			day: '2-digit', 
			month: 'short', 
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
	
	function formatDateShort(dateStr: string): string {
		const date = new Date(dateStr);
		return date.toLocaleDateString('en-IN', { 
			day: '2-digit', 
			month: 'short', 
			year: 'numeric'
		});
	}
	
	function clearFilters() {
		selectedCourse = null;
		selectedType = null;
		selectedTerm = null;
		loadPayments();
	}
	
	function setQuickRange(range: string) {
		const now = new Date();
		let start: Date;
		let end: Date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
		
		switch (range) {
			case 'today':
				start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
				break;
			case 'yesterday':
				start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
				end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59);
				break;
			case 'week':
				start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
				break;
			case 'month':
				start = new Date(now.getFullYear(), now.getMonth(), 1);
				end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
				break;
			case 'lastMonth':
				start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
				end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
				break;
			default:
				start = new Date(now.getFullYear(), now.getMonth(), 1);
		}
		
		startDate = formatDateForInput(start);
		endDate = formatDateForInput(end);
		loadPayments();
	}
	
	function downloadCSV() {
		// CSV header
		const headers = [
			'Date',
			'Student Name',
			'Student ID',
			'Course',
			'Year',
			'Term',
			'Type',
			'Student Remarks',
			'Payment Remarks',
			'Fee Paid',
			'Discount',
			'Total'
		];
		
		// CSV rows
		const rows = payments.map(payment => [
			formatDateShort(payment.date),
			payment.student.studentName || 'N/A',
			payment.student.admissionNo || 'N/A',
			payment.courseName || 'N/A',
			payment.feeStructure?.year || 'N/A',
			payment.feeStructure?.term || 'N/A',
			payment.paymentType === 'REGULAR' ? 'Regular' : 'Additional',
			payment.student.remarks || '-',
			payment.remarks || '-',
			payment.amountPaid,
			payment.discountAmount || 0,
			payment.amountPaid + (payment.discountAmount || 0)
		]);
		
		// Add totals row
		const totalRow = [
			'',
			'',
			'',
			'',
			'',
			'',
			'',
			'',
			'Total:',
			payments.reduce((sum, p) => sum + p.amountPaid, 0),
			payments.reduce((sum, p) => sum + (p.discountAmount || 0), 0),
			totalAmount
		];
		
		// Combine headers and rows
		const csvContent = [
			headers.join(','),
			...rows.map(row => row.map(cell => {
				// Escape cells containing commas or quotes
				const cellStr = String(cell);
				if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
					return `"${cellStr.replace(/"/g, '""')}"`;
				}
				return cellStr;
			}).join(',')),
			totalRow.join(',')
		].join('\n');
		
		// Create blob and download
		const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
		const link = document.createElement('a');
		const url = URL.createObjectURL(blob);
		
		link.setAttribute('href', url);
		link.setAttribute('download', `payment-report-${startDate}-to-${endDate}.csv`);
		link.style.visibility = 'hidden';
		
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	}
	
	// Calculate max for bar chart scaling
	$: maxAdditional = Math.max(...additionalPaymentData.map(d => d.amount), 1);
	$: maxCourse = Math.max(...courseData.map(d => d.amount), 1);
</script>

<svelte:head>
	<title>Payment Dashboard - Revathi Arts and Music School</title>
</svelte:head>

<div class="container mx-auto p-6 max-w-full">
	<!-- Header -->
	<div class="mb-6">
		<div class="flex justify-between items-start">
			<div>
				<h1 class="text-3xl font-bold mb-2 flex items-center gap-3">
					<IndianRupee class="w-8 h-8 text-primary" />
					Payment Dashboard
				</h1>
				<p class="text-base-content/70">
					View and analyze payment history across all students
				</p>
			</div>
			<button class="btn btn-primary" on:click={downloadCSV}>
				<Download class="w-5 h-5" />
				Download CSV
			</button>
		</div>
	</div>

	<!-- Filters Card -->
	<div class="card bg-base-100 shadow-xl mb-6">
		<div class="card-body">
			<h2 class="card-title mb-4">
				<Filter class="w-5 h-5" />
				Filters
			</h2>
			
			<!-- Quick Date Ranges -->
			<div class="flex flex-wrap gap-2 mb-4">
				<button class="btn btn-sm btn-outline" on:click={() => setQuickRange('today')}>Today</button>
				<button class="btn btn-sm btn-outline" on:click={() => setQuickRange('yesterday')}>Yesterday</button>
				<button class="btn btn-sm btn-outline" on:click={() => setQuickRange('week')}>Last 7 Days</button>
				<button class="btn btn-sm btn-outline" on:click={() => setQuickRange('month')}>This Month</button>
				<button class="btn btn-sm btn-outline" on:click={() => setQuickRange('lastMonth')}>Last Month</button>
			</div>
			
			<!-- Date Range -->
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
				<div class="form-control">
					<label class="label" for="startDate">
						<span class="label-text">Start Date</span>
					</label>
					<input
						id="startDate"
						type="date"
						class="input input-bordered"
						bind:value={startDate}
						on:change={loadPayments}
					/>
				</div>
				
				<div class="form-control">
					<label class="label" for="endDate">
						<span class="label-text">End Date</span>
					</label>
					<input
						id="endDate"
						type="date"
						class="input input-bordered"
						bind:value={endDate}
						on:change={loadPayments}
					/>
				</div>
				
				<div class="form-control">
					<label class="label" for="courseFilter">
						<span class="label-text">Course</span>
					</label>
					<select
						id="courseFilter"
						class="select select-bordered"
						bind:value={selectedCourse}
						on:change={loadPayments}
					>
						<option value={null}>All Courses</option>
						{#each courses as course}
							<option value={course}>{course}</option>
						{/each}
					</select>
				</div>
				
				<div class="form-control">
					<label class="label" for="typeFilter">
						<span class="label-text">Payment Type</span>
					</label>
					<select
						id="typeFilter"
						class="select select-bordered"
						bind:value={selectedType}
						on:change={loadPayments}
					>
						<option value={null}>All Types</option>
						{#each paymentTypes as type}
							<option value={type}>{type === 'REGULAR' ? 'Regular' : 'Additional'}</option>
						{/each}
					</select>
				</div>
			</div>
			
			{#if selectedCourse || selectedType || selectedTerm}
				<div class="flex justify-end">
					<button class="btn btn-sm btn-ghost" on:click={clearFilters}>
						Clear Filters
					</button>
				</div>
			{/if}
		</div>
	</div>

	<!-- Statistics Cards -->
	<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
		<div class="stats shadow">
			<div class="stat">
				<div class="stat-figure text-primary">
					<IndianRupee class="w-8 h-8" />
				</div>
				<div class="stat-title">Total Fee Cleared</div>
				<div class="stat-value text-primary">₹{formatCurrency(totalFeeCleared)}</div>
				<div class="stat-desc">Fee + Discount</div>
			</div>
		</div>
		
		<div class="stats shadow">
			<div class="stat">
				<div class="stat-figure text-success">
					<IndianRupee class="w-8 h-8" />
				</div>
				<div class="stat-title">Total Collected</div>
				<div class="stat-value text-success">₹{formatCurrency(totalCollected)}</div>
				<div class="stat-desc">Amount received</div>
			</div>
		</div>
		
		<div class="stats shadow">
			<div class="stat">
				<div class="stat-figure text-warning">
					<IndianRupee class="w-8 h-8" />
				</div>
				<div class="stat-title">Total Discount</div>
				<div class="stat-value text-warning">₹{formatCurrency(totalDiscount)}</div>
				<div class="stat-desc">Discount given</div>
			</div>
		</div>
		
		<div class="stats shadow">
			<div class="stat">
				<div class="stat-figure text-secondary">
					<TrendingUp class="w-8 h-8" />
				</div>
				<div class="stat-title">Total Payments</div>
				<div class="stat-value text-secondary">{totalPayments}</div>
				<div class="stat-desc">Payment count</div>
			</div>
		</div>
	</div>

	<!-- Charts Row -->
	<div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
		<!-- Course-wise Collection Chart -->
		<div class="card bg-base-100 shadow-xl">
			<div class="card-body">
				<h2 class="card-title">Course-wise Collection</h2>
				{#if courseData.length > 0}
					<div class="space-y-3">
						{#each courseData as data}
							<div>
								<div class="flex justify-between text-sm mb-1">
									<span class="font-medium">{data.course}</span>
									<span class="text-base-content/70">₹{formatCurrency(data.amount)} ({data.count} payments)</span>
								</div>
								<div class="w-full bg-base-300 rounded-full h-4">
									<div 
										class="bg-primary h-4 rounded-full flex items-center justify-end px-2"
										style="width: {(data.amount / maxCourse) * 100}%"
									>
										{#if (data.amount / maxCourse) > 0.2}
											<span class="text-xs text-primary-content font-medium">₹{formatCurrency(data.amount)}</span>
										{/if}
									</div>
								</div>
							</div>
						{/each}
					</div>
				{:else}
					<p class="text-base-content/50 text-center py-8">No data available</p>
				{/if}
			</div>
		</div>

		<!-- Additional Payments by Remark Chart -->
		<div class="card bg-base-100 shadow-xl">
			<div class="card-body">
				<h2 class="card-title">Additional Payments by Remark</h2>
				{#if additionalPaymentData.length > 0}
					<div class="space-y-3">
						{#each additionalPaymentData as data}
							<div>
								<div class="flex justify-between text-sm mb-1">
									<span class="font-medium">{data.remark}</span>
									<span class="text-base-content/70">₹{formatCurrency(data.amount)} ({data.count} payments)</span>
								</div>
								<div class="w-full bg-base-300 rounded-full h-4">
									<div 
										class="bg-secondary h-4 rounded-full flex items-center justify-end px-2"
										style="width: {(data.amount / maxAdditional) * 100}%"
									>
										{#if (data.amount / maxAdditional) > 0.2}
											<span class="text-xs text-secondary-content font-medium">₹{formatCurrency(data.amount)}</span>
										{/if}
									</div>
								</div>
							</div>
						{/each}
					</div>
				{:else}
					<p class="text-base-content/50 text-center py-8">No additional payments found</p>
				{/if}
			</div>
		</div>
	</div>

	<!-- Payments Table -->
	<div class="card bg-base-100 shadow-xl">
		<div class="card-body">
			<h2 class="card-title mb-4">Payment Records ({totalPayments})</h2>
			
			{#if loading}
				<div class="flex justify-center items-center py-12">
					<span class="loading loading-spinner loading-lg"></span>
				</div>
			{:else if error}
				<div class="alert alert-error">
					<span>{error}</span>
				</div>
			{:else if payments.length === 0}
				<div class="text-center py-12">
					<Calendar class="w-16 h-16 text-base-content/30 mx-auto mb-4" />
					<h3 class="text-xl font-bold mb-2">No Payments Found</h3>
					<p class="text-base-content/70">
						No payment records found for the selected date range and filters.
					</p>
				</div>
			{:else}
				<div class="overflow-x-auto">
					<table class="table table-sm">
						<thead>
							<tr class="bg-base-200">
								<th class="whitespace-nowrap">Date</th>
								<th>Student Name</th>
								<th>Student ID</th>
								<th>Course</th>
								<th>Year</th>
								<th>Term</th>
								<th>Type</th>
								<th class="min-w-[150px]">Student Remarks</th>
								<th class="min-w-[150px]">Payment Remarks</th>
								<th class="text-right">Fee Paid</th>
								<th class="text-right">Discount</th>
								<th class="text-right">Total</th>
							</tr>
						</thead>
						<tbody>
							{#each payments as payment}
								<tr class="hover">
									<td class="whitespace-nowrap">{formatDateShort(payment.date)}</td>
									<td>
										<div class="font-medium">{payment.student.studentName || 'N/A'}</div>
									</td>
									<td>
										{#if payment.student.admissionNo}
											<a 
												href="/students/{payment.student.admissionNo}" 
												target="_blank"
												rel="noopener noreferrer"
												class="text-xs text-primary hover:text-primary-focus underline cursor-pointer"
											>
												{payment.student.admissionNo}
											</a>
										{:else}
											<div class="text-xs text-base-content/70">N/A</div>
										{/if}
									</td>
									<td>
										<span class="badge badge-outline">{payment.courseName || 'N/A'}</span>
									</td>
									<td>
										<div class="text-center">{payment.feeStructure?.year || 'N/A'}</div>
									</td>
									<td>
										<div class="text-center">{payment.feeStructure?.term || 'N/A'}</div>
									</td>
									<td>
										<span class="badge badge-sm">
											{payment.paymentType === 'REGULAR' ? 'Regular' : 'Additional'}
										</span>
									</td>
									<td>
										<div class="text-xs whitespace-normal break-words">{payment.student.remarks || '-'}</div>
									</td>
									<td>
										<div class="text-xs whitespace-normal break-words">{payment.remarks || '-'}</div>
									</td>
									<td class="text-right font-mono">₹{formatCurrency(payment.amountPaid)}</td>
									<td class="text-right font-mono">₹{formatCurrency(payment.discountAmount || 0)}</td>
									<td class="text-right font-mono font-bold">
										₹{formatCurrency(payment.amountPaid + (payment.discountAmount || 0))}
									</td>
								</tr>
							{/each}
						</tbody>
						<tfoot>
							<tr class="bg-base-200 font-bold">
								<td colspan="9" class="text-right">Total:</td>
								<td class="text-right">₹{formatCurrency(payments.reduce((sum, p) => sum + p.amountPaid, 0))}</td>
								<td class="text-right">₹{formatCurrency(payments.reduce((sum, p) => sum + (p.discountAmount || 0), 0))}</td>
								<td class="text-right">₹{formatCurrency(totalAmount)}</td>
							</tr>
						</tfoot>
					</table>
				</div>
			{/if}
		</div>
	</div>
</div>
