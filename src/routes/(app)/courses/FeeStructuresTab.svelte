<script lang="ts">
	import { onMount } from 'svelte';
	import { Plus, Pencil, Copy, Trash2 } from 'lucide-svelte';
	import { api, canAccess, errorMessage, fieldErrors, toast } from '$lib';
	import { TERMS_PER_YEAR, type Course, type FeeStructure, type TermAmount } from '$lib/api/types';
	import { cadenceLabel, money, termMonths } from '$lib/utils/format';
	import Badge from '$lib/components/Badge.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import ErrorCallout from '$lib/components/ErrorCallout.svelte';
	import FieldError from '$lib/components/FieldError.svelte';

	let { course }: { course: Course } = $props();

	let structures: FeeStructure[] = $state([]);
	let loading = $state(true);
	let loadError = $state('');

	let canWrite = $derived($canAccess('/api/fee-structures/**', 'write'));

	// editor
	let editorOpen = $state(false);
	let editing: FeeStructure | null = $state(null);
	let name = $state('');
	let termsPerYear = $state(4);
	let terms: TermAmount[] = $state([]);
	let saving = $state(false);
	let formError = $state('');
	let errors: Record<string, string> = $state({});

	// clone
	let cloning: FeeStructure | null = $state(null);
	let cloneName = $state('');
	let cloneError = $state('');

	async function load() {
		loading = true;
		loadError = '';
		try {
			structures = (await api.feeStructures.list(course.name)).sort((a, b) => a.name.localeCompare(b.name));
		} catch (e) {
			loadError = errorMessage(e, 'Failed to load fee structures');
		} finally {
			loading = false;
		}
	}

	onMount(load);

	function yearly(fs: { terms: TermAmount[] }) {
		return fs.terms.reduce((s, t) => s + (Number(t.amount) || 0), 0);
	}

	/** Rebuild the term rows for a new termsPerYear, keeping amounts that still fit. */
	function setTermsPerYear(n: number) {
		termsPerYear = n;
		terms = Array.from({ length: n }, (_, i) => ({
			termNumber: i + 1,
			amount: terms[i]?.amount ?? terms[terms.length - 1]?.amount ?? 0
		}));
	}

	function openEditor(fs: FeeStructure | null) {
		editing = fs;
		name = fs?.name ?? '';
		termsPerYear = fs?.termsPerYear ?? 4;
		terms = fs ? fs.terms.map((t) => ({ ...t })) : Array.from({ length: 4 }, (_, i) => ({ termNumber: i + 1, amount: 0 }));
		formError = '';
		errors = {};
		editorOpen = true;
	}

	function fillAll() {
		const first = terms[0]?.amount ?? 0;
		terms = terms.map((t) => ({ ...t, amount: first }));
	}

	async function save() {
		formError = '';
		errors = {};
		if (!name.trim()) errors.name = 'Name is required';
		if (terms.some((t) => !(Number(t.amount) >= 0) || (t.amount as unknown) === '')) errors.terms = 'Every term needs an amount of 0 or more';
		if (Object.keys(errors).length) return;
		saving = true;
		const body = {
			name: name.trim(),
			courseName: course.name,
			termsPerYear,
			terms: terms.map((t) => ({ termNumber: t.termNumber, amount: Number(t.amount) }))
		};
		try {
			if (editing) await api.feeStructures.update(editing.id, body);
			else await api.feeStructures.create(body);
			toast.ok(
				editing?.usedInTimeline
					? `Saved "${body.name}". Dues for ${course.name} are being recalculated.`
					: `Saved "${body.name}"`
			);
			editorOpen = false;
			await load();
		} catch (e) {
			formError = errorMessage(e, 'Failed to save fee structure');
			errors = fieldErrors(e);
		} finally {
			saving = false;
		}
	}

	function openClone(fs: FeeStructure) {
		cloning = fs;
		cloneName = `${fs.name} (copy)`;
		cloneError = '';
	}

	async function doClone() {
		if (!cloning) return;
		if (!cloneName.trim()) {
			cloneError = 'Name is required';
			return;
		}
		saving = true;
		try {
			const created = await api.feeStructures.clone(cloning.id, cloneName.trim());
			toast.ok(`Created "${created.name}"`);
			cloning = null;
			await load();
		} catch (e) {
			cloneError = fieldErrors(e).name ?? errorMessage(e, 'Failed to clone');
		} finally {
			saving = false;
		}
	}

	async function remove(fs: FeeStructure) {
		if (!confirm(`Delete fee structure "${fs.name}"?`)) return;
		try {
			await api.feeStructures.remove(fs.id);
			toast.ok(`Deleted "${fs.name}"`);
			await load();
		} catch (e) {
			toast.error(errorMessage(e, 'Failed to delete'));
		}
	}
