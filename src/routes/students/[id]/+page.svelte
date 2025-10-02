<script lang="ts">
	import { Calendar, Phone, MapPin, GraduationCap, FileText, School } from 'lucide-svelte';
	import { currentStudentStore, type Student } from '$lib';

	// Get current student from store
	$: currentStudentState = $currentStudentStore;
	$: student = currentStudentState.student;

	// Format date helper
	function formatDate(dateString: string | undefined): string {
		if (!dateString) return 'Not provided';
		try {
			return new Date(dateString).toLocaleDateString('en-US', {
				year: 'numeric',
				month: 'long',
				day: 'numeric'
			});
		} catch {
			return dateString;
		}
	}
</script>

{#if !student}
    <div class="alert alert-warning">
        <div>
            <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current flex-shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
            <span>No student data available.</span>
        </div>
    </div>
{:else}
<div class="space-y-6">
	<!-- Basic Information Card -->
	<div class="card bg-base-100 shadow-sm">
		<div class="card-body">
			<h2 class="card-title text-lg mb-4 flex items-center">
				<GraduationCap class="w-5 h-5 mr-2 text-primary" />
				Basic Information
			</h2>
			
			<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
				<div class="space-y-4">
					<div>
						<label class="text-sm font-medium text-base-content/70">Student Name</label>
						<p class="text-base font-medium">{student?.studentName || 'Not provided'}</p>
					</div>
					
					<div>
						<label class="text-sm font-medium text-base-content/70">Admission No</label>
						<p class="text-base font-mono">{student?.admissionNo || 'Not assigned'}</p>
					</div>
					
					<div>
						<label class="text-sm font-medium text-base-content/70">Date of Birth</label>
						<div class="flex items-center space-x-2">
							<Calendar class="w-4 h-4 text-base-content/50" />
							<p class="text-base">{formatDate(student?.dob)}</p>
						</div>
					</div>
				</div>
				
				<div class="space-y-4">
					<div>
						<label class="text-sm font-medium text-base-content/70">Status</label>
						<div class="flex items-center space-x-2">
							<div class="badge" class:badge-success={student?.status === 'active'} class:badge-warning={student?.status !== 'active'}>
								{student?.status || 'Unknown'}
							</div>
						</div>
					</div>
					
					<div>
						<label class="text-sm font-medium text-base-content/70">Admission Date</label>
						<div class="flex items-center space-x-2">
							<Calendar class="w-4 h-4 text-base-content/50" />
							<p class="text-base">{formatDate(student?.admissionDate)}</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Academic Information Card -->
	<div class="card bg-base-100 shadow-sm">
		<div class="card-body">
			<h2 class="card-title text-lg mb-4 flex items-center">
				<School class="w-5 h-5 mr-2 text-secondary" />
				Academic Information
			</h2>
			
			<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
				<div>
					<label class="text-sm font-medium text-base-content/70">Class</label>
					<p class="text-base">{student.className || 'Not assigned'}</p>
				</div>
				
				<div>
					<label class="text-sm font-medium text-base-content/70">School</label>
					<p class="text-base">{student.school || 'Not provided'}</p>
				</div>
			</div>
		</div>
	</div>

	<!-- Contact Information Card -->
	<div class="card bg-base-100 shadow-sm">
		<div class="card-body">
			<h2 class="card-title text-lg mb-4 flex items-center">
				<Phone class="w-5 h-5 mr-2 text-accent" />
				Contact Information
			</h2>
			
			<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
				<div class="space-y-4">
					<div>
						<label class="text-sm font-medium text-base-content/70">Contact Number</label>
						<div class="flex items-center space-x-2">
							<Phone class="w-4 h-4 text-base-content/50" />
							<p class="text-base">{student.contactNo || 'Not provided'}</p>
						</div>
					</div>
					
					<div>
						<label class="text-sm font-medium text-base-content/70">Pin Code</label>
						<div class="flex items-center space-x-2">
							<MapPin class="w-4 h-4 text-base-content/50" />
							<p class="text-base">{student.pinCode || 'Not provided'}</p>
						</div>
					</div>
				</div>
				
				<div>
					<label class="text-sm font-medium text-base-content/70">Address</label>
					<div class="flex items-start space-x-2">
						<MapPin class="w-4 h-4 text-base-content/50 mt-1" />
						<p class="text-base">{student.address || 'Not provided'}</p>
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Additional Information Card -->
	{#if student && student.remarks}
		<div class="card bg-base-100 shadow-sm">
			<div class="card-body">
				<h2 class="card-title text-lg mb-4 flex items-center">
					<FileText class="w-5 h-5 mr-2 text-info" />
					Remarks
				</h2>
				
				<div class="bg-base-200 p-4 rounded-lg">
					<p class="text-base whitespace-pre-wrap">{student.remarks}</p>
				</div>
			</div>
		</div>
	{/if}

	<!-- Quick Actions Card -->
	<div class="card bg-base-100 shadow-sm">
		<div class="card-body">
			<h2 class="card-title text-lg mb-4">Quick Actions</h2>
			
			<div class="flex flex-wrap gap-3">
				<button class="btn btn-primary btn-sm">
					<GraduationCap class="w-4 h-4 mr-2" />
					Edit Details
				</button>
				<button class="btn btn-outline btn-sm" disabled>
					<FileText class="w-4 h-4 mr-2" />
					View Courses
				</button>
				<button class="btn btn-outline btn-sm" disabled>
					<Phone class="w-4 h-4 mr-2" />
					Send Message
				</button>
				<button class="btn btn-outline btn-sm" disabled>
					<Calendar class="w-4 h-4 mr-2" />
					Schedule Meeting
				</button>
			</div>
		</div>
	</div>
</div>
{/if}