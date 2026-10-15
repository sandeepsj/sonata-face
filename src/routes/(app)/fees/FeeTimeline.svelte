<script lang="ts">
	import { onMount } from 'svelte';
	import { Plus, Pencil, Trash2, CalendarRange } from 'lucide-svelte';
	import { api, canAccess, errorMessage, fieldErrors } from '$lib';
	import type { FeeStructure, Impact, PreviewTerm, TimelineChange, TimelineEntry, TimelineRequest } from '$lib/api/types';
	import { formatDate, formatPeriod, isoDate, money, parseLocal } from '$lib/utils/format';
	import Modal from '$lib/components/Modal.svelte';
	import ErrorCallout from '$lib/components/ErrorCallout.svelte';
	import FieldError from '$lib/components/FieldError.svelte';
	import ImpactConfirm from '$lib/components/ImpactConfirm.svelte';

	/** Called after a timeline change (structures' `usedInTimeline` may change) */
	let { onChanged }: { onChanged?: () => void } = $props();

	const year = new Date().getFullYear();

	let entries: TimelineEntry[] = $state([]);
	let structures: FeeStructure[] = $state([]);
	let loading = $state(true);
	let loadError = $state('');

	// preview shown beside the editor
	let from = $state(`${year - 1}-01-01`);
	let to = $state(`${year + 1}-12-31`);
	let terms: PreviewTerm[] = $state([]);
	let previewLoading = $state(false);
	let previewError = $state('');

	// editor
	let editorOpen = $state(false);
	let editing: TimelineEntry | null = $state(null);
	let feeStructureId: number | null = $state(null);
	let effectiveFrom = $state('');
	/** Valid term starts for the editor (from the preview); empty → free date input */
	let startOptions: string[] = $state([]);
	let saving = $state(false);
	let formError = $state('');
	let errors: Record<string, string> = $state({});

	// second step: confirm the dry run's impact, then apply
	let pending: { summary: string; from: string | null; impact: Impact | null; apply: () => Promise<TimelineChange> } | null =
		$state(null);

	let canWrite = $derived($canAccess('/api/fee-timeline/**', 'write'));
	let canReadStructures = $derived($canAccess('/api/fee-structures/**'));

	const COLORS = ['var(--accent)', 'var(--info)', 'var(--ok)', 'var(--warn)', 'oklch(0.55 0.15 300)', 'oklch(0.55 0.12 200)'];
	let colorOf = $derived.by(() => {
		const ids = [...new Set([...entries.map((e) => e.feeStructureId), ...structures.map((s) => s.id)])];
		return (id: number) => COLORS[ids.indexOf(id) % COLORS.length];
	});
	let today = isoDate();

	export async function load() {
		loading = true;
		loadError = '';
		try {
			const [e, s] = await Promise.all([
				api.feeTimeline.list(),
				canReadStructures ? api.feeStructures.list() : Promise.resolve([])
			]);
			entries = e;
			structures = s.sort((a, b) => a.name.localeCompare(b.name));
		} catch (err) {
			loadError = errorMessage(err, 'Failed to load the fee timeline');
		} finally {
			loading = false;
		}
		await loadPreview();
	}

	async function loadPreview() {
		previewError = '';
		if (!from || !to || from > to) {
			previewError = 'Choose a start date on or before the end date.';
			terms = [];
			return;
		}
		previewLoading = true;
		try {
			terms = await api.feeTimeline.preview(from, to);
		} catch (e) {
			previewError = errorMessage(e, 'Failed to load the preview');
			terms = [];
		} finally {
			previewLoading = false;
		}
	}

	onMount(load);

	function addYears(d: string, n: number): string {
		const x = parseLocal(d)!;
		x.setFullYear(x.getFullYear() + n);
		return isoDate(x);
	}

	/**
	 * A structure may start only at the beginning of a term of the entry before it, so offer the term starts
	 * the current timeline produces (other entries' own start dates excluded).
	 */
	async function loadStartOptions(entry: TimelineEntry | null) {
		startOptions = [];
		const first = entries[0];
		if (!first || entry?.id === first.id) return; // the first entry may start on any date
		const last = entries[entries.length - 1];
		const end = addYears(last.effectiveFrom > today ? last.effectiveFrom : today, 3);
		const others = new Set(entries.filter((e) => e.id !== entry?.id).map((e) => e.effectiveFrom));
		const preview = await api.feeTimeline.preview(first.effectiveFrom, end);
		startOptions = [...new Set(preview.map((t) => t.periodStart))].filter((d) => !others.has(d) && d > first.effectiveFrom);
		if (entry && !startOptions.includes(entry.effectiveFrom)) startOptions = [entry.effectiveFrom, ...startOptions].sort();
	}

	async function openEditor(entry: TimelineEntry | null) {
		editing = entry;
		feeStructureId = entry?.feeStructureId ?? structures[0]?.id ?? null;
		effectiveFrom = entry?.effectiveFrom ?? '';
		formError = '';
		errors = {};
		editorOpen = true;
		try {
			await loadStartOptions(entry);
			if (!effectiveFrom) effectiveFrom = startOptions.find((d) => d >= today) ?? startOptions[0] ?? '';
		} catch (e) {
			formError = errorMessage(e, 'Could not work out the valid start dates');
		}
	}

	function structureName(id: number | null) {
		return structures.find((s) => s.id === id)?.name ?? '';
	}

	async function save() {
		formError = '';
		errors = {};
		if (!feeStructureId) errors.feeStructureId = 'Choose a fee structure';
		if (!effectiveFrom) errors.effectiveFrom = 'Choose a start date';
		if (Object.keys(errors).length) return;
		const body: TimelineRequest = { feeStructureId: feeStructureId!, effectiveFrom };
		const target = editing;
		const run = (dryRun: boolean) =>
			target ? api.feeTimeline.update(target.id, body, dryRun) : api.feeTimeline.create(body, dryRun);
		saving = true;
		try {
			// Nothing is saved yet: show the impact, apply after an explicit confirmation
			const dry = await run(true);
			editorOpen = false;
			pending = {
				summary: target
					? `Change the entry from ${formatDate(target.effectiveFrom)} to "${structureName(body.feeStructureId)}" from ${formatDate(body.effectiveFrom)}`
					: `"${structureName(body.feeStructureId)}" applies from ${formatDate(body.effectiveFrom)}`,
				from: body.effectiveFrom,
				impact: dry.recalculation ?? null,
				apply: () => run(false)
			};
		} catch (e) {
			// e.g. 400 "not a term start; nearest valid dates are …": show it as is
			formError = errorMessage(e, 'Failed to check the timeline entry');
			errors = fieldErrors(e);
		} finally {
			saving = false;
		}
	}

	async function remove(entry: TimelineEntry) {
		try {
			const dry = await api.feeTimeline.remove(entry.id, true);
			pending = {
				summary: `Remove "${entry.feeStructureName}" from ${formatDate(entry.effectiveFrom)}`,
				from: entry.effectiveFrom,
				impact: dry.recalculation ?? null,
				apply: () => api.feeTimeline.remove(entry.id)
			};
		} catch (e) {
			loadError = errorMessage(e, 'This entry cannot be removed');
		}
	}

	async function applyPending(): Promise<Impact | null> {
		const res = await pending!.apply();
		return res.recalculation ?? null;
	}

	// --- band geometry for the preview strip ---
	function dayNum(d: string) {
		return Math.floor(parseLocal(d)!.getTime() / 86_400_000);
	}
	let span = $derived(Math.max(1, dayNum(to) - dayNum(from) + 1));
	function bandStyle(p: PreviewTerm) {
		const a = Math.max(dayNum(p.periodStart), dayNum(from));
		const b = Math.min(dayNum(p.periodEnd), dayNum(to));
		const left = ((a - dayNum(from)) / span) * 100;
		const width = ((b - a + 1) / span) * 100;
		return `left:${left}%; width:${width}%; background:${colorOf(p.feeStructureId)};`;
	}
	let yearTicks = $derived.by(() => {
		const out: { label: string; left: number }[] = [];
		if (!from || !to || from > to) return out;
		const a = parseLocal(from)!.getFullYear();
		const b = parseLocal(to)!.getFullYear();
		for (let y = a; y <= b; y++) {
			const d = Math.max(dayNum(`${y}-01-01`), dayNum(from));
			out.push({ label: String(y), left: ((d - dayNum(from)) / span) * 100 });
		}
		return out;
	});
