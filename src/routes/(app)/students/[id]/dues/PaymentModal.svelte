<script lang="ts">
	// Record a course-fee (REGULAR) payment against one billing period.
	import { untrack } from 'svelte';
	import { Trash2, Plus, Tag } from 'lucide-svelte';
	import { api, currentStudentStore, errorMessage, fieldErrors, toast } from '$lib';
	import type { Course, DiscountInput, Due } from '$lib/api/types';
	import { dateTimeLocalInput, formatPeriod, fromDateTimeLocalInput, money } from '$lib/utils/format';
	import { discountProblem, filledDiscounts, totalDiscount } from '$lib/utils/discounts';
	import Modal from '$lib/components/Modal.svelte';
	import PeriodPicker from '$lib/components/PeriodPicker.svelte';
	import ErrorCallout from '$lib/components/ErrorCallout.svelte';
	import FieldError from '$lib/components/FieldError.svelte';

	interface Props {
		open: boolean;
		studentId: number;
		/** Pre-select this due's course and period */
		due?: Due | null;
		onClose: () => void;
	}
	let { open, studentId, due = null, onClose }: Props = $props();

	let courses: Course[] = $state([]);
	let courseName = $state('');
	let periodDate = $state('');
	let pickedDue: Due | null = $state(null);
	let amountPaid: number | '' = $state('');
	let label = $state('');
	let remarks = $state('');
	let date = $state(dateTimeLocalInput());
	let discounts: DiscountInput[] = $state([]);

	let saving = $state(false);
	let formError = $state('');
	let errors: Record<string, string> = $state({});

	// courses the student has (had) a session in, limited to active ones
	let sessionCourses = $derived([...new Set($currentStudentStore.sessions.data.map((s) => s.course.name))]);
	let courseOptions = $derived(courses.filter((c) => sessionCourses.includes(c.name)));

	let discountTotal = $derived(totalDiscount(filledDiscounts(discounts)));
	let applied = $derived((Number(amountPaid) || 0) + discountTotal);

	$effect(() => {
		if (open) untrack(reset);
	});

	async function reset() {
		courseName = due?.courseName ?? '';
		periodDate = due?.periodStart ?? '';
		pickedDue = due;
		amountPaid = due ? due.balance : '';
		label = '';
		remarks = '';
		date = dateTimeLocalInput();
		discounts = [];
		formError = '';
		errors = {};
		try {
			courses = await api.courses.list();
		} catch {
			courses = [];
		}
		if (!courseName && courseOptions.length === 1) courseName = courseOptions[0].name;
	}

	// default the amount and label when the period changes
	let lastPeriod = '';
	$effect(() => {
		const key = `${courseName}|${periodDate}`;
		untrack(() => onPeriodChange(key));
	});
	function onPeriodChange(key: string) {
		if (key === lastPeriod) return;
		lastPeriod = key;
		if (pickedDue && pickedDue.periodStart === periodDate) {
			if (!due || due.periodStart !== periodDate || amountPaid === '') amountPaid = pickedDue.balance;
			label = `${courseName} fee · ${formatPeriod(pickedDue.periodStart, pickedDue.periodEnd)}`;
		} else if (periodDate) {
			label = `${courseName} fee`;
		}
	}

	function addDiscount() {
		discounts = [...discounts, { discountAmount: 0, label: '' }];
	}
	function removeDiscount(i: number) {
		discounts = discounts.filter((_, idx) => idx !== i);
	}

	function validate(): boolean {
		errors = {};
		if (!courseName) errors.courseName = 'Choose a course';
		if (!periodDate) errors.periodDate = 'Choose the period this payment is for';
		if (amountPaid === '' || Number(amountPaid) < 0) errors.amountPaid = 'Enter an amount of 0 or more';
		else if (Number(amountPaid) === 0 && discountTotal === 0) errors.amountPaid = 'A zero payment needs a discount';
		if (!label.trim()) errors.label = 'A label is required';
		const dp = discountProblem(discounts);
		if (dp) errors.discounts = dp;
		if (pickedDue && applied > pickedDue.balance && !errors.amountPaid)
			errors.amountPaid = `Amount plus discounts (${money(applied)}) is more than the balance of ${money(pickedDue.balance)}`;
		return Object.keys(errors).length === 0;
	}

	async function submit() {
		formError = '';
		if (!validate()) return;
		saving = true;
		try {
			const ds = filledDiscounts(discounts).map((d) => ({ ...d, discountAmount: Number(d.discountAmount), label: d.label.trim() }));
			await api.payments.create({
				studentId,
				paymentType: 'REGULAR',
				courseName,
				periodDate,
				amountPaid: Number(amountPaid),
				label: label.trim(),
				remarks: remarks.trim() || undefined,
				date: fromDateTimeLocalInput(date),
				discounts: ds.length ? ds : undefined
			});
			toast.ok('Payment recorded');
			onClose();
			currentStudentStore.refreshAfterWrite(studentId);
		} catch (e) {
			formError = errorMessage(e, 'Failed to record payment');
			errors = fieldErrors(e);
		} finally {
			saving = false;
		}
	}
