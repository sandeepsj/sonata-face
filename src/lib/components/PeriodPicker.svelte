<script lang="ts">
	// Pick the billing period a course-fee payment is for.
	// Lists the student's dues for the course; "Other period" falls back to the timeline preview.
	// `value` is the periodDate sent to the API (the period's start date).
	import { untrack } from 'svelte';
	import { api, errorMessage } from '$lib';
	import type { BillingPeriod, Due } from '$lib/api/types';
	import { formatPeriod, isoDate, money, termLabel } from '$lib/utils/format';
	import StatusBadge from './StatusBadge.svelte';

	interface Props {
		studentId: number;
		courseName: string;
		value: string;
		/** The chosen due, when the period comes from the student's dues */
		due?: Due | null;
		disabled?: boolean;
	}
	let { studentId, courseName, value = $bindable(), due = $bindable(null), disabled = false }: Props = $props();

	let dues: Due[] = $state([]);
	let periods: BillingPeriod[] = $state([]);
	let mode: 'dues' | 'other' = $state('dues');
	let loading = $state(false);
	let error = $state('');
	let showSettled = $state(false);

	let open = $derived(dues.filter((d) => d.balance > 0 && d.status !== 'WAIVED'));
	let listed = $derived(showSettled ? dues : open);

	async function loadDues(course: string) {
		loading = true;
		error = '';
		try {
			dues = course ? await api.dues.list({ studentId, courseName: course }) : [];
			if (value && !dues.some((d) => d.periodStart === value)) {
				// keep a preset value (e.g. from "Pay" on a due) if it's a due; otherwise clear it
				const match = dues.find((d) => d.periodStart <= value && value <= d.periodEnd);
				value = match?.periodStart ?? '';
			}
			due = dues.find((d) => d.periodStart === value) ?? null;
			if (!value && open.length > 0) pick(open[0]);
		} catch (e) {
			error = errorMessage(e, 'Failed to load dues');
		} finally {
			loading = false;
		}
	}

	async function loadPreview() {
		loading = true;
		error = '';
		try {
			const y = new Date().getFullYear();
			periods = await api.feeTimeline.preview(courseName, `${y - 3}-01-01`, `${y}-12-31`);
		} catch (e) {
			error = errorMessage(e, 'Failed to load billing periods');
		} finally {
			loading = false;
		}
	}

	// Reload only when the course changes; everything else is read untracked so the
	// writes to value/due (bound by the parent) can't re-trigger this effect.
	$effect(() => {
		const course = courseName;
		untrack(() => {
			mode = 'dues';
			loadDues(course);
		});
	});

	function pick(d: Due) {
		value = d.periodStart;
		due = d;
	}

	function pickPeriod(p: BillingPeriod) {
		value = p.periodStart;
		due = dues.find((d) => d.periodStart === p.periodStart) ?? null;
	}

	function switchMode(m: 'dues' | 'other') {
		mode = m;
		if (m === 'other' && periods.length === 0) loadPreview();
	}

	const today = isoDate();
</script>

<div class="pp">
	<div style="display:flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap;">
		<div class="seg">
			<button type="button" class:active={mode === 'dues'} onclick={() => switchMode('dues')} {disabled}>Student's dues</button>
			<button type="button" class:active={mode === 'other'} onclick={() => switchMode('other')} {disabled}>Other period</button>
		</div>
		{#if mode === 'dues' && dues.length > open.length}
			<label style="font-size: 12px; display:flex; gap: 6px; align-items:center;">
				<input type="checkbox" bind:checked={showSettled} {disabled} /> Show settled periods
			</label>
		{/if}
	</div>

	{#if error}<div class="field-error" style="margin-top: 6px;">{error}</div>{/if}

	{#if loading}
		<div style="padding: 14px; text-align:center;"><span class="spinner"></span></div>
	{:else if !courseName}
		<div class="muted" style="font-size: 12px; padding: 10px 0;">Choose a course first.</div>
	{:else if mode === 'dues'}
		{#if listed.length === 0}
			<div class="muted" style="font-size: 12px; padding: 10px 0;">
				No {showSettled ? '' : 'open '}dues for {courseName}. Use "Other period" to pick from the course's billing periods.
			</div>
		{:else}
			<div class="pp-list" role="radiogroup" aria-label="Billing period">
				{#each listed as d (d.id)}
					<button type="button" role="radio" aria-checked={value === d.periodStart} class="pp-row" class:sel={value === d.periodStart} onclick={() => pick(d)} {disabled}>
						<span>
							<span class="strong">{formatPeriod(d.periodStart, d.periodEnd)}</span>
							<span class="muted" style="font-size: 11px;"> · {termLabel(d.termNumber, d.termsPerYear)}{d.periodStart > today ? ' · upcoming' : ''}</span>
						</span>
						<span style="display:flex; align-items:center; gap: 8px;">
							<span style="font-family: var(--font-mono); font-size: 12px;">{money(d.balance)} <span class="muted">of {money(d.amount)}</span></span>
							<StatusBadge status={d.status} />
						</span>
					</button>
				{/each}
			</div>
		{/if}
	{:else if periods.length === 0}
		<div class="muted" style="font-size: 12px; padding: 10px 0;">{courseName} has no billing periods. Add a fee timeline entry first.</div>
	{:else}
		<div class="pp-list" role="radiogroup" aria-label="Billing period">
			{#each [...periods].reverse() as p (p.periodStart)}
				<button type="button" role="radio" aria-checked={value === p.periodStart} class="pp-row" class:sel={value === p.periodStart} onclick={() => pickPeriod(p)} {disabled}>
					<span>
						<span class="strong">{formatPeriod(p.periodStart, p.periodEnd)}</span>
						<span class="muted" style="font-size: 11px;"> · {termLabel(p.termNumber, p.termsPerYear)}</span>
					</span>
					<span style="font-family: var(--font-mono); font-size: 12px;">{money(p.amount)}</span>
				</button>
			{/each}
		</div>
		<div class="muted" style="font-size: 11px; margin-top: 6px;">The student must have been enrolled during the period, or the payment is refused.</div>
	{/if}
</div>

<style>
	.pp-list {
		display: flex;
		flex-direction: column;
		gap: 4px;
		max-height: 240px;
		overflow-y: auto;
		margin-top: 8px;
	}
	.pp-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 10px;
		padding: 8px 10px;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--surface);
		cursor: pointer;
		text-align: left;
		font: inherit;
		color: inherit;
	}
	.pp-row:hover { background: var(--hover); }
	.pp-row.sel {
		border-color: var(--accent);
		background: var(--accent-soft);
	}
</style>