</script>

<div class="course-card">
	<div class="course-card-head" style="display:flex; align-items:center; justify-content:space-between; gap: 10px;">
		<div>
			<span class="course-card-title">Fee timeline</span>
			<div class="muted" style="font-size: 12px; margin-top: 2px;">
				One for the whole school. Each structure applies until the next one starts, and a new one can start only at the beginning of a term.
			</div>
		</div>
		{#if canWrite && canReadStructures}
			<button class="btn-s btn-primary-s btn-sm-s" onclick={() => openEditor(null)} disabled={structures.length === 0} title={structures.length === 0 ? 'Create a fee structure first' : ''}>
				<Plus size={13} strokeWidth={1.8} /> Add entry
			</button>
		{/if}
	</div>

	<div style="padding: 14px; display:flex; flex-direction:column; gap: 12px;">
		<ErrorCallout message={loadError} />
		{#if !loading && canWrite && structures.length === 0}
			<div class="callout info"><div class="callout-body">Create a fee structure first, then add it to the timeline here.</div></div>
		{/if}

		{#if loading}
			<div style="display:flex; justify-content:center; padding: 20px;"><span class="spinner"></span></div>
		{:else}
			<div class="tbl-wrap">
				<table class="tbl">
					<thead><tr><th>Fee structure</th><th>Term</th><th>From</th><th>To</th><th></th></tr></thead>
					<tbody>
						{#each entries as e (e.id)}
							{@const active = e.effectiveFrom <= today && (!e.effectiveTo || e.effectiveTo >= today)}
							<tr>
								<td>
									<span class="swatch" style="background:{colorOf(e.feeStructureId)}"></span>
									<span class="strong">{e.feeStructureName}</span>
									{#if active}<span class="muted" style="font-size: 11px;"> · applies today</span>{/if}
								</td>
								<td class="muted">{e.termMonths === 1 ? 'monthly' : `${e.termMonths} months`}</td>
								<td>{formatDate(e.effectiveFrom)}</td>
								<td>{e.effectiveTo ? formatDate(e.effectiveTo) : 'Open-ended'}</td>
								<td style="text-align:right; white-space: nowrap;">
									{#if canWrite && canReadStructures}
										<button class="btn-s btn-ghost-s btn-icon-s" aria-label="Edit entry" title="Edit" onclick={() => openEditor(e)}><Pencil size={13} /></button>
									{/if}
									{#if canWrite}
										<button class="btn-s btn-ghost-s btn-icon-s" style="color: var(--danger);" aria-label="Remove entry" title="Remove" onclick={() => remove(e)}><Trash2 size={13} /></button>
									{/if}
								</td>
							</tr>
						{:else}
							<tr><td colspan="5" class="muted" style="text-align:center; padding: 18px;">No timeline entries. Nothing is billed until one is added.</td></tr>
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
			<span class="course-card-title"><CalendarRange size={15} strokeWidth={1.6} style="vertical-align: -2px;" /> Terms preview</span>
			<div class="muted" style="font-size: 12px; margin-top: 2px;">The terms the current timeline produces, with each course's amount. Updated after every change.</div>
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
				{#each terms as p}<span class="seg-p" style={bandStyle(p)} title="{formatPeriod(p.periodStart, p.periodEnd)} · {p.feeStructureName}"></span>{/each}
			</div>
			{#if terms.length === 0}
				<div class="callout info"><div class="callout-body">No terms in this range.</div></div>
			{:else}
				<div class="tbl-wrap">
					<table class="tbl">
						<thead><tr><th>Term</th><th>Fee structure</th><th>Amount per course</th></tr></thead>
						<tbody>
							{#each terms as p}
								<tr>
									<td><span class="swatch" style="background:{colorOf(p.feeStructureId)}"></span>{formatPeriod(p.periodStart, p.periodEnd)} <span class="muted" style="font-size: 11px;">({formatDate(p.periodStart)} – {formatDate(p.periodEnd)})</span></td>
									<td>{p.feeStructureName}</td>
									<td class="muted" style="font-size: 12px;">
										{#each p.amounts as a, i}{i ? ' · ' : ''}{a.courseName} <span style="font-family: var(--font-mono); color: var(--fg);">{money(a.amount)}</span>{:else}No course billed{/each}
									</td>
								</tr>
							{/each}
						</tbody>
						<tfoot><tr><td colspan="3" class="muted">{terms.length} term{terms.length !== 1 ? 's' : ''}</td></tr></tfoot>
					</table>
				</div>
			{/if}
		{/if}
	</div>
</div>

<Modal open={editorOpen} title={editing ? 'Edit timeline entry' : 'Add timeline entry'} subtitle="Applies to the whole school" busy={saving} onClose={() => (editorOpen = false)}>
	<form id="tl-form" onsubmit={(e) => { e.preventDefault(); save(); }} style="display:flex; flex-direction:column; gap: 14px;">
		<div class="field">
			<label for="tl-fs">Fee structure *</label>
			<select id="tl-fs" class="input-s" bind:value={feeStructureId} disabled={saving}>
				{#each structures as s}<option value={s.id}>{s.name} — {s.termMonths === 1 ? 'monthly' : `${s.termMonths}-month terms`}</option>{/each}
			</select>
			<FieldError {errors} field="feeStructureId" />
		</div>
		<div class="field">
			<label for="tl-from">Starts on *</label>
			{#if startOptions.length > 0}
				<select id="tl-from" class="input-s" class:input-error-s={errors.effectiveFrom} bind:value={effectiveFrom} disabled={saving}>
					{#each startOptions as d}<option value={d}>{formatDate(d)}{d === today ? ' (today)' : ''}</option>{/each}
				</select>
				<span class="hint">Only the start of a term of the structure before it is allowed.</span>
			{:else}
				<input id="tl-from" type="date" class="input-s" class:input-error-s={errors.effectiveFrom} bind:value={effectiveFrom} disabled={saving} />
				<span class="hint">The first entry may start on any date. Nothing is billed before it.</span>
			{/if}
			<FieldError {errors} field="effectiveFrom" />
		</div>
		<div class="muted" style="font-size: 12px;">You'll see how everyone's dues change before anything is saved.</div>
		<ErrorCallout message={formError} />
	</form>
	{#snippet footer()}
		<button class="btn-s btn-secondary-s" onclick={() => (editorOpen = false)} disabled={saving}>Cancel</button>
		<button class="btn-s btn-primary-s" type="submit" form="tl-form" disabled={saving}>{#if saving}<span class="spinner"></span>{/if}Review impact</button>
	{/snippet}
</Modal>

<ImpactConfirm
	open={pending !== null}
	title="Confirm timeline change"
	summary={pending?.summary ?? ''}
	from={pending?.from}
	impact={pending?.impact ?? null}
	apply={applyPending}
	onClose={() => (pending = null)}
	onDone={() => {
		load();
		onChanged?.();
	}}
/>

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