</script>

<Modal {open} title="Record course fee" subtitle="A payment for one billing period of a course." size="lg" busy={saving} {onClose}>
	<form id="pay-form" onsubmit={(e) => { e.preventDefault(); submit(); }} style="display:flex; flex-direction:column; gap: 14px;">
		<div class="field">
			<label for="pay-course">Course *</label>
			<select id="pay-course" class="input-s" bind:value={courseName} disabled={saving}>
				<option value="">Choose a course…</option>
				{#each courseOptions as c}<option value={c.name}>{c.name}</option>{/each}
			</select>
			{#if courseOptions.length === 0}<span class="hint">The student has no sessions in an active course.</span>{/if}
			<FieldError {errors} field="courseName" />
		</div>

		<div class="field">
			<span class="kpi-label">Period *</span>
			<PeriodPicker {studentId} {courseName} bind:value={periodDate} bind:due={pickedDue} disabled={saving} />
			<FieldError {errors} field="periodDate" />
		</div>

		<div class="grid-2">
			<div class="field">
				<label for="pay-amount">Amount paid *</label>
				<input id="pay-amount" type="number" step="0.01" min="0" class="input-s" class:input-error-s={errors.amountPaid} bind:value={amountPaid} disabled={saving} />
				{#if pickedDue}<span class="hint">Balance for this period: {money(pickedDue.balance)}</span>{/if}
				<FieldError {errors} field="amountPaid" />
			</div>
			<div class="field">
				<label for="pay-date">Date &amp; time</label>
				<input id="pay-date" type="datetime-local" class="input-s" bind:value={date} disabled={saving} />
				<FieldError {errors} field="date" />
			</div>
		</div>

		<div class="card-s" style="background: var(--bg-elev);">
			<div style="padding: 10px 14px; display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 500;">
				<Tag size={14} strokeWidth={1.6} style="color: var(--fg-muted);" />
				<span>Discounts</span>
				{#if discountTotal > 0}<span class="muted" style="font-weight: 400;">· {money(discountTotal)}</span>{/if}
				<button type="button" class="btn-s btn-ghost-s btn-sm-s" style="margin-left: auto;" onclick={addDiscount} disabled={saving}><Plus size={12} strokeWidth={1.8} /> Add</button>
			</div>
			{#if discounts.length > 0}
				<div style="padding: 0 14px 12px; display: flex; flex-direction: column; gap: 8px;">
					{#each discounts as d, i}
						<div style="display: flex; gap: 8px; align-items: center;">
							<input type="text" bind:value={d.label} class="input-s" placeholder="Label (e.g. Sibling discount)" disabled={saving} style="flex: 1;" aria-label="Discount label" />
							<input type="number" step="0.01" min="0.01" bind:value={d.discountAmount} class="input-s" style="width: 130px;" placeholder="Amount" disabled={saving} aria-label="Discount amount" />
							<button type="button" class="btn-s btn-ghost-s btn-icon-s" style="color: var(--danger);" onclick={() => removeDiscount(i)} disabled={saving} aria-label="Remove discount"><Trash2 size={14} strokeWidth={1.6} /></button>
						</div>
					{/each}
				</div>
			{/if}
			<div style="padding: 0 14px 10px;"><FieldError {errors} field="discounts" /></div>
		</div>

		<div class="grid-2">
			<div class="field">
				<label for="pay-label">Label *</label>
				<input id="pay-label" type="text" class="input-s" class:input-error-s={errors.label} bind:value={label} disabled={saving} />
				<FieldError {errors} field="label" />
			</div>
			<div class="field">
				<label for="pay-remarks">Remarks</label>
				<input id="pay-remarks" type="text" class="input-s" bind:value={remarks} placeholder="e.g. cash, UPI ref…" disabled={saving} />
			</div>
		</div>

		<div style="display:flex; justify-content: space-between; align-items: baseline; padding: 10px 12px; background: var(--bg-elev); border-radius: 8px;">
			<span class="muted" style="font-size: 13px;">Applied to the period (paid + discounts)</span>
			<span style="font-family: var(--font-serif); font-size: 20px;">{money(applied)}</span>
		</div>

		<ErrorCallout message={formError} />
	</form>
	{#snippet footer()}
		<button class="btn-s btn-secondary-s" onclick={onClose} disabled={saving}>Cancel</button>
		<button class="btn-s btn-primary-s" type="submit" form="pay-form" disabled={saving}>{#if saving}<span class="spinner"></span>Saving…{:else}Record payment{/if}</button>
	{/snippet}
</Modal>