</script>

<div class="course-card">
	<div class="course-card-head" style="display:flex; align-items:center; justify-content:space-between; gap: 10px;">
		<div>
			<span class="course-card-title">Fee structures</span>
			<div class="muted" style="font-size: 12px; margin-top: 2px;">Reusable fee templates for {course.name}. Use the fee timeline to say when each one applies.</div>
		</div>
		{#if canWrite}
			<button class="btn-s btn-primary-s btn-sm-s" onclick={() => openEditor(null)}><Plus size={13} strokeWidth={1.8} /> New structure</button>
		{/if}
	</div>

	<div style="padding: 14px; display:flex; flex-direction:column; gap: 12px;">
		<ErrorCallout message={loadError} />
		{#if loading}
			<div style="display:flex; justify-content:center; padding: 20px;"><span class="spinner"></span></div>
		{:else if structures.length === 0}
			<div class="callout info"><div class="callout-body">No fee structures for {course.name} yet.</div></div>
		{:else}
			{#each structures as fs (fs.id)}
				<div class="card-s">
					<div class="card-body-s">
						<div style="display:flex; align-items:flex-start; justify-content:space-between; gap: 10px; flex-wrap: wrap;">
							<div>
								<div style="display:flex; align-items:center; gap: 8px;">
									<span style="font-family: var(--font-serif); font-size: 16px; font-weight: 500;">{fs.name}</span>
									{#if fs.usedInTimeline}<Badge kind="ok">Used in timeline</Badge>{:else}<Badge kind="neutral">Not used</Badge>{/if}
								</div>
								<div class="muted" style="font-size: 12px; margin-top: 2px;">{cadenceLabel(fs.termsPerYear)} · {money(yearly(fs))} a year</div>
							</div>
							{#if canWrite}
								<div style="display:flex; gap: 4px;">
									<button class="btn-s btn-ghost-s btn-sm-s" onclick={() => openEditor(fs)}><Pencil size={13} /> Edit</button>
									<button class="btn-s btn-ghost-s btn-sm-s" onclick={() => openClone(fs)}><Copy size={13} /> Clone</button>
									<button
										class="btn-s btn-ghost-s btn-sm-s"
										style="color: var(--danger);"
										onclick={() => remove(fs)}
										disabled={fs.usedInTimeline}
										title={fs.usedInTimeline ? 'Remove it from the fee timeline first' : 'Delete'}
									><Trash2 size={13} /> Delete</button>
								</div>
							{/if}
						</div>
						<div class="terms-grid">
							{#each fs.terms as t}
								<div class="term-cell">
									<div class="kpi-label">{fs.termsPerYear === 12 ? termMonths(t.termNumber, 12) : `Term ${t.termNumber} · ${termMonths(t.termNumber, fs.termsPerYear)}`}</div>
									<div style="font-family: var(--font-mono); font-size: 13px;">{money(t.amount)}</div>
								</div>
							{/each}
						</div>
					</div>
				</div>
			{/each}
		{/if}
	</div>
</div>

<Modal open={editorOpen} title={editing ? 'Edit fee structure' : 'New fee structure'} subtitle={course.name} size="lg" busy={saving} onClose={() => (editorOpen = false)}>
	<form id="fs-form" onsubmit={(e) => { e.preventDefault(); save(); }} style="display:flex; flex-direction:column; gap: 14px;">
		{#if editing?.usedInTimeline}
			<div class="callout info"><div class="callout-body">This structure is used in the fee timeline. Saving recalculates dues for {course.name}. Payments are not changed.</div></div>
		{/if}
		<div class="grid-2">
			<div class="field">
				<label for="fs-name">Name *</label>
				<input id="fs-name" class="input-s" class:input-error-s={errors.name} bind:value={name} placeholder="e.g. Quarterly 2026" disabled={saving} />
				<FieldError {errors} field="name" />
			</div>
			<div class="field">
				<label for="fs-tpy">Terms per year</label>
				<select id="fs-tpy" class="input-s" value={termsPerYear} onchange={(e) => setTermsPerYear(Number(e.currentTarget.value))} disabled={saving}>
					{#each TERMS_PER_YEAR as n}<option value={n}>{n} — {cadenceLabel(n)}</option>{/each}
				</select>
				<FieldError {errors} field="termsPerYear" />
			</div>
		</div>
		<div>
			<div style="display:flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
				<span class="kpi-label">Amount per term</span>
				{#if terms.length > 1}<button type="button" class="btn-s btn-ghost-s btn-sm-s" onclick={fillAll} disabled={saving}>Use term 1 amount for all</button>{/if}
			</div>
			<div class="terms-grid" style="margin-top: 0;">
				{#each terms as t, i}
					<div class="field">
						<label for="term-{i}">{termsPerYear === 12 ? termMonths(t.termNumber, 12) : `Term ${t.termNumber} · ${termMonths(t.termNumber, termsPerYear)}`}</label>
						<input id="term-{i}" class="input-s" type="number" min="0" step="0.01" bind:value={t.amount} disabled={saving} />
					</div>
				{/each}
			</div>
			<FieldError {errors} field="terms" />
			<div class="muted" style="font-size: 12px; margin-top: 6px;">Yearly total: {money(yearly({ terms }))}</div>
		</div>
		<ErrorCallout message={formError} />
	</form>
	{#snippet footer()}
		<button class="btn-s btn-secondary-s" onclick={() => (editorOpen = false)} disabled={saving}>Cancel</button>
		<button class="btn-s btn-primary-s" type="submit" form="fs-form" disabled={saving}>{#if saving}<span class="spinner"></span>{/if}{editing ? 'Save' : 'Create'}</button>
	{/snippet}
</Modal>

<Modal open={cloning !== null} title="Clone fee structure" subtitle={cloning ? `Copy of "${cloning.name}" with the same terms and amounts` : ''} busy={saving} onClose={() => (cloning = null)}>
	<form id="clone-form" onsubmit={(e) => { e.preventDefault(); doClone(); }}>
		<div class="field">
			<label for="clone-name">New name *</label>
			<input id="clone-name" class="input-s" class:input-error-s={cloneError} bind:value={cloneName} disabled={saving} />
			{#if cloneError}<div class="field-error">{cloneError}</div>{/if}
		</div>
	</form>
	{#snippet footer()}
		<button class="btn-s btn-secondary-s" onclick={() => (cloning = null)} disabled={saving}>Cancel</button>
		<button class="btn-s btn-primary-s" type="submit" form="clone-form" disabled={saving}>{#if saving}<span class="spinner"></span>{/if}Clone</button>
	{/snippet}
</Modal>

<style>
	.terms-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
		gap: 8px;
		margin-top: 12px;
	}
	.term-cell {
		padding: 8px 10px;
		background: var(--bg-elev);
		border: 1px solid var(--border);
		border-radius: 8px;
	}
</style>
