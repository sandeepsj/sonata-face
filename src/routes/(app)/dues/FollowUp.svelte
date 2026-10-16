<script lang="ts">
	// Ongoing sessions sorted by how many terms are unpaid, to find students who stopped coming but whose session
	// was never ended (the backend keeps billing every new term until it is).
	import { onMount } from 'svelte';
	import { Download, UserX } from 'lucide-svelte';
	import { api, canAccess, errorMessage, toast } from '$lib';
	import type { Course, Due, StudentSession } from '$lib/api/types';
	import { formatDate, formatPeriod, isoDate, parseLocal } from '$lib/utils/format';
	import Money from '$lib/components/Money.svelte';
	import Badge from '$lib/components/Badge.svelte';
	import Select from '$lib/components/Select.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import ErrorCallout from '$lib/components/ErrorCallout.svelte';

	type Row = {
		session: StudentSession;
		studentId: number;
		studentName: string;
		courseName: string;
		/** unpaid terms, oldest first */
		dues: Due[];
		owed: number;
	};

	let canReadSessions = $derived($canAccess('/api/student-sessions/**'));
	let canEnd = $derived($canAccess('/api/student-sessions/**', 'write'));
	let canCloseStudent = $derived($canAccess('/api/students/**', 'write'));

	let sessions: StudentSession[] = $state([]);
	let openDues: Due[] = $state([]);
	let courses: Course[] = $state([]);
	let loading = $state(true);
	let error = $state('');

	let courseName = $state('');
	let minUnpaid = $state(1);
	let search = $state('');

	async function load() {
		loading = true;
		error = '';
		try {
			const [s, due, partial] = await Promise.all([
				api.sessions.list({ active: true }),
				api.dues.list({ status: 'DUE' }),
				api.dues.list({ status: 'PARTIALLY_PAID' })
			]);
			sessions = s;
			openDues = [...due, ...partial];
		} catch (e) {
			error = errorMessage(e, 'Failed to load sessions and dues');
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		api.courses.list().then((c) => (courses = c.sort((a, b) => a.name.localeCompare(b.name)))).catch(() => {});
		if (canReadSessions) load();
		else loading = false;
	});

	/** One row per ongoing (student, course) session, with its unpaid terms */
	let rows = $derived.by<Row[]>(() => {
		const byKey = new Map<string, Due[]>();
		for (const d of openDues) {
			const k = `${d.studentId}|${d.courseName}`;
			byKey.set(k, [...(byKey.get(k) ?? []), d]);
		}
		const latest = new Map<string, StudentSession>();
		for (const s of sessions) {
			const k = `${s.student.admissionNo}|${s.course.name}`;
			const prev = latest.get(k);
			if (!prev || s.dateOfJoining > prev.dateOfJoining) latest.set(k, s);
		}
		return [...latest.entries()].map(([k, s]) => {
			const dues = (byKey.get(k) ?? []).sort((a, b) => a.periodStart.localeCompare(b.periodStart));
			return {
				session: s,
				studentId: s.student.admissionNo,
				studentName: s.student.studentName,
				courseName: s.course.name,
				dues,
				owed: dues.reduce((sum, d) => sum + d.balance, 0)
			};
		});
	});

	let shown = $derived.by(() => {
		const q = search.trim().toLowerCase();
		return rows
			.filter((r) => r.dues.length >= minUnpaid)
			.filter((r) => !courseName || r.courseName === courseName)
			.filter((r) => !q || r.studentName.toLowerCase().includes(q) || String(r.studentId).includes(q))
			.sort((a, b) => b.dues.length - a.dues.length || b.owed - a.owed || a.studentName.localeCompare(b.studentName));
	});
	let totalTerms = $derived(shown.reduce((s, r) => s + r.dues.length, 0));
	let totalOwed = $derived(shown.reduce((s, r) => s + r.owed, 0));
	/** Ongoing sessions per student, to know whether ending one closes their admission */
	let ongoingCount = $derived.by(() => {
		const m = new Map<number, number>();
		for (const r of rows) m.set(r.studentId, (m.get(r.studentId) ?? 0) + 1);
		return m;
	});

	// ---- end a session ----
	let ending: Row | null = $state(null);
	let leftOn = $state('');
	let closeStudent = $state(false);
	let saving = $state(false);
	let endError = $state('');
	let today = isoDate();

	function dayBefore(d: string): string {
		const x = parseLocal(d)!;
		x.setDate(x.getDate() - 1);
		return isoDate(x);
	}

	function openEnd(r: Row) {
		ending = r;
		const joined = r.session.dateOfJoining.slice(0, 10);
		// end of the last term they paid for = the day before the oldest unpaid term starts (not before joining)
		const guess = r.dues[0] ? dayBefore(r.dues[0].periodStart) : today;
		leftOn = guess < joined ? joined : guess > today ? today : guess;
		closeStudent = canCloseStudent && (ongoingCount.get(r.studentId) ?? 0) <= 1;
		endError = '';
	}

	/** Terms that start after the leaving date are removed; the term containing it stays */
	let preview = $derived.by(() => {
		if (!ending || !leftOn) return { removed: [] as Due[], kept: [] as Due[] };
		return {
			removed: ending.dues.filter((d) => d.periodStart > leftOn),
			kept: ending.dues.filter((d) => d.periodStart <= leftOn)
		};
	});

	async function confirmEnd() {
		if (!ending) return;
		endError = '';
		const joined = ending.session.dateOfJoining.slice(0, 10);
		if (!leftOn) {
			endError = 'Choose the date the student left';
			return;
		}
		if (leftOn > today || leftOn < joined) {
			endError = `Choose a date between ${formatDate(joined)} and today`;
			return;
		}
		saving = true;
		const r = ending;
		const removed = preview.removed.length;
		try {
			await api.sessions.disjoin(r.session.id, leftOn);
			if (closeStudent) await api.students.update(r.studentId, { status: 'closed' });
			toast.ok(
				`${r.studentName}: ${r.courseName} ended on ${formatDate(leftOn)}. ${removed} term${removed === 1 ? '' : 's'} removed${closeStudent ? ', admission closed' : ''}.`
			);
			ending = null;
			await load();
		} catch (e) {
			endError = errorMessage(e, 'Failed to end the session');
		} finally {
			saving = false;
		}
	}

	function downloadCSV() {
		const headers = ['Student', 'Admission #', 'Course', 'Joined', 'Unpaid terms', 'Owed', 'Oldest unpaid term'];
		const lines = shown.map((r) => [
			r.studentName,
			r.studentId,
			r.courseName,
			r.session.dateOfJoining.slice(0, 10),
			r.dues.length,
			r.owed,
			r.dues[0] ? formatPeriod(r.dues[0].periodStart, r.dues[0].periodEnd) : ''
		]);
		const csv = [headers, ...lines]
			.map((l) => l.map((c) => (/[",\n]/.test(String(c)) ? `"${String(c).replace(/"/g, '""')}"` : String(c))).join(','))
			.join('\n');
		const link = document.createElement('a');
		link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
		link.download = `students-to-follow-up-${today}.csv`;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	}
</script>

{#if !canReadSessions}
	<div class="callout info"><div class="callout-body">This view needs read access to sessions (enrolment).</div></div>
{:else}
	<div class="kpi-grid" style="margin-bottom: 18px;">
		<div class="kpi">
			<div class="kpi-label">Students to follow up</div>
			<div class="kpi-value" style="color: var(--accent);">{shown.length}</div>
			<div class="kpi-meta"><span>ongoing sessions with {minUnpaid}+ unpaid term{minUnpaid === 1 ? '' : 's'}</span></div>
		</div>
		<div class="kpi">
			<div class="kpi-label">Unpaid terms</div>
			<div class="kpi-value">{totalTerms}</div>
			<div class="kpi-meta"><span>across these sessions</span></div>
		</div>
		<div class="kpi">
			<div class="kpi-label">Owed</div>
			<div class="kpi-value" style="color: var(--danger);"><Money value={totalOwed} mono={false} /></div>
			<div class="kpi-meta"><span>if they are still enrolled</span></div>
		</div>
	</div>

	<div class="card-s" style="margin-bottom: 18px;">
		<div class="card-body-s">
			<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; align-items: end;">
				<div class="field">
					<span class="field-label">Course</span>
					<Select
						bind:value={courseName}
						options={[{ value: '', label: 'All courses' }, ...courses.map((c) => ({ value: c.name, label: c.name }))]}
						ariaLabel="Course"
					/>
				</div>
				<div class="field">
					<span class="field-label">Unpaid terms</span>
					<Select bind:value={minUnpaid} options={[1, 2, 3, 4, 6].map((n) => ({ value: n, label: `${n} or more` }))} ariaLabel="Minimum unpaid terms" />
				</div>
				<div class="field">
					<label for="fu-search">Student</label>
					<input id="fu-search" class="input-s" placeholder="Name or admission #" bind:value={search} />
				</div>
				<div style="display: flex; justify-content: flex-end;">
					<button class="btn-s btn-secondary-s" onclick={downloadCSV} disabled={shown.length === 0}><Download size={14} strokeWidth={1.6} /> Export CSV</button>
				</div>
			</div>
			<div class="muted" style="font-size: 12px; margin-top: 10px;">
				Ongoing sessions only, most unpaid terms first. A student who stopped coming keeps being billed for every new term
				until their session is ended.
			</div>
		</div>
	</div>

	<ErrorCallout message={error} />

	{#if loading}
		<div style="display: flex; justify-content: center; padding: 60px 0;"><span class="spinner spinner-lg"></span></div>
	{:else if shown.length === 0 && !error}
		<div class="callout info"><div class="callout-body">No ongoing sessions with {minUnpaid} or more unpaid terms.</div></div>
	{:else}
		<div class="tbl-wrap">
			<table class="tbl">
				<thead>
					<tr>
						<th>Student</th>
						<th>Course</th>
						<th>Joined</th>
						<th class="num">Unpaid terms</th>
						<th class="num">Owed</th>
						<th>Oldest unpaid</th>
						{#if canEnd}<th></th>{/if}
					</tr>
				</thead>
				<tbody>
					{#each shown as r (r.session.id)}
						<tr>
							<td>
								<a href="/students/{r.studentId}/dues" class="strong" style="color: var(--fg);">{r.studentName}</a>
								<div class="muted" style="font-family: var(--font-mono); font-size: 11px;">#{r.studentId}</div>
							</td>
							<td>{r.courseName}</td>
							<td class="muted" style="white-space: nowrap;">{formatDate(r.session.dateOfJoining)}</td>
							<td class="num"><Badge kind={r.dues.length >= 3 ? 'danger' : r.dues.length === 2 ? 'warn' : 'neutral'}>{r.dues.length}</Badge></td>
							<td class="num"><Money value={r.owed} danger={r.owed > 0} /></td>
							<td style="white-space: nowrap;">{r.dues[0] ? formatPeriod(r.dues[0].periodStart, r.dues[0].periodEnd) : '—'}</td>
							{#if canEnd}
								<td style="text-align: right; white-space: nowrap;">
									<button class="btn-s btn-secondary-s btn-sm-s" onclick={() => openEnd(r)} title="The student stopped coming: end this session">
										<UserX size={12} strokeWidth={1.8} /> End session
									</button>
								</td>
							{/if}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
{/if}

<Modal
	open={ending !== null}
	title="End session"
	subtitle={ending ? `${ending.studentName} (#${ending.studentId}) · ${ending.courseName} · joined ${formatDate(ending.session.dateOfJoining)}` : ''}
	busy={saving}
	onClose={() => (ending = null)}
>
	{#if ending}
		<div style="display: flex; flex-direction: column; gap: 14px;">
			<div class="field">
				<label for="fu-left">Left on *</label>
				<input id="fu-left" type="date" class="input-s" bind:value={leftOn} min={ending.session.dateOfJoining.slice(0, 10)} max={today} disabled={saving} />
				<span class="hint">
					Defaults to the end of the last term they paid for. Terms starting after this date are removed from their dues; the
					term containing it stays.
				</span>
			</div>
			{#if leftOn}
				<div class="card-s" style="background: var(--bg-elev);">
					<div class="card-body-s" style="font-size: 13px; display: flex; flex-direction: column; gap: 4px;">
						<div>
							Removes <span class="strong">{preview.removed.length}</span> unpaid term{preview.removed.length === 1 ? '' : 's'}
							(<Money value={preview.removed.reduce((s, d) => s + d.balance, 0)} mono={false} />){#if preview.removed[0]}: {formatPeriod(preview.removed[0].periodStart, preview.removed[0].periodEnd)}{preview.removed.length > 1 ? ` → ${formatPeriod(preview.removed[preview.removed.length - 1].periodStart, preview.removed[preview.removed.length - 1].periodEnd)}` : ''}{/if}
						</div>
						<div class="muted">
							{preview.kept.length} unpaid term{preview.kept.length === 1 ? ' stays' : 's stay'} owed (<Money value={preview.kept.reduce((s, d) => s + d.balance, 0)} mono={false} />)
						</div>
					</div>
				</div>
			{/if}
			{#if canCloseStudent}
				<label style="display: flex; align-items: flex-start; gap: 8px; font-size: 13px;">
					<input type="checkbox" bind:checked={closeStudent} disabled={saving} style="margin-top: 3px;" />
					<span>
						Also mark {ending.studentName}'s admission closed
						{#if (ongoingCount.get(ending.studentId) ?? 0) > 1}<span class="muted">(they have other ongoing sessions)</span>{/if}
					</span>
				</label>
			{/if}
			<ErrorCallout message={endError} />
		</div>
	{/if}
	{#snippet footer()}
		<button class="btn-s btn-secondary-s" onclick={() => (ending = null)} disabled={saving}>Cancel</button>
		<button class="btn-s btn-danger-s" onclick={confirmEnd} disabled={saving || !leftOn}>
			{#if saving}<span class="spinner"></span>{/if}End session
		</button>
	{/snippet}
</Modal>
