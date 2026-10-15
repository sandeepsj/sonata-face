<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { RefreshCcw, Clock, Scale } from 'lucide-svelte';
	import { api, ApiError, canAccess, errorMessage } from '$lib';
	import type { LegacyComparison, RebuildJob, RebuildSchedule, RebuildScope } from '$lib/api/types';
	import { features } from '$lib/config/features';
	import { formatDateTime } from '$lib/utils/format';
	import Money from '$lib/components/Money.svelte';
	import Badge from '$lib/components/Badge.svelte';
	import ErrorCallout from '$lib/components/ErrorCallout.svelte';

	let scope = $state<RebuildScope>('ALL');
	let studentId = $state('');

	let job = $state<RebuildJob | null>(null);
	let starting = $state(false);
	let error = $state('');
	let pollTimer: ReturnType<typeof setTimeout> | null = null;

	// not on backend (features.missingEndpoints)
	let schedule = $state<RebuildSchedule | null>(null);
	let scheduleError = $state('');

	let comparison = $state<LegacyComparison | null>(null);
	let comparisonState = $state<'idle' | 'loading' | 'gone' | 'error'>('idle');
	let comparisonError = $state('');
	let onlyMismatches = $state(true);

	let canWrite = $derived($canAccess('/api/dues/**', 'write'));
	let shownStudents = $derived(
		comparison
			? [...comparison.students]
					.filter((s) => !onlyMismatches || !s.match)
					.sort((a, b) => Number(a.match) - Number(b.match) || a.studentId - b.studentId)
			: []
	);

	onMount(async () => {
		if (!features.missingEndpoints) return;
		try {
			schedule = await api.dues.rebuildSchedule();
		} catch (e) {
			scheduleError = errorMessage(e, 'Could not load the schedule');
		}
	});

	onDestroy(() => {
		if (pollTimer) clearTimeout(pollTimer);
	});

	async function start() {
		error = '';
		let id: number | undefined;
		if (scope === 'STUDENT') {
			id = Number(studentId.trim());
			if (!studentId.trim() || !Number.isInteger(id)) {
				error = 'Enter an admission number';
				return;
			}
		}
		if (scope === 'ALL' && !confirm('Recalculate dues for the whole school now?')) return;
		starting = true;
		try {
			const { jobId } = await api.dues.rebuild(scope, id);
			job = { jobId, status: 'RUNNING' };
			poll(jobId);
		} catch (e) {
			error = errorMessage(e, 'Could not start the recalculation');
		} finally {
			starting = false;
		}
	}

	async function poll(jobId: string) {
		try {
			job = await api.dues.rebuildJob(jobId);
			if (job.status === 'RUNNING') pollTimer = setTimeout(() => poll(jobId), 1000);
		} catch (e) {
			error = errorMessage(e, 'Lost track of the job');
		}
	}

	async function loadComparison() {
		comparisonState = 'loading';
		comparisonError = '';
		try {
			comparison = await api.dues.legacyComparison();
			comparisonState = 'idle';
		} catch (e) {
			if (e instanceof ApiError && e.isNotFound) comparisonState = 'gone';
			else {
				comparisonState = 'error';
				comparisonError = errorMessage(e, 'Could not load the comparison');
			}
		}
	}
</script>

<svelte:head><title>Recalculate dues — Revathi Arts</title></svelte:head>

