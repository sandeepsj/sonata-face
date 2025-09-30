<script lang="ts">
	import { onMount } from 'svelte';
	import { Users, Search, ChevronLeft, ChevronRight, Mail } from 'lucide-svelte';
	import { StudentService, type Student } from '$lib';

	// Reactive state - much simpler now!
	let students: Student[] = [];
	let loading = false;
	let error = '';
	let currentPage = 0;
	let pageSize = 10;
	let totalElements = 0;
	let totalPages = 0;
	let searchQuery = '';

	// Use the refactored service
	async function fetchStudents(page: number = 0, size: number = 10, search: string = '') {
		loading = true;
		error = '';
		
		try {
			const response = await StudentService.getStudents({ page, size, search });
			
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
			fetchStudents(page, pageSize, searchQuery);
		}
	}

	function handleSearch() {
		currentPage = 0; // Reset to first page on search
		fetchStudents(0, pageSize, searchQuery);
	}

	function handlePageSizeChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		pageSize = parseInt(target.value);
		currentPage = 0; // Reset to first page
		fetchStudents(0, pageSize, searchQuery);
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
			<button class="btn btn-primary">
				<Users class="w-4 h-4 mr-2" />
				Add Student
			</button>
		</div>
	</div>

	<!-- Search and Filters -->
	<div class="card bg-base-100 shadow-xl mb-6">
		<div class="card-body">
			<div class="flex flex-col md:flex-row gap-4">
				<!-- Search Input -->
				<div class="flex-1">
					<div class="form-control">
						<div class="input-group">
							<input
								type="text"
								placeholder="Search students by name or contact..."
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
						<button class="btn btn-sm btn-outline" on:click={() => fetchStudents(currentPage, pageSize, searchQuery)}>
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
								<th>Contact</th>
								<th>Status</th>
								<th>Actions</th>
							</tr>
						</thead>
						<tbody>
							{#each students as student, index (student.admissionId || `student-${index}`)}
								<tr class="hover">
									<td class="font-mono text-sm">{student.admissionId || index + 1}</td>
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
									<td>
										<div class="flex space-x-2">
											<button class="btn btn-ghost btn-xs">View</button>
											<button class="btn btn-ghost btn-xs">Edit</button>
											<button class="btn btn-ghost btn-xs text-error">Delete</button>
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