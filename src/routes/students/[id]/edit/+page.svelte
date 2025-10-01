<script lang="ts">
	import { Save, X } from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import type { Student } from '$lib';

	// Props from layout
	export let student: Student;

	// Get student ID from URL
	$: studentId = $page.params.id;

	// Form data - initialize with student data reactively
	$: formData = {
		studentName: student?.studentName || '',
		className: student?.className || '',
		school: student?.school || '',
		contactNo: student?.contactNo || '',
		address: student?.address || '',
		pinCode: student?.pinCode || '',
		dob: student?.dob || '',
		status: student?.status || 'active',
		remarks: student?.remarks || ''
	};

	let saving = false;
	let errors: Record<string, string> = {};

	// Validation
	function validateForm() {
		errors = {};
		
		if (!formData.studentName.trim()) {
			errors.studentName = 'Student name is required';
		}
		
		if (formData.contactNo && !/^\d{10}$/.test(formData.contactNo.replace(/\D/g, ''))) {
			errors.contactNo = 'Please enter a valid 10-digit phone number';
		}
		
		if (formData.pinCode && !/^\d{6}$/.test(formData.pinCode)) {
			errors.pinCode = 'Please enter a valid 6-digit pin code';
		}

		return Object.keys(errors).length === 0;
	}

	// Save function (placeholder for now)
	async function saveStudent() {
		if (!validateForm()) return;
		
		saving = true;
		
		try {
			// TODO: Implement StudentService.updateStudent(studentId, formData)
			console.log('Saving student data:', formData);
			
			// Simulate API call
			await new Promise(resolve => setTimeout(resolve, 1000));
			
			// Navigate back to overview
			goto(`/students/${studentId}`);
		} catch (error) {
			console.error('Error saving student:', error);
		} finally {
			saving = false;
		}
	}

	function cancel() {
		goto(`/students/${studentId}`);
	}
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="card bg-base-100 shadow-sm">
		<div class="card-body">
			<div class="flex items-center justify-between">
				<h2 class="card-title text-lg">Edit Student Details</h2>
				<div class="flex space-x-2">
					<button 
						class="btn btn-outline btn-sm" 
						on:click={cancel}
						disabled={saving}
					>
						<X class="w-4 h-4 mr-2" />
						Cancel
					</button>
					<button 
						class="btn btn-primary btn-sm" 
						on:click={saveStudent}
						disabled={saving}
					>
						{#if saving}
							<span class="loading loading-spinner loading-xs mr-2"></span>
							Saving...
						{:else}
							<Save class="w-4 h-4 mr-2" />
							Save Changes
						{/if}
					</button>
				</div>
			</div>
		</div>
	</div>

	<!-- Basic Information Form -->
	<div class="card bg-base-100 shadow-sm">
		<div class="card-body">
			<h3 class="text-lg font-semibold mb-4">Basic Information</h3>
			
			<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
				<div class="form-control">
					<label class="label">
						<span class="label-text font-medium">Student Name *</span>
					</label>
					<input 
						type="text" 
						class="input input-bordered"
						class:input-error={errors.studentName}
						bind:value={formData.studentName}
						placeholder="Enter student name"
						disabled={saving}
					/>
					{#if errors.studentName}
						<label class="label">
							<span class="label-text-alt text-error">{errors.studentName}</span>
						</label>
					{/if}
				</div>

				<div class="form-control">
					<label class="label">
						<span class="label-text font-medium">Date of Birth</span>
					</label>
					<input 
						type="date" 
						class="input input-bordered"
						bind:value={formData.dob}
						disabled={saving}
					/>
				</div>

				<div class="form-control">
					<label class="label">
						<span class="label-text font-medium">Status</span>
					</label>
					<select 
						class="select select-bordered"
						bind:value={formData.status}
						disabled={saving}
					>
						<option value="active">Active</option>
						<option value="inactive">Inactive</option>
						<option value="graduated">Graduated</option>
						<option value="transferred">Transferred</option>
					</select>
				</div>
			</div>
		</div>
	</div>

	<!-- Academic Information Form -->
	<div class="card bg-base-100 shadow-sm">
		<div class="card-body">
			<h3 class="text-lg font-semibold mb-4">Academic Information</h3>
			
			<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
				<div class="form-control">
					<label class="label">
						<span class="label-text font-medium">Class</span>
					</label>
					<input 
						type="text" 
						class="input input-bordered"
						bind:value={formData.className}
						placeholder="e.g., 10A, Grade 5"
						disabled={saving}
					/>
				</div>

				<div class="form-control">
					<label class="label">
						<span class="label-text font-medium">School</span>
					</label>
					<input 
						type="text" 
						class="input input-bordered"
						bind:value={formData.school}
						placeholder="Enter school name"
						disabled={saving}
					/>
				</div>
			</div>
		</div>
	</div>

	<!-- Contact Information Form -->
	<div class="card bg-base-100 shadow-sm">
		<div class="card-body">
			<h3 class="text-lg font-semibold mb-4">Contact Information</h3>
			
			<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
				<div class="form-control">
					<label class="label">
						<span class="label-text font-medium">Contact Number</span>
					</label>
					<input 
						type="tel" 
						class="input input-bordered"
						class:input-error={errors.contactNo}
						bind:value={formData.contactNo}
						placeholder="Enter 10-digit phone number"
						disabled={saving}
					/>
					{#if errors.contactNo}
						<label class="label">
							<span class="label-text-alt text-error">{errors.contactNo}</span>
						</label>
					{/if}
				</div>

				<div class="form-control">
					<label class="label">
						<span class="label-text font-medium">Pin Code</span>
					</label>
					<input 
						type="text" 
						class="input input-bordered"
						class:input-error={errors.pinCode}
						bind:value={formData.pinCode}
						placeholder="Enter 6-digit pin code"
						maxlength="6"
						disabled={saving}
					/>
					{#if errors.pinCode}
						<label class="label">
							<span class="label-text-alt text-error">{errors.pinCode}</span>
						</label>
					{/if}
				</div>

				<div class="form-control md:col-span-2">
					<label class="label">
						<span class="label-text font-medium">Address</span>
					</label>
					<textarea 
						class="textarea textarea-bordered h-20"
						bind:value={formData.address}
						placeholder="Enter full address"
						disabled={saving}
					></textarea>
				</div>
			</div>
		</div>
	</div>

	<!-- Additional Information Form -->
	<div class="card bg-base-100 shadow-sm">
		<div class="card-body">
			<h3 class="text-lg font-semibold mb-4">Additional Information</h3>
			
			<div class="form-control">
				<label class="label">
					<span class="label-text font-medium">Remarks</span>
				</label>
				<textarea 
					class="textarea textarea-bordered h-24"
					bind:value={formData.remarks}
					placeholder="Add any additional notes or remarks about the student"
					disabled={saving}
				></textarea>
			</div>
		</div>
	</div>
</div>