<div class="page">
	<div class="page-head">
		<div class="page-head-row">
			<div>
				<h1 class="page-title">Recalculate <em>dues</em></h1>
				<p class="page-subtitle">Dues are recalculated automatically after every change. Run it by hand to repair them for one student or the whole school.</p>
			</div>
		</div>
	</div>

	<div class="grid-2" style="margin-bottom: 18px; align-items: start;">
		<div class="card-s">
			<div class="card-header"><h3 class="card-title-s"><RefreshCcw size={15} strokeWidth={1.6} style="vertical-align: -2px;" /> Run a recalculation</h3></div>
			<div class="card-body-s" style="display:flex; flex-direction:column; gap: 14px;">
				<div class="field">
					<span class="kpi-label">Scope</span>
					<div class="seg">
						{#each [['ALL', 'Whole school'], ['STUDENT', 'One student']] as [v, label]}
							<button class:active={scope === v} onclick={() => (scope = v as RebuildScope)} disabled={!canWrite}>{label}</button>
						{/each}
					</div>
				</div>
				{#if scope === 'STUDENT'}
					<div class="field">
						<label for="rb-student">Admission number</label>
						<input id="rb-student" class="input-s" inputmode="numeric" bind:value={studentId} />
					</div>
				{/if}
				<ErrorCallout message={error} />
				{#if canWrite}
					<div>
						<button class="btn-s btn-primary-s" onclick={start} disabled={starting || job?.status === 'RUNNING'}>
							{#if starting || job?.status === 'RUNNING'}<span class="spinner"></span>{/if}
							Recalculate now
						</button>
					</div>
				{:else}
					<div class="muted" style="font-size: 12px;">You need write access to dues to run a recalculation.</div>
				{/if}
			</div>
		</div>

		{#if features.missingEndpoints}
		<div class="card-s">
			<div class="card-header"><h3 class="card-title-s"><Clock size={15} strokeWidth={1.6} style="vertical-align: -2px;" /> Nightly run</h3></div>
			<div class="card-body-s">
				{#if schedule}
					<div style="font-family: var(--font-serif); font-size: 20px;">Next run {formatDateTime(schedule.nextRunAt)}</div>
					<div class="muted" style="font-size: 12px; margin-top: 4px;">Schedule (cron): <code>{schedule.cron}</code>. Everything is recalculated nightly, so dues for new periods appear without anyone acting.</div>
				{:else}
					<ErrorCallout message={scheduleError} />
				{/if}
			</div>
		</div>
		{/if}
	</div>

	{#if job}
		<div class="card-s" style="margin-bottom: 18px;">
			<div class="card-header" style="display:flex; justify-content: space-between; align-items: center;">
				<h3 class="card-title-s">Job {job.jobId.slice(0, 8)}</h3>
				{#if job.status === 'RUNNING'}<Badge kind="warn">Running…</Badge>{:else if job.status === 'DONE'}<Badge kind="ok">Done</Badge>{:else}<Badge kind="danger">Failed</Badge>{/if}
			</div>
			<div class="card-body-s" style="display:flex; flex-direction:column; gap: 14px;">
				<div class="kpi-grid">
					<div class="kpi"><div class="kpi-label">Students</div><div class="kpi-value">{job.students ?? 0}</div></div>
					<div class="kpi"><div class="kpi-label">Terms added</div><div class="kpi-value">{job.changes?.inserted ?? 0}</div></div>
					<div class="kpi"><div class="kpi-label">Changed</div><div class="kpi-value">{job.changes?.updated ?? 0}</div></div>
					<div class="kpi"><div class="kpi-label">Removed</div><div class="kpi-value">{job.changes?.deleted ?? 0}</div></div>
				</div>
				{#if job.startedAt}
					<div class="muted" style="font-size: 12px;">Scope {job.scope === 'STUDENT' ? 'one student' : 'whole school'} · started {formatDateTime(job.startedAt)}{job.finishedAt ? ` · finished ${formatDateTime(job.finishedAt)}` : ''}</div>
				{/if}
				{#if job.errors?.length}
					<div class="callout danger"><div class="callout-body"><div class="callout-title">{job.errors.length} error{job.errors.length === 1 ? '' : 's'}</div>{#each job.errors as e}<div>{e}</div>{/each}</div></div>
				{/if}
				{#if job.status === 'DONE' && !job.changes?.inserted && !job.changes?.updated && !job.changes?.deleted}
					<div class="callout info"><div class="callout-body">No changes were needed. Dues were up to date.</div></div>
				{/if}
			</div>
		</div>
	{/if}

	{#if features.missingEndpoints}
	<div class="card-s">
		<div class="card-header" style="display:flex; justify-content: space-between; align-items: center;">
			<h3 class="card-title-s"><Scale size={15} strokeWidth={1.6} style="vertical-align: -2px;" /> Migration check: old vs new dues</h3>
			{#if comparisonState !== 'gone'}
				<button class="btn-s btn-secondary-s btn-sm-s" onclick={loadComparison} disabled={comparisonState === 'loading'}>
					{#if comparisonState === 'loading'}<span class="spinner"></span>{/if}{comparison ? 'Reload' : 'Run comparison'}
				</button>
			{/if}
		</div>
		<div class="card-body-s" style="display:flex; flex-direction:column; gap: 12px;">
			<div class="muted" style="font-size: 12px;">A one-off report that compares each student's dues from the old system with the recalculated ones.</div>
			{#if comparisonState === 'gone'}
				<div class="callout info"><div class="callout-body">The old dues tables have been removed, so there is nothing left to compare.</div></div>
			{:else if comparisonState === 'error'}
				<ErrorCallout message={comparisonError} />
			{:else if comparison}
				<div class="kpi-grid">
					<div class="kpi"><div class="kpi-label">Mismatched students</div><div class="kpi-value" style:color={comparison.mismatches ? 'var(--danger)' : 'var(--ok)'}>{comparison.mismatches}</div><div class="kpi-meta"><span>of {comparison.students.length}</span></div></div>
					<div class="kpi"><div class="kpi-label">Billed old → new</div><div class="kpi-value" style="font-size: 16px;"><Money value={comparison.totals.legacyBilled} mono={false} /> → <Money value={comparison.totals.newBilled} mono={false} /></div></div>
					<div class="kpi"><div class="kpi-label">Outstanding old → new</div><div class="kpi-value" style="font-size: 16px;"><Money value={comparison.totals.legacyOutstanding} mono={false} /> → <Money value={comparison.totals.newOutstanding} mono={false} /></div></div>
					<div class="kpi"></div>
				</div>
				<label style="font-size: 12px; display:flex; gap: 6px; align-items:center;"><input type="checkbox" bind:checked={onlyMismatches} /> Only show mismatches</label>
				<div class="tbl-wrap" style="max-height: 420px; overflow-y: auto;">
					<table class="tbl">
						<thead><tr><th>Student</th><th class="num">Old billed</th><th class="num">New billed</th><th class="num">Old outstanding</th><th class="num">New outstanding</th><th></th></tr></thead>
						<tbody>
							{#each shownStudents as s (s.studentId)}
								<tr>
									<td><a href="/students/{s.studentId}/dues" style="color: var(--accent);">{s.studentId}</a></td>
									<td class="num"><Money value={s.legacyBilled} /></td>
									<td class="num"><Money value={s.newBilled} /></td>
									<td class="num"><Money value={s.legacyOutstanding} /></td>
									<td class="num"><Money value={s.newOutstanding} /></td>
									<td>{#if s.match}<Badge kind="ok">Match</Badge>{:else}<Badge kind="danger">Mismatch</Badge>{/if}</td>
								</tr>
							{:else}
								<tr><td colspan="6" class="muted" style="text-align:center; padding: 18px;">{onlyMismatches ? 'Every student matches.' : 'No students.'}</td></tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>
	</div>
{/if}
</div>
