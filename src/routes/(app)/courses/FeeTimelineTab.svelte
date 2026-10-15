<script lang="ts">
	import { onMount } from 'svelte';
	import { Plus, Pencil, Trash2, CalendarRange } from 'lucide-svelte';
	import { api, canAccess, errorMessage, fieldErrors, toast } from '$lib';
	import type { BillingPeriod, Course, FeeStructure, TimelineEntry } from '$lib/api/types';
	import { cadenceLabel, formatDate, formatPeriod, isoDate, money, parseLocal, termLabel } from '$lib/utils/format';
	import Modal from '$lib/components/Modal.svelte';
	import ErrorCallout from '$lib/components/ErrorCallout.svelte';
	import FieldError from '$lib/components/FieldError.svelte';

	let { course }: { course: Course } = $props();

	const year = new Date().getFullYear();

	let entries: TimelineEntry[] = $state([]);
	let structures: FeeStructure[] = $state([]);
	let loading = $state(true);
	let loadError = $state('');

	// preview
	let from = $state(`${year - 1}-01-01`);
	let to = $state(`${year}-12-31`);
	let periods: BillingPeriod[] = $state([]);
	let previewLoading = $state(false);
	let previewError = $state('');

	// editor
	let editorOpen = $state(false);
	let editing: TimelineEntry | null = $state(null);
	let feeStructureId: number | null = $state(null);
	let effectiveFrom = $state('');
	let effectiveTo = $state('');
	let openEnded = $state(true);
	let saving = $state(false);
	let formError = $state('');
	let errors: Record<string, string> = $state({});

	let canWrite = $derived($canAccess('/api/fee-structures/**', 'write') && course.status === 'ACTIVE');
	let canWriteAtAll = $derived($canAccess('/api/fee-structures/**', 'write'));

	const COLORS = ['var(--accent)', 'var(--info)', 'var(--ok)', 'var(--warn)', 'oklch(0.55 0.15 300)', 'oklch(0.55 0.12 200)'];
	let colorOf = $derived.by(() => {
		const ids = [...new Set([...entries.map((e) => e.feeStructureId), ...structures.map((s) => s.id)])];
		return (id: number) => COLORS[ids.indexOf(id) % COLORS.length];
	});
	let structureName = $derived((id: number) => structures.find((s) => s.id === id)?.name ?? `#${id}`);
	let today = isoDate();

	async function load() {
		loading = true;
		loadError = '';
		try {
			[entries, structures] = await Promise.all([api.feeTimeline.list(course.name), api.feeStructures.list(course.name)]);
		} catch (e) {
			loadError = errorMessage(e, 'Failed to load the fee timeline');
		} finally {
			loading = false;
		}
		await loadPreview();
	}

	async function loadPreview() {
		previewError = '';
		if (!from || !to || from > to) {
			previewError = 'Choose a start date on or before the end date.';
			periods = [];
			return;
		}
		previewLoading = true;
		try {
			periods = await api.feeTimeline.preview(course.name, from, to);
		} catch (e) {
			previewError = errorMessage(e, 'Failed to load the preview');
			periods = [];
		} finally {
			previewLoading = false;
		}
	}

	onMount(load);

	function openEditor(entry: TimelineEntry | null) {
		editing = entry;
		const last = entries[entries.length - 1];
		feeStructureId = entry?.feeStructureId ?? structures[0]?.id ?? null;
		effectiveFrom = entry?.effectiveFrom ?? (last?.effectiveTo ? nextDay(last.effectiveTo) : `${year}-01-01`);
		effectiveTo = entry?.effectiveTo ?? '';
		openEnded = entry ? entry.effectiveTo === null : true;
		formError = '';
		errors = {};
		editorOpen = true;
	}

	function nextDay(d: string) {
		const x = parseLocal(d)!;
		x.setDate(x.getDate() + 1);
		return isoDate(x);
	}

	async function save() {
		formError = '';
		errors = {};
		if (!feeStructureId) errors.feeStructureId = 'Choose a fee structure';
		if (!effectiveFrom) errors.effectiveFrom = 'Choose a start date';
		if (!openEnded && !effectiveTo) errors.effectiveTo = 'Choose an end date, or make it open-ended';
		if (!openEnded && effectiveTo && effectiveFrom && effectiveTo < effectiveFrom)
			errors.effectiveTo = 'The end date must be on or after the start date';
		if (Object.keys(errors).length) return;
		saving = true;
		const body = {
			courseName: course.name,
			feeStructureId: feeStructureId!,
			effectiveFrom,
			effectiveTo: openEnded ? null : effectiveTo
		};
		try {
			if (editing) await api.feeTimeline.update(editing.id, body);
			else await api.feeTimeline.create(body);
			toast.ok(`Timeline saved. Dues for ${course.name} are being recalculated.`);
			editorOpen = false;
			await load();
		} catch (e) {
			formError = errorMessage(e, 'Failed to save timeline entry');
			errors = fieldErrors(e);
		} finally {
			saving = false;
		}
	}

	async function remove(entry: TimelineEntry) {
		if (!confirm(`Remove "${entry.feeStructureName}" from ${formatDate(entry.effectiveFrom)}? Periods it covered will no longer be billed.`)) return;
		try {
			await api.feeTimeline.remove(entry.id);
			toast.ok(`Entry removed. Dues for ${course.name} are being recalculated.`);
			await load();
		} catch (e) {
			toast.error(errorMessage(e, 'Failed to remove entry'));
		}
	}

	// --- band geometry for the preview strip ---
	function dayNum(d: string) {
		return Math.floor(parseLocal(d)!.getTime() / 86_400_000);
	}
	let span = $derived(Math.max(1, dayNum(to) - dayNum(from) + 1));
	function bandStyle(p: BillingPeriod) {
		const a = Math.max(dayNum(p.periodStart), dayNum(from));
		const b = Math.min(dayNum(p.periodEnd), dayNum(to));
		const left = ((a - dayNum(from)) / span) * 100;
		const width = ((b - a + 1) / span) * 100;
		return `left:${left}%; width:${width}%; background:${colorOf(p.feeStructureId)};`;
	}
	let yearTicks = $derived.by(() => {
		const out: { label: string; left: number }[] = [];
		const a = parseLocal(from)!.getFullYear();
		const b = parseLocal(to)!.getFullYear();
		for (let y = a; y <= b; y++) {
			const d = Math.max(dayNum(`${y}-01-01`), dayNum(from));
			out.push({ label: String(y), left: ((d - dayNum(from)) / span) * 100 });
		}
		return out;
	});
	let previewTotal = $derived(periods.reduce((s, p) => s + p.amount, 0));
