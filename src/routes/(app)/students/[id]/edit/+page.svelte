<script lang="ts">
	import { Save, X, ArrowLeft, RotateCcw } from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { api, currentStudentStore, errorMessage, fieldErrors } from '$lib';
	import ErrorCallout from '$lib/components/ErrorCallout.svelte';

	$: currentStudentState = $currentStudentStore;
	$: student = currentStudentState.student;
	$: studentId = $page.params.id;

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

	let formData = { ...originalData };
	let formInitialized = false;
	let saving = false;
	let errors: Record<string, string> = {};
	let formError = '';
	let changedFieldsCount = 0;

	$: if (student && student !== null && !formInitialized) {
		const newData = {
			studentName: student.studentName || '',
			className: student.className || '',
			school: student.school || '',
			contactNo: student.contactNo || '',
			address: student.address || '',
			pinCode: student.pinCode != null ? String(student.pinCode) : '',
			dob: student.dob || '',
			status: student.status || 'active',
			remarks: student.remarks || ''
		};
		originalData = { ...newData };
		formData = { ...newData };
		formInitialized = true;
	}

	function isFieldChanged(name: keyof typeof formData): boolean {
		return formData[name] !== originalData[name];
	}

	function getChangedFields(): Partial<typeof formData> {
		const changes: Partial<typeof formData> = {};
		Object.keys(formData).forEach((key) => {
			const k = key as keyof typeof formData;
			if (isFieldChanged(k)) changes[k] = formData[k];
		});
		return changes;
	}

	$: {
		const changes: Partial<typeof formData> = {};
		Object.keys(formData).forEach((key) => {
			const k = key as keyof typeof formData;
			if (formData[k] !== originalData[k]) changes[k] = formData[k];
		});
		changedFieldsCount = Object.keys(changes).length;
	}

	function resetChanges() {
		formData = { ...originalData };
	}

	function validateForm() {
		errors = {};
		if (!formData.studentName.trim()) errors.studentName = 'Student name is required';
		if (formData.contactNo && !/^\d{10}$/.test(formData.contactNo.replace(/\D/g, '')))
			errors.contactNo = 'Please enter a valid 10-digit phone number';
		if (formData.pinCode && !/^\d{6}$/.test(formData.pinCode))
			errors.pinCode = 'Please enter a valid 6-digit pin code';
		return Object.keys(errors).length === 0;
	}

	async function saveStudent() {
		if (!validateForm()) return;
		saving = true;
		formError = '';
		try {
			const changes = getChangedFields();
			if (Object.keys(changes).length === 0) {
				goto(`/students/${studentId}`);
				return;
			}
			const updated = await api.students.update(Number(studentId), changes);
			currentStudentStore.updateStudent(updated);
			goto(`/students/${studentId}`);
		} catch (error) {
			formError = errorMessage(error, 'Failed to save student');
			errors = { ...errors, ...fieldErrors(error) };
		} finally {
			saving = false;
		}
	}

	function cancel() {
		goto(`/students/${studentId}`);
	}
</script>

