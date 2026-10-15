<script lang="ts">
	import { onMount } from 'svelte';
	import { Plus, Pencil, Trash2 } from 'lucide-svelte';
	import { api, canAccess, errorMessage, fieldErrors, toast } from '$lib';
	import type { Course, FeeStructure, FeeStructureRequest, Impact } from '$lib/api/types';
	import { money } from '$lib/utils/format';
	import Badge from '$lib/components/Badge.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import ErrorCallout from '$lib/components/ErrorCallout.svelte';
	import FieldError from '$lib/components/FieldError.svelte';
	import ImpactConfirm from '$lib/components/ImpactConfirm.svelte';

	/** Called after a change that may affect the timeline and dues */
	let { onChanged }: { onChanged?: () => void } = $props();

	let structures: FeeStructure[] = $state([]);
	let courses: Course[] = $state([]);
	let loading = $state(true);
	let loadError = $state('');

	let canWrite = $derived($canAccess('/api/fee-structures/**', 'write'));

	// editor: one amount row per course; a blank amount means the course isn't billed
	let editorOpen = $state(false);
	let editing: FeeStructure | null = $state(null);
	let name = $state('');
	let termMonths: number | string = $state(3);
	let amounts: Record<string, string> = $state({});
	let saving = $state(false);
	let formError = $state('');
	let errors: Record<string, string> = $state({});

	// second step for structures on the timeline
	let confirmBody: FeeStructureRequest | null = $state(null);
	let confirmImpact: Impact | null = $state(null);

	export async function load() {
		loading = true;
		loadError = '';
		try {
			const [s, c] = await Promise.all([api.feeStructures.list(), api.courses.list()]);
			structures = s.sort((a, b) => a.name.localeCompare(b.name));
			courses = c.sort((a, b) => a.name.localeCompare(b.name));
		} catch (e) {
			loadError = errorMessage(e, 'Failed to load fee structures');
		} finally {
			loading = false;
		}
	}

	onMount(load);

	function termLabel(m: number): string {
		if (m === 1) return 'Monthly';
		if (m === 12) return 'Yearly';
		return `Every ${m} months`;
	}

	function openEditor(fs: FeeStructure | null) {
		editing = fs;
		name = fs?.name ?? '';
		termMonths = fs?.termMonths ?? 3;
		amounts = Object.fromEntries(courses.map((c) => [c.name, '']));
		for (const a of fs?.amounts ?? []) amounts[a.courseName] = String(a.amount);
		formError = '';
		errors = {};
		editorOpen = true;
	}

	function buildBody(): FeeStructureRequest | null {
		const e: Record<string, string> = {};
		if (!name.trim()) e.name = 'Name is required';
		const m = Number(termMonths);
		if (!Number.isInteger(m) || m < 1 || m > 12) e.termMonths = 'A whole number of months from 1 to 12';
		const rows = Object.entries(amounts).filter(([, v]) => String(v).trim() !== '');
		if (rows.some(([, v]) => !(Number(v) >= 0))) e.amounts = 'Amounts must be 0 or more';
		errors = e;
		if (Object.keys(e).length) return null;
		return {
			name: name.trim(),
			termMonths: m,
			amounts: rows.map(([courseName, v]) => ({ courseName, amount: Number(v) }))
		};
	}

	async function save() {
		formError = '';
		const body = buildBody();
		if (!body) return;
		saving = true;
		try {
			if (editing?.usedInTimeline) {
				// On the timeline: show the impact first, apply after an explicit confirmation
				const dry = await api.feeStructures.update(editing.id, body, true);
				confirmImpact = dry.recalculation ?? null;
				confirmBody = body;
				editorOpen = false;
				return;
			}
			if (editing) await api.feeStructures.update(editing.id, body);
			else await api.feeStructures.create(body);
			toast.ok(`Saved "${body.name}"`);
			editorOpen = false;
			await load();
			onChanged?.();
		} catch (e) {
			formError = errorMessage(e, 'Failed to save fee structure');
			errors = fieldErrors(e);
		} finally {
			saving = false;
		}
	}

	async function applyConfirmed(): Promise<Impact | null> {
		const res = await api.feeStructures.update(editing!.id, confirmBody!);
		return res.recalculation ?? null;
	}

	async function remove(fs: FeeStructure) {
		if (!confirm(`Delete fee structure "${fs.name}"?`)) return;
		try {
			await api.feeStructures.remove(fs.id);
			toast.ok(`Deleted "${fs.name}"`);
			await load();
			onChanged?.();
		} catch (e) {
			toast.error(errorMessage(e, 'Failed to delete'));
		}
	}

	/** Field error for a course row: `amounts[i]…` from the server, indexed like the request */
	function amountError(courseName: string): string | undefined {
		const filled = Object.entries(amounts).filter(([, v]) => String(v).trim() !== '').map(([c]) => c);
		const i = filled.indexOf(courseName);
		return i < 0 ? undefined : Object.entries(errors).find(([k]) => k.startsWith(`amounts[${i}]`))?.[1];
	}
</script>