</script>

<div class="course-card">
	<div class="course-card-head" style="display:flex; align-items:center; justify-content:space-between; gap: 10px;">
		<div>
			<span class="course-card-title">Fee timeline</span>
			<div class="muted" style="font-size: 12px; margin-top: 2px;">Which fee structure applies when. Entries can't overlap; gaps aren't billed.</div>
		</div>
		{#if canWrite}
			<button class="btn-s btn-primary-s btn-sm-s" onclick={() => openEditor(null)} disabled={structures.length === 0} title={structures.length === 0 ? 'Create a fee structure first' : ''}>
				<Plus size={13} strokeWidth={1.8} /> Add entry
			</button>
		{/if}
	</div>

	<div style="padding: 14px; display:flex; flex-direction:column; gap: 12px;">
		<ErrorCallout message={loadError} />
		{#if course.status === 'CLOSED' && canWriteAtAll}
			<div class="callout"><div class="callout-body">{course.name} is closed, so new timeline entries can't be added. Reopen the course to change its timeline.</div></div>
		{/if}
		{#if !loading && structures.length === 0}
			<div class="callout info"><div class="callout-body">Create a fee structure in the "Fee structures" tab first, then add it to the timeline here.</div></div>
		{/if}

		{#if loading}
			<div style="display:flex; justify-content:center; padding: 20px;"><span class="spinner"></span></div>
		{:else}
			<div class="tbl-wrap">
				<table class="tbl">
					<thead><tr><th>Fee structure</th><th>From</th><th>To</th><th></th></tr></thead>
					<tbody>
						{#each entries as e (e.id)}
							{@const active = e.effectiveFrom <= today && (e.effectiveTo === null || e.effectiveTo >= today)}
							<tr>
								<td>
									<span class="swatch" style="background:{colorOf(e.feeStructureId)}"></span>
									<span class="strong">{e.feeStructureName}</span>
									{#if active}<span class="muted" style="font-size: 11px;"> · applies today</span>{/if}
								</td>
								<td>{formatDate(e.effectiveFrom)}</td>
								<td>{e.effectiveTo ? formatDate(e.effectiveTo) : 'Open-ended'}</td>
								<td style="text-align:right; white-space: nowrap;">
									{#if canWriteAtAll}
										<button class="btn-s btn-ghost-s btn-icon-s" aria-label="Edit entry" title="Edit" onclick={() => openEditor(e)}><Pencil size={13} /></button>
										<button class="btn-s btn-ghost-s btn-icon-s" style="color: var(--danger);" aria-label="Remove entry" title="Remove" onclick={() => remove(e)}><Trash2 size={13} /></button>
									{/if}
								</td>
							</tr>
						{:else}
							<tr><td colspan="4" class="muted" style="text-align:center; padding: 18px;">No timeline entries. Nothing is billed for {course.name} until one is added.</td></tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>
</div>

<div class="course-card">
	<div class="course-card-head" style="display:flex; align-items:flex-end; justify-content:space-between; gap: 10px; flex-wrap: wrap;">
		<div>
			<span class="course-card-title"><CalendarRange size={15} strokeWidth={1.6} style="vertical-align: -2px;" /> Billing preview</span>
			<div class="muted" style="font-size: 12px; margin-top: 2px;">The billing periods the current timeline produces. Updated after every change.</div>
		</div>
		<div style="display:flex; gap: 8px; align-items: flex-end;">
			<div class="field"><label for="pv-from">From</label><input id="pv-from" type="date" class="input-s" bind:value={from} onchange={loadPreview} /></div>
			<div class="field"><label for="pv-to">To</label><input id="pv-to" type="date" class="input-s" bind:value={to} onchange={loadPreview} /></div>
		</div>
	</div>
	<div style="padding: 14px; display:flex; flex-direction:column; gap: 12px;">
		<ErrorCallout message={previewError} />
		{#if previewLoading}
			<div style="display:flex; justify-content:center; padding: 20px;"><span class="spinner"></span></div>
		{:else if !previewError}
			<div class="band" aria-hidden="true">
				{#each yearTicks as t}<span class="tick" style="left:{t.left}%">{t.label}</span>{/each}
				{#each periods as p}<span class="seg-p" style={bandStyle(p)} title="{formatPeriod(p.periodStart, p.periodEnd)} · {money(p.amount)}"></span>{/each}
			</div>
			{#if periods.length === 0}
				<div class="callout info"><div class="callout-body">No billing periods in this range.</div></div>
			{:else}
				<div class="tbl-wrap">
					<table class="tbl">
						<thead><tr><th>Period</th><th>Term</th><th>Fee structure</th><th style="text-align:right;">Amount</th></tr></thead>
						<tbody>
							{#each periods as p}
								<tr>
									<td><span class="swatch" style="background:{colorOf(p.feeStructureId)}"></span>{formatPeriod(p.periodStart, p.periodEnd)} <span class="muted" style="font-size: 11px;">({formatDate(p.periodStart)} – {formatDate(p.periodEnd)})</span></td>
									<td class="muted">{termLabel(p.termNumber, p.termsPerYear)}</td>
									<td>{structureName(p.feeStructureId)}</td>
									<td class="num" style="text-align:right; font-family: var(--font-mono);">{money(p.amount)}</td>
								</tr>
							{/each}
						</tbody>
						<tfoot><tr><td colspan="3" class="muted">{periods.length} period{periods.length !== 1 ? 's' : ''}</td><td style="text-align:right; font-family: var(--font-mono); font-weight: 600;">{money(previewTotal)}</td></tr></tfoot>
					</table>
				</div>
			{/if}
		{/if}
	</div>
</div>

<Modal open={editorOpen} title={editing ? 'Edit timeline entry' : 'Add timeline entry'} subtitle={course.name} busy={saving} onClose={() => (editorOpen = false)}>
	<form id="tl-form" onsubmit={(e) => { e.preventDefault(); save(); }} style="display:flex; flex-direction:column; gap: 14px;">
		<div class="field">
			<label for="tl-fs">Fee structure *</label>
			<select id="tl-fs" class="input-s" bind:value={feeStructureId} disabled={saving}>
				{#each structures as s}<option value={s.id}>{s.name} — {cadenceLabel(s.termsPerYear)}</option>{/each}
			</select>
			<FieldError {errors} field="feeStructureId" />
		</div>
		<div class="grid-2">
			<div class="field">
				<label for="tl-from">Effective from *</label>
				<input id="tl-from" type="date" class="input-s" class:input-error-s={errors.effectiveFrom} bind:value={effectiveFrom} disabled={saving} />
				<FieldError {errors} field="effectiveFrom" />
			</div>
			<div class="field">
				<label for="tl-to">Effective to</label>
				<input id="tl-to" type="date" class="input-s" class:input-error-s={errors.effectiveTo} bind:value={effectiveTo} disabled={saving || openEnded} />
				<label style="display:flex; align-items:center; gap: 6px; font-size: 12px; margin-top: 4px;">
					<input type="checkbox" bind:checked={openEnded} disabled={saving} /> Open-ended (no end date)
				</label>
				<FieldError {errors} field="effectiveTo" />
			</div>
		</div>
		<div class="muted" style="font-size: 12px;">
			Both dates are inclusive. A period is billed by the entry active on its first day. If the start isn't on a term
			boundary, the short first period is charged the full term amount.
		</div>
		<ErrorCallout message={formError} />
	</form>
	{#snippet footer()}
		<button class="btn-s btn-secondary-s" onclick={() => (editorOpen = false)} disabled={saving}>Cancel</button>
		<button class="btn-s btn-primary-s" type="submit" form="tl-form" disabled={saving}>{#if saving}<span class="spinner"></span>{/if}Save</button>
	{/snippet}
</Modal>

<style>
	.swatch {
		display: inline-block;
		width: 9px;
		height: 9px;
		border-radius: 2px;
		margin-right: 7px;
		vertical-align: 0;
	}
	.band {
		position: relative;
		height: 34px;
		border-radius: 8px;
		background: var(--bg-elev);
		border: 1px solid var(--border);
		overflow: hidden;
	}
	.seg-p {
		position: absolute;
		top: 14px;
		bottom: 4px;
		border-right: 2px solid var(--surface);
		opacity: 0.85;
	}
	.tick {
		position: absolute;
		top: 1px;
		font-size: 10px;
		color: var(--fg-muted);
		padding-left: 3px;
		border-left: 1px solid var(--border-strong);
		height: 100%;
	}
</style>
