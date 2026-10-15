<script lang="ts">
	import { page } from '$app/stores';
	import { api, canAccess, currentStudentStore, errorMessage, fieldErrors, toast } from '$lib';
	import type { Course, SessionCreateRequest, StudentSession } from '$lib/api/types';
	import { durationBetween, formatDate, fromDateTimeLocalInput, dateTimeLocalInput } from '$lib/utils/format';
	import ErrorCallout from '$lib/components/ErrorCallout.svelte';
	import FieldError from '$lib/components/FieldError.svelte';
	import {
		Calendar,
		BookOpen,
		Clock,
		AlertCircle,
		CheckCircle,
		Plus,
		X,
		AlertTriangle
	} from 'lucide-svelte';
	import Badge from '$lib/components/Badge.svelte';
	import { features } from '$lib/config/features';

	$: studentId = Number($page.params.id);
	$: storeState = $currentStudentStore;
	$: sessions = storeState.sessions.data;
	$: loading = storeState.sessions.loading;
	$: error = storeState.sessions.error;
	$: canWrite = $canAccess('/api/student-sessions/**', 'write');

	let courses: Course[] = [];

	let showEnrollmentModal = false;
	let enrollmentLoading = false;
	let selectedCourseName = '';
	let customJoinDate = '';
	let customDisjoinDate = '';
	let sessionType: 'active' | 'historical' = 'active';
	let enrollError = '';
	let enrollErrors: Record<string, string> = {};

	let sessionFilter: 'all' | 'active' | 'inactive' = 'all';

	let showConfirmModal = false;
	let sessionToEnd: StudentSession | null = null;
	let endingSession = false;
	let endMode: 'now' | 'past' = 'now';
	let endDate = '';
	let endError = '';

	function byJoinDesc(a: StudentSession, b: StudentSession) {
		return b.dateOfJoining.localeCompare(a.dateOfJoining);
	}
	$: activeSessions = sessions.filter((s) => !s.dateOfDisjoining).sort(byJoinDesc);
	$: inactiveSessions = sessions
		.filter((s) => !!s.dateOfDisjoining)
		.sort((a, b) => (b.dateOfDisjoining ?? '').localeCompare(a.dateOfDisjoining ?? ''));
	$: filteredActiveSessions = sessionFilter === 'inactive' ? [] : activeSessions;
	$: filteredInactiveSessions = sessionFilter === 'active' ? [] : inactiveSessions;
	$: enrolledCourseNames = activeSessions.map((s) => s.course.name);
	$: availableCourses = courses.filter((c) => !enrolledCourseNames.includes(c.name));

	async function loadStudentSessions() {
		await Promise.all([currentStudentStore.fetchSessions(studentId), loadCourses()]);
	}

	async function loadCourses() {
		try {
			courses = (await api.courses.list()).sort((a, b) => a.name.localeCompare(b.name));
		} catch (err) {
			courses = [];
		}
	}

	function handleDisjoinSession(sessionId: number) {
		const session = sessions.find((s) => s.id === sessionId);
		if (!session) return;
		sessionToEnd = session;
		endMode = 'now';
		endDate = dateTimeLocalInput();
		endError = '';
		showConfirmModal = true;
	}
	function cancelEndSession() {
		showConfirmModal = false;
		sessionToEnd = null;
		endingSession = false;
	}
	async function confirmEndSession() {
		if (!sessionToEnd) return;
		endError = '';
		if (endMode === 'past' && !endDate) {
			endError = 'Choose the date the student left';
			return;
		}
		try {
			endingSession = true;
			await api.sessions.disjoin(sessionToEnd.id, endMode === 'past' ? fromDateTimeLocalInput(endDate) : undefined);
			toast.ok(`${sessionToEnd.course.name} session ended.${features.legacyFeeModel ? ' Dues are being recalculated.' : ''}`);
			showConfirmModal = false;
			sessionToEnd = null;
			await currentStudentStore.refreshAfterWrite(studentId);
		} catch (err) {
			endError = errorMessage(err, 'Failed to end session');
		} finally {
			endingSession = false;
		}
	}

	function openEnrollmentModal() {
		showEnrollmentModal = true;
		selectedCourseName = '';
		customJoinDate = '';
		customDisjoinDate = '';
		sessionType = 'active';
		enrollError = '';
		enrollErrors = {};
	}
	function closeEnrollmentModal() {
		showEnrollmentModal = false;
	}

	$: if (studentId) loadStudentSessions();

	async function handleEnrollment() {
		if (!selectedCourseName) return;
		enrollError = '';
		enrollErrors = {};
		if (sessionType === 'historical') {
			if (!customJoinDate || !customDisjoinDate) {
				enrollError = 'Enter both the join and end dates';
				return;
			}
			if (customDisjoinDate <= customJoinDate) {
				enrollErrors = { dateOfDisjoining: 'The end date must be after the join date' };
				return;
			}
		}
		try {
			enrollmentLoading = true;
			const req: SessionCreateRequest = { studentId, courseName: selectedCourseName };
			if (customJoinDate) req.dateOfJoining = fromDateTimeLocalInput(customJoinDate);
			if (sessionType === 'historical' && customDisjoinDate)
				req.dateOfDisjoining = fromDateTimeLocalInput(customDisjoinDate);
			await api.sessions.create(req);
			toast.ok(`Enrolled in ${selectedCourseName}.${features.legacyFeeModel ? ' Dues are being calculated.' : ''}`);
			closeEnrollmentModal();
			await currentStudentStore.refreshAfterWrite(studentId);
		} catch (err) {
			enrollError = errorMessage(err, 'Failed to create session');
			enrollErrors = fieldErrors(err);
		} finally {
			enrollmentLoading = false;
		}
	}
