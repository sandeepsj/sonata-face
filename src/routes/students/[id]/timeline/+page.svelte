<script lang="ts">
	import { onMount } from 'svelte';
	import { currentStudentStore } from '$lib/stores/currentStudentStore';
	import { StudentSessionService, type Student, type StudentSession } from '$lib';
	import { 
		Calendar, 
		UserPlus, 
		LogIn, 
		LogOut, 
		IndianRupee, 
		Trash2,
		Clock,
		AlertCircle 
	} from 'lucide-svelte';

	export let student: Student;

	interface TimelineEvent {
		id: string;
		date: string;
		type: 'admission' | 'session-join' | 'session-disjoin' | 'payment' | 'payment-deactivation';
		title: string;
		description: string;
		icon: any;
		iconClass: string;
		data?: any;
	}

	let sessions: StudentSession[] = [];
	let loading = true;
	let error: string | null = null;

	$: currentStudent = student || $currentStudentStore.student;
	$: studentId = currentStudent?.admissionNo;
	$: payments = $currentStudentStore.payments.data;
	$: dues = $currentStudentStore.dues.data;

	// Build timeline events
	$: timelineEvents = buildTimelineEvents(currentStudent, sessions, payments);

	onMount(async () => {
		if (studentId) {
			await loadTimelineData();
		}
	});

	async function loadTimelineData() {
		if (!studentId) {
			error = 'Student ID not available';
			loading = false;
			return;
		}

		loading = true;
		error = null;

		try {
			// Load sessions, payments, and dues
			const [sessionsData] = await Promise.all([
				StudentSessionService.getAllSessionsByStudent(studentId),
				currentStudentStore.fetchPayments(studentId, true),
				currentStudentStore.fetchDues(studentId, true)
			]);

			sessions = sessionsData;
		} catch (err) {
			console.error('Failed to load timeline data:', err);
			error = err instanceof Error ? err.message : 'Failed to load timeline data';
		} finally {
			loading = false;
		}
	}

	function buildTimelineEvents(
		student: Student | null,
		sessions: StudentSession[],
		payments: any[]
	): TimelineEvent[] {
		const events: TimelineEvent[] = [];

		if (!student) return events;

		// Add admission event
		if (student.admissionDate) {
			events.push({
				id: `admission-${student.admissionNo}`,
				date: student.admissionDate,
				type: 'admission',
				title: 'Student Admitted',
				description: `${student.studentName} was admitted to the school`,
				icon: UserPlus,
				iconClass: 'bg-success text-success-content'
			});
		}

		// Add session join events
		sessions.forEach((session) => {
			events.push({
				id: `session-join-${session.id}`,
				date: session.dateOfJoining,
				type: 'session-join',
				title: `Joined ${session.course.name}`,
				description: `Started learning ${session.course.name}`,
				icon: LogIn,
				iconClass: 'bg-primary text-primary-content',
				data: session
			});

			// Add session disjoin events
			if (session.dateOfDisjoining) {
				events.push({
					id: `session-disjoin-${session.id}`,
					date: session.dateOfDisjoining,
					type: 'session-disjoin',
					title: `Left ${session.course.name}`,
					description: `Completed or discontinued ${session.course.name}`,
					icon: LogOut,
					iconClass: 'bg-warning text-warning-content',
					data: session
				});
			}
		});

		// Add payment events
		payments.forEach((payment) => {
			// Only add if payment was originally active (created)
			const wasCreated = payment.createdAt;
			if (wasCreated) {
				const paymentDetails = getPaymentDetails(payment);
				const termInfo = paymentDetails.termYear && paymentDetails.termNumber 
					? ` - Year ${paymentDetails.termYear}, Term ${paymentDetails.termNumber}`
					: '';
				
				events.push({
					id: `payment-${payment.id}`,
					date: payment.date,
					type: 'payment',
					title: `Payment: ${payment.label || 'Fee Payment'}`,
					description: `₹${payment.amountPaid.toLocaleString('en-IN')} paid for ${paymentDetails.courseName || 'fees'}${termInfo}`,
					icon: IndianRupee,
					iconClass: payment.isActive ? 'bg-info text-info-content' : 'bg-base-300 text-base-content opacity-50',
					data: payment
				});

				// Add deactivation event if payment was deactivated
				if (!payment.isActive && payment.updatedAt && payment.updatedAt !== payment.createdAt) {
					events.push({
						id: `payment-deactivation-${payment.id}`,
						date: payment.updatedAt,
						type: 'payment-deactivation',
						title: `Payment Deactivated: ${payment.label || 'Fee Payment'}`,
						description: `Payment of ₹${payment.amountPaid.toLocaleString('en-IN')} was deactivated`,
						icon: Trash2,
						iconClass: 'bg-error text-error-content',
						data: payment
					});
				}
			}
		});

		// Sort events by date (newest first)
		return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
	}

	function getPaymentDetails(payment: any) {
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

	function getRelativeTime(dateStr: string): string {
		const date = new Date(dateStr);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

		if (diffDays === 0) return 'Today';
		if (diffDays === 1) return 'Yesterday';
		if (diffDays < 7) return `${diffDays} days ago`;
		if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
		if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
		return `${Math.floor(diffDays / 365)} years ago`;
	}
</script>

<svelte:head>
	<title>Timeline - {currentStudent?.studentName || 'Student'}</title>
</svelte:head>

<div class="container mx-auto p-6 max-w-5xl">
	<!-- Header -->
	<div class="mb-6">
		<h1 class="text-3xl font-bold mb-2">Student Timeline</h1>
		<p class="text-base-content/70">
			Complete chronological history of {currentStudent?.studentName || 'student'}'s journey
		</p>
	</div>

	<!-- Loading State -->
	{#if loading}
		<div class="flex justify-center items-center py-12">
			<span class="loading loading-spinner loading-lg"></span>
		</div>
	{:else if error}
		<!-- Error State -->
		<div class="alert alert-error">
			<AlertCircle class="h-5 w-5" />
			<span>{error}</span>
		</div>
	{:else if timelineEvents.length === 0}
		<!-- Empty State -->
		<div class="card bg-base-100 shadow-xl">
			<div class="card-body items-center text-center py-12">
				<Clock class="w-16 h-16 text-base-content/30 mb-4" />
				<h3 class="text-xl font-semibold text-base-content/70">No Timeline Events</h3>
				<p class="text-base-content/50">
					No events have been recorded for this student yet.
				</p>
			</div>
		</div>
	{:else}
		<!-- Timeline -->
		<div class="relative">
			<!-- Timeline vertical line -->
			<div class="absolute left-8 top-0 bottom-0 w-0.5 bg-base-300"></div>

			<!-- Timeline Events -->
			<div class="space-y-6">
				{#each timelineEvents as event (event.id)}
					<div class="relative pl-20">
						<!-- Icon circle -->
						<div class="absolute left-0 w-16 h-16 rounded-full {event.iconClass} flex items-center justify-center shadow-lg z-10">
							<svelte:component this={event.icon} class="w-8 h-8" />
						</div>

						<!-- Event card -->
						<div class="card bg-base-100 shadow-md hover:shadow-lg transition-shadow">
							<div class="card-body p-4">
								<div class="flex justify-between items-start gap-4">
									<div class="flex-1">
										<h3 class="font-bold text-lg mb-1">{event.title}</h3>
										<p class="text-sm text-base-content/70 mb-2">{event.description}</p>
										
										<div class="flex items-center gap-4 text-xs text-base-content/60">
											<div class="flex items-center gap-1">
												<Calendar class="w-3 h-3" />
												<span>{formatDate(event.date)}</span>
											</div>
											<div class="flex items-center gap-1">
												<Clock class="w-3 h-3" />
												<span>{getRelativeTime(event.date)}</span>
											</div>
										</div>
									</div>

									<!-- Event type badge -->
									<div class="flex flex-col items-end gap-2">
										{#if event.type === 'admission'}
											<span class="badge badge-success badge-sm">Admission</span>
										{:else if event.type === 'session-join'}
											<span class="badge badge-primary badge-sm">Enrolled</span>
										{:else if event.type === 'session-disjoin'}
											<span class="badge badge-warning badge-sm">Completed</span>
										{:else if event.type === 'payment'}
											<span class="badge badge-info badge-sm">
												{event.data?.paymentType === 'REGULAR' ? 'Regular Payment' : 
												 event.data?.paymentType === 'ADDITIONAL' ? 'Additional Payment' : 
												 'Other Payment'}
											</span>
											{#if !event.data?.isActive}
												<span class="badge badge-ghost badge-sm">Deactivated</span>
											{/if}
										{:else if event.type === 'payment-deactivation'}
											<span class="badge badge-error badge-sm">Deactivated</span>
										{/if}

										<span class="text-xs text-base-content/50">
											{formatDateTime(event.date)}
										</span>
									</div>
								</div>

								<!-- Additional payment details -->
								{#if event.type === 'payment' && event.data}
									<div class="mt-3 pt-3 border-t border-base-300">
										<div class="grid grid-cols-2 gap-2 text-xs">
											<div>
												<span class="text-base-content/60">Amount Paid:</span>
												<span class="font-bold ml-2">₹{event.data.amountPaid.toLocaleString('en-IN')}</span>
											</div>
											{#if event.data.discountAmount > 0}
												<div>
													<span class="text-base-content/60">Discount:</span>
													<span class="font-bold ml-2 text-success">₹{event.data.discountAmount.toLocaleString('en-IN')}</span>
												</div>
											{/if}
										</div>
									</div>
								{/if}

								<!-- Session duration -->
								{#if (event.type === 'session-join' || event.type === 'session-disjoin') && event.data}
									<div class="mt-3 pt-3 border-t border-base-300">
										<div class="text-xs">
											<span class="text-base-content/60">Course:</span>
											<span class="font-medium ml-2">{event.data.course.name}</span>
										</div>
										{#if event.type === 'session-disjoin'}
											<div class="text-xs mt-1">
												<span class="text-base-content/60">Duration:</span>
												<span class="font-medium ml-2">
													{formatDate(event.data.dateOfJoining)} - {formatDate(event.data.dateOfDisjoining)}
												</span>
											</div>
										{/if}
									</div>
								{/if}
							</div>
						</div>
					</div>
				{/each}
			</div>
		</div>

		<!-- Summary Stats -->
		<div class="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
			<div class="card bg-base-100 shadow-sm">
				<div class="card-body p-4 text-center">
					<div class="text-2xl font-bold">{timelineEvents.filter(e => e.type === 'session-join').length}</div>
					<div class="text-xs text-base-content/70">Courses Enrolled</div>
				</div>
			</div>
			<div class="card bg-base-100 shadow-sm">
				<div class="card-body p-4 text-center">
					<div class="text-2xl font-bold">{timelineEvents.filter(e => e.type === 'session-disjoin').length}</div>
					<div class="text-xs text-base-content/70">Courses Completed</div>
				</div>
			</div>
			<div class="card bg-base-100 shadow-sm">
				<div class="card-body p-4 text-center">
					<div class="text-2xl font-bold">{timelineEvents.filter(e => e.type === 'payment' && e.data?.isActive).length}</div>
					<div class="text-xs text-base-content/70">Active Payments</div>
				</div>
			</div>
			<div class="card bg-base-100 shadow-sm">
				<div class="card-body p-4 text-center">
					<div class="text-2xl font-bold">{timelineEvents.filter(e => e.type === 'payment-deactivation').length}</div>
					<div class="text-xs text-base-content/70">Deactivations</div>
				</div>
			</div>
		</div>
	{/if}
</div>
