<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { StudentSessionService, CourseService, type StudentSession, type Course, type CreateStudentSessionRequest } from '$lib';
	import { Calendar, BookOpen, Clock, User, AlertCircle, CheckCircle, Plus, X, AlertTriangle } from 'lucide-svelte';

	// Get student ID from URL params
	$: studentId = Number($page.params.id);

	// Component state
	let sessions: StudentSession[] = [];
	let courses: Course[] = [];
	let loading = true;
	let error = '';

	// Enrollment modal state
	let showEnrollmentModal = false;
	let enrollmentLoading = false;
	let selectedCourseId = '';
	let customJoinDate = '';
	let customDisjoinDate = '';
	let sessionType: 'active' | 'historical' = 'active';

	// Filter state
	let sessionFilter: 'all' | 'active' | 'inactive' = 'all';

	// Confirmation modal state
	let showConfirmModal = false;
	let sessionToEnd: StudentSession | null = null;
	let endingSession = false;

	// Computed values
	$: groupedSessions = StudentSessionService.groupSessionsByStatus(sessions);
	$: activeSessions = groupedSessions.active;
	$: inactiveSessions = groupedSessions.inactive;
	
	// Apply filtering
	$: filteredActiveSessions = sessionFilter === 'inactive' ? [] : activeSessions;
	$: filteredInactiveSessions = sessionFilter === 'active' ? [] : inactiveSessions;
	$: totalFilteredSessions = filteredActiveSessions.length + filteredInactiveSessions.length;
	
	// Get enrolled course names to exclude from dropdown
	$: enrolledCourseNames = activeSessions.map(session => session.course.name);
	$: availableCourses = courses.filter(course => !enrolledCourseNames.includes(course.name));

	async function loadStudentSessions() {
		try {
			loading = true;
			error = '';

			// Load both sessions and courses
			const [sessionsData, coursesData] = await Promise.all([
				StudentSessionService.getAllSessionsByStudent(studentId),
				CourseService.getCourses()
			]);
			
			sessions = sessionsData;
			courses = coursesData;

		} catch (err) {
			console.error('Error loading student sessions:', err);
			error = err instanceof Error ? err.message : 'Failed to load student sessions';
		} finally {
			loading = false;
		}
	}

	async function handleDisjoinSession(sessionId: number) {
		// Find the session to end
		const session = sessions.find(s => s.id === sessionId);
		if (!session) {
			error = 'Session not found';
			return;
		}

		// Show confirmation modal
		sessionToEnd = session;
		showConfirmModal = true;
	}

	function cancelEndSession() {
		showConfirmModal = false;
		sessionToEnd = null;
		endingSession = false;
	}

	async function confirmEndSession() {
		if (!sessionToEnd) return;

		try {
			endingSession = true;
			error = '';

			await StudentSessionService.disjoinSession(sessionToEnd.id);
			
			// Close modal and reload data
			showConfirmModal = false;
			sessionToEnd = null;
			await loadStudentSessions();

		} catch (err) {
			console.error('Error ending session:', err);
			error = err instanceof Error ? err.message : 'Failed to end session';
		} finally {
			endingSession = false;
		}
	}

	function openEnrollmentModal() {
		showEnrollmentModal = true;
		selectedCourseId = '';
		customJoinDate = '';
		customDisjoinDate = '';
		sessionType = 'active';
		error = '';
	}

	function closeEnrollmentModal() {
		showEnrollmentModal = false;
		selectedCourseId = '';
		customJoinDate = '';
		customDisjoinDate = '';
		sessionType = 'active';
		error = '';
	}

	async function handleEnrollment() {
		if (!selectedCourseId) {
			error = 'Please select a course';
			return;
		}

		// Validation for historical sessions
		if (sessionType === 'historical') {
			if (!customJoinDate) {
				error = 'Join date is required for historical sessions';
				return;
			}
			if (!customDisjoinDate) {
				error = 'End date is required for historical sessions';
				return;
			}
			
			const joinDate = new Date(customJoinDate);
			const disjoinDate = new Date(customDisjoinDate);
			
			if (disjoinDate <= joinDate) {
				error = 'End date must be after join date';
				return;
			}
		}

		try {
			enrollmentLoading = true;
			error = '';

			const selectedCourse = courses.find(c => c.id === selectedCourseId);
			if (!selectedCourse) {
				error = 'Selected course not found';
				return;
			}

			const enrollmentRequest: CreateStudentSessionRequest = {
				studentId: studentId,
				courseName: selectedCourse.name
			};

			// Add custom join date if specified
			if (customJoinDate) {
				enrollmentRequest.dateOfJoining = new Date(customJoinDate).toISOString();
			}

			// Add custom disjoin date for historical sessions
			if (sessionType === 'historical' && customDisjoinDate) {
				enrollmentRequest.dateOfDisjoining = new Date(customDisjoinDate).toISOString();
			}

			await StudentSessionService.createSession(enrollmentRequest);
			
			// Close modal and reload data
			closeEnrollmentModal();
			await loadStudentSessions();

		} catch (err) {
			console.error('Error enrolling student:', err);
			error = err instanceof Error ? err.message : 'Failed to enroll student in course';
		} finally {
			enrollmentLoading = false;
		}
	}

	onMount(() => {
		loadStudentSessions();
	});
