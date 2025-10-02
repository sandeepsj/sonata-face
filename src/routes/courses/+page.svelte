<script lang="ts">
	import { onMount } from 'svelte';
	import { CourseService, FeeStructureService, type Course, type FeeStructure } from '$lib';
	
	// Component state
	let courses: Course[] = [];
	let feeStructures: FeeStructure[] = [];
	let loading = true;
	let error = '';
	
	// View state
	let selectedYear: number;
	let selectedCourse: string | null = null;
	let viewMode: 'by-course' | 'by-year' = 'by-year';
	
	// Generate year range: 10 years back to 1 year future (in reverse order)
	const currentYear = new Date().getFullYear();
	const availableYears = Array.from(
		{ length: 12 }, 
		(_, i) => currentYear + 1 - i
	);
	
	// Set default to current year
	selectedYear = currentYear;
	
	// Computed values
	$: uniqueCourseIds = FeeStructureService.getUniqueCoursesFromFeeStructures(feeStructures);
	
	// Filter fee structures based on selections
	$: filteredFeeStructures = filterFeeStructures(feeStructures, viewMode, selectedYear, selectedCourse);
	$: groupedFeeStructures = FeeStructureService.groupFeeStructuresByCourse(filteredFeeStructures);
	
	function filterFeeStructures(
		structures: FeeStructure[], 
		mode: string, 
		year: number, 
		course: string | null
	): FeeStructure[] {
		let filtered = [...structures];
		
		// Always filter by year since we only have year-based API
		filtered = filtered.filter(fs => fs.year === year);
		
		if (mode === 'by-course' && course) {
			filtered = filtered.filter(fs => fs.course.id === course);
		}
		
		return filtered;
	}
	
	function getCourseInfo(courseId: string): Course | undefined {
		return courses.find(c => c.id === courseId);
	}

	/**
	 * Calculate month range for a specific term based on course's terms per year
	 * Term 1 always starts with January, terms are evenly distributed throughout the year
	 */
	function getTermMonthRange(termNumber: number, termsPerYear: number): string {
		// Calendar year months (January to December)
		const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
		
		if (termsPerYear <= 0 || termNumber <= 0 || termNumber > termsPerYear) {
			return 'Invalid';
		}
		
		// Calculate months per term (12 months / number of terms)
		const monthsPerTerm = 12 / termsPerYear;
		
		// Calculate start and end month indices for this term (Term 1 starts at index 0 = January)
		const startMonthIndex = Math.floor((termNumber - 1) * monthsPerTerm);
		const endMonthIndex = Math.floor(termNumber * monthsPerTerm) - 1;
		
		// Handle edge case where end month goes beyond array length
		const safeEndMonthIndex = Math.min(endMonthIndex, months.length - 1);
		
		const startMonth = months[startMonthIndex];
		const endMonth = months[safeEndMonthIndex];
		
		// If same month (very short terms), show just one month
		if (startMonth === endMonth) {
			return startMonth;
		}
		
		return `${startMonth} - ${endMonth}`;
	}

	/**
	 * Get terms per year for a specific course in the selected year
	 */
	function getTermsPerYear(courseId: string): number {
		return FeeStructureService.getTermsPerYear(courseId, selectedYear, feeStructures);
	}
	
	function handleViewModeChange(mode: 'by-course' | 'by-year') {
		viewMode = mode;
		if (mode === 'by-year') {
			selectedCourse = null;
		}
	}
	
	function resetFilters() {
		viewMode = 'by-year';
		selectedYear = currentYear;
		selectedCourse = null;
	}
	
	async function loadFeeStructuresForYear(year: number) {
		try {
			loading = true;
			error = '';
			
			const feeStructuresData = await FeeStructureService.getFeeStructuresByYear(year);
			feeStructures = feeStructuresData;
			
		} catch (err) {
			console.error('Error loading fee structures:', err);
			error = err instanceof Error ? err.message : 'Failed to load fee structure data';
		} finally {
			loading = false;
		}
	}
	
	// Load fee structures when year changes
	$: if (selectedYear) {
		loadFeeStructuresForYear(selectedYear);
	}
	
	async function loadData() {
		try {
			loading = true;
			error = '';
			
			// Only load courses - fee structures will be loaded reactively based on selectedYear
			const coursesData = await CourseService.getCourses();
			courses = coursesData;
			
		} catch (err) {
			console.error('Error loading courses:', err);
			error = err instanceof Error ? err.message : 'Failed to load course data';
		} finally {
			loading = false;
		}
	}
	
	onMount(() => {
		loadData();
	});
</script>

<svelte:head>
	<title>Courses & Fee Structure - Revathi Arts and Music School</title>
</svelte:head>

