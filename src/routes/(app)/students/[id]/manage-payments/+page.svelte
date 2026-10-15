<script lang="ts">
	import { page } from '$app/stores';
	import { Trash2, AlertTriangle, ArrowRightLeft } from 'lucide-svelte';
	import { api, canAccess, currentStudentStore, errorMessage, fieldErrors, toast } from '$lib';
	import type { Course, Due, Payment } from '$lib/api/types';
	import { formatDate } from '$lib/utils/format';
	import { amountCleared, conversionNote, paymentPeriodLabel } from '$lib/utils/payments';
	import Money from '$lib/components/Money.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import ErrorCallout from '$lib/components/ErrorCallout.svelte';
	import FieldError from '$lib/components/FieldError.svelte';
	import PeriodPicker from '$lib/components/PeriodPicker.svelte';

	let studentId = $derived(Number($page.params.id));
	let st = $derived($currentStudentStore);
	let activePayments = $derived(st.payments.data.filter((p) => p.isActive));
	let dues = $derived(st.dues.data);
	let canWrite = $derived($canAccess('/api/payments/**', 'write'));

	// deactivate
	let toDeactivate: Payment | null = $state(null);
	let deactivating = $state(false);
	let deactivateError = $state('');

	// convert
	let toConvert: Payment | null = $state(null);
	let courses: Course[] = $state([]);
	let convertCourse = $state('');
	let convertPeriod = $state('');
	let convertDue: Due | null = $state(null);
	let converting = $state(false);
	let convertError = $state('');
	let convertErrors: Record<string, string> = $state({});

	let sessionCourses = $derived([...new Set(st.sessions.data.map((s) => s.course.name))]);
	let convertOptions = $derived(courses.filter((c) => sessionCourses.includes(c.name)));

	$effect(() => {
		const id = studentId;
		if (!id) return;
		currentStudentStore.fetchPayments(id, true);
		currentStudentStore.fetchDues(id, true);
		currentStudentStore.fetchSessions(id);
	});

	async function deactivate() {
		if (!toDeactivate) return;
		deactivating = true;
		deactivateError = '';
		try {
			await api.payments.deactivate(toDeactivate.id);
			toast.ok(toDeactivate.paymentType === 'REGULAR' ? 'Payment deactivated. Dues are being recalculated.' : 'Payment deactivated');
			toDeactivate = null;
			await currentStudentStore.refreshAfterWrite(studentId);
		} catch (e) {
			deactivateError = errorMessage(e, 'Failed to deactivate payment');
			currentStudentStore.fetchPayments(studentId, true);
		} finally {
			deactivating = false;
		}
	}

	async function openConvert(p: Payment) {
		toConvert = p;
		convertCourse = '';
		convertPeriod = '';
		convertDue = null;
		convertError = '';
		convertErrors = {};
		try {
			courses = await api.courses.list();
		} catch {
			courses = [];
		}
		convertCourse =
			p.courseName && convertOptions.some((c) => c.name === p.courseName)
				? p.courseName
				: convertOptions.length === 1
					? convertOptions[0].name
					: '';
	}

	async function convert() {
		if (!toConvert) return;
		convertErrors = {};
		convertError = '';
		if (!convertCourse) convertErrors.courseName = 'Choose a course';
		if (!convertPeriod) convertErrors.periodDate = 'Choose the period this payment was for';
		if (convertDue && amountCleared(toConvert) > convertDue.balance)
			convertErrors.periodDate = `This payment settles ${amountCleared(toConvert)} but the period's balance is ${convertDue.balance}`;
		if (Object.keys(convertErrors).length) return;
		converting = true;
		try {
			await api.payments.convertToCourseFee(toConvert.id, {
				courseName: convertCourse !== toConvert.courseName ? convertCourse : undefined,
				periodDate: convertPeriod
			});
			toast.ok('Converted to a course fee. Dues are being recalculated.');
			toConvert = null;
			await currentStudentStore.refreshAfterWrite(studentId);
		} catch (e) {
			convertError = errorMessage(e, 'Failed to convert payment');
			convertErrors = fieldErrors(e);
		} finally {
			converting = false;
		}
	}
</script>

<div class="section-row">
	<div>
		<h2 class="section-title-s">Manage <em>payments</em></h2>
		<div style="color: var(--fg-muted); font-size: 13px;">Deactivate payments entered by mistake, or turn an additional payment into a course fee.</div>
	</div>
</div>

<div class="callout" style="margin-bottom: 18px;">
	<AlertTriangle size={18} strokeWidth={1.6} />
	<div>
		<div class="callout-title">Deactivation is permanent</div>
		<div class="callout-body">Payments are never deleted, only deactivated. Deactivating or converting a payment recalculates the student's dues.</div>
	</div>
</div>