</script>

<svelte:head>
	<title>Student Sessions - Revathi Arts and Music School</title>
</svelte:head>

<div class="container mx-auto p-6 space-y-6">
	<!-- Page Header -->
	<div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
		<div>
			<h1 class="text-3xl font-bold text-base-content flex items-center gap-2">
				<BookOpen class="w-8 h-8 text-primary" />
				Student Sessions
			</h1>
			<p class="text-base-content/70 mt-1">Complete course enrollment history - active and completed sessions</p>
		</div>

		<div class="flex gap-2">
			<button 
				class="btn btn-primary btn-sm"
				on:click={openEnrollmentModal}
				disabled={loading}
			>
				<Plus class="w-4 h-4" />
				Add Session
			</button>
		</div>
	</div>

	<!-- Filter Controls -->
	{#if !loading && sessions.length > 0}
		<div class="card bg-base-100 shadow-sm">
			<div class="card-body p-4">
				<div class="flex flex-wrap gap-4 items-center">
					<div class="flex items-center gap-2">
						<span class="text-sm font-medium">Filter Sessions:</span>
						<div class="btn-group">
							<button 
								class="btn btn-sm"
								class:btn-active={sessionFilter === 'all'}
								on:click={() => sessionFilter = 'all'}
							>
								All ({sessions.length})
							</button>
							<button 
								class="btn btn-sm"
								class:btn-active={sessionFilter === 'active'}
								on:click={() => sessionFilter = 'active'}
							>
								Active ({activeSessions.length})
							</button>
							<button 
								class="btn btn-sm"
								class:btn-active={sessionFilter === 'inactive'}
								on:click={() => sessionFilter = 'inactive'}
							>
								Completed ({inactiveSessions.length})
							</button>
						</div>
					</div>

					{#if sessionFilter !== 'all'}
						<div class="text-sm text-base-content/70">
							Showing {totalFilteredSessions} of {sessions.length} sessions
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}

	<!-- Loading State -->
	{#if loading}
		<div class="flex justify-center items-center py-12">
			<span class="loading loading-spinner loading-lg"></span>
		</div>
	{/if}

	<!-- Error State -->
	{#if error}
		<div class="alert alert-error">
			<AlertCircle class="w-5 h-5" />
			<span>{error}</span>
		</div>
	{/if}

	<!-- Sessions Content -->
	{#if !loading && !error}
		<!-- Summary Stats -->
		<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
			<div class="stat bg-base-100 shadow-sm rounded-lg">
				<div class="stat-figure text-primary">
					<CheckCircle class="w-8 h-8" />
				</div>
				<div class="stat-title">Active Sessions</div>
				<div class="stat-value text-primary">{activeSessions.length}</div>
				<div class="stat-desc">Currently enrolled</div>
			</div>

			<div class="stat bg-base-100 shadow-sm rounded-lg">
				<div class="stat-figure text-secondary">
					<Clock class="w-8 h-8" />
				</div>
				<div class="stat-title">Completed Sessions</div>
				<div class="stat-value text-secondary">{inactiveSessions.length}</div>
				<div class="stat-desc">Previously enrolled</div>
			</div>

			<div class="stat bg-base-100 shadow-sm rounded-lg">
				<div class="stat-figure text-accent">
					<BookOpen class="w-8 h-8" />
				</div>
				<div class="stat-title">Total Sessions</div>
				<div class="stat-value text-accent">{sessions.length}</div>
				<div class="stat-desc">All time</div>
			</div>
		</div>

		<!-- Active Sessions -->
		{#if filteredActiveSessions.length > 0}
			<div class="card bg-base-100 shadow-sm">
				<div class="card-body">
					<h2 class="card-title text-xl flex items-center gap-2">
						<CheckCircle class="w-6 h-6 text-success" />
						Active Sessions ({filteredActiveSessions.length})
					</h2>
					
					<div class="overflow-x-auto">
						<table class="table table-zebra">
							<thead>
								<tr>
									<th>Course</th>
									<th>Joined Date</th>
									<th>Duration</th>
									<th>Status</th>
									<th>Actions</th>
								</tr>
							</thead>
							<tbody>
								{#each filteredActiveSessions as session}
									<tr>
										<td>
											<div class="font-semibold">{session.course.name}</div>
										</td>
										<td>
											<div class="flex items-center gap-2">
												<Calendar class="w-4 h-4 text-base-content/50" />
												{StudentSessionService.formatDate(session.dateOfJoining)}
											</div>
										</td>
										<td>
											<div class="flex items-center gap-2">
												<Clock class="w-4 h-4 text-base-content/50" />
												{StudentSessionService.calculateSessionDuration(session)}
											</div>
										</td>
										<td>
											<div class="badge badge-success">Active</div>
										</td>
										<td>
											<button 
												class="btn btn-error btn-xs"
												on:click={() => handleDisjoinSession(session.id)}
											>
												End Session
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

		<!-- Inactive Sessions -->
		{#if filteredInactiveSessions.length > 0}
			<div class="card bg-base-100 shadow-sm">
				<div class="card-body">
					<h2 class="card-title text-xl flex items-center gap-2">
						<Clock class="w-6 h-6 text-base-content/50" />
						Completed Sessions ({filteredInactiveSessions.length})
					</h2>
					
					<div class="overflow-x-auto">
						<table class="table table-zebra">
							<thead>
								<tr>
									<th>Course</th>
									<th>Joined Date</th>
									<th>Left Date</th>
									<th>Duration</th>
									<th>Status</th>
								</tr>
							</thead>
							<tbody>
								{#each filteredInactiveSessions as session}
									<tr>
										<td>
											<div class="font-semibold">{session.course.name}</div>
										</td>
										<td>
											<div class="flex items-center gap-2">
												<Calendar class="w-4 h-4 text-base-content/50" />
												{StudentSessionService.formatDate(session.dateOfJoining)}
											</div>
										</td>
										<td>
											<div class="flex items-center gap-2">
												<Calendar class="w-4 h-4 text-base-content/50" />
												{session.dateOfDisjoining ? StudentSessionService.formatDate(session.dateOfDisjoining) : 'N/A'}
											</div>
										</td>
										<td>
											<div class="flex items-center gap-2">
												<Clock class="w-4 h-4 text-base-content/50" />
												{StudentSessionService.calculateSessionDuration(session)}
											</div>
										</td>
										<td>
											<div class="badge badge-neutral">Completed</div>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			</div>
		{/if}

		<!-- Empty State -->
		{#if sessions.length === 0}
			<div class="card bg-base-100 shadow-sm">
				<div class="card-body text-center py-12">
					<BookOpen class="w-16 h-16 text-base-content/30 mx-auto mb-4" />
					<h3 class="text-xl font-semibold text-base-content/70 mb-2">No Sessions Found</h3>
					<p class="text-base-content/50 mb-4">This student hasn't been enrolled in any courses yet.</p>
					<button 
						class="btn btn-primary"
						on:click={openEnrollmentModal}
					>
						<Plus class="w-4 h-4" />
						Add First Session
					</button>
				</div>
			</div>
		{/if}
	{/if}
</div>

<!-- Enrollment Modal -->
{#if showEnrollmentModal}
	<div class="modal modal-open">
		<div class="modal-box max-w-2xl">
			<h3 class="font-bold text-lg flex items-center gap-2">
				<Plus class="w-5 h-5 text-primary" />
				Add Session
			</h3>
			
			<div class="py-4 space-y-4">
				<!-- Session Type Selection -->
				<div class="form-control">
					<label class="label">
						<span class="label-text">Session Type</span>
					</label>
					<div class="flex gap-4">
						<label class="label cursor-pointer">
							<input 
								type="radio" 
								name="sessionType" 
								value="active" 
								bind:group={sessionType}
								class="radio radio-primary"
								disabled={enrollmentLoading}
							/>
							<span class="label-text ml-2">Active Session</span>
						</label>
						<label class="label cursor-pointer">
							<input 
								type="radio" 
								name="sessionType" 
								value="historical" 
								bind:group={sessionType}
								class="radio radio-secondary"
								disabled={enrollmentLoading}
							/>
							<span class="label-text ml-2">Historical Session</span>
						</label>
					</div>
					<label class="label">
						<span class="label-text-alt">
							{sessionType === 'active' ? 'Create an ongoing enrollment' : 'Add a completed session from the past'}
						</span>
					</label>
				</div>

				<!-- Course Selection -->
				<div class="form-control">
					<label class="label" for="course-select">
						<span class="label-text">Select Course</span>
					</label>
					<select 
						id="course-select"
						class="select select-bordered w-full"
						bind:value={selectedCourseId}
						disabled={enrollmentLoading}
					>
						<option value="">Choose a course...</option>
						{#if sessionType === 'active'}
							{#each availableCourses as course}
								<option value={course.id}>{course.name}</option>
							{/each}
						{:else}
							{#each courses as course}
								<option value={course.id}>{course.name}</option>
							{/each}
						{/if}
					</select>
					{#if sessionType === 'active' && availableCourses.length === 0}
						<label class="label">
							<span class="label-text-alt text-warning">
								All available courses are already enrolled or no courses available
							</span>
						</label>
					{/if}
				</div>

				<!-- Join Date -->
				<div class="form-control">
					<label class="label" for="join-date">
						<span class="label-text">
							Join Date {sessionType === 'historical' ? '(Required)' : '(Optional)'}
						</span>
					</label>
					<input 
						id="join-date"
						type="datetime-local"
						class="input input-bordered w-full"
						bind:value={customJoinDate}
						disabled={enrollmentLoading}
						required={sessionType === 'historical'}
					/>
					<label class="label">
						<span class="label-text-alt">
							{sessionType === 'active' ? 'Leave empty to use current date and time' : 'When did the student join this course?'}
						</span>
					</label>
				</div>

				<!-- End Date (for historical sessions) -->
				{#if sessionType === 'historical'}
					<div class="form-control">
						<label class="label" for="disjoin-date">
							<span class="label-text">End Date (Required)</span>
						</label>
						<input 
							id="disjoin-date"
							type="datetime-local"
							class="input input-bordered w-full"
							bind:value={customDisjoinDate}
							disabled={enrollmentLoading}
							required
						/>
						<label class="label">
							<span class="label-text-alt">When did the student complete/leave this course?</span>
						</label>
					</div>
				{/if}

				<!-- Error Display -->
				{#if error}
					<div class="alert alert-error">
						<AlertCircle class="w-5 h-5" />
						<span>{error}</span>
					</div>
				{/if}
			</div>

			<div class="modal-action">
				<button 
					class="btn btn-ghost"
					on:click={closeEnrollmentModal}
					disabled={enrollmentLoading}
				>
					<X class="w-4 h-4" />
					Cancel
				</button>
				<button 
					class="btn"
					class:btn-primary={sessionType === 'active'}
					class:btn-secondary={sessionType === 'historical'}
					on:click={handleEnrollment}
					disabled={enrollmentLoading || !selectedCourseId || (sessionType === 'active' && availableCourses.length === 0)}
				>
					{#if enrollmentLoading}
						<span class="loading loading-spinner loading-sm"></span>
					{:else if sessionType === 'active'}
						<CheckCircle class="w-4 h-4" />
					{:else}
						<Calendar class="w-4 h-4" />
					{/if}
					{sessionType === 'active' ? 'Enroll Student' : 'Add Historical Session'}
				</button>
			</div>
		</div>
		<div class="modal-backdrop" on:click={closeEnrollmentModal}></div>
	</div>
{/if}

<!-- End Session Confirmation Modal -->
{#if showConfirmModal && sessionToEnd}
	<div class="modal modal-open">
		<div class="modal-box">
			<div class="flex items-start gap-4">
				<div class="flex-shrink-0">
					<AlertTriangle class="w-8 h-8 text-warning" />
				</div>
				<div class="flex-1">
					<h3 class="font-bold text-lg text-base-content">Confirm End Session</h3>
					<div class="py-4 space-y-3">
						<p class="text-base-content/80">
							Are you sure you want to end this session? This action <strong>cannot be undone</strong>.
						</p>
						
						<div class="bg-base-200 p-4 rounded-lg">
							<div class="space-y-2">
								<div class="flex items-center gap-2">
									<BookOpen class="w-4 h-4 text-base-content/60" />
									<span class="font-semibold">{sessionToEnd.course.name}</span>
								</div>
								<div class="flex items-center gap-2">
									<Calendar class="w-4 h-4 text-base-content/60" />
									<span class="text-sm">
										Started: {StudentSessionService.formatDate(sessionToEnd.dateOfJoining)}
									</span>
								</div>
								<div class="flex items-center gap-2">
									<Clock class="w-4 h-4 text-base-content/60" />
									<span class="text-sm">
										Duration: {StudentSessionService.calculateSessionDuration(sessionToEnd)}
									</span>
								</div>
							</div>
						</div>

						<div class="alert alert-warning">
							<AlertTriangle class="w-5 h-5" />
							<div class="text-sm">
								<div class="font-semibold">Important:</div>
								<ul class="list-disc list-inside mt-1 space-y-1">
									<li>This will mark the session as completed with today's date</li>
									<li>The student will be unenrolled from this course</li>
									<li>This action cannot be reversed</li>
									<li>Historical data will be preserved for reporting</li>
								</ul>
							</div>
						</div>
					</div>
				</div>
			</div>

			<div class="modal-action">
				<button 
					class="btn btn-ghost"
					on:click={cancelEndSession}
					disabled={endingSession}
				>
					<X class="w-4 h-4" />
					Cancel
				</button>
				<button 
					class="btn btn-error"
					on:click={confirmEndSession}
					disabled={endingSession}
				>
					{#if endingSession}
						<span class="loading loading-spinner loading-sm"></span>
					{:else}
						<AlertTriangle class="w-4 h-4" />
					{/if}
					Yes, End Session
				</button>
			</div>
		</div>
		<div class="modal-backdrop" on:click={cancelEndSession}></div>
	</div>
{/if}

<style>
	.stat {
		padding: 1.5rem;
	}
</style>