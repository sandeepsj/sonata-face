<script lang="ts">
	import { onMount } from 'svelte';
	import { DuesAggregateService, FeeDuesService } from '$lib';
	import type { 
		CourseAggregate, 
		YearAggregate, 
		TermAggregate, 
		AggregateGroupBy,
		FeeDuesTrackerDTO
	} from '$lib';
	import { IndianRupee, Filter, ChevronDown, ChevronRight, Download, Users } from 'lucide-svelte';

	// State for grouping selection
	let groupBy = $state<AggregateGroupBy>('course');
	
	// Filter state
	let selectedStatuses = $state('DUE,PARTIALLY_PAID');
	let selectedYear = $state<number | null>(null);
	let selectedTermNumber = $state<number | null>(null);
	let selectedCourse = $state<string | null>(null);
	
	// Aggregates data
	let courseAggregates = $state<CourseAggregate[]>([]);
	let yearAggregates = $state<YearAggregate[]>([]);
	let termAggregates = $state<TermAggregate[]>([]);
	
	// Expanded details
	let expandedItems = $state<Set<string>>(new Set());
	let detailsData = $state<Map<string, FeeDuesTrackerDTO[]>>(new Map());
	let loadingDetails = $state<Set<string>>(new Set());
	
	// Loading and error state
	let loading = $state(false);
	let error = $state<string | null>(null);
	
	// Available filter options
	let availableYears = $state<number[]>([]);
	let availableCourses = $state<string[]>([]);
	
	onMount(() => {
		loadAggregates();
		loadFilterOptions();
	});
	
	async function loadFilterOptions() {
		try {
			// Get all aggregates to extract available years and courses
			const years = await DuesAggregateService.getAggregateByYear({ statuses: selectedStatuses });
			const courses = await DuesAggregateService.getAggregateByCourse({ statuses: selectedStatuses });
			
			availableYears = years.map(y => y.year).sort((a, b) => b - a);
			availableCourses = courses.map(c => c.course).sort();
		} catch (err) {
			console.error('Error loading filter options:', err);
		}
	}
	
	async function loadAggregates() {
		loading = true;
		error = null;
		
		try {
			const params = {
				statuses: selectedStatuses,
				year: selectedYear || undefined,
				termNumber: selectedTermNumber || undefined,
				course: selectedCourse || undefined
			};
			
			if (groupBy === 'course') {
				courseAggregates = await DuesAggregateService.getAggregateByCourse(params);
			} else if (groupBy === 'year') {
				yearAggregates = await DuesAggregateService.getAggregateByYear(params);
			} else if (groupBy === 'term') {
				termAggregates = await DuesAggregateService.getAggregateByTerm(params);
			}
			
			// Clear expanded items when filters change
			expandedItems.clear();
			detailsData.clear();
		} catch (err) {
			error = 'Failed to load aggregates. Please try again.';
			console.error('Error loading aggregates:', err);
		} finally {
			loading = false;
		}
	}
	
	async function toggleExpand(key: string, params: any) {
		if (expandedItems.has(key)) {
			expandedItems.delete(key);
			expandedItems = new Set(expandedItems);
		} else {
			expandedItems.add(key);
			expandedItems = new Set(expandedItems);
			
			if (!detailsData.has(key)) {
				await loadDetails(key, params);
			}
		}
	}
	
	async function loadDetails(key: string, params: any) {
		loadingDetails.add(key);
		loadingDetails = new Set(loadingDetails);
		
		try {
			const filterParams = {
				statuses: selectedStatuses,
				...params
			};
			
			const details = await FeeDuesService.getDuesWithFilters(filterParams);
			detailsData.set(key, details);
			detailsData = new Map(detailsData);
		} catch (err) {
			console.error('Error loading details:', err);
			error = 'Failed to load details. Please try again.';
		} finally {
			loadingDetails.delete(key);
			loadingDetails = new Set(loadingDetails);
		}
	}
	
	function clearFilters() {
		selectedYear = null;
		selectedTermNumber = null;
		selectedCourse = null;
		loadAggregates();
	}
	
	function formatCurrency(amount: number | null | undefined): string {
		if (amount === null || amount === undefined || isNaN(amount)) {
			return '0.00';
		}
		return amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
	}
	
	function getStatusBadgeClass(status: string): string {
		switch (status) {
			case 'DUE':
				return 'badge-error';
			case 'PARTIALLY_PAID':
				return 'badge-warning';
			case 'PAID':
				return 'badge-success';
			case 'CANCELLED':
				return 'badge-ghost';
			default:
				return 'badge-neutral';
		}
	}
	
	function downloadCSV() {
		let headers: string[] = [];
		let rows: any[][] = [];
		
		if (groupBy === 'course') {
			headers = ['Course', 'Count', 'Total Due'];
			rows = courseAggregates.map(agg => [agg.course, agg.count, agg.totalDue]);
		} else if (groupBy === 'year') {
			headers = ['Year', 'Count', 'Total Due'];
			rows = yearAggregates.map(agg => [agg.year, agg.count, agg.totalDue]);
		} else if (groupBy === 'term') {
			headers = ['Year', 'Term', 'Count', 'Total Due'];
			rows = termAggregates.map(agg => [agg.year, agg.termNumber, agg.count, agg.totalDue]);
		}
		
		const csvContent = [
			headers.join(','),
			...rows.map(row => row.join(','))
		].join('\n');
		
		const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
		const link = document.createElement('a');
		const url = URL.createObjectURL(blob);
		
		link.setAttribute('href', url);
		link.setAttribute('download', `dues-aggregate-${groupBy}-${new Date().toISOString().split('T')[0]}.csv`);
		link.style.visibility = 'hidden';
		
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	}
	
	$effect(() => {
		loadAggregates();
	});