{#if st.payments.loading && st.payments.data.length === 0}
	<div style="display: flex; justify-content: center; padding: 60px 0;"><span class="spinner spinner-lg"></span></div>
{:else if st.payments.error}
	<ErrorCallout message={st.payments.error} />
{:else if activePayments.length === 0}
	<div class="card-s">
		<div class="card-body-s">
			<div class="empty-s">
				<div class="glyph">∅</div>
				<div style="font-family: var(--font-serif); font-size: 18px; color: var(--fg); margin-top: 6px;">No active payments</div>
			</div>
		</div>
	</div>
{:else}
	<div class="tbl-wrap">
		<div style="padding: 14px 16px; border-bottom: 1px solid var(--border); background: var(--bg-elev);">
			<h3 class="card-title-s">Active payments ({activePayments.length})</h3>
		</div>
		<div style="overflow-x: auto;">
			<table class="tbl">
				<thead>
					<tr>
						<th>Date</th><th>Label</th><th>Type</th><th>Course</th><th>Period</th>
						<th style="text-align: right;">Paid</th><th style="text-align: right;">Discount</th><th style="text-align: right;">Total</th>
						{#if canWrite}<th style="text-align: right;">Actions</th>{/if}
					</tr>
				</thead>
				<tbody>
					{#each activePayments as p (p.id)}
						<tr>
							<td class="strong">{formatDate(p.date)}</td>
							<td>
								{p.label || '—'}
								{#if p.remarks}<div class="muted" style="font-size: 11px;">{p.remarks}</div>{/if}
								{#if conversionNote(p)}<div class="muted" style="font-size: 11px;">{conversionNote(p)}</div>{/if}
							</td>
							<td><StatusBadge status={p.paymentType} /></td>
							<td>{p.courseName || '—'}</td>
							<td>{paymentPeriodLabel(p, dues)}</td>
							<td class="num" style="text-align: right;"><Money value={p.amountPaid} /></td>
							<td class="num" style="text-align: right;"><Money value={p.discountAmount || 0} /></td>
							<td class="num strong" style="text-align: right;"><Money value={amountCleared(p)} /></td>
							{#if canWrite}
								<td style="text-align: right; white-space: nowrap;">
									{#if p.paymentType === 'ADDITIONAL'}
										<button class="btn-s btn-secondary-s btn-sm-s" onclick={() => openConvert(p)} title="Staff recorded this as additional by mistake">
											<ArrowRightLeft size={12} strokeWidth={1.8} /> Convert to course fee
										</button>
									{/if}
									<button class="btn-s btn-secondary-s btn-sm-s" style="color: var(--danger); border-color: var(--danger-soft);" onclick={() => { toDeactivate = p; deactivateError = ''; }}>
										<Trash2 size={12} strokeWidth={1.8} /> Deactivate
									</button>
								</td>
							{/if}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
{/if}

<Modal open={toDeactivate !== null} title="Deactivate payment?" subtitle="This can't be undone." busy={deactivating} onClose={() => (toDeactivate = null)}>
	{#if toDeactivate}
		<div class="card-s" style="background: var(--bg-elev); margin-bottom: 14px;">
			<div class="card-body-s" style="display: flex; flex-direction: column; gap: 8px; font-size: 13px;">
				<div style="display: flex; justify-content: space-between;"><span class="muted">Date</span><span class="strong">{formatDate(toDeactivate.date)}</span></div>
				<div style="display: flex; justify-content: space-between;"><span class="muted">Label</span><span class="strong">{toDeactivate.label}</span></div>
				<div style="display: flex; justify-content: space-between;"><span class="muted">Type</span><StatusBadge status={toDeactivate.paymentType} /></div>
				<div style="display: flex; justify-content: space-between;"><span class="muted">Course · period</span><span class="strong">{toDeactivate.courseName || '—'} · {paymentPeriodLabel(toDeactivate, dues)}</span></div>
				<div style="display: flex; justify-content: space-between;"><span class="muted">Paid + discount</span><span class="strong"><Money value={toDeactivate.amountPaid} /> + <Money value={toDeactivate.discountAmount} /></span></div>
			</div>
		</div>
		{#if toDeactivate.paymentType === 'REGULAR'}
			<div class="callout"><div class="callout-body">The period's balance goes back up by the amount paid plus discounts.</div></div>
		{/if}
		<div style="margin-top: 12px;"><ErrorCallout message={deactivateError} /></div>
	{/if}
	{#snippet footer()}
		<button class="btn-s btn-secondary-s" onclick={() => (toDeactivate = null)} disabled={deactivating}>Cancel</button>
		<button class="btn-s btn-danger-s" onclick={deactivate} disabled={deactivating}>{#if deactivating}<span class="spinner"></span>{/if}Deactivate</button>
	{/snippet}
</Modal>

<Modal open={toConvert !== null} title="Convert to course fee" subtitle={toConvert ? `"${toConvert.label}" · ${formatDate(toConvert.date)} · settles ₹${amountCleared(toConvert)}` : ''} size="lg" busy={converting} onClose={() => (toConvert = null)}>
	{#if toConvert}
		<div style="display:flex; flex-direction:column; gap: 14px;">
			<div class="callout info"><div class="callout-body">The payment keeps its amount, date, discounts and remarks. It becomes a course fee for the chosen period, and the conversion is recorded with your name.</div></div>
			<div class="field">
				<label for="cv-course">Course *</label>
				<select id="cv-course" class="input-s" bind:value={convertCourse} disabled={converting}>
					<option value="">Choose a course…</option>
					{#each convertOptions as c}<option value={c.name}>{c.name}</option>{/each}
				</select>
				<FieldError errors={convertErrors} field="courseName" />
			</div>
			<div class="field">
				<span class="kpi-label">Period *</span>
				<PeriodPicker {studentId} courseName={convertCourse} bind:value={convertPeriod} bind:due={convertDue} disabled={converting} />
				<FieldError errors={convertErrors} field="periodDate" />
			</div>
			<ErrorCallout message={convertError} />
		</div>
	{/if}
	{#snippet footer()}
		<button class="btn-s btn-secondary-s" onclick={() => (toConvert = null)} disabled={converting}>Cancel</button>
		<button class="btn-s btn-primary-s" onclick={convert} disabled={converting}>{#if converting}<span class="spinner"></span>{/if}Convert</button>
	{/snippet}
</Modal>
