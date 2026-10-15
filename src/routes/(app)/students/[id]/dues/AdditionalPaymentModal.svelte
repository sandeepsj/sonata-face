<script lang="ts">
	// Record an ADDITIONAL payment (admission fee, books, exams…). It never affects dues.
	import { untrack } from 'svelte';
	import { Trash2, Plus, Tag } from 'lucide-svelte';
	import { api, currentStudentStore, errorMessage, fieldErrors, toast } from '$lib';
	import type { Course, DiscountInput } from '$lib/api/types';
	import { dateTimeLocalInput, fromDateTimeLocalInput, money } from '$lib/utils/format';
	import { discountProblem, filledDiscounts, totalDiscount } from '$lib/utils/discounts';
	import Modal from '$lib/components/Modal.svelte';
	import ErrorCallout from '$lib/components/ErrorCallout.svelte';
	import FieldError from '$lib/components/FieldError.svelte';

	interface Props {
		open: boolean;
		studentId: number;
		studentName?: string;
		onClose: () => void;
	}
	let { open, studentId, studentName = '', onClose }: Props = $props();

	const SUGGESTIONS = ['Admission fee', 'Books', 'Exam fee', 'Instrument', 'Uniform'];

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

	let discountTotal = $derived(totalDiscount(filledDiscounts(discounts)));

	$effect(() => {
		if (open) untrack(reset);
	});

	async function reset() {
		courseName = '';
		amountPaid = '';
		label = '';
		remarks = '';
		date = dateTimeLocalInput();
		discounts = [];
		formError = '';
		errors = {};
		try {
			courses = (await api.courses.list()).sort((a, b) => a.name.localeCompare(b.name));
		} catch {
			courses = [];
		}
	}

	function validate(): boolean {
		errors = {};
		if (amountPaid === '' || Number(amountPaid) < 0) errors.amountPaid = 'Enter an amount of 0 or more';
		else if (Number(amountPaid) === 0 && discountTotal === 0) errors.amountPaid = 'A zero payment needs a discount';
		if (!label.trim()) errors.label = 'Say what this payment is for';
		const dp = discountProblem(discounts);
		if (dp) errors.discounts = dp;
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
				paymentType: 'ADDITIONAL',
				courseName: courseName || undefined,
				amountPaid: Number(amountPaid),
				label: label.trim(),
				remarks: remarks.trim() || undefined,
				date: fromDateTimeLocalInput(date),
				discounts: ds.length ? ds : undefined
			});
			toast.ok('Additional payment recorded');
			onClose();
			currentStudentStore.fetchPayments(studentId, true);
		} catch (e) {
			formError = errorMessage(e, 'Failed to record payment');
			errors = fieldErrors(e);
		} finally {
			saving = false;
		}
	}
</script>

<Modal {open} title="Additional payment" subtitle={`Admission fee, books, exams… for ${studentName || 'this student'}. Doesn't affect course dues.`} size="lg" busy={saving} {onClose}>
	<form id="add-pay-form" onsubmit={(e) => { e.preventDefault(); submit(); }} style="display:flex; flex-direction:column; gap: 14px;">
		<div class="field">
			<label for="ap-label">What is it for? *</label>
			<input id="ap-label" type="text" class="input-s" class:input-error-s={errors.label} bind:value={label} placeholder="e.g. Admission fee" disabled={saving} />
			<div style="display:flex; gap: 6px; flex-wrap: wrap; margin-top: 4px;">
				{#each SUGGESTIONS as s}<button type="button" class="chip" onclick={() => (label = s)} disabled={saving}>{s}</button>{/each}
			</div>
			<FieldError {errors} field="label" />
		</div>
		<div class="grid-2">
			<div class="field">
				<label for="ap-amount">Amount paid *</label>
				<input id="ap-amount" type="number" step="0.01" min="0" class="input-s" class:input-error-s={errors.amountPaid} bind:value={amountPaid} disabled={saving} />
				<FieldError {errors} field="amountPaid" />
			</div>
			<div class="field">
				<label for="ap-course">Course (optional)</label>
				<select id="ap-course" class="input-s" bind:value={courseName} disabled={saving}>
					<option value="">None</option>
					{#each courses as c}<option value={c.name}>{c.name}{c.status === 'CLOSED' ? ' (closed)' : ''}</option>{/each}
				</select>
				<FieldError {errors} field="courseName" />
			</div>
		</div>

		<div class="card-s" style="background: var(--bg-elev);">
			<div style="padding: 10px 14px; display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 500;">
				<Tag size={14} strokeWidth={1.6} style="color: var(--fg-muted);" />
				<span>Discounts</span>
				{#if discountTotal > 0}<span class="muted" style="font-weight: 400;">· {money(discountTotal)}</span>{/if}
				<button type="button" class="btn-s btn-ghost-s btn-sm-s" style="margin-left: auto;" onclick={() => (discounts = [...discounts, { discountAmount: 0, label: '' }])} disabled={saving}><Plus size={12} strokeWidth={1.8} /> Add</button>
			</div>
			{#if discounts.length > 0}
				<div style="padding: 0 14px 12px; display: flex; flex-direction: column; gap: 8px;">
					{#each discounts as d, i}
						<div style="display: flex; gap: 8px; align-items: center;">
							<input type="text" bind:value={d.label} class="input-s" placeholder="Label" disabled={saving} style="flex: 1;" aria-label="Discount label" />
							<input type="number" step="0.01" min="0.01" bind:value={d.discountAmount} class="input-s" style="width: 130px;" placeholder="Amount" disabled={saving} aria-label="Discount amount" />
							<button type="button" class="btn-s btn-ghost-s btn-icon-s" style="color: var(--danger);" onclick={() => (discounts = discounts.filter((_, x) => x !== i))} disabled={saving} aria-label="Remove discount"><Trash2 size={14} strokeWidth={1.6} /></button>
						</div>
					{/each}
				</div>
			{/if}
			<div style="padding: 0 14px 10px;"><FieldError {errors} field="discounts" /></div>
		</div>

		<div class="grid-2">
			<div class="field">
				<label for="ap-date">Date &amp; time</label>
				<input id="ap-date" type="datetime-local" class="input-s" bind:value={date} disabled={saving} />
			</div>
			<div class="field">
				<label for="ap-remarks">Remarks</label>
				<input id="ap-remarks" type="text" class="input-s" bind:value={remarks} disabled={saving} />
			</div>
		</div>
		<ErrorCallout message={formError} />
	</form>
	{#snippet footer()}
		<button class="btn-s btn-secondary-s" onclick={onClose} disabled={saving}>Cancel</button>
		<button class="btn-s btn-primary-s" type="submit" form="add-pay-form" disabled={saving}>{#if saving}<span class="spinner"></span>Saving…{:else}Record payment{/if}</button>
	{/snippet}
</Modal>
