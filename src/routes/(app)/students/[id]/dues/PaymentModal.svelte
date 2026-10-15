<script lang="ts">
	// Record a course-fee (REGULAR) payment. It pays the student's oldest unpaid term of the course first, then
	// the next; there is no period to pick and no upper limit (anything beyond what is due becomes credit).
	// "Forgive a term" is a ₹0 REGULAR payment with a discount labelled with the reason. Like any course-fee
	// payment it applies to the oldest unpaid term of the course, so the form defaults to that term's balance.
	import { untrack } from 'svelte';
	import { Trash2, Plus, Tag } from 'lucide-svelte';
	import { api, currentStudentStore, errorMessage, fieldErrors, toast } from '$lib';
	import type { Course, DiscountInput, Due } from '$lib/api/types';
	import { dateTimeLocalInput, formatPeriod, fromDateTimeLocalInput, money } from '$lib/utils/format';
	import { discountProblem, filledDiscounts, totalDiscount } from '$lib/utils/discounts';
	import Modal from '$lib/components/Modal.svelte';
	import ErrorCallout from '$lib/components/ErrorCallout.svelte';
	import FieldError from '$lib/components/FieldError.svelte';

	interface Props {
		open: boolean;
		studentId: number;
		/** Pre-select this due's course and balance */
		due?: Due | null;
		/** Forgive the oldest unpaid term: ₹0 paid, a discount for its balance with the reason as its label */
		forgive?: boolean;
		onClose: () => void;
	}
	let { open, studentId, due = null, forgive = false, onClose }: Props = $props();

	let courses: Course[] = $state([]);
	let courseName = $state('');
	let amountPaid: number | '' = $state('');
	let label = $state('');
	let remarks = $state('');
	let date = $state(dateTimeLocalInput());
	let discounts: DiscountInput[] = $state([]);

	let saving = $state(false);
	let formError = $state('');
	let errors: Record<string, string> = $state({});

	// a REGULAR payment needs a session in its course
	let sessionCourses = $derived([...new Set($currentStudentStore.sessions.data.map((s) => s.course.name))]);
	let courseOptions = $derived(courses.filter((c) => sessionCourses.includes(c.name)));
	/** What is still owed for the chosen course, oldest term first */
	let owed = $derived(
		$currentStudentStore.dues.data
			.filter((d) => d.courseName === courseName && d.balance > 0)
			.sort((a, b) => a.periodStart.localeCompare(b.periodStart))
	);
	let owedTotal = $derived(owed.reduce((s, d) => s + d.balance, 0));

	let discountTotal = $derived(totalDiscount(filledDiscounts(discounts)));
	let applied = $derived((Number(amountPaid) || 0) + discountTotal);

	$effect(() => {
		if (open) untrack(reset);
	});

	async function reset() {
		courseName = due?.courseName ?? '';
		if (forgive) {
			amountPaid = 0;
			discounts = [{ discountAmount: 0, label: '' }];
			label = '';
		} else {
			amountPaid = due ? due.balance : '';
			discounts = [];
			label = due ? `${due.courseName} fee` : '';
		}
		remarks = '';
		date = dateTimeLocalInput();
		formError = '';
		errors = {};
		try {
			courses = await api.courses.list();
		} catch {
			courses = [];
		}
		if (!courseName && courseOptions.length === 1) courseName = courseOptions[0].name;
		if (!label && courseName) label = `${courseName} fee`;
	}

	// keep the defaults in step with the course until the user types their own
	let autoLabel = '';
	$effect(() => {
		const c = courseName;
		const oldest = owed[0];
		untrack(() => {
			if (!c) return;
			const next = forgive && oldest ? `${c} fee forgiven · ${formatPeriod(oldest.periodStart, oldest.periodEnd)}` : `${c} fee`;
			if (!label || label === autoLabel) label = autoLabel = next;
			if (forgive && discounts.length === 1 && oldest) discounts[0].discountAmount = oldest.balance;
		});
	});

	function addDiscount() {
		discounts = [...discounts, { discountAmount: 0, label: '' }];
	}
	function removeDiscount(i: number) {
		discounts = discounts.filter((_, idx) => idx !== i);
	}

	function validate(): boolean {
		errors = {};
		if (!courseName) errors.courseName = 'Choose a course';
		if (amountPaid === '' || Number(amountPaid) < 0) errors.amountPaid = 'Enter an amount of 0 or more';
		else if (Number(amountPaid) === 0 && discountTotal === 0) errors.amountPaid = 'A ₹0 payment needs a discount';
		if (!label.trim()) errors.label = 'A label is required';
		const dp = discountProblem(discounts);
		if (dp) errors.discounts = forgive ? 'Say why the term is forgiven, and the amount' : dp;
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
				amountPaid: Number(amountPaid),
				label: label.trim(),
				remarks: remarks.trim() || undefined,
				date: fromDateTimeLocalInput(date),
				discounts: ds.length ? ds : undefined
			});
			toast.ok(forgive ? 'Term forgiven. Dues updated.' : 'Payment recorded. Dues updated.');
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

