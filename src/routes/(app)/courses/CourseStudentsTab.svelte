<script lang="ts">
	import { onMount } from 'svelte';
	import { Printer } from 'lucide-svelte';
	import { api, errorMessage } from '$lib';
	import type { Course, StudentSession } from '$lib/api/types';
	import { formatDate, isoDate } from '$lib/utils/format';
	import Badge from '$lib/components/Badge.svelte';
	import ErrorCallout from '$lib/components/ErrorCallout.svelte';
	import { features } from '$lib/config/features';

	// Listing sessions as of a date (`activeOn`) isn't on backend: list every session instead
	const byDate = features.missingEndpoints;

	let { course }: { course: Course } = $props();

	let activeOn = $state(isoDate());
	let sessions: StudentSession[] = $state([]);
	let loading = $state(true);
	let error = $state('');

	let ongoing = $derived(sessions.filter((s) => !s.dateOfDisjoining).length);

	async function load() {
		loading = true;
		error = '';
		try {
			const q = byDate ? { courseName: course.name, activeOn: activeOn || undefined } : { courseName: course.name };
			sessions = (await api.sessions.list(q)).sort((a, b) =>
				(a.student.studentName ?? '').localeCompare(b.student.studentName ?? '')
			);
		} catch (e) {
			error = errorMessage(e, 'Failed to load students');
			sessions = [];
		} finally {
			loading = false;
		}
	}

	onMount(load);

	function todayStr(): string {
		return formatDate(isoDate());
	}
</script>

<div class="course-card">
	<div class="course-card-head" style="display: flex; align-items: flex-end; justify-content: space-between; gap: 10px; flex-wrap: wrap;">
		<div>
			{#if byDate}
				<span class="course-card-title">Students enrolled on {formatDate(activeOn)}</span>
				<div class="muted" style="font-size: 12px; margin-top: 2px;">Sessions in {course.name} that cover the chosen date.</div>
			{:else}
				<span class="course-card-title">Students enrolled</span>
				<div class="muted" style="font-size: 12px; margin-top: 2px;">Every session in {course.name}, ongoing and ended.</div>
			{/if}
		</div>
		<div style="display:flex; gap: 8px; align-items: flex-end;">
			<div class="field" hidden={!byDate}><label for="active-on">Enrolled on</label><input id="active-on" type="date" class="input-s" bind:value={activeOn} onchange={load} /></div>
			<button class="btn-s btn-secondary-s btn-sm-s" onclick={() => window.print()} disabled={sessions.length === 0}>
				<Printer size={14} strokeWidth={1.6} /> Print
			</button>
		</div>
	</div>
	<ErrorCallout message={error} />
	{#if loading}
		<div style="display: flex; justify-content: center; padding: 30px 0;"><span class="spinner spinner-lg"></span></div>
	{:else if sessions.length === 0 && !error}
		<div class="callout info" style="margin: 14px;"><div class="callout-body">No students {byDate ? `were enrolled in ${course.name} on ${formatDate(activeOn)}` : `have been enrolled in ${course.name}`}.</div></div>
	{:else}
		<div class="tbl-wrap" style="border: 0; border-radius: 0;">
			<table class="tbl">
				<thead><tr><th>Admission #</th><th>Name</th><th>Joined</th><th>Left</th><th>Status</th></tr></thead>
				<tbody>
					{#each sessions as s (s.id)}
						<tr>
							<td><a href="/students/{s.student.admissionNo}" style="color: var(--accent); font-family: var(--font-mono); font-size: 12px;">{s.student.admissionNo}</a></td>
							<td><span class="strong">{s.student.studentName}</span></td>
							<td class="muted">{formatDate(s.dateOfJoining)}</td>
							<td class="muted">{s.dateOfDisjoining ? formatDate(s.dateOfDisjoining) : '—'}</td>
							<td>{#if !s.dateOfDisjoining}<Badge kind="ok">Ongoing</Badge>{:else}<Badge kind="neutral">Left</Badge>{/if}</td>
						</tr>
					{/each}
				</tbody>
			</table>
			<div style="padding: 10px 16px; font-size: 12px; color: var(--fg-muted); border-top: 1px solid var(--border);">
				Total: {sessions.length} student{sessions.length !== 1 ? 's' : ''} · {ongoing} still enrolled
			</div>
		</div>
	{/if}
</div>

{#if sessions.length > 0}
	<div class="course-print">
		<div class="print-header">
			<div>
				<div class="print-brand">Revathi <em>Arts</em> &amp; Music School</div>
				<div class="print-title">{course.name} · students roster</div>
				<div class="print-meta">{byDate ? `Enrolled on ${formatDate(activeOn)}` : 'All enrolments'} · {sessions.length} students · Generated {todayStr()}</div>
			</div>
		</div>
		<table class="print-tbl">
			<thead><tr><th style="width: 40px;">#</th><th>Admission #</th><th>Name</th><th>Joined</th><th>Left</th></tr></thead>
			<tbody>
				{#each sessions as s, i}
					<tr>
						<td>{i + 1}</td>
						<td>{s.student.admissionNo}</td>
						<td>{s.student.studentName}</td>
						<td>{formatDate(s.dateOfJoining)}</td>
						<td>{s.dateOfDisjoining ? formatDate(s.dateOfDisjoining) : '—'}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

<style>
	/* ---------- Print ---------- */
	.course-print { display: none; }

	@media print {
		:global(body) :global(*) { visibility: hidden !important; }
		.course-print, .course-print * { visibility: visible !important; }
		.course-print {
			display: block;
			position: absolute;
			inset: 0;
			padding: 18mm 14mm;
			background: white;
			color: #1a1a1a;
			font-family: var(--font-sans);
		}
		.print-header {
			display: flex;
			justify-content: space-between;
			align-items: flex-start;
			gap: 24px;
			border-bottom: 1px solid #d0d0d0;
			padding-bottom: 10px;
			margin-bottom: 16px;
		}
		.print-brand { font-family: var(--font-serif); font-size: 18px; }
		.print-brand em { font-style: italic; color: #444; }
		.print-title { font-family: var(--font-serif); font-size: 22px; font-weight: 500; margin-top: 4px; }
		.print-meta { font-size: 11px; color: #555; margin-top: 4px; }
		.print-tbl { width: 100%; border-collapse: collapse; font-size: 11px; }
		.print-tbl th, .print-tbl td {
			padding: 5px 7px;
			border-bottom: 1px solid #ececec;
			text-align: left;
			vertical-align: top;
		}
		.print-tbl th {
			text-transform: uppercase;
			letter-spacing: 0.06em;
			font-size: 9.5px;
			color: #555;
			font-weight: 500;
			background: #f6f6f6;
		}
		@page { margin: 12mm; }
	}
</style>
