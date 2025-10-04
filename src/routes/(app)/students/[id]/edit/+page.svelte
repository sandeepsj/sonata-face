<script lang="ts">
	import { Save, X } from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { StudentService, currentStudentStore, type Student } from '$lib';

	// Get current student from store
	$: currentStudentState = $currentStudentStore;
	$: student = currentStudentState.student;

	// Get student ID from URL
	$: studentId = $page.params.id;

	// Store original data for change comparison (only update when student changes)
	let originalData = {
		studentName: '',
		className: '',
		school: '',
		contactNo: '',
		address: '',
		pinCode: '',
		dob: '',
		status: 'active',
		remarks: ''
	};

	// Form data - separate from reactive updates
	let formData = {
		studentName: '',
		className: '',
		school: '',
		contactNo: '',
		address: '',
		pinCode: '',
		dob: '',
		status: 'active',
		remarks: ''
	};

	// Track if form has been initialized to avoid re-initialization
	let formInitialized = false;

	// Initialize form data when student changes (only once per student)
	$: if (student && student !== null && !formInitialized) {
		const newData = {
			studentName: student.studentName || '',
			className: student.className || '',
			school: student.school || '',
			contactNo: student.contactNo || '',
			address: student.address || '',
			pinCode: student.pinCode || '',
			dob: student.dob || '',
			status: student.status || 'active',
			remarks: student.remarks || ''
		};
		
		originalData = { ...newData };
		formData = { ...newData };
		formInitialized = true;
		console.log('Form initialized with data:', newData);
	}

	let saving = false;
	let errors: Record<string, string> = {};
	let changedFieldsCount = 0;

	// Check if a field has been changed
	function isFieldChanged(fieldName: keyof typeof formData): boolean {
		const changed = formData[fieldName] !== originalData[fieldName];
		// Debug logging
		if (changed) {
			console.log(`Field ${fieldName} changed:`, {
				original: originalData[fieldName],
				current: formData[fieldName]
			});
		}
		return changed;
	}

	// Get only changed fields for API call
	function getChangedFields(): Partial<typeof formData> {
		const changes: Partial<typeof formData> = {};
		
		Object.keys(formData).forEach(key => {
			const fieldKey = key as keyof typeof formData;
			if (isFieldChanged(fieldKey)) {
				changes[fieldKey] = formData[fieldKey];
			}
		});
		
		console.log('Changed fields:', changes);
		return changes;
	}

	// Get count of changed fields - simplified to avoid multiple calls
	$: {
		const changes: Partial<typeof formData> = {};
		
		Object.keys(formData).forEach(key => {
			const fieldKey = key as keyof typeof formData;
			if (formData[fieldKey] !== originalData[fieldKey]) {
				changes[fieldKey] = formData[fieldKey];
			}
		});
		
		changedFieldsCount = Object.keys(changes).length;
		console.log('Changed fields count recalculated:', changedFieldsCount, changes);
	}

	// Reset all changes
	function resetChanges() {
		formData = { ...originalData };
		console.log('Form reset to original data:', originalData);
	}

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

	// Save function with real API call
	async function saveStudent() {
		if (!validateForm()) return;
		
		saving = true;
		
		try {
			const changes = getChangedFields();
			
			// Only proceed if there are changes
			if (Object.keys(changes).length === 0) {
				console.log('No changes to save');
				goto(`/students/${studentId}`);
				return;
			}
			
			console.log('Saving changes:', changes);
			
			// Call the actual API to update student
			const updatedStudent = await StudentService.updateStudent(Number(studentId), changes);
			
			console.log('Student updated successfully:', updatedStudent);
			
			// Update the store with the new student data
			currentStudentStore.updateStudent(updatedStudent);
			
			// Navigate back to overview
			goto(`/students/${studentId}`);
		} catch (error) {
			console.error('Error saving student:', error);
			// You could add a toast notification here for error feedback
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
				<div>
					<h2 class="card-title text-lg">Edit Student Details</h2>
					{#if changedFieldsCount > 0}
						<div class="text-sm text-warning mt-1">
							{changedFieldsCount} field{changedFieldsCount > 1 ? 's' : ''} modified
						</div>
					{:else}
						<div class="text-sm text-base-content/70 mt-1">
							No changes made
						</div>
					{/if}
				</div>
				<div class="flex space-x-2">
					{#if changedFieldsCount > 0}
						<button 
							class="btn btn-ghost btn-sm" 
							on:click={resetChanges}
							disabled={saving}
						>
							Reset Changes
						</button>
					{/if}
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
						class:btn-disabled={changedFieldsCount === 0}
						on:click={saveStudent}
						disabled={saving || changedFieldsCount === 0}
						title="Changed fields: {changedFieldsCount}"
					>
						{#if saving}
							<span class="loading loading-spinner loading-xs mr-2"></span>
							Saving...
						{:else}
							<Save class="w-4 h-4 mr-2" />
							Save Changes ({changedFieldsCount})
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
						{#if isFieldChanged('studentName')}
							<span class="label-text-alt text-warning">• Modified</span>
						{/if}
					</label>
					<input 
						type="text" 
						class="input input-bordered"
						class:input-error={errors.studentName}
						class:input-warning={isFieldChanged('studentName')}
						class:border-warning={isFieldChanged('studentName')}
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
						{#if isFieldChanged('dob')}
							<span class="label-text-alt text-warning">• Modified</span>
						{/if}
					</label>
					<input 
						type="date" 
						class="input input-bordered"
						class:input-warning={isFieldChanged('dob')}
						class:border-warning={isFieldChanged('dob')}
						bind:value={formData.dob}
						disabled={saving}
					/>
				</div>

				<div class="form-control">
					<label class="label">
						<span class="label-text font-medium">Status</span>
						{#if isFieldChanged('status')}
							<span class="label-text-alt text-warning">• Modified</span>
						{/if}
					</label>
					<select 
						class="select select-bordered"
						class:select-warning={isFieldChanged('status')}
						class:border-warning={isFieldChanged('status')}
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
						{#if isFieldChanged('className')}
							<span class="label-text-alt text-warning">• Modified</span>
						{/if}
					</label>
					<input 
						type="text" 
						class="input input-bordered"
						class:input-warning={isFieldChanged('className')}
						class:border-warning={isFieldChanged('className')}
						bind:value={formData.className}
						placeholder="e.g., 10A, Grade 5"
						disabled={saving}
					/>
				</div>

				<div class="form-control">
					<label class="label">
						<span class="label-text font-medium">School</span>
						{#if isFieldChanged('school')}
							<span class="label-text-alt text-warning">• Modified</span>
						{/if}
					</label>
					<input 
						type="text" 
						class="input input-bordered"
						class:input-warning={isFieldChanged('school')}
						class:border-warning={isFieldChanged('school')}
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
						{#if isFieldChanged('contactNo')}
							<span class="label-text-alt text-warning">• Modified</span>
						{/if}
					</label>
					<input 
						type="tel" 
						class="input input-bordered"
						class:input-error={errors.contactNo}
						class:input-warning={isFieldChanged('contactNo') && !errors.contactNo}
						class:border-warning={isFieldChanged('contactNo') && !errors.contactNo}
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
						{#if isFieldChanged('pinCode')}
							<span class="label-text-alt text-warning">• Modified</span>
						{/if}
					</label>
					<input 
						type="text" 
						class="input input-bordered"
						class:input-error={errors.pinCode}
						class:input-warning={isFieldChanged('pinCode') && !errors.pinCode}
						class:border-warning={isFieldChanged('pinCode') && !errors.pinCode}
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
						{#if isFieldChanged('address')}
							<span class="label-text-alt text-warning">• Modified</span>
						{/if}
					</label>
					<textarea 
						class="textarea textarea-bordered h-20"
						class:textarea-warning={isFieldChanged('address')}
						class:border-warning={isFieldChanged('address')}
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
					{#if isFieldChanged('remarks')}
						<span class="label-text-alt text-warning">• Modified</span>
					{/if}
				</label>
				<textarea 
					class="textarea textarea-bordered h-24"
					class:textarea-warning={isFieldChanged('remarks')}
					class:border-warning={isFieldChanged('remarks')}
					bind:value={formData.remarks}
					placeholder="Add any additional notes or remarks about the student"
					disabled={saving}
				></textarea>
			</div>
		</div>
	</div>
</div>