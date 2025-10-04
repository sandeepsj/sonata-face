<script lang="ts">
	import { FeeStructureService, feeStructureStore, StudentSessionService, type Course, type FeeStructure, type StudentSession } from '$lib';
	import { Users, Download } from 'lucide-svelte';
	
	// Component state
	let feeStructures: FeeStructure[] = [];
	let loading = true;
	let error = '';
	
	// Student session state
	let expandedCourses = new Set<string>();
	let studentSessions = new Map<string, StudentSession[]>();
	let loadingStudents = new Set<string>();
	let studentSearchYear: number | null = null;
	let studentSearchTerm: number | null = null;
	
	// Subscribe to fee structure store
	$: storeState = $feeStructureStore;
	
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
	
	// Computed values - extract unique courses from loaded fee structures
	$: uniqueCourses = getUniqueCoursesFromFeeStructures(feeStructures);
	
	// Filter fee structures based on selections
	$: filteredFeeStructures = filterFeeStructures(feeStructures, viewMode, selectedCourse);
	$: groupedFeeStructures = groupFeeStructuresByCourse(filteredFeeStructures);
	
	/**
	 * Filter fee structures based on view mode and selected course
	 */
	function filterFeeStructures(
		structures: FeeStructure[], 
		mode: 'by-course' | 'by-year', 
		courseId: string | null
	): FeeStructure[] {
		// If in 'by-course' mode and a specific course is selected, filter by that course
		if (mode === 'by-course' && courseId) {
			return structures.filter(fs => fs.course.id === courseId);
		}
		// Otherwise, return all structures (show all courses for the selected year)
		return structures;
	}
	
	/**
	 * Extract unique courses from fee structures
	 * Returns array of Course objects with id and name
	 */
	function getUniqueCoursesFromFeeStructures(structures: FeeStructure[]): Course[] {
		const coursesMap = new Map<string, Course>();
		structures.forEach(fs => {
			if (!coursesMap.has(fs.course.id)) {
				coursesMap.set(fs.course.id, fs.course);
			}
		});
		return Array.from(coursesMap.values()).sort((a, b) => a.name.localeCompare(b.name));
	}
	
	function groupFeeStructuresByCourse(structures: FeeStructure[]): Map<string, FeeStructure[]> {
		const grouped = new Map<string, FeeStructure[]>();
		
		structures.forEach(fs => {
			const courseId = fs.course.id;
			if (!grouped.has(courseId)) {
				grouped.set(courseId, []);
			}
			grouped.get(courseId)!.push(fs);
		});
		
		// Sort each group by term
		grouped.forEach(courseFeatures => {
			courseFeatures.sort((a, b) => a.term - b.term);
		});
		
		return grouped;
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
			
			// Use fee structure store instead of direct API call
			const feeStructuresData = await feeStructureStore.getByYear(year);
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

	/**
	 * Toggle student list for a course
	 */
	async function toggleStudentList(courseId: string, courseName: string) {
		const key = `${courseId}_${selectedYear}_${studentSearchYear || 'all'}_${studentSearchTerm || 'all'}`;
		
		if (expandedCourses.has(key)) {
			expandedCourses.delete(key);
			expandedCourses = expandedCourses;
			return;
		}

		expandedCourses.add(key);
		expandedCourses = expandedCourses;
		
		// Load student sessions if not already loaded
		if (!studentSessions.has(key)) {
			await loadStudentSessions(courseId, courseName, key);
		}
	}

	/**
	 * Load student sessions based on selected filters
	 */
	async function loadStudentSessions(courseId: string, courseName: string, cacheKey: string) {
		try {
			loadingStudents.add(cacheKey);
			loadingStudents = loadingStudents;
			
			let sessions: StudentSession[] = [];
			
			// Call appropriate API based on selected filters
			if (studentSearchYear !== null && studentSearchTerm !== null) {
				sessions = await StudentSessionService.getStudentsByCourseYearTerm(
					courseName, 
					studentSearchYear, 
					studentSearchTerm
				);
			} else if (studentSearchYear !== null) {
				sessions = await StudentSessionService.getStudentsByCourseAndYear(
					courseName, 
					studentSearchYear
				);
			} else {
				sessions = await StudentSessionService.getStudentsByCourse(courseName);
			}
			
			studentSessions.set(cacheKey, sessions);
			studentSessions = studentSessions;
			
		} catch (err) {
			console.error('Error loading student sessions:', err);
			error = err instanceof Error ? err.message : 'Failed to load student sessions';
		} finally {
			loadingStudents.delete(cacheKey);
			loadingStudents = loadingStudents;
		}
	}

	/**
	 * Check if a student session is active
	 */
	function isSessionActive(session: StudentSession): boolean {
		return session.dateOfDisjoining === null || session.dateOfDisjoining === undefined;
	}

	/**
	 * Format date for display
	 */
	function formatDate(dateString: string | null | undefined): string {
		if (!dateString) return 'N/A';
		const date = new Date(dateString);
		return date.toLocaleDateString('en-GB', { 
			day: '2-digit', 
			month: 'short', 
			year: 'numeric' 
		});
	}

	/**
	 * Apply student search filters
	 */
	function applyStudentFilters() {
		// Clear expanded states and cache when filters change
		expandedCourses.clear();
		studentSessions.clear();
		expandedCourses = expandedCourses;
		studentSessions = studentSessions;
	}

	/**
	 * Reset student search filters
	 */
	function resetStudentFilters() {
		studentSearchYear = null;
		studentSearchTerm = null;
		applyStudentFilters();
	}

	/**
	 * Download student list as CSV
	 */
	function downloadStudentListCSV(courseName: string, sessions: StudentSession[]) {
		// CSV headers
		const headers = ['Admission No', 'Student Name', 'Course', 'Date of Joining', 'Date of Disjoining', 'Status'];
		
		// CSV rows
		const rows = sessions.map(session => [
			session.student.admissionNo || '',
			session.student.studentName || '',
			session.course.name || '',
			formatDate(session.dateOfJoining),
			isSessionActive(session) ? 'Active' : formatDate(session.dateOfDisjoining),
			isSessionActive(session) ? 'Active' : 'Inactive'
		]);
		
		// Combine headers and rows
		const csvContent = [
			headers.join(','),
			...rows.map(row => row.map(cell => `"${cell}"`).join(','))
		].join('\n');
		
		// Create and download file
		const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
		const link = document.createElement('a');
		const url = URL.createObjectURL(blob);
		
		const fileName = `students_${courseName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
		
		link.setAttribute('href', url);
		link.setAttribute('download', fileName);
		link.style.visibility = 'hidden';
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	}

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
							{#each uniqueCourses as course}
								<option value={course.id}>
									{course.name}
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
					{@const courseInfo = courseFeeStructures[0]?.course}
					{@const yearlyFee = FeeStructureService.calculateYearlyFee(courseFeeStructures)}
					{@const studentKey = `${courseId}_${selectedYear}_${studentSearchYear || 'all'}_${studentSearchTerm || 'all'}`}
					{@const isExpanded = expandedCourses.has(studentKey)}
					{@const sessions = studentSessions.get(studentKey) || []}
					{@const isLoadingStudents = loadingStudents.has(studentKey)}
					
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

							<!-- View Students Button -->
							<div class="card-actions justify-end mt-4">
								<button 
									class="btn btn-sm btn-primary"
									on:click={() => toggleStudentList(courseId, courseInfo?.name || courseId)}
								>
									<Users size={16} />
									{isExpanded ? 'Hide Students' : 'View Students'}
								</button>
							</div>

							<!-- Student List Section -->
							{#if isExpanded}
								<div class="divider"></div>
								
								<!-- Student Filters -->
								<div class="bg-base-200 p-4 rounded-lg mb-4">
									<div class="flex flex-wrap gap-4 items-end">
										<div class="form-control">
											<label class="label" for="student-year-{courseId}">
												<span class="label-text">Filter by Year</span>
											</label>
											<select 
												id="student-year-{courseId}"
												class="select select-bordered select-sm w-full max-w-xs"
												bind:value={studentSearchYear}
												on:change={applyStudentFilters}
											>
												<option value={null}>All Years</option>
												{#each availableYears as year}
													<option value={year}>{year}</option>
												{/each}
											</select>
										</div>

										<div class="form-control">
											<label class="label" for="student-term-{courseId}">
												<span class="label-text">Filter by Term</span>
											</label>
											<select 
												id="student-term-{courseId}"
												class="select select-bordered select-sm w-full max-w-xs"
												bind:value={studentSearchTerm}
												on:change={applyStudentFilters}
												disabled={studentSearchYear === null}
											>
												<option value={null}>All Terms</option>
												{#each Array.from({ length: getTermsPerYear(courseId) || 4 }, (_, i) => i + 1) as term}
													<option value={term}>Term {term}</option>
												{/each}
											</select>
										</div>

										<button 
											class="btn btn-outline btn-sm"
											on:click={resetStudentFilters}
										>
											Reset
										</button>

										{#if sessions.length > 0}
											<button 
												class="btn btn-sm btn-success ml-auto"
												on:click={() => downloadStudentListCSV(courseInfo?.name || courseId, sessions)}
											>
												<Download size={16} />
												Export CSV
											</button>
										{/if}
									</div>
								</div>

								<!-- Student Table -->
								{#if isLoadingStudents}
									<div class="flex justify-center items-center py-8">
										<span class="loading loading-spinner loading-md"></span>
									</div>
								{:else if sessions.length === 0}
									<div class="alert alert-info">
										<span>No students found for the selected filters.</span>
									</div>
								{:else}
									<div class="overflow-x-auto">
										<table class="table table-zebra w-full">
											<thead>
												<tr>
													<th>Admission No</th>
													<th>Student Name</th>
													<th>Date of Joining</th>
													<th>Date of Disjoining</th>
													<th>Status</th>
												</tr>
											</thead>
											<tbody>
												{#each sessions as session}
													<tr>
														<td>
															<a 
																href="/students/{session.student.admissionNo}" 
																class="link link-primary font-medium"
																target="_blank"
																rel="noopener noreferrer"
															>
																{session.student.admissionNo}
															</a>
														</td>
														<td>{session.student.studentName}</td>
														<td>{formatDate(session.dateOfJoining)}</td>
														<td>
															{isSessionActive(session) ? '-' : formatDate(session.dateOfDisjoining)}
														</td>
														<td>
															<div class="badge badge-sm"
																 class:badge-success={isSessionActive(session)}
																 class:badge-neutral={!isSessionActive(session)}
															>
																{isSessionActive(session) ? 'Active' : 'Inactive'}
															</div>
														</td>
													</tr>
												{/each}
											</tbody>
										</table>
										<div class="text-sm text-base-content/70 mt-2">
											Total: {sessions.length} student{sessions.length !== 1 ? 's' : ''}
										</div>
									</div>
								{/if}
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	{/if}
</div>