<div class="course-card">
	<div class="course-card-head" style="display:flex; align-items:center; justify-content:space-between; gap: 10px;">
		<div>
			<span class="course-card-title">Fee structures</span>
			<div class="muted" style="font-size: 12px; margin-top: 2px;">
				A term length and an amount for each course. The timeline says when each one applies.
			</div>
		</div>
		{#if canWrite}
			<button class="btn-s btn-primary-s btn-sm-s" onclick={() => openEditor(null)} disabled={loading}><Plus size={13} strokeWidth={1.8} /> New structure</button>
		{/if}
	</div>

	<div style="padding: 14px; display:flex; flex-direction:column; gap: 12px;">
		<ErrorCallout message={loadError} />
		{#if loading}
			<div style="display:flex; justify-content:center; padding: 20px;"><span class="spinner"></span></div>
		{:else if structures.length === 0}
			<div class="callout info"><div class="callout-body">No fee structures yet.</div></div>
		{:else}
			{#each structures as fs (fs.id)}
				<div class="card-s">
					<div class="card-body-s">
						<div style="display:flex; align-items:flex-start; justify-content:space-between; gap: 10px; flex-wrap: wrap;">
							<div>
								<div style="display:flex; align-items:center; gap: 8px;">
									<span style="font-family: var(--font-serif); font-size: 16px; font-weight: 500;">{fs.name}</span>
									{#if fs.usedInTimeline}<Badge kind="ok">On the timeline</Badge>{:else}<Badge kind="neutral">Not used</Badge>{/if}
								</div>
								<div class="muted" style="font-size: 12px; margin-top: 2px;">{termLabel(fs.termMonths)} · {fs.amounts.length} {fs.amounts.length === 1 ? 'course' : 'courses'}</div>
							</div>
							{#if canWrite}
								<div style="display:flex; gap: 4px;">
									<button class="btn-s btn-ghost-s btn-sm-s" onclick={() => openEditor(fs)}><Pencil size={13} /> Edit</button>
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
							{#each fs.amounts as a (a.courseName)}
								<div class="term-cell">
									<div class="kpi-label">{a.courseName}</div>
									<div style="font-family: var(--font-mono); font-size: 13px;">{money(a.amount)} <span class="muted">/ term</span></div>
								</div>
							{:else}
								<div class="muted" style="font-size: 12px;">No course is billed under this structure.</div>
							{/each}
						</div>
					</div>
				</div>
			{/each}
		{/if}
	</div>
</div>

<Modal open={editorOpen} title={editing ? 'Edit fee structure' : 'New fee structure'} subtitle="One structure covers every course" size="lg" busy={saving} onClose={() => (editorOpen = false)}>
	<form id="fs-form" onsubmit={(e) => { e.preventDefault(); save(); }} style="display:flex; flex-direction:column; gap: 14px;">
		{#if editing?.usedInTimeline}
			<div class="callout info"><div class="callout-body">This structure is on the fee timeline. You'll see how everyone's dues change before anything is saved.</div></div>
		{/if}
		<div class="grid-2">
			<div class="field">
				<label for="fs-name">Name *</label>
				<input id="fs-name" class="input-s" class:input-error-s={errors.name} bind:value={name} placeholder="e.g. 2027 fees" disabled={saving} />
				<FieldError {errors} field="name" />
			</div>
			<div class="field">
				<label for="fs-months">Term length (months) *</label>
				<input id="fs-months" class="input-s" class:input-error-s={errors.termMonths} type="number" min="1" max="12" step="1" bind:value={termMonths} disabled={saving} />
				<FieldError {errors} field="termMonths" />
			</div>
		</div>
		<div>
			<span class="kpi-label">Amount per term, by course</span>
			<div class="tbl-wrap" style="margin-top: 6px;">
				<table class="tbl">
					<tbody>
						{#each courses as c (c.name)}
							<tr>
								<td style="font-weight: 500;">
									<label for="amt-{c.name}">{c.name}</label>
									{#if amountError(c.name)}<div class="field-error">{amountError(c.name)}</div>{/if}
								</td>
								<td style="width: 180px;">
									<input id="amt-{c.name}" class="input-s" type="number" min="0" step="0.01" placeholder="Not billed" bind:value={amounts[c.name]} disabled={saving} />
								</td>
							</tr>
						{:else}
							<tr><td class="muted">Add a course first.</td></tr>
						{/each}
					</tbody>
				</table>
			</div>
			<FieldError {errors} field="amounts" />
			<div class="muted" style="font-size: 12px; margin-top: 6px;">Leave a course blank to not bill it while this structure applies. 0 is allowed.</div>
		</div>
		<ErrorCallout message={formError} />
	</form>
	{#snippet footer()}
		<button class="btn-s btn-secondary-s" onclick={() => (editorOpen = false)} disabled={saving}>Cancel</button>
		<button class="btn-s btn-primary-s" type="submit" form="fs-form" disabled={saving}>
			{#if saving}<span class="spinner"></span>{/if}{editing?.usedInTimeline ? 'Review impact' : editing ? 'Save' : 'Create'}
		</button>
	{/snippet}
</Modal>

<ImpactConfirm
	open={confirmBody !== null}
	title="Confirm fee change"
	summary={editing ? `Edit "${editing.name}"` : ''}
	impact={confirmImpact}
	apply={applyConfirmed}
	onClose={() => (confirmBody = null)}
	onDone={() => {
		load();
		onChanged?.();
	}}
/>

<style>
	.terms-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
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