</script>

<div class="section-row">
	<div>
		<h2 class="section-title-s">Course <em>sessions</em></h2>
		<div style="color: var(--fg-muted); font-size: 13px;">Active and completed enrolments.</div>
	</div>
	{#if canWrite}
		<div>
			<button class="btn-s btn-primary-s btn-sm-s" on:click={openEnrollmentModal} disabled={loading}>
				<Plus size={14} strokeWidth={1.8} /> Add session
			</button>
		</div>
	{/if}
</div>

{#if !loading && sessions.length > 0}
	<div class="card-s" style="margin-bottom: 18px;">
		<div class="card-body-s" style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
			<span class="kpi-label">Filter</span>
			<div class="seg">
				<button class:active={sessionFilter === 'all'} on:click={() => (sessionFilter = 'all')}>All ({sessions.length})</button>
				<button class:active={sessionFilter === 'active'} on:click={() => (sessionFilter = 'active')}>Active ({activeSessions.length})</button>
				<button class:active={sessionFilter === 'inactive'} on:click={() => (sessionFilter = 'inactive')}>Completed ({inactiveSessions.length})</button>
			</div>
		</div>
	</div>
{/if}

{#if loading}
	<div style="display: flex; justify-content: center; padding: 60px 0; color: var(--fg-muted);"><span class="spinner spinner-lg"></span></div>
{:else if error}
	<div class="callout danger">
		<AlertCircle size={18} strokeWidth={1.6} />
		<div class="callout-body">{error}</div>
	</div>
{:else}
	<div class="kpi-grid" style="margin-bottom: 18px;">
		<div class="kpi">
			<div class="kpi-label">Active</div>
			<div class="kpi-value" style="color: var(--ok);">{activeSessions.length}</div>
			<div class="kpi-meta"><span>Currently enrolled</span></div>
		</div>
		<div class="kpi">
			<div class="kpi-label">Completed</div>
			<div class="kpi-value">{inactiveSessions.length}</div>
			<div class="kpi-meta"><span>Previously enrolled</span></div>
		</div>
		<div class="kpi">
			<div class="kpi-label">Total</div>
			<div class="kpi-value" style="color: var(--accent);">{sessions.length}</div>
			<div class="kpi-meta"><span>All time</span></div>
		</div>
		<div class="kpi"></div>
	</div>

	{#if filteredActiveSessions.length > 0}
		<div class="card-s" style="margin-bottom: 18px;">
			<div class="card-header">
				<h3 class="card-title-s" style="display: flex; align-items: center; gap: 8px;">
					<CheckCircle size={16} strokeWidth={1.6} style="color: var(--ok);" />
					Active sessions ({filteredActiveSessions.length})
				</h3>
			</div>
			<div class="card-body-s tight">
				<table class="tbl">
					<thead>
						<tr><th>Course</th><th>Joined</th><th>Duration</th><th>Status</th><th style="text-align: right;">Actions</th></tr>
					</thead>
					<tbody>
						{#each filteredActiveSessions as session}
							<tr>
								<td><div class="strong">{session.course.name}</div></td>
								<td><div style="display: inline-flex; align-items: center; gap: 6px;"><Calendar size={12} strokeWidth={1.6} style="color: var(--fg-muted);" />{formatDate(session.dateOfJoining)}</div></td>
								<td><div style="display: inline-flex; align-items: center; gap: 6px;"><Clock size={12} strokeWidth={1.6} style="color: var(--fg-muted);" />{durationBetween(session.dateOfJoining, session.dateOfDisjoining)}</div></td>
								<td><Badge kind="ok" dot>Active</Badge></td>
								<td style="text-align: right;">
									{#if canWrite}<button class="btn-s btn-secondary-s btn-sm-s" style="color: var(--danger); border-color: var(--danger-soft);" on:click={() => handleDisjoinSession(session.id)}>End session</button>{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/if}

	{#if filteredInactiveSessions.length > 0}
		<div class="card-s" style="margin-bottom: 18px;">
			<div class="card-header">
				<h3 class="card-title-s" style="display: flex; align-items: center; gap: 8px;">
					<Clock size={16} strokeWidth={1.6} style="color: var(--fg-muted);" />
					Completed ({filteredInactiveSessions.length})
				</h3>
			</div>
			<div class="card-body-s tight">
				<table class="tbl">
					<thead>
						<tr><th>Course</th><th>Joined</th><th>Left</th><th>Duration</th><th>Status</th></tr>
					</thead>
					<tbody>
						{#each filteredInactiveSessions as session}
							<tr style="opacity: 0.85;">
								<td><div class="strong">{session.course.name}</div></td>
								<td>{formatDate(session.dateOfJoining)}</td>
								<td>{session.dateOfDisjoining ? formatDate(session.dateOfDisjoining) : '—'}</td>
								<td>{durationBetween(session.dateOfJoining, session.dateOfDisjoining)}</td>
								<td><Badge kind="neutral">Completed</Badge></td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/if}

	{#if sessions.length === 0}
		<div class="card-s">
			<div class="card-body-s">
				<div class="empty-s">
					<div class="glyph">∅</div>
					<div style="font-family: var(--font-serif); font-size: 18px; color: var(--fg); margin-top: 6px;">No sessions yet</div>
					<div style="margin-top: 4px;">This student hasn't been enrolled in any courses.</div>
					<div style="margin-top: 14px;" hidden={!canWrite}>
						<button class="btn-s btn-primary-s" on:click={openEnrollmentModal}>
							<Plus size={14} strokeWidth={1.8} /> Add first session
						</button>
					</div>
				</div>
			</div>
		</div>
	{/if}
{/if}

{#if showEnrollmentModal}
	<div class="modal-veil" on:click={closeEnrollmentModal} on:keydown={(e) => e.key === 'Escape' && closeEnrollmentModal()} role="presentation">
		<div class="modal-s modal-lg" role="dialog" aria-modal="true" on:click|stopPropagation on:keydown|stopPropagation>
			<div class="modal-head">
				<div>
					<h3 class="modal-title-s">Add <em style="color: var(--accent); font-style: italic;">session</em></h3>
					<div class="modal-sub">Enrol the student in a course or backfill historical session.</div>
				</div>
				<button class="btn-s btn-ghost-s btn-icon-s" on:click={closeEnrollmentModal} disabled={enrollmentLoading} aria-label="Close"><X size={16} strokeWidth={1.6} /></button>
			</div>
			<div class="modal-body-s">
				<div style="display: flex; flex-direction: column; gap: 14px;">
					<div class="field">
						<label>Session type</label>
						<div class="seg">
							<button class:active={sessionType === 'active'} on:click={() => (sessionType = 'active')} disabled={enrollmentLoading}>Active</button>
							<button class:active={sessionType === 'historical'} on:click={() => (sessionType = 'historical')} disabled={enrollmentLoading}>Historical</button>
						</div>
						<span class="hint">{sessionType === 'active' ? 'Create an ongoing enrolment.' : 'Backfill a completed past session.'}</span>
					</div>

					<div class="field">
						<label for="course-select">Course</label>
						<select id="course-select" class="select-s" bind:value={selectedCourseName} disabled={enrollmentLoading}>
							<option value="">Choose a course…</option>
							{#if sessionType === 'active'}
								{#each availableCourses as course}<option value={course.name}>{course.name}</option>{/each}
							{:else}
								{#each courses as course}<option value={course.name}>{course.name}</option>{/each}
							{/if}
						</select>
						{#if sessionType === 'active' && availableCourses.length === 0}
							<span class="field-error">Already enrolled in every active course, or there are no active courses.</span>
						{/if}
					</div>

					<div class="field">
						<label for="join-date">Join date {sessionType === 'historical' ? '(required)' : '(optional)'}</label>
						<input id="join-date" type="datetime-local" class="input-s" bind:value={customJoinDate} disabled={enrollmentLoading} required={sessionType === 'historical'} />
						<span class="hint">{sessionType === 'active' ? 'Leave empty to use current date.' : 'When did the student join?'}</span>
						<FieldError errors={enrollErrors} field="dateOfJoining" />
					</div>

					{#if sessionType === 'historical'}
						<div class="field">
							<label for="disjoin-date">End date (required)</label>
							<input id="disjoin-date" type="datetime-local" class="input-s" bind:value={customDisjoinDate} disabled={enrollmentLoading} required />
							<span class="hint">When did the student leave/complete?</span>
							<FieldError errors={enrollErrors} field="dateOfDisjoining" />
						</div>
					{/if}

					{#if features.legacyFeeModel}<span class="hint">Only active courses are listed. Dues are calculated from the course's fee timeline.</span>{/if}
					<ErrorCallout message={enrollError} />
				</div>
			</div>
			<div class="modal-foot">
				<button class="btn-s btn-secondary-s" on:click={closeEnrollmentModal} disabled={enrollmentLoading}><X size={14} strokeWidth={1.6} /> Cancel</button>
				<button class="btn-s btn-primary-s" on:click={handleEnrollment} disabled={enrollmentLoading || !selectedCourseName || (sessionType === 'active' && availableCourses.length === 0)}>
					{#if enrollmentLoading}<span class="spinner"></span>{:else if sessionType === 'active'}<CheckCircle size={14} strokeWidth={1.8} />{:else}<Calendar size={14} strokeWidth={1.8} />{/if}
					{sessionType === 'active' ? 'Enrol student' : 'Add historical session'}
				</button>
			</div>
		</div>
	</div>
{/if}

{#if showConfirmModal && sessionToEnd}
	<div class="modal-veil" on:click={cancelEndSession} on:keydown={(e) => e.key === 'Escape' && cancelEndSession()} role="presentation">
		<div class="modal-s" role="dialog" aria-modal="true" on:click|stopPropagation on:keydown|stopPropagation>
			<div class="modal-head">
				<div>
					<h3 class="modal-title-s">End <em style="color: var(--danger); font-style: italic;">session</em>?</h3>
					<div class="modal-sub">The student stops being billed for periods after the end date.</div>
				</div>
				<button class="btn-s btn-ghost-s btn-icon-s" on:click={cancelEndSession} disabled={endingSession} aria-label="Close"><X size={16} strokeWidth={1.6} /></button>
			</div>
			<div class="modal-body-s">
				<div class="card-s" style="background: var(--bg-elev); margin-bottom: 14px;">
					<div class="card-body-s">
						<div style="display: flex; flex-direction: column; gap: 8px; font-size: 13px;">
							<div style="display: flex; align-items: center; gap: 8px;"><BookOpen size={14} strokeWidth={1.6} style="color: var(--accent);" /><span class="strong">{sessionToEnd.course.name}</span></div>
							<div style="display: flex; align-items: center; gap: 8px;"><Calendar size={13} strokeWidth={1.6} style="color: var(--fg-muted);" /><span>Started: {formatDate(sessionToEnd.dateOfJoining)}</span></div>
							<div style="display: flex; align-items: center; gap: 8px;"><Clock size={13} strokeWidth={1.6} style="color: var(--fg-muted);" /><span>Duration: {durationBetween(sessionToEnd.dateOfJoining, null)}</span></div>
						</div>
					</div>
				</div>
				<!-- Ending on a past date isn't on backend `self-service` (disjoin takes no date) -->
				<div class="field" style="margin-bottom: 14px;" hidden={!features.legacyFeeModel}>
					<span class="kpi-label">Session ends</span>
					<div class="seg">
						<button class:active={endMode === 'now'} on:click={() => (endMode = 'now')} disabled={endingSession}>Now</button>
						<button class:active={endMode === 'past'} on:click={() => (endMode = 'past')} disabled={endingSession}>On a past date</button>
					</div>
					{#if endMode === 'past'}
						<input type="datetime-local" class="input-s" style="margin-top: 8px;" bind:value={endDate} max={dateTimeLocalInput()} disabled={endingSession} aria-label="End date" />
						<span class="hint">Can't be before the join date.</span>
					{/if}
				</div>
				<div style="margin-bottom: 14px;"><ErrorCallout message={endError} /></div>
				<div class="callout">
					<AlertTriangle size={16} strokeWidth={1.6} />
					<div>
						<div class="callout-title">Cannot be undone</div>
						<div class="callout-body">The student will be unenrolled. Historical data is preserved for reporting.</div>
					</div>
				</div>
			</div>
			<div class="modal-foot">
				<button class="btn-s btn-secondary-s" on:click={cancelEndSession} disabled={endingSession}>Cancel</button>
				<button class="btn-s btn-danger-s" on:click={confirmEndSession} disabled={endingSession}>
					{#if endingSession}<span class="spinner"></span>{:else}<AlertTriangle size={14} strokeWidth={1.8} />{/if}
					Yes, end session
				</button>
			</div>
		</div>
	</div>
{/if}
