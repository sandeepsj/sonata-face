<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { 
		Users, 
		Search, 
		ChevronLeft, 
		ChevronRight, 
		Mail, 
		Filter,
		X,
		Calendar,
		MapPin,
		School,
		Hash,
		Phone,
		User,
		ChevronDown,
		ChevronUp
	} from 'lucide-svelte';
	import { StudentService, type Student, type StudentAdvancedSearchParams } from '$lib';

	// Reactive state - much simpler now!
	let students: Student[] = [];
	let loading = false;
	let error = '';
	let currentPage = 0;
	let pageSize = 10;
	let totalElements = 0;
	let totalPages = 0;
	let searchQuery = '';

	// Advanced search state
	let showAdvancedSearch = false;
	let advancedSearchParams: StudentAdvancedSearchParams = {
		name: '',
		contactNo: '',
		admissionNo: '',
		school: '',
		className: '',
		pinCode: '',
		admissionDate: '',
		admissionDateFrom: '',
		admissionDateTo: ''
	};

	// Active filters for display
	$: activeFilters = getActiveFilters();
	$: activeAdvancedFiltersCount = getActiveAdvancedFiltersCount();

	function getActiveAdvancedFiltersCount() {
		return Object.values(advancedSearchParams).filter(v => v !== undefined && v !== null && v !== '').length;
	}

	function getActiveFilters() {
		const filters: Array<{key: string, value: string, label: string}> = [];
		
		if (searchQuery) {
			filters.push({ key: 'searchQuery', value: searchQuery, label: `Name: "${searchQuery}"` });
		}
		
		if (advancedSearchParams.name) {
			filters.push({ key: 'name', value: advancedSearchParams.name, label: `Name: "${advancedSearchParams.name}"` });
		}
		
		if (advancedSearchParams.contactNo) {
			filters.push({ key: 'contactNo', value: advancedSearchParams.contactNo, label: `Phone: "${advancedSearchParams.contactNo}"` });
		}
		
		if (advancedSearchParams.admissionNo) {
			filters.push({ key: 'admissionNo', value: advancedSearchParams.admissionNo, label: `Admission: "${advancedSearchParams.admissionNo}"` });
		}
		
		if (advancedSearchParams.school) {
			filters.push({ key: 'school', value: advancedSearchParams.school, label: `School: "${advancedSearchParams.school}"` });
		}
		
		if (advancedSearchParams.className) {
			filters.push({ key: 'className', value: advancedSearchParams.className, label: `Class: "${advancedSearchParams.className}"` });
		}
		
		if (advancedSearchParams.pinCode) {
			filters.push({ key: 'pinCode', value: advancedSearchParams.pinCode, label: `Pin: "${advancedSearchParams.pinCode}"` });
		}
		
		if (advancedSearchParams.admissionDate) {
			filters.push({ key: 'admissionDate', value: advancedSearchParams.admissionDate, label: `Date: "${advancedSearchParams.admissionDate}"` });
		}
		
		if (advancedSearchParams.admissionDateFrom) {
			filters.push({ key: 'admissionDateFrom', value: advancedSearchParams.admissionDateFrom, label: `From: "${advancedSearchParams.admissionDateFrom}"` });
		}
		
		if (advancedSearchParams.admissionDateTo) {
			filters.push({ key: 'admissionDateTo', value: advancedSearchParams.admissionDateTo, label: `To: "${advancedSearchParams.admissionDateTo}"` });
		}
		
		return filters;
	}

	// Navigation function
	function navigateToStudent(student: Student) {
		const studentId = student.admissionNo || student.admissionId;
		if (studentId) {
			goto(`/students/${studentId}`);
		}
	}

	// Use the refactored service with advanced search support
	async function fetchStudents(page: number = 0, size: number = 10) {
		loading = true;
		error = '';
		
		try {
			// Check if we have any search parameters (quick search or advanced search)
			const hasAdvancedSearch = Object.values(advancedSearchParams).some(v => v !== undefined && v !== null && v !== '');
			const hasQuickSearch = searchQuery && searchQuery.trim() !== '';
			
			let response;
			
			if (hasQuickSearch || hasAdvancedSearch) {
				// Use advanced search for any search (including quick name search)
				const searchParams: StudentAdvancedSearchParams = {
					page,
					size,
					...advancedSearchParams
				};

				// Add quick search as name parameter
				if (hasQuickSearch) {
					searchParams.name = searchQuery.trim();
				}

				// Clean empty values
				Object.keys(searchParams).forEach(key => {
					const value = searchParams[key as keyof StudentAdvancedSearchParams];
					if (value === undefined || value === null || value === '') {
						delete searchParams[key as keyof StudentAdvancedSearchParams];
					}
				});

				response = await StudentService.advancedSearchStudents(searchParams);
			} else {
				// No search parameters, use regular endpoint for listing all students
				response = await StudentService.getStudents({ 
					page, 
					size 
				});
			}
			
			students = response.content;
			totalElements = response.totalElements;
			totalPages = response.totalPages;
			currentPage = response.number;
			pageSize = response.size;
			
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to fetch students';
			console.error('Error fetching students:', err);
			students = [];
			totalElements = 0;
			totalPages = 0;
		} finally {
			loading = false;
		}
	}

	// Navigation functions
	function goToPage(page: number) {
		if (page >= 0 && page < totalPages) {
			fetchStudents(page, pageSize);
		}
	}

	function handleSearch() {
		currentPage = 0; // Reset to first page on search
		fetchStudents(0, pageSize);
	}

	function handleAdvancedSearch() {
		currentPage = 0; // Reset to first page on search
		fetchStudents(0, pageSize);
	}

	function clearFilter(filterKey: string) {
		if (filterKey === 'searchQuery') {
			searchQuery = '';
		} else {
			advancedSearchParams[filterKey as keyof typeof advancedSearchParams] = '';
		}
		// Reset page size to 10 and go to first page
		pageSize = 10;
		currentPage = 0;
		handleSearch();
	}

	function clearAllFilters() {
		searchQuery = '';
		advancedSearchParams = {
			name: '',
			contactNo: '',
			admissionNo: '',
			school: '',
			className: '',
			pinCode: '',
			admissionDate: '',
			admissionDateFrom: '',
			admissionDateTo: ''
		};
		// Reset page size to 10 and go to first page
		pageSize = 10;
		currentPage = 0;
		handleSearch();
	}

	function handlePageSizeChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		pageSize = parseInt(target.value);
		currentPage = 0; // Reset to first page
		fetchStudents(0, pageSize);
	}

	// Load initial data
	onMount(() => {
		fetchStudents();
	});
