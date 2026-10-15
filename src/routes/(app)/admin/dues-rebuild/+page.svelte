<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { RefreshCcw, Clock, Scale } from 'lucide-svelte';
	import { api, ApiError, canAccess, errorMessage } from '$lib';
	import type { Course, LegacyComparison, RebuildJob, RebuildSchedule, RebuildScope } from '$lib/api/types';
	import { formatDate, formatDateTime } from '$lib/utils/format';
	import Money from '$lib/components/Money.svelte';
	import Badge from '$lib/components/Badge.svelte';
	import ErrorCallout from '$lib/components/ErrorCallout.svelte';

	let scope = $state<RebuildScope>('ALL');
	let courseName = $state('');
	let studentId = $state('');
	let dryRun = $state(true);
	let courses: Course[] = $state([]);

	let job = $state<RebuildJob | null>(null);
	let starting = $state(false);
	let error = $state('');
	let pollTimer: ReturnType<typeof setTimeout> | null = null;

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
		api.courses.list().then((c) => (courses = c.sort((a, b) => a.name.localeCompare(b.name)))).catch(() => {});
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
		const id = scope === 'COURSE' ? courseName : scope === 'STUDENT' ? studentId.trim() : undefined;
		if (scope !== 'ALL' && !id) {
			error = scope === 'COURSE' ? 'Choose a course' : 'Enter an admission number';
			return;
		}
		if (!dryRun && scope === 'ALL' && !confirm('Recalculate dues for the whole school now?')) return;
		starting = true;
		try {
			const { jobId } = await api.dues.rebuild(scope, id, dryRun);
			job = { jobId, status: 'RUNNING' } as RebuildJob;
			poll(jobId);
		} catch (e) {
			error = errorMessage(e, 'Could not start the recalculation');
		} finally {
			starting = false;
		}
	}

	async function poll(jobId: number) {
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

	function describe(err: unknown): string {
		if (typeof err === 'string') return err;
		if (err && typeof err === 'object') {
			const o = err as Record<string, unknown>;
			return [o.studentId ? `Student ${o.studentId}` : '', o.message ?? o.error ?? JSON.stringify(err)].filter(Boolean).join(': ');
		}
		return String(err);
	}
</script>

<svelte:head><title>Dues recalculation — Revathi Arts</title></svelte:head>

<div class="page">
	<div class="page-head">
		<div class="page-head-row">
			<div>
				<h1 class="page-title">Dues <em>recalculation</em></h1>
				<p class="page-subtitle">Dues are recalculated automatically after every change. Run it by hand to check or repair them.</p>
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
						{#each [['ALL', 'Whole school'], ['COURSE', 'One course'], ['STUDENT', 'One student']] as [v, label]}
							<button class:active={scope === v} onclick={() => (scope = v as RebuildScope)} disabled={!canWrite}>{label}</button>
						{/each}
					</div>
				</div>
				{#if scope === 'COURSE'}
					<div class="field">
						<label for="rb-course">Course</label>
						<select id="rb-course" class="input-s" bind:value={courseName}>
							<option value="">Choose…</option>
							{#each courses as c}<option value={c.name}>{c.name}</option>{/each}
						</select>
					</div>
				{:else if scope === 'STUDENT'}
					<div class="field">
						<label for="rb-student">Admission number</label>
						<input id="rb-student" class="input-s" inputmode="numeric" bind:value={studentId} />
					</div>
				{/if}
				<label style="display:flex; gap: 8px; align-items: flex-start; font-size: 13px;">
					<input type="checkbox" bind:checked={dryRun} disabled={!canWrite} style="margin-top: 3px;" />
					<span>Dry run: <span class="muted">show what would change without writing anything</span></span>
				</label>
				<ErrorCallout message={error} />
				{#if canWrite}
					<div>
						<button class="btn-s btn-primary-s" onclick={start} disabled={starting || job?.status === 'RUNNING'}>
							{#if starting || job?.status === 'RUNNING'}<span class="spinner"></span>{/if}
							{dryRun ? 'Preview changes' : 'Recalculate now'}
						</button>
					</div>
				{:else}
					<div class="muted" style="font-size: 12px;">You need write access to dues to run a recalculation.</div>
				{/if}
			</div>
		</div>

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
	</div>

	{#if job}
		<div class="card-s" style="margin-bottom: 18px;">
			<div class="card-header" style="display:flex; justify-content: space-between; align-items: center;">
				<h3 class="card-title-s">Job #{job.jobId} {job.dryRun ? '(dry run)' : ''}</h3>
				{#if job.status === 'RUNNING'}<Badge kind="warn">Running…</Badge>{:else if job.status === 'DONE'}<Badge kind="ok">Done</Badge>{:else}<Badge kind="danger">Failed</Badge>{/if}
			</div>
			<div class="card-body-s" style="display:flex; flex-direction:column; gap: 14px;">
				<div class="kpi-grid">
					<div class="kpi"><div class="kpi-label">{job.dryRun ? 'Would create' : 'Created'}</div><div class="kpi-value">{job.created ?? 0}</div></div>
					<div class="kpi"><div class="kpi-label">{job.dryRun ? 'Would update' : 'Updated'}</div><div class="kpi-value">{job.updated ?? 0}</div></div>
					<div class="kpi"><div class="kpi-label">{job.dryRun ? 'Would delete' : 'Deleted'}</div><div class="kpi-value">{job.deleted ?? 0}</div></div>
					<div class="kpi"><div class="kpi-label">Errors</div><div class="kpi-value" style:color={job.errors?.length ? 'var(--danger)' : undefined}>{job.errors?.length ?? 0}</div></div>
				</div>
				{#if job.startedAt}
					<div class="muted" style="font-size: 12px;">Scope {job.scope}{job.scopeId ? ` · ${job.scopeId}` : ''} · started {formatDateTime(job.startedAt)}{job.finishedAt ? ` · finished ${formatDateTime(job.finishedAt)}` : ''}</div>
				{/if}
				{#if job.errors?.length}
					<div class="callout danger"><div class="callout-body">{#each job.errors as e}<div>{describe(e)}</div>{/each}</div></div>
				{/if}
				{#if job.status === 'DONE' && (job.changes?.length ?? 0) === 0}
					<div class="callout info"><div class="callout-body">{job.dryRun ? 'Nothing would change. Dues are up to date.' : 'No changes were needed.'}</div></div>
				{:else if job.changes?.length}
					<div class="tbl-wrap" style="max-height: 360px; overflow-y: auto;">
						<table class="tbl">
							<thead><tr><th>Change</th><th>Student</th><th>Session</th><th>Period from</th></tr></thead>
							<tbody>
								{#each job.changes as c}
									<tr>
										<td><Badge kind={c.action === 'CREATE' ? 'ok' : c.action === 'DELETE' ? 'danger' : 'info'}>{c.action}</Badge></td>
										<td><a href="/students/{c.studentId}/dues" style="color: var(--accent);">{c.studentId}</a></td>
										<td class="muted">{c.sessionId ?? '—'}</td>
										<td>{formatDate(c.periodStart)}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</div>
		</div>
	{/if}

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
</div>
