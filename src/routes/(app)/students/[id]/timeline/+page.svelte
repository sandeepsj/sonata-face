<script lang="ts">
	import { onMount } from 'svelte';
	import { currentStudentStore } from '$lib/stores/currentStudentStore';
	import { api, type Student, type StudentSession } from '$lib';
	import {
		Calendar,
		UserPlus,
		LogIn,
		LogOut,
		IndianRupee,
		ArrowRightLeft,
		Clock,
		AlertCircle
	} from 'lucide-svelte';
	import Badge from '$lib/components/Badge.svelte';

	export let student: Student;

	interface TimelineEvent {
		id: string;
		date: string;
		type: 'admission' | 'session-join' | 'session-disjoin' | 'payment' | 'payment-conversion';
		title: string;
		description: string;
		icon: any;
		nodeColor: string;
		nodeBg: string;
		data?: any;
	}

	let sessions: StudentSession[] = [];
	let loading = true;
	let error: string | null = null;

	$: currentStudent = student || $currentStudentStore.student;
	$: studentId = currentStudent?.admissionNo;
	$: payments = $currentStudentStore.payments.data;
	$: timelineEvents = buildTimelineEvents(currentStudent, sessions, payments);

	$: groupedByMonth = groupByMonth(timelineEvents);

	onMount(async () => {
		if (studentId) await loadTimelineData();
	});

	async function loadTimelineData() {
		if (!studentId) {
			error = 'Student ID not available';
			loading = false;
			return;
		}
		loading = true;
		error = null;
		try {
			const [sessionsData] = await Promise.all([
				api.sessions.list({ studentId }),
				currentStudentStore.fetchPayments(studentId, true),
			]);
			sessions = sessionsData;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load timeline data';
		} finally {
			loading = false;
		}
	}

	function buildTimelineEvents(
		student: Student | null,
		sessions: StudentSession[],
		payments: any[]
	): TimelineEvent[] {
		const events: TimelineEvent[] = [];
		if (!student) return events;

		if (student.admissionDate) {
			events.push({
				id: `admission-${student.admissionNo}`,
				date: student.admissionDate,
				type: 'admission',
				title: 'Student admitted',
				description: `${student.studentName} was admitted to the school`,
				icon: UserPlus,
				nodeColor: 'var(--ok)',
				nodeBg: 'var(--ok-soft)'
			});
		}

		sessions.forEach((session) => {
			events.push({
				id: `session-join-${session.id}`,
				date: session.dateOfJoining,
				type: 'session-join',
				title: `Joined ${session.course.name}`,
				description: `Started learning ${session.course.name}`,
				icon: LogIn,
				nodeColor: 'var(--accent)',
				nodeBg: 'var(--accent-soft)',
				data: session
			});
			if (session.dateOfDisjoining) {
				events.push({
					id: `session-disjoin-${session.id}`,
					date: session.dateOfDisjoining,
					type: 'session-disjoin',
					title: `Left ${session.course.name}`,
					description: `Completed or discontinued ${session.course.name}`,
					icon: LogOut,
					nodeColor: 'var(--warn)',
					nodeBg: 'var(--warn-soft)',
					data: session
				});
			}
		});

		payments.forEach((payment) => {
			{
				events.push({
					id: `payment-${payment.id}`,
					date: payment.date,
					type: 'payment',
					title: `Payment: ${payment.label || 'Fee payment'}${payment.isActive ? '' : ' (deactivated)'}`,
					description: `₹${payment.amountPaid.toLocaleString('en-IN')} paid for ${payment.courseName || 'fees'}`,
					icon: IndianRupee,
					nodeColor: payment.isActive ? 'var(--info)' : 'var(--fg-muted)',
					nodeBg: payment.isActive ? 'var(--info-soft)' : 'var(--surface-2)',
					data: payment
				});
				if (payment.convertedAt) {
					events.push({
						id: `payment-conversion-${payment.id}`,
						date: payment.convertedAt,
						type: 'payment-conversion',
						title: `Converted to course fee: ${payment.label || 'payment'}`,
						description: `By ${payment.convertedBy ?? 'unknown'} · now applied to ${payment.courseName}`,
						icon: ArrowRightLeft,
						nodeColor: 'var(--accent)',
						nodeBg: 'var(--accent-soft)',
						data: payment
					});
				}
			}
		});

		return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
	}

	function groupByMonth(events: TimelineEvent[]): { month: string; year: number; events: TimelineEvent[] }[] {
		const groups: Record<string, { month: string; year: number; events: TimelineEvent[] }> = {};
		for (const e of events) {
			const d = new Date(e.date);
			const key = `${d.getFullYear()}-${d.getMonth()}`;
			if (!groups[key]) {
				groups[key] = {
					month: d.toLocaleDateString('en-IN', { month: 'long' }),
					year: d.getFullYear(),
					events: []
				};
			}
			groups[key].events.push(e);
		}
		return Object.values(groups);
	}

	function getDay(d: string): string {
		try { return String(new Date(d).getDate()).padStart(2, '0'); } catch { return ''; }
	}
	function getMonAbbr(d: string): string {
		try { return new Date(d).toLocaleDateString('en-IN', { month: 'short' }).toUpperCase(); } catch { return ''; }
	}
	function formatTime(d: string): string {
		try { return new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; }
	}