{#if formError}<div style="margin-bottom: 14px;"><ErrorCallout message={formError} /></div>{/if}

<div class="card-s" style="margin-bottom: 18px; position: sticky; top: 70px; z-index: 5;">
	<div class="card-body-s" style="display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap;">
		<div>
			<h3 class="card-title-s">Edit <em style="color: var(--accent); font-style: italic;">student</em></h3>
			{#if changedFieldsCount > 0}
				<div style="font-size: 12px; color: var(--warn); margin-top: 2px;">
					{changedFieldsCount} field{changedFieldsCount > 1 ? 's' : ''} modified
				</div>
			{:else}
				<div style="font-size: 12px; color: var(--fg-muted); margin-top: 2px;">No changes yet</div>
			{/if}
		</div>
		<div style="display: flex; gap: 8px;">
			{#if changedFieldsCount > 0}
				<button class="btn-s btn-ghost-s btn-sm-s" on:click={resetChanges} disabled={saving}>
					<RotateCcw size={12} strokeWidth={1.6} /> Reset
				</button>
			{/if}
			<button class="btn-s btn-secondary-s btn-sm-s" on:click={cancel} disabled={saving}>
				<X size={12} strokeWidth={1.8} /> Cancel
			</button>
			<button class="btn-s btn-primary-s btn-sm-s" on:click={saveStudent} disabled={saving || changedFieldsCount === 0}>
				{#if saving}<span class="spinner"></span>Saving…{:else}<Save size={12} strokeWidth={1.8} /> Save{#if changedFieldsCount > 0} ({changedFieldsCount}){/if}{/if}
			</button>
		</div>
	</div>
</div>

<div class="col-s">
	<div class="card-s">
		<div class="card-header">
			<h3 class="card-title-s">Personal <em style="color: var(--accent); font-style: italic;">details</em></h3>
		</div>
		<div class="card-body-s">
			<div class="grid-2">
				<div class="field">
					<label>
						Student name *
						{#if isFieldChanged('studentName')}<span style="color: var(--warn); margin-left: 6px;">• modified</span>{/if}
					</label>
					<input class="input-s" class:input-error-s={errors.studentName} bind:value={formData.studentName} placeholder="Enter student name" disabled={saving} />
					{#if errors.studentName}<span class="field-error">{errors.studentName}</span>{/if}
				</div>
				<div class="field">
					<label>
						Date of birth
						{#if isFieldChanged('dob')}<span style="color: var(--warn); margin-left: 6px;">• modified</span>{/if}
					</label>
					<input type="date" class="input-s" bind:value={formData.dob} disabled={saving} />
				</div>
				<div class="field">
					<label>
						Status
						{#if isFieldChanged('status')}<span style="color: var(--warn); margin-left: 6px;">• modified</span>{/if}
					</label>
					<select class="select-s" bind:value={formData.status} disabled={saving}>
						<option value="active">Active</option>
						<option value="closed">Closed</option>
						<option value="suspended">Suspended</option>
					</select>
				</div>
			</div>
		</div>
	</div>

	<div class="card-s">
		<div class="card-header">
			<h3 class="card-title-s">School &amp; <em style="color: var(--accent); font-style: italic;">academics</em></h3>
		</div>
		<div class="card-body-s">
			<div class="grid-2">
				<div class="field">
					<label>
						Class
						{#if isFieldChanged('className')}<span style="color: var(--warn); margin-left: 6px;">• modified</span>{/if}
					</label>
					<input class="input-s" bind:value={formData.className} placeholder="e.g. 10A, Grade 5" disabled={saving} />
				</div>
				<div class="field">
					<label>
						School
						{#if isFieldChanged('school')}<span style="color: var(--warn); margin-left: 6px;">• modified</span>{/if}
					</label>
					<input class="input-s" bind:value={formData.school} placeholder="School name" disabled={saving} />
				</div>
			</div>
		</div>
	</div>

	<div class="card-s">
		<div class="card-header">
			<h3 class="card-title-s">Contact</h3>
		</div>
		<div class="card-body-s">
			<div class="grid-2">
				<div class="field">
					<label>
						Phone
						{#if isFieldChanged('contactNo')}<span style="color: var(--warn); margin-left: 6px;">• modified</span>{/if}
					</label>
					<input type="tel" class="input-s" class:input-error-s={errors.contactNo} bind:value={formData.contactNo} placeholder="10-digit number" disabled={saving} />
					{#if errors.contactNo}<span class="field-error">{errors.contactNo}</span>{/if}
				</div>
				<div class="field">
					<label>
						Pin code
						{#if isFieldChanged('pinCode')}<span style="color: var(--warn); margin-left: 6px;">• modified</span>{/if}
					</label>
					<input class="input-s" class:input-error-s={errors.pinCode} bind:value={formData.pinCode} placeholder="6-digit code" maxlength="6" disabled={saving} />
					{#if errors.pinCode}<span class="field-error">{errors.pinCode}</span>{/if}
				</div>
				<div class="field" style="grid-column: span 2;">
					<label>
						Address
						{#if isFieldChanged('address')}<span style="color: var(--warn); margin-left: 6px;">• modified</span>{/if}
					</label>
					<textarea class="input-s" bind:value={formData.address} placeholder="Full address" disabled={saving} style="min-height: 70px; resize: vertical;"></textarea>
				</div>
			</div>
		</div>
	</div>

	<div class="card-s">
		<div class="card-header">
			<h3 class="card-title-s">Notes</h3>
		</div>
		<div class="card-body-s">
			<div class="field">
				<label>
					Remarks
					{#if isFieldChanged('remarks')}<span style="color: var(--warn); margin-left: 6px;">• modified</span>{/if}
				</label>
				<textarea class="input-s" bind:value={formData.remarks} placeholder="Notes about the student…" disabled={saving} style="min-height: 100px; resize: vertical;"></textarea>
			</div>
		</div>
	</div>
</div>
