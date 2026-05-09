<script lang="ts">
	import { Save, X, ArrowLeft } from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import { StudentService } from '$lib';

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

	function validateForm() {
		errors = {};
		if (!formData.studentName.trim()) errors.studentName = 'Student name is required';
		if (formData.contactNo && !/^\d{10}$/.test(formData.contactNo.replace(/\D/g, '')))
			errors.contactNo = 'Please enter a valid 10-digit phone number';
		if (formData.pinCode && !/^\d{6}$/.test(formData.pinCode))
			errors.pinCode = 'Please enter a valid 6-digit pin code';
		if (formData.admissionDate && isNaN(new Date(formData.admissionDate).getTime()))
			errors.admissionDate = 'Please enter a valid admission date';
		if (formData.dob) {
			const d = new Date(formData.dob);
			if (isNaN(d.getTime())) errors.dob = 'Please enter a valid date of birth';
			else if (d > new Date()) errors.dob = 'Date of birth cannot be in the future';
		}
		return Object.keys(errors).length === 0;
	}

	async function saveStudent() {
		if (!validateForm()) return;
		saving = true;
		try {
			const studentData: Partial<typeof formData> = {};
			studentData.studentName = formData.studentName.trim();
			if (formData.admissionDate) studentData.admissionDate = formData.admissionDate;
			if (formData.contactNo) studentData.contactNo = formData.contactNo.trim();
			if (formData.dob) studentData.dob = formData.dob;
			if (formData.className) studentData.className = formData.className.trim();
			if (formData.school) studentData.school = formData.school.trim();
			if (formData.address) studentData.address = formData.address.trim();
			if (formData.pinCode) studentData.pinCode = formData.pinCode;
			if (formData.remarks) studentData.remarks = formData.remarks.trim();
			if (formData.status !== 'active') studentData.status = formData.status;

			const created = await StudentService.createStudent(studentData);
			goto(`/students/${created.admissionNo}`);
		} catch (error) {
			console.error('Error creating student:', error);
		} finally {
			saving = false;
		}
	}

	function cancel() {
		goto('/students');
	}

	function setTodayAsAdmissionDate() {
		formData.admissionDate = new Date().toISOString().split('T')[0];
	}
</script>

<svelte:head>
	<title>Add student — Revathi Arts</title>
</svelte:head>

<div class="page">
	<button class="btn-s btn-ghost-s btn-sm-s" on:click={cancel} style="margin-bottom: 12px;">
		<ArrowLeft size={14} strokeWidth={1.6} /> All students
	</button>

	<div class="page-head">
		<div class="page-head-row">
			<div>
				<h1 class="page-title">Admit a <em>student</em></h1>
				<p class="page-subtitle">Create a new student record.</p>
			</div>
			<div style="display: flex; gap: 8px;">
				<button class="btn-s btn-secondary-s" on:click={cancel} disabled={saving}>
					<X size={14} strokeWidth={1.6} /> Cancel
				</button>
				<button class="btn-s btn-primary-s" on:click={saveStudent} disabled={saving}>
					{#if saving}<span class="spinner"></span>Creating…{:else}<Save size={14} strokeWidth={1.8} /> Admit student{/if}
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
						<label>Student name *</label>
						<input class="input-s" class:input-error-s={errors.studentName} bind:value={formData.studentName} placeholder="Full name" disabled={saving} required />
						{#if errors.studentName}<span class="field-error">{errors.studentName}</span>{/if}
					</div>
					<div class="field">
						<label style="display: flex; justify-content: space-between;">
							<span>Admission date</span>
							<button type="button" style="color: var(--accent); background: transparent; border: 0; cursor: pointer; font-size: 11px; padding: 0;" on:click={setTodayAsAdmissionDate} disabled={saving}>Set today</button>
						</label>
						<input type="date" class="input-s" class:input-error-s={errors.admissionDate} bind:value={formData.admissionDate} disabled={saving} />
						{#if errors.admissionDate}<span class="field-error">{errors.admissionDate}</span>{/if}
						<span class="hint">Leave empty to use the current date.</span>
					</div>
					<div class="field">
						<label>Date of birth</label>
						<input type="date" class="input-s" class:input-error-s={errors.dob} bind:value={formData.dob} disabled={saving} />
						{#if errors.dob}<span class="field-error">{errors.dob}</span>{/if}
					</div>
					<div class="field">
						<label>Status</label>
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
						<label>Class</label>
						<input class="input-s" bind:value={formData.className} placeholder="e.g. 10A, Grade 5" disabled={saving} />
					</div>
					<div class="field">
						<label>School</label>
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
						<label>Phone</label>
						<input type="tel" class="input-s" class:input-error-s={errors.contactNo} bind:value={formData.contactNo} placeholder="10-digit number" disabled={saving} />
						{#if errors.contactNo}<span class="field-error">{errors.contactNo}</span>{/if}
					</div>
					<div class="field">
						<label>Pin code</label>
						<input class="input-s" class:input-error-s={errors.pinCode} bind:value={formData.pinCode} placeholder="6-digit code" maxlength="6" disabled={saving} />
						{#if errors.pinCode}<span class="field-error">{errors.pinCode}</span>{/if}
					</div>
					<div class="field" style="grid-column: span 2;">
						<label>Address</label>
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
					<label>Remarks</label>
					<textarea class="input-s" bind:value={formData.remarks} placeholder="Anything else worth noting…" disabled={saving} style="min-height: 100px; resize: vertical;"></textarea>
				</div>
			</div>
		</div>
	</div>
</div>