<Modal
	{open}
	title={forgive ? 'Forgive a term' : 'Record course fee'}
	subtitle={forgive ? 'Records a ₹0 course-fee payment with a discount for the reason, e.g. the student left early. It applies to the oldest unpaid term of the course.' : 'Pays the oldest unpaid term of the course first, then the next. Anything beyond what is due becomes credit.'}
	size="lg"
	busy={saving}
	{onClose}
>
	<form id="pay-form" onsubmit={(e) => { e.preventDefault(); submit(); }} style="display:flex; flex-direction:column; gap: 14px;">
		<div class="field">
			<label for="pay-course">Course *</label>
			<select id="pay-course" class="input-s" bind:value={courseName} disabled={saving}>
				<option value="">Choose a course…</option>
				{#each courseOptions as c}<option value={c.name}>{c.name}</option>{/each}
			</select>
			{#if courseOptions.length === 0}<span class="hint">The student has no sessions, so there is no course fee to pay.</span>{/if}
			{#if courseName}
				<span class="hint">
					{#if owed.length > 0 && forgive}
						Forgives {formatPeriod(owed[0].periodStart, owed[0].periodEnd)} ({money(owed[0].balance)} owed), the oldest unpaid term.
					{:else if owed.length > 0}
						Owed: {money(owedTotal)} over {owed.length} term{owed.length === 1 ? '' : 's'}, oldest {formatPeriod(owed[0].periodStart, owed[0].periodEnd)}.
					{:else}
						Nothing is owed for {courseName} right now; this payment becomes credit for the next term.
					{/if}
				</span>
			{/if}
			<FieldError {errors} field="courseName" />
		</div>

		<div class="grid-2">
			<div class="field">
				<label for="pay-amount">Amount paid *</label>
				<input id="pay-amount" type="number" step="0.01" min="0" class="input-s" class:input-error-s={errors.amountPaid} bind:value={amountPaid} disabled={saving || forgive} />
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
							<input type="text" bind:value={d.label} class="input-s" placeholder={forgive ? 'Reason (e.g. Left in March)' : 'Label (e.g. Sibling discount)'} disabled={saving} style="flex: 1;" aria-label="Discount label" />
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
			<span class="muted" style="font-size: 13px;">Applied to dues, oldest term first (paid + discounts)</span>
			<span style="font-family: var(--font-serif); font-size: 20px;">{money(applied)}</span>
		</div>

		<ErrorCallout message={formError} />
	</form>
	{#snippet footer()}
		<button class="btn-s btn-secondary-s" onclick={onClose} disabled={saving}>Cancel</button>
		<button class="btn-s btn-primary-s" type="submit" form="pay-form" disabled={saving}>{#if saving}<span class="spinner"></span>Saving…{:else}{forgive ? 'Forgive' : 'Record payment'}{/if}</button>
	{/snippet}
</Modal>