</script>

<div class="section-row">
	<div>
		<h2 class="section-title-s">Timeline</h2>
		<div style="color: var(--fg-muted); font-size: 13px;">
			Chronological history of {currentStudent?.studentName || 'student'}'s journey.
		</div>
	</div>
</div>

{#if loading}
	<div style="display: flex; justify-content: center; padding: 60px 0; color: var(--fg-muted);"><span class="spinner spinner-lg"></span></div>
{:else if error}
	<div class="callout danger">
		<AlertCircle size={18} strokeWidth={1.6} />
		<div class="callout-body">{error}</div>
	</div>
{:else if timelineEvents.length === 0}
	<div class="card-s">
		<div class="card-body-s">
			<div class="empty-s">
				<div class="glyph">∅</div>
				<div style="font-family: var(--font-serif); font-size: 18px; color: var(--fg); margin-top: 6px;">No events yet</div>
				<div style="margin-top: 4px;">No events have been recorded for this student.</div>
			</div>
		</div>
	</div>
{:else}
	<div class="grid-2" style="grid-template-columns: 1fr 280px; gap: 18px; align-items: start;">
		<div class="card-s">
			<div class="tl">
				{#each groupedByMonth as group}
					<div class="tl-month">
						<span class="tl-month-tick"></span>
						<span>{group.month} {group.year}</span>
						<span class="tl-month-count">{group.events.length}</span>
					</div>
					{#each group.events as event (event.id)}
						<div class="tl-row">
							<div class="tl-date">
								<div class="tl-date-day">{getDay(event.date)}</div>
								<div class="tl-date-mon">{getMonAbbr(event.date)}</div>
							</div>
							<div class="tl-rail">
								<span class="tl-node" style="background: {event.nodeBg}; color: {event.nodeColor}; box-shadow: 0 0 0 3px var(--bg-elev);">
									<svelte:component this={event.icon} size={11} strokeWidth={1.8} />
								</span>
							</div>
							<div class="tl-card-s">
								<div class="tl-card-head">
									<span class="tl-pill" style="background: {event.nodeBg}; color: {event.nodeColor}; border-color: {event.nodeColor};">
										{#if event.type === 'admission'}Admission
										{:else if event.type === 'session-join'}Enrolled
										{:else if event.type === 'session-disjoin'}Completed
										{:else if event.type === 'payment'}{event.data?.paymentType === 'ADDITIONAL' ? 'Additional' : 'Payment'}
										{:else}Converted{/if}
									</span>
									<span class="tl-time">{formatTime(event.date)}</span>
								</div>
								<div class="tl-title-s">{event.title}</div>
								<div class="tl-sub-s">{event.description}</div>
							</div>
						</div>
					{/each}
				{/each}
			</div>
		</div>

		<div class="card-s" style="position: sticky; top: 80px;">
			<div class="card-header">
				<h3 class="card-title-s">At a <em style="color: var(--accent); font-style: italic;">glance</em></h3>
			</div>
			<div class="card-body-s">
				<div style="display: flex; flex-direction: column; gap: 12px;">
					<div>
						<div class="kpi-label">Courses enrolled</div>
						<div style="font-family: var(--font-serif); font-size: 24px;">{timelineEvents.filter((e) => e.type === 'session-join').length}</div>
					</div>
					<div class="divider-s" style="margin: 0;"></div>
					<div>
						<div class="kpi-label">Courses completed</div>
						<div style="font-family: var(--font-serif); font-size: 24px;">{timelineEvents.filter((e) => e.type === 'session-disjoin').length}</div>
					</div>
					<div class="divider-s" style="margin: 0;"></div>
					<div>
						<div class="kpi-label">Active payments</div>
						<div style="font-family: var(--font-serif); font-size: 24px;">{timelineEvents.filter((e) => e.type === 'payment' && e.data?.isActive).length}</div>
					</div>
					<div class="divider-s" style="margin: 0;"></div>
					<div>
						<div class="kpi-label">Conversions</div>
						<div style="font-family: var(--font-serif); font-size: 24px;">{timelineEvents.filter((e) => e.type === 'payment-conversion').length}</div>
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}