</script>

<svelte:head>
	<title>Fee Dues - Revathi Arts and Music School</title>
</svelte:head>

<div class="container mx-auto p-6 max-w-full">
	<!-- Header -->
	<div class="mb-6">
		<div class="flex justify-between items-start">
			<div>
				<h1 class="text-3xl font-bold mb-2 flex items-center gap-3">
					<IndianRupee class="w-8 h-8 text-error" />
					Fee Dues Dashboard
				</h1>
				<p class="text-base-content/70">
					View and manage pending dues grouped by course, year, or term
				</p>
			</div>
			<button class="btn btn-primary" onclick={downloadCSV}>
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
				Filters & Grouping
			</h2>
			
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
				<!-- Group By -->
				<div class="form-control">
					<label class="label" for="groupBy">
						<span class="label-text font-semibold">Group By</span>
					</label>
					<select
						id="groupBy"
						class="select select-bordered select-primary"
						bind:value={groupBy}
						onchange={() => loadAggregates()}
					>
						<option value="course">Course</option>
						<option value="year">Year</option>
						<option value="term">Term (Year + Number)</option>
					</select>
				</div>
				
				<!-- Status Filter -->
				<div class="form-control">
					<label class="label" for="statusFilter">
						<span class="label-text">Status</span>
					</label>
					<select
						id="statusFilter"
						class="select select-bordered"
						bind:value={selectedStatuses}
						onchange={() => loadAggregates()}
					>
						<option value="DUE,PARTIALLY_PAID">Pending (Due + Partial)</option>
						<option value="DUE">Due Only</option>
						<option value="PARTIALLY_PAID">Partially Paid Only</option>
						<option value="PAID">Paid</option>
						<option value="CANCELLED">Cancelled</option>
						<option value="">All Statuses</option>
					</select>
				</div>
				
				<!-- Year Filter -->
				<div class="form-control">
					<label class="label" for="yearFilter">
						<span class="label-text">Year</span>
					</label>
					<select
						id="yearFilter"
						class="select select-bordered"
						bind:value={selectedYear}
						onchange={() => loadAggregates()}
						disabled={groupBy === 'year'}
					>
						<option value={null}>All Years</option>
						{#each availableYears as year}
							<option value={year}>{year}</option>
						{/each}
					</select>
				</div>
				
				<!-- Term Filter -->
				<div class="form-control">
					<label class="label" for="termFilter">
						<span class="label-text">Term Number</span>
					</label>
					<select
						id="termFilter"
						class="select select-bordered"
						bind:value={selectedTermNumber}
						onchange={() => loadAggregates()}
						disabled={groupBy === 'term'}
					>
						<option value={null}>All Terms</option>
						<option value={1}>Term 1</option>
						<option value={2}>Term 2</option>
						<option value={3}>Term 3</option>
						<option value={4}>Term 4</option>
					</select>
				</div>
				
				<!-- Course Filter -->
				<div class="form-control">
					<label class="label" for="courseFilter">
						<span class="label-text">Course</span>
					</label>
					<select
						id="courseFilter"
						class="select select-bordered"
						bind:value={selectedCourse}
						onchange={() => loadAggregates()}
						disabled={groupBy === 'course'}
					>
						<option value={null}>All Courses</option>
						{#each availableCourses as course}
							<option value={course}>{course}</option>
						{/each}
					</select>
				</div>
			</div>
			
			{#if selectedYear || selectedTermNumber || selectedCourse}
				<div class="flex justify-end">
					<button class="btn btn-sm btn-ghost" onclick={clearFilters}>
						Clear Filters
					</button>
				</div>
			{/if}
		</div>
	</div>

	<!-- Aggregates Display -->
	<div class="card bg-base-100 shadow-xl">
		<div class="card-body">
			<h2 class="card-title mb-4">
				{#if groupBy === 'course'}
					Dues by Course
				{:else if groupBy === 'year'}
					Dues by Year
				{:else}
					Dues by Term
				{/if}
			</h2>
			
			{#if loading}
				<div class="flex justify-center items-center py-12">
					<span class="loading loading-spinner loading-lg"></span>
				</div>
			{:else if error}
				<div class="alert alert-error">
					<span>{error}</span>
				</div>
			{:else if (groupBy === 'course' && courseAggregates.length === 0) || 
			         (groupBy === 'year' && yearAggregates.length === 0) || 
			         (groupBy === 'term' && termAggregates.length === 0)}
				<div class="text-center py-12">
					<p class="text-base-content/50">No dues found with the selected filters</p>
				</div>
			{:else}
				<div class="space-y-2">
					{#if groupBy === 'course'}
						{#each courseAggregates as aggregate}
							{@const key = `course-${aggregate.course}`}
							{@const isExpanded = expandedItems.has(key)}
							{@const isLoadingDetails = loadingDetails.has(key)}
							
							<div class="collapse collapse-arrow bg-base-200">
								<input 
									type="checkbox" 
									checked={isExpanded}
									onchange={() => toggleExpand(key, { course: aggregate.course, year: selectedYear, termNumber: selectedTermNumber })}
								/>
								<div class="collapse-title">
									<div class="flex justify-between items-center">
										<div class="flex items-center gap-4">
											<span class="badge badge-lg badge-primary">{aggregate.course}</span>
											<span class="text-sm text-base-content/70">
												<Users class="w-4 h-4 inline" /> {aggregate.count} {aggregate.count === 1 ? 'due' : 'dues'}
											</span>
										</div>
										<div class="font-bold text-lg text-error">
											₹{formatCurrency(aggregate.totalDue)}
										</div>
									</div>
								</div>
								<div class="collapse-content">
									{#if isLoadingDetails}
										<div class="flex justify-center py-4">
											<span class="loading loading-spinner loading-md"></span>
										</div>
									{:else if detailsData.has(key)}
										{@const details = detailsData.get(key) || []}
										<div class="overflow-x-auto mt-4">
											<table class="table table-sm table-zebra">
												<thead>
													<tr>
														<th>Student ID</th>
														<th>Course</th>
														<th>Year</th>
														<th>Term</th>
														<th class="text-right">Total Fee</th>
														<th class="text-right">Paid</th>
														<th class="text-right">Due</th>
														<th>Status</th>
													</tr>
												</thead>
												<tbody>
													{#each details as due}
														<tr class="hover">
															<td>
																<a 
																	href="/students/{due.studentId}" 
																	target="_blank"
																	rel="noopener noreferrer"
																	class="text-primary hover:text-primary-focus underline"
																>
																	{due.studentId}
																</a>
															</td>
															<td>{due.courseName}</td>
															<td>{due.termYear}</td>
															<td>{due.termNumber}</td>
															<td class="text-right font-mono">₹{formatCurrency(due.totalFee)}</td>
															<td class="text-right font-mono">₹{formatCurrency(due.amountPaid)}</td>
															<td class="text-right font-mono font-bold text-error">₹{formatCurrency(due.amountDue)}</td>
															<td>
																<span class="badge badge-sm {getStatusBadgeClass(due.status)}">
																	{due.status}
																</span>
															</td>
														</tr>
													{/each}
												</tbody>
											</table>
										</div>
									{/if}
								</div>
							</div>
						{/each}
					{:else if groupBy === 'year'}
						{#each yearAggregates as aggregate}
							{@const key = `year-${aggregate.year}`}
							{@const isExpanded = expandedItems.has(key)}
							{@const isLoadingDetails = loadingDetails.has(key)}
							
							<div class="collapse collapse-arrow bg-base-200">
								<input 
									type="checkbox" 
									checked={isExpanded}
									onchange={() => toggleExpand(key, { year: aggregate.year, course: selectedCourse, termNumber: selectedTermNumber })}
								/>
								<div class="collapse-title">
									<div class="flex justify-between items-center">
										<div class="flex items-center gap-4">
											<span class="badge badge-lg badge-primary">Year {aggregate.year}</span>
											<span class="text-sm text-base-content/70">
												<Users class="w-4 h-4 inline" /> {aggregate.count} {aggregate.count === 1 ? 'due' : 'dues'}
											</span>
										</div>
										<div class="font-bold text-lg text-error">
											₹{formatCurrency(aggregate.totalDue)}
										</div>
									</div>
								</div>
								<div class="collapse-content">
									{#if isLoadingDetails}
										<div class="flex justify-center py-4">
											<span class="loading loading-spinner loading-md"></span>
										</div>
									{:else if detailsData.has(key)}
										{@const details = detailsData.get(key) || []}
										<div class="overflow-x-auto mt-4">
											<table class="table table-sm table-zebra">
												<thead>
													<tr>
														<th>Student ID</th>
														<th>Course</th>
														<th>Year</th>
														<th>Term</th>
														<th class="text-right">Total Fee</th>
														<th class="text-right">Paid</th>
														<th class="text-right">Due</th>
														<th>Status</th>
													</tr>
												</thead>
												<tbody>
													{#each details as due}
														<tr class="hover">
															<td>
																<a 
																	href="/students/{due.studentId}" 
																	target="_blank"
																	rel="noopener noreferrer"
																	class="text-primary hover:text-primary-focus underline"
																>
																	{due.studentId}
																</a>
															</td>
															<td>{due.courseName}</td>
															<td>{due.termYear}</td>
															<td>{due.termNumber}</td>
															<td class="text-right font-mono">₹{formatCurrency(due.totalFee)}</td>
															<td class="text-right font-mono">₹{formatCurrency(due.amountPaid)}</td>
															<td class="text-right font-mono font-bold text-error">₹{formatCurrency(due.amountDue)}</td>
															<td>
																<span class="badge badge-sm {getStatusBadgeClass(due.status)}">
																	{due.status}
																</span>
															</td>
														</tr>
													{/each}
												</tbody>
											</table>
										</div>
									{/if}
								</div>
							</div>
						{/each}
					{:else if groupBy === 'term'}
						{#each termAggregates as aggregate}
							{@const key = `term-${aggregate.year}-${aggregate.termNumber}`}
							{@const isExpanded = expandedItems.has(key)}
							{@const isLoadingDetails = loadingDetails.has(key)}
							
							<div class="collapse collapse-arrow bg-base-200">
								<input 
									type="checkbox" 
									checked={isExpanded}
									onchange={() => toggleExpand(key, { year: aggregate.year, termNumber: aggregate.termNumber, course: selectedCourse })}
								/>
								<div class="collapse-title">
									<div class="flex justify-between items-center">
										<div class="flex items-center gap-4">
											<span class="badge badge-lg badge-primary">Year {aggregate.year} - Term {aggregate.termNumber}</span>
											<span class="text-sm text-base-content/70">
												<Users class="w-4 h-4 inline" /> {aggregate.count} {aggregate.count === 1 ? 'due' : 'dues'}
											</span>
										</div>
										<div class="font-bold text-lg text-error">
											₹{formatCurrency(aggregate.totalDue)}
										</div>
									</div>
								</div>
								<div class="collapse-content">
									{#if isLoadingDetails}
										<div class="flex justify-center py-4">
											<span class="loading loading-spinner loading-md"></span>
										</div>
									{:else if detailsData.has(key)}
										{@const details = detailsData.get(key) || []}
										<div class="overflow-x-auto mt-4">
											<table class="table table-sm table-zebra">
												<thead>
													<tr>
														<th>Student ID</th>
														<th>Course</th>
														<th>Year</th>
														<th>Term</th>
														<th class="text-right">Total Fee</th>
														<th class="text-right">Paid</th>
														<th class="text-right">Due</th>
														<th>Status</th>
													</tr>
												</thead>
												<tbody>
													{#each details as due}
														<tr class="hover">
															<td>
																<a 
																	href="/students/{due.studentId}" 
																	target="_blank"
																	rel="noopener noreferrer"
																	class="text-primary hover:text-primary-focus underline"
																>
																	{due.studentId}
																</a>
															</td>
															<td>{due.courseName}</td>
															<td>{due.termYear}</td>
															<td>{due.termNumber}</td>
															<td class="text-right font-mono">₹{formatCurrency(due.totalFee)}</td>
															<td class="text-right font-mono">₹{formatCurrency(due.amountPaid)}</td>
															<td class="text-right font-mono font-bold text-error">₹{formatCurrency(due.amountDue)}</td>
															<td>
																<span class="badge badge-sm {getStatusBadgeClass(due.status)}">
																	{due.status}
																</span>
															</td>
														</tr>
													{/each}
												</tbody>
											</table>
										</div>
									{/if}
								</div>
							</div>
						{/each}
					{/if}
				</div>
			{/if}
		</div>
	</div>
</div>