</script>

<svelte:head>
	<title>Students - Revathi Arts and Music School</title>
</svelte:head>

<div class="container mx-auto p-6">
	<!-- Header -->
	<div class="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
		<div class="flex items-center space-x-3 mb-4 md:mb-0">
			<Users class="w-8 h-8 text-primary" />
			<div>
				<h1 class="text-3xl font-bold">Students</h1>
				<p class="text-base-content/70">Manage student information and enrollment</p>
			</div>
		</div>
		
		<div class="flex items-center space-x-4">
			<button class="btn btn-primary" on:click={() => goto('/students/add')}>
				<Users class="w-4 h-4 mr-2" />
				Add Student
			</button>
		</div>
	</div>

	<!-- Search and Filters -->
	<div class="card bg-base-100 shadow-xl mb-6">
		<div class="card-body">
			<div class="flex flex-col md:flex-row gap-4">
				<!-- Quick Search Input -->
				<div class="flex-1">
					<div class="form-control">
						<label class="label">
							<span class="label-text">Quick Search by Name</span>
						</label>
						<div class="input-group">
							<input
								type="text"
								placeholder="Search students by name..."
								class="input input-bordered flex-1"
								bind:value={searchQuery}
								on:keydown={(e) => e.key === 'Enter' && handleSearch()}
							/>
							<button class="btn btn-square btn-primary" on:click={handleSearch}>
								<Search class="w-5 h-5" />
							</button>
						</div>
					</div>
				</div>

				<!-- Advanced Search Toggle -->
				<div class="form-control">
					<label class="label">
						<span class="label-text">Filters</span>
					</label>
					<div class="relative">
						<button 
							class="btn btn-outline"
							class:btn-active={showAdvancedSearch}
							on:click={() => showAdvancedSearch = !showAdvancedSearch}
						>
							<Filter class="w-4 h-4 mr-2" />
							Advanced
							{#if showAdvancedSearch}
								<ChevronUp class="w-4 h-4 ml-2" />
							{:else}
								<ChevronDown class="w-4 h-4 ml-2" />
							{/if}
						</button>
						<!-- Badge showing active filter count when collapsed -->
						{#if !showAdvancedSearch && activeAdvancedFiltersCount > 0}
							<div class="badge badge-primary badge-sm absolute -top-1 -right-1">
								{activeAdvancedFiltersCount}
							</div>
						{/if}
					</div>
				</div>

				<!-- Page Size Selector -->
				<div class="form-control">
					<label class="label">
						<span class="label-text">Show per page</span>
					</label>
					<select class="select select-bordered" on:change={handlePageSizeChange} value={pageSize}>
						<option value={5}>5</option>
						<option value={10}>10</option>
						<option value={20}>20</option>
						<option value={50}>50</option>
					</select>
				</div>
			</div>

			<!-- Advanced Search Panel -->
			{#if showAdvancedSearch}
				<div class="divider">Advanced Search Options</div>
				<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
					<!-- Name Search -->
					<div class="form-control">
						<label class="label">
							<span class="label-text">
								<User class="w-4 h-4 inline mr-1" />
								Student Name
							</span>
						</label>
						<input
							type="text"
							placeholder="Enter student name"
							class="input input-bordered"
							bind:value={advancedSearchParams.name}
							on:keydown={(e) => e.key === 'Enter' && handleAdvancedSearch()}
						/>
					</div>

					<!-- Contact Number Search -->
					<div class="form-control">
						<label class="label">
							<span class="label-text">
								<Phone class="w-4 h-4 inline mr-1" />
								Contact Number
							</span>
						</label>
						<input
							type="text"
							placeholder="Enter phone number"
							class="input input-bordered"
							bind:value={advancedSearchParams.contactNo}
							on:keydown={(e) => e.key === 'Enter' && handleAdvancedSearch()}
						/>
					</div>

					<!-- Admission Number Search -->
					<div class="form-control">
						<label class="label">
							<span class="label-text">
								<Hash class="w-4 h-4 inline mr-1" />
								Admission Number
							</span>
						</label>
						<input
							type="text"
							placeholder="Enter admission number"
							class="input input-bordered"
							bind:value={advancedSearchParams.admissionNo}
							on:keydown={(e) => e.key === 'Enter' && handleAdvancedSearch()}
						/>
					</div>

					<!-- School Search -->
					<div class="form-control">
						<label class="label">
							<span class="label-text">
								<School class="w-4 h-4 inline mr-1" />
								School
							</span>
						</label>
						<input
							type="text"
							placeholder="Enter school name"
							class="input input-bordered"
							bind:value={advancedSearchParams.school}
							on:keydown={(e) => e.key === 'Enter' && handleAdvancedSearch()}
						/>
					</div>

					<!-- Class Search -->
					<div class="form-control">
						<label class="label">
							<span class="label-text">Class</span>
						</label>
						<input
							type="text"
							placeholder="Enter class"
							class="input input-bordered"
							bind:value={advancedSearchParams.className}
							on:keydown={(e) => e.key === 'Enter' && handleAdvancedSearch()}
						/>
					</div>

					<!-- Pin Code Search -->
					<div class="form-control">
						<label class="label">
							<span class="label-text">
								<MapPin class="w-4 h-4 inline mr-1" />
								Pin Code
							</span>
						</label>
						<input
							type="text"
							placeholder="Enter pin code"
							class="input input-bordered"
							bind:value={advancedSearchParams.pinCode}
							on:keydown={(e) => e.key === 'Enter' && handleAdvancedSearch()}
						/>
					</div>

					<!-- Admission Date -->
					<div class="form-control">
						<label class="label">
							<span class="label-text">
								<Calendar class="w-4 h-4 inline mr-1" />
								Admission Date
							</span>
						</label>
						<input
							type="date"
							class="input input-bordered"
							bind:value={advancedSearchParams.admissionDate}
							on:change={handleAdvancedSearch}
						/>
					</div>

					<!-- Date Range From -->
					<div class="form-control">
						<label class="label">
							<span class="label-text">Date From</span>
						</label>
						<input
							type="date"
							class="input input-bordered"
							bind:value={advancedSearchParams.admissionDateFrom}
							on:change={handleAdvancedSearch}
						/>
					</div>

					<!-- Date Range To -->
					<div class="form-control">
						<label class="label">
							<span class="label-text">Date To</span>
						</label>
						<input
							type="date"
							class="input input-bordered"
							bind:value={advancedSearchParams.admissionDateTo}
							on:change={handleAdvancedSearch}
						/>
					</div>
				</div>

				<!-- Advanced Search Actions -->
				<div class="flex flex-wrap gap-2 mt-4">
					<button class="btn btn-primary" on:click={handleAdvancedSearch}>
						<Search class="w-4 h-4 mr-2" />
						Apply Filters
					</button>
					<button class="btn btn-ghost" on:click={clearAllFilters}>
						<X class="w-4 h-4 mr-2" />
						Clear All
					</button>
				</div>
			{/if}

			<!-- Active Filters Display -->
			{#if activeFilters.length > 0}
				<div class="divider">Active Filters</div>
				<div class="flex flex-wrap gap-2">
					{#each activeFilters as filter}
						<div class="badge badge-primary gap-2">
							{filter.label}
							<button
								class="btn btn-ghost btn-xs btn-circle"
								on:click={() => clearFilter(filter.key)}
							>
								<X class="w-3 h-3" />
							</button>
						</div>
					{/each}
					{#if activeFilters.length > 1}
						<button class="btn btn-ghost btn-xs" on:click={clearAllFilters}>
							Clear All
						</button>
					{/if}
				</div>
			{/if}
		</div>
	</div>

	<!-- Students Table -->
	<div class="card bg-base-100 shadow-xl">
		<div class="card-body">
			{#if loading}
				<!-- Loading State -->
				<div class="flex justify-center items-center py-12">
					<span class="loading loading-spinner loading-lg text-primary"></span>
					<span class="ml-3 text-lg">Loading students...</span>
				</div>
			{:else if error}
				<!-- Error State -->
				<div class="alert alert-error">
					<div>
						<h3 class="font-bold">Error!</h3>
						<div class="text-xs">{error}</div>
					</div>
					<div>
						<button class="btn btn-sm btn-outline" on:click={() => fetchStudents(currentPage, pageSize)}>
							Retry
						</button>
					</div>
				</div>
			{:else if students.length === 0}
				<!-- Empty State -->
				<div class="text-center py-12">
					<Users class="w-16 h-16 text-base-content/30 mx-auto mb-4" />
					<h3 class="text-lg font-semibold mb-2">No students found</h3>
					<p class="text-base-content/70 mb-4">
						{searchQuery ? 'Try adjusting your search criteria' : 'Start by adding your first student'}
					</p>
					<button class="btn btn-primary">
						<Users class="w-4 h-4 mr-2" />
						Add First Student
					</button>
				</div>
			{:else}
				<!-- Students Table -->
				<div class="overflow-x-auto">
					<table class="table table-zebra w-full">
						<thead>
							<tr>
								<th>Admission ID</th>
								<th>Student Name</th>
								<th>Class</th>
								<th>School</th>
								<th>Contact</th>
								<th>Status</th>
							</tr>
						</thead>
						<tbody>
							{#each students as student, index (student.admissionNo || student.admissionId || `student-${index}`)}
								<tr 
									class="hover cursor-pointer" 
									on:click={() => navigateToStudent(student)}
									role="button"
									tabindex="0"
									on:keydown={(e) => e.key === 'Enter' && navigateToStudent(student)}
								>
									<td class="font-mono text-sm">{student.admissionNo || student.admissionId || index + 1}</td>
									<td>
										<div>
											<div class="font-bold">{student.studentName || 'Unknown'}</div>
											{#if student.admissionDate}
												<div class="text-sm text-base-content/70">Admitted: {student.admissionDate}</div>
											{/if}
										</div>
									</td>
									<td>
										<div class="flex items-center space-x-2">
											<div class="badge badge-outline">{student.className || 'N/A'}</div>
										</div>
									</td>
									<td>
										<div class="text-sm">{student.school || 'N/A'}</div>
									</td>
									<td>
										<div class="flex items-center space-x-2">
											<Mail class="w-4 h-4 text-base-content/50" />
											<span class="text-sm">{student.contactNo || 'No contact'}</span>
										</div>
									</td>
									<td>
										<div class="badge" class:badge-success={student.status === 'active'} class:badge-warning={student.status !== 'active'}>
											{student.status || 'Unknown'}
										</div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				<!-- Pagination -->
				<div class="flex flex-col md:flex-row items-center justify-between mt-6 gap-4">
					<!-- Results Info -->
					<div class="text-sm text-base-content/70">
						Showing {currentPage * pageSize + 1} to {Math.min((currentPage + 1) * pageSize, totalElements)} of {totalElements} students
					</div>

					<!-- Pagination Controls -->
					<div class="flex items-center space-x-2">
						<!-- Previous Button -->
						<button
							class="btn btn-outline btn-sm"
							class:btn-disabled={currentPage === 0}
							on:click={() => goToPage(currentPage - 1)}
							disabled={currentPage === 0}
						>
							<ChevronLeft class="w-4 h-4" />
							Previous
						</button>

						<!-- Page Numbers -->
						<div class="flex space-x-1">
							{#each Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
								const startPage = Math.max(0, Math.min(currentPage - 2, totalPages - 5));
								return startPage + i;
							}) as page}
								<button
									class="btn btn-sm"
									class:btn-active={page === currentPage}
									class:btn-outline={page !== currentPage}
									on:click={() => goToPage(page)}
								>
									{page + 1}
								</button>
							{/each}
						</div>

						<!-- Next Button -->
						<button
							class="btn btn-outline btn-sm"
							class:btn-disabled={currentPage >= totalPages - 1}
							on:click={() => goToPage(currentPage + 1)}
							disabled={currentPage >= totalPages - 1}
						>
							Next
							<ChevronRight class="w-4 h-4" />
						</button>
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>