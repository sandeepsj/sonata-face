<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { Users, Lock, LockOpen } from 'lucide-svelte';
	import { api, canAccess, errorMessage, toast } from '$lib';
	import type { Course, StudentSession } from '$lib/api/types';
	import { formatDate } from '$lib/utils/format';
	import Badge from '$lib/components/Badge.svelte';
	import ErrorCallout from '$lib/components/ErrorCallout.svelte';
	import CourseStudentsTab from './CourseStudentsTab.svelte';
	import { features } from '$lib/config/features';

	// Course status and close/reopen aren't on backend. Fee structures and the timeline are on the Fees page.
	const legacy = features.missingEndpoints;

	type StatusFilter = 'ACTIVE' | 'CLOSED' | 'ALL';

	let courses: Course[] = $state([]);
	let activeSessions: StudentSession[] = $state([]);
	let loading = $state(true);
	let error = $state('');
	let statusFilter = $state<StatusFilter>(legacy ? 'ACTIVE' : 'ALL');


	let busy = $state(false);

	let canWriteCourse = $derived($canAccess('/api/courses/**', 'write'));
	let canReadSessions = $derived($canAccess('/api/student-sessions/**'));

	let shown = $derived(statusFilter === 'ALL' ? courses : courses.filter((c) => c.status === statusFilter));
	let selectedName = $derived($page.url.searchParams.get('course'));
	let selected = $derived(courses.find((c) => c.name === selectedName) ?? shown[0] ?? null);

	let studentCounts = $derived.by(() => {
		const m = new Map<string, number>();
		for (const s of activeSessions) m.set(s.course.name, (m.get(s.course.name) ?? 0) + 1);
		return m;
	});
	let stats = $derived({
		active: courses.filter((c) => c.status === 'ACTIVE').length,
		closed: courses.filter((c) => c.status === 'CLOSED').length,
		students: new Set(activeSessions.map((s) => s.student.admissionNo)).size,
		enrolments: activeSessions.length
	});

	async function load() {
		loading = true;
		error = '';
		// Enrolment counts come from every ongoing session, which is slow to load: show the courses first
		if (canReadSessions) loadCounts();
		try {
			courses = (await api.courses.list()).sort((a, b) => a.name.localeCompare(b.name));
		} catch (e) {
			error = errorMessage(e, 'Failed to load courses');
		} finally {
			loading = false;
		}
	}

	let countsLoading = $state(false);
	async function loadCounts() {
		countsLoading = true;
		try {
			activeSessions = await api.sessions.list({ active: true });
		} catch {
			activeSessions = [];
		} finally {
			countsLoading = false;
		}
	}

	/** An enrolment count, or '…' while the sessions are still loading */
	function countOf(course: string): string | number {
		return countsLoading ? '…' : (studentCounts.get(course) ?? 0);
	}

	onMount(load);


	function select(name: string) {
		const url = new URL($page.url);
		url.searchParams.set('course', name);
		goto(url, { replaceState: true, noScroll: true, keepFocus: true });
	}

	async function toggleClosed(c: Course) {
		const closing = c.status === 'ACTIVE';
		const msg = closing
			? `Close ${c.name}? It will take no new enrolments, timeline entries or course-fee payments. Existing sessions, payments and dues stay as they are.`
			: `Reopen ${c.name}?`;
		if (!confirm(msg)) return;
		busy = true;
		try {
			const updated = closing ? await api.courses.close(c.name) : await api.courses.reopen(c.name);
			courses = courses.map((x) => (x.name === updated.name ? updated : x));
			toast.ok(`${updated.name} ${closing ? 'closed' : 'reopened'}`);
		} catch (err) {
			toast.error(errorMessage(err));
			await load();
		} finally {
			busy = false;
		}
	}

	function initials(name: string): string {
		return name
			.split(/\s+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((w) => w[0]?.toUpperCase() ?? '')
			.join('');
	}
</script>

<svelte:head>
	<title>Courses — Revathi Arts</title>
</svelte:head>

<div class="page">
	<div class="page-head">
		<div class="page-head-row">
			<div>
				<h1 class="page-title">Courses &amp; <em>students</em></h1>
				<p class="page-subtitle">Courses and who is enrolled in them. New courses and their fees are added on the Fees page.</p>
			</div>
			{#if legacy}
				<div class="seg" role="radiogroup" aria-label="Course status">
					{#each [['ACTIVE', 'Active'], ['CLOSED', 'Closed'], ['ALL', 'All']] as [v, label]}
						<button class:active={statusFilter === v} role="radio" aria-checked={statusFilter === v} onclick={() => (statusFilter = v as StatusFilter)}>{label}</button>
					{/each}
				</div>
			{/if}
		</div>
	</div>

	<div class="course-stats" class:no-status={!legacy}>
		{#if legacy}
			<div class="stat-card">
				<div class="stat-value">{stats.active}</div>
				<div class="stat-meta muted">active courses</div>
			</div>
			<div class="stat-card">
				<div class="stat-value">{stats.closed}</div>
				<div class="stat-meta muted">closed courses</div>
			</div>
		{:else}
			<div class="stat-card">
				<div class="stat-value">{courses.length}</div>
				<div class="stat-meta muted">courses</div>
			</div>
		{/if}
		<div class="stat-card">
			<div class="stat-value">{canReadSessions ? (countsLoading ? '…' : stats.students) : '—'}</div>
			<div class="stat-meta muted">students enrolled now</div>
		</div>
		<div class="stat-card">
			<div class="stat-value">{canReadSessions ? (countsLoading ? '…' : stats.enrolments) : '—'}</div>
			<div class="stat-meta muted">ongoing enrolments</div>
		</div>
	</div>

	<ErrorCallout message={error} />

	{#if loading}
		<div style="display: flex; justify-content: center; padding: 60px 0;"><span class="spinner spinner-lg"></span></div>
	{:else}
		<div class="course-split">
			<aside class="course-list-card">
				<div class="course-list-head">
					<span class="course-list-title">{statusFilter === 'ALL' ? 'All' : statusFilter === 'ACTIVE' ? 'Active' : 'Closed'} courses</span>
					<span class="course-list-count">{shown.length}</span>
				</div>
				<div class="course-list-body">
					{#each shown as c (c.name)}
						<button type="button" class="course-row" class:is-sel={selected?.name === c.name} class:is-closed={c.status === 'CLOSED'} onclick={() => select(c.name)}>
							<span class="course-avatar">{initials(c.name)}</span>
							<span class="course-row-body">
								<span class="course-row-name">{c.name}</span>
								<span class="course-row-meta">
									{#if c.status === 'CLOSED'}
										<Lock size={11} strokeWidth={1.6} /> closed {formatDate(c.closedAt)}
									{:else}
										<Users size={11} strokeWidth={1.6} /> {countOf(c.name)} enrolled
									{/if}
								</span>
							</span>
						</button>
					{:else}
						<div class="muted" style="padding: 18px; text-align: center; font-size: 13px;">No {statusFilter === 'ALL' ? '' : statusFilter.toLowerCase()} courses.</div>
					{/each}
				</div>
			</aside>

			<section class="course-detail">
				{#if selected}
					<header class="course-detail-head">
						<div style="display: flex; gap: 14px; align-items: flex-start; flex: 1; min-width: 0;">
							<span class="course-avatar course-avatar-lg">{initials(selected.name)}</span>
							<div style="min-width: 0; flex: 1;">
								<div style="display:flex; align-items:center; gap:10px; flex-wrap: wrap;">
									<h2 class="course-detail-name">{selected.name}</h2>
									{#if legacy}
										{#if selected.status === 'ACTIVE'}<Badge kind="ok" dot>Active</Badge>{:else}<Badge kind="neutral">Closed</Badge>{/if}
									{/if}
								</div>
								<p class="course-detail-sub">
									{#if selected.status === 'CLOSED'}
										Closed on {formatDate(selected.closedAt)}. No new enrolments, timeline entries or course-fee payments.
									{:else}
										{countOf(selected.name)} students enrolled now
									{/if}
								</p>
								{#if canWriteCourse && legacy}
									<div style="display: flex; gap: 8px; margin-top: 12px;">
										<button class="btn-s btn-secondary-s btn-sm-s" onclick={() => toggleClosed(selected!)} disabled={busy}>
											{#if selected.status === 'ACTIVE'}<Lock size={12} strokeWidth={1.6} /> Close course{:else}<LockOpen size={12} strokeWidth={1.6} /> Reopen course{/if}
										</button>
									</div>
								{/if}
							</div>
						</div>
					</header>

					<div class="course-tabs">
						{#if canReadSessions}
							<button class="is-active">
								Students <span class="tab-badge">{countOf(selected.name)}</span>
							</button>
						{/if}
					</div>

					{#key selected.name}
						{#if canReadSessions}
							<CourseStudentsTab course={selected} />
						{/if}
					{/key}
				{:else}
					<div class="callout info"><div class="callout-body">{courses.length === 0 ? 'No courses yet. Add one on the Fees page, in a fee structure.' : 'Select a course to view details.'}</div></div>
				{/if}
			</section>
		</div>
	{/if}
</div>

<style>
	.course-stats {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 12px;
		margin-bottom: 18px;
	}
	.course-stats.no-status {
		grid-template-columns: repeat(3, 1fr);
	}
	@media (max-width: 1100px) {
		.course-stats,
		.course-stats.no-status { grid-template-columns: repeat(2, 1fr); }
	}
	.stat-card {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 12px;
		padding: 16px 18px;
		min-height: 88px;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
	}
	.stat-value {
		font-family: var(--font-serif);
		font-size: 28px;
		font-weight: 500;
		letter-spacing: -0.02em;
		color: var(--fg);
		line-height: 1.1;
	}
	.stat-meta {
		font-size: 12px;
		color: var(--fg-soft);
		margin-top: 8px;
		display: flex;
		align-items: center;
	}

	.course-split {
		display: grid;
		grid-template-columns: 320px 1fr;
		gap: 16px;
		align-items: start;
	}
	@media (max-width: 980px) {
		.course-split { grid-template-columns: 1fr; }
	}

	.course-list-card {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 12px;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}
	.course-list-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 14px;
		border-bottom: 1px solid var(--border);
	}
	.course-list-title {
		font-size: 11px;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--fg-muted);
		font-weight: 600;
	}
	.course-list-count {
		font-size: 12px;
		font-weight: 600;
		color: var(--fg-soft);
		background: var(--surface-2);
		border-radius: 999px;
		padding: 2px 8px;
		min-width: 24px;
		text-align: center;
	}
	.course-list-body {
		padding: 6px;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.course-row {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px;
		background: transparent;
		border: 0;
		border-radius: 8px;
		cursor: pointer;
		text-align: left;
		font: inherit;
		color: inherit;
		transition: background 120ms ease;
	}
	.course-row:hover { background: var(--hover); }
	.course-row.is-sel { background: var(--accent-soft); }
	.course-row.is-sel .course-row-name { color: var(--accent-deep); }
	.course-row-body {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
		flex: 1;
	}
	.course-row-name {
		font-size: 13px;
		font-weight: 500;
		color: var(--fg);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.course-row-meta {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 11px;
		color: var(--fg-muted);
	}
	.course-avatar {
		width: 32px;
		height: 32px;
		border-radius: 8px;
		background: var(--accent-soft);
		color: var(--accent-deep);
		display: grid;
		place-items: center;
		font-family: var(--font-serif);
		font-style: italic;
		font-weight: 600;
		font-size: 13px;
		flex-shrink: 0;
	}
	.course-avatar-lg {
		width: 56px;
		height: 56px;
		border-radius: 12px;
		font-size: 22px;
	}

	.course-detail {
		display: flex;
		flex-direction: column;
		gap: 14px;
		min-width: 0;
	}
	.course-detail-head {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 12px;
		padding: 18px 20px;
		display: flex;
		gap: 18px;
		flex-wrap: wrap;
		align-items: flex-start;
	}
	.course-detail-name {
		font-family: var(--font-serif);
		font-size: 24px;
		font-weight: 500;
		letter-spacing: -0.01em;
		margin: 0;
	}
	.course-detail-sub {
		margin: 4px 0 0;
		font-size: 13px;
		color: var(--fg-muted);
	}

	.course-tabs {
		display: flex;
		gap: 6px;
		border-bottom: 1px solid var(--border);
		padding: 0 4px;
	}
	.course-tabs button {
		background: transparent;
		border: 0;
		padding: 10px 14px;
		font: inherit;
		font-size: 13px;
		color: var(--fg-soft);
		cursor: pointer;
		border-bottom: 2px solid transparent;
		margin-bottom: -1px;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		transition: color 120ms ease, border-color 120ms ease;
	}
	.course-tabs button:hover { color: var(--fg); }
	.course-tabs button.is-active {
		color: var(--accent-deep);
		border-bottom-color: var(--accent);
		font-weight: 500;
	}
	.tab-badge {
		font-size: 11px;
		background: var(--surface-2);
		color: var(--fg-soft);
		padding: 1px 6px;
		border-radius: 999px;
	}

	.course-row.is-closed .course-row-name { color: var(--fg-muted); }
</style>
