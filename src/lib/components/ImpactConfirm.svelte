<script lang="ts">
	// Second step of a fee change: the caller has already sent the request with `?dryRun=true` and passes its
	// `recalculation` here. The admin confirms explicitly, then `apply` sends the real request. The request itself
	// is the status (it returns once everyone's dues are recalculated, or rolls back on failure).
	import { AlertTriangle, CheckCircle } from 'lucide-svelte';
	import type { Impact } from '$lib/api/types';
	import { errorMessage } from '$lib/api/client';
	import { formatDate, money } from '$lib/utils/format';
	import Modal from './Modal.svelte';
	import ErrorCallout from './ErrorCallout.svelte';

	interface Props {
		open: boolean;
		title: string;
		/** What is changing, e.g. 'Add "Quarterly 2027" to the timeline' */
		summary: string;
		/** First date the change affects, if any */
		from?: string | null;
		/** The dry run's recalculation */
		impact: Impact | null;
		/** Sends the real request; returns its recalculation */
		apply: () => Promise<Impact | null | undefined>;
		onClose: () => void;
		/** Called after the real request succeeded and the result was dismissed */
		onDone?: () => void;
	}
	let { open, title, summary, from = null, impact, apply, onClose, onDone }: Props = $props();

	let understood = $state(false);
	let applying = $state(false);
	let error = $state('');
	let result: Impact | null | undefined = $state(undefined);

	$effect(() => {
		if (open) {
			understood = false;
			applying = false;
			error = '';
			result = undefined;
		}
	});

	function signed(n: number): string {
		return `${n >= 0 ? '+' : '−'}${money(Math.abs(n))}`;
	}

	async function run() {
		error = '';
		applying = true;
		try {
			result = (await apply()) ?? null;
		} catch (e) {
			error = errorMessage(e, 'The change was not applied');
		} finally {
			applying = false;
		}
	}

	function finish() {
		const done = result !== undefined;
		onClose();
		if (done) onDone?.();
	}
</script>

{#snippet impactLines(i: Impact)}
	<div class="impact">
		<div><span class="impact-num">{i.students}</span> {i.students === 1 ? "student's dues change" : "students' dues change"}</div>
		<div class="muted" style="font-size: 12px;">{i.inserted} terms added · {i.updated} changed · {i.deleted} removed</div>
		<div style="margin-top: 6px;">
			Outstanding <span class="mono">{money(i.outstandingBefore)}</span> → <span class="mono">{money(i.outstandingAfter)}</span>
			<span class="mono" class:up={i.outstandingChange > 0} class:down={i.outstandingChange < 0}>({signed(i.outstandingChange)})</span>
		</div>
	</div>
{/snippet}

<Modal {open} {title} subtitle={summary} busy={applying} onClose={finish}>
	{#if result !== undefined}
		<div class="callout info" style="margin-bottom: 12px;">
			<CheckCircle size={16} strokeWidth={1.6} />
			<div class="callout-body">Done. Everyone's dues have been recalculated.</div>
		</div>
		{#if result}{@render impactLines(result)}{/if}
	{:else if applying}
		<div style="display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 24px 0;">
			<span class="spinner spinner-lg"></span>
			<div>Updating fees and recalculating dues…</div>
			<div class="muted" style="font-size: 12px;">Keep this page open. If anything fails, nothing is changed.</div>
		</div>
	{:else}
		<div style="display: flex; flex-direction: column; gap: 12px;">
			<div class="muted" style="font-size: 13px;">
				Nothing has been saved yet. This is what the change would do{from ? `, from ${formatDate(from)}` : ''}:
			</div>
			{#if impact}{@render impactLines(impact)}{:else}<div class="muted">No dues change.</div>{/if}
			<label class="confirm-row">
				<input type="checkbox" bind:checked={understood} />
				<span>I understand this recalculates everyone's dues.</span>
			</label>
			<ErrorCallout message={error} />
		</div>
	{/if}
	{#snippet footer()}
		{#if result !== undefined}
			<button class="btn-s btn-primary-s" onclick={finish}>Close</button>
		{:else}
			<button class="btn-s btn-secondary-s" onclick={finish} disabled={applying}>Cancel</button>
			<button class="btn-s btn-primary-s" onclick={run} disabled={!understood || applying}>
				{#if applying}<span class="spinner"></span>{:else}<AlertTriangle size={14} strokeWidth={1.6} />{/if} Apply change
			</button>
		{/if}
	{/snippet}
</Modal>

<style>
	.impact {
		padding: 12px 14px;
		background: var(--bg-elev);
		border: 1px solid var(--border);
		border-radius: 10px;
		font-size: 13.5px;
	}
	.impact-num {
		font-family: var(--font-serif);
		font-size: 20px;
		font-weight: 500;
	}
	.mono {
		font-family: var(--font-mono);
	}
	.up {
		color: var(--danger);
	}
	.down {
		color: var(--ok, inherit);
	}
	.confirm-row {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
	}
</style>
