<script lang="ts">
	import { Save, X, Calendar, Users } from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import { StudentService, type Student } from '$lib';

	// Form data with all possible fields
	let formData = {
		studentName: '',
		admissionDate: '',
		contactNo: '',
		dob: '',
		className: '',
		school: '',
		address: '',
		pinCode: '',
		remarks: '',
		status: 'active'
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

		// Validate dates if provided
		if (formData.admissionDate) {
			const admissionDate = new Date(formData.admissionDate);
			if (isNaN(admissionDate.getTime())) {
				errors.admissionDate = 'Please enter a valid admission date';
			}
		}

		if (formData.dob) {
			const dobDate = new Date(formData.dob);
			if (isNaN(dobDate.getTime())) {
				errors.dob = 'Please enter a valid date of birth';
			} else if (dobDate > new Date()) {
				errors.dob = 'Date of birth cannot be in the future';
			}
		}

		return Object.keys(errors).length === 0;
	}

	// Save function with real API call
	async function saveStudent() {
		if (!validateForm()) return;
		
		saving = true;
		
		try {
			// Prepare data for API - only send non-empty fields
			const studentData: Partial<typeof formData> = {};
			
			// Always include student name (required)
			studentData.studentName = formData.studentName.trim();
			
			// Include other fields only if they have values
			if (formData.admissionDate) studentData.admissionDate = formData.admissionDate;
			if (formData.contactNo) studentData.contactNo = formData.contactNo.trim();
			if (formData.dob) studentData.dob = formData.dob;
			if (formData.className) studentData.className = formData.className.trim();
			if (formData.school) studentData.school = formData.school.trim();
			if (formData.address) studentData.address = formData.address.trim();
			if (formData.pinCode) studentData.pinCode = formData.pinCode;
			if (formData.remarks) studentData.remarks = formData.remarks.trim();
			if (formData.status !== 'active') studentData.status = formData.status; // Only include if not default
			
			console.log('Creating student with data:', studentData);
			
			// Call the API to create student
			const createdStudent = await StudentService.createStudent(studentData);
			
			console.log('Student created successfully:', createdStudent);
			
			// Navigate to the new student's detail page
			goto(`/students/${createdStudent.admissionNo}`);
		} catch (error) {
			console.error('Error creating student:', error);
			// You could add a toast notification here for error feedback
		} finally {
			saving = false;
		}
	}

	function cancel() {
		goto('/students');
	}

	// Set today as default admission date
	function setTodayAsAdmissionDate() {
		const today = new Date().toISOString().split('T')[0];
		formData.admissionDate = today;
	}
</script>

<svelte:head>
	<title>Add New Student - Revathi Arts and Music School</title>
</svelte:head>

<div class="container mx-auto p-6">
	<!-- Header -->
	<div class="card bg-base-100 shadow-sm mb-6">
		<div class="card-body">
			<div class="flex items-center justify-between">
				<div class="flex items-center space-x-3">
					<Users class="w-8 h-8 text-primary" />
					<div>
						<h1 class="text-3xl font-bold">Add New Student</h1>
						<p class="text-base-content/70">Create a new student record</p>
					</div>
				</div>
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
							Creating...
						{:else}
							<Save class="w-4 h-4 mr-2" />
							Create Student
						{/if}
					</button>
				</div>
			</div>
		</div>
	</div>

	<div class="space-y-6">
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
							placeholder="Enter student's full name"
							disabled={saving}
							required
						/>
						{#if errors.studentName}
							<label class="label">
								<span class="label-text-alt text-error">{errors.studentName}</span>
							</label>
						{/if}
					</div>

					<div class="form-control">
						<label class="label">
							<span class="label-text font-medium">Admission Date</span>
							<button 
								type="button"
								class="label-text-alt link link-primary"
								on:click={setTodayAsAdmissionDate}
								disabled={saving}
							>
								Set Today
							</button>
						</label>
						<input 
							type="date" 
							class="input input-bordered"
							class:input-error={errors.admissionDate}
							bind:value={formData.admissionDate}
							disabled={saving}
						/>
						{#if errors.admissionDate}
							<label class="label">
								<span class="label-text-alt text-error">{errors.admissionDate}</span>
							</label>
						{/if}
						<label class="label">
							<span class="label-text-alt">Leave empty to use current date</span>
						</label>
					</div>

					<div class="form-control">
						<label class="label">
							<span class="label-text font-medium">Date of Birth</span>
						</label>
						<input 
							type="date" 
							class="input input-bordered"
							class:input-error={errors.dob}
							bind:value={formData.dob}
							disabled={saving}
						/>
						{#if errors.dob}
							<label class="label">
								<span class="label-text-alt text-error">{errors.dob}</span>
							</label>
						{/if}
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
							<option value="closed">Closed</option>
							<option value="suspended">Suspended</option>
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
</div>