<div class="container mx-auto p-6 space-y-6">
	<!-- Page Header -->
	<div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
		<div>
			<h1 class="text-3xl font-bold text-base-content">Courses & Fee Structure</h1>
			<p class="text-base-content/70 mt-1">View all courses and their fee structures</p>
		</div>
		
		<!-- View Mode Controls -->
		<div class="flex flex-wrap gap-2">
			<div class="btn-group">
				<button 
					class="btn btn-sm"
					class:btn-active={viewMode === 'by-year'}
					on:click={() => handleViewModeChange('by-year')}
				>
					By Year
				</button>
				<button 
					class="btn btn-sm"
					class:btn-active={viewMode === 'by-course'}
					on:click={() => handleViewModeChange('by-course')}
				>
					By Course
				</button>
			</div>
		</div>
	</div>
	
	<!-- Filter Controls -->
	<div class="card bg-base-100 shadow-sm">
		<div class="card-body p-4">
			<div class="flex flex-wrap gap-4 items-end">
				<div class="form-control">
					<label class="label" for="year-select">
						<span class="label-text">Select Year</span>
					</label>
					<select 
						id="year-select"
						class="select select-bordered select-sm w-full max-w-xs"
						bind:value={selectedYear}
					>
						{#each availableYears as year}
							<option value={year}>{year}</option>
						{/each}
					</select>
				</div>

				{#if viewMode === 'by-course'}
					<div class="form-control">
						<label class="label" for="course-select">
							<span class="label-text">Select Course</span>
						</label>
						<select 
							id="course-select"
							class="select select-bordered select-sm w-full max-w-xs"
							bind:value={selectedCourse}
						>
							<option value={null}>All courses</option>
							{#each uniqueCourseIds as courseId}
								{@const courseInfo = getCourseInfo(courseId)}
								<option value={courseId}>
									{courseInfo?.name || courseId}
								</option>
							{/each}
						</select>
					</div>
				{/if}
				
				<button 
					class="btn btn-outline btn-sm"
					on:click={resetFilters}
				>
					Reset Filters
				</button>
			</div>
		</div>
	</div>
	
	<!-- Loading State -->
	{#if loading}
		<div class="flex justify-center items-center py-12">
			<span class="loading loading-spinner loading-lg"></span>
		</div>
	{/if}
	
	<!-- Error State -->
	{#if error}
		<div class="alert alert-error">
			<span>{error}</span>
		</div>
	{/if}
	
	<!-- Content -->
	{#if !loading && !error}
		{#if filteredFeeStructures.length === 0}
			<div class="card bg-base-100 shadow-sm">
				<div class="card-body text-center py-12">
					<h3 class="text-lg font-semibold text-base-content/70">No fee structures found</h3>
					<p class="text-base-content/60">Try adjusting your filters or check back later.</p>
				</div>
			</div>
		{:else}
			<!-- Course Fee Structure Cards -->
			<div class="grid gap-6">
				{#each Array.from(groupedFeeStructures.entries()) as [courseId, courseFeeStructures]}
					{@const courseInfo = getCourseInfo(courseId)}
					{@const yearlyFee = FeeStructureService.calculateYearlyFee(courseFeeStructures)}
					
					<div class="card bg-base-100 shadow-lg">
						<div class="card-body">
							<!-- Course Header -->
							<div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
								<div>
									<h2 class="card-title text-xl">{courseInfo?.name || courseId}</h2>
									<div class="flex gap-4 text-sm text-base-content/70">
										<span>Terms per year: {getTermsPerYear(courseId) || 'N/A'}</span>
										{#if courseFeeStructures.length > 0}
											<span>Year: {courseFeeStructures[0].year}</span>
										{/if}
									</div>
								</div>
								
								<div class="stats shadow">
									<div class="stat">
										<div class="stat-title">Annual Fee</div>
										<div class="stat-value text-lg">₹{yearlyFee.toLocaleString()}</div>
									</div>
								</div>
							</div>
							
							<!-- Fee Structure Table -->
							<div class="overflow-x-auto">
								<table class="table table-zebra w-full">
									<thead>
										<tr>
											<th>Term</th>
											<th>Duration</th>
											<th>Fee Amount</th>
											<th>Status</th>
										</tr>
									</thead>
									<tbody>
										{#each courseFeeStructures as feeStructure}
											{@const courseInfo = getCourseInfo(feeStructure.course.id)}
											{@const termsPerYear = getTermsPerYear(feeStructure.course.id)}
											<tr>
												<td>
													<div class="font-medium">Term {feeStructure.term}</div>
												</td>
												<td>
													<div class="text-sm text-base-content/70">
														{termsPerYear > 0 ? getTermMonthRange(feeStructure.term, termsPerYear) : 'N/A'}
													</div>
												</td>
												<td>
													<div class="font-semibold">₹{feeStructure.amount.toLocaleString()}</div>
												</td>
												<td>
													<div class="badge badge-sm"
														 class:badge-success={feeStructure.isActive}
														 class:badge-neutral={!feeStructure.isActive}
													>
														{feeStructure.isActive ? 'Active' : 'Inactive'}
													</div>
												</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	{/if}
</div>