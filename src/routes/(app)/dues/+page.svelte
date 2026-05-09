<script lang="ts">
	import { onMount } from 'svelte';
	import { DuesAggregateService, FeeDuesService } from '$lib';
	import type {
		CourseAggregate,
		YearAggregate,
		TermAggregate,
		AggregateGroupBy,
		FeeDuesTrackerDTO
	} from '$lib';
	import {
		Filter,
		Download,
		Users,
		Book,
		Calendar,
		Hash,
		AlertCircle,
		Printer
	} from 'lucide-svelte';
	import { tick } from 'svelte';
	import Badge from '$lib/components/Badge.svelte';
	import Money from '$lib/components/Money.svelte';
	import Select from '$lib/components/Select.svelte';

	type DuesGroup = {
		key: string;
		label: string;
		sub?: string;
		count: number;
		totalDue: number;
		params: { course?: string; year?: number; termNumber?: number };
	};

	let groupBy = $state<AggregateGroupBy>('course');
	let selectedStatuses = $state('DUE,PARTIALLY_PAID');
	let selectedYear = $state<number | null>(null);
	let selectedTermNumber = $state<number | null>(null);
	let selectedCourse = $state<string | null>(null);

	let courseAggregates = $state<CourseAggregate[]>([]);
	let yearAggregates = $state<YearAggregate[]>([]);
	let termAggregates = $state<TermAggregate[]>([]);

	let selectedKey = $state<string | null>(null);
	let detailsData = $state<Map<string, FeeDuesTrackerDTO[]>>(new Map());
	let loadingDetails = $state(false);

	let loading = $state(false);
	let error = $state<string | null>(null);

	let availableYears = $state<number[]>([]);
	let availableCourses = $state<string[]>([]);

	// Print state — when truthy, the print block renders these groups instead of the on-screen detail.
	let printGroups = $state<DuesGroup[] | null>(null);
	let printing = $state(false);

	onMount(() => {
		loadAggregates();
		loadFilterOptions();
	});

	async function loadFilterOptions() {
		try {
			const years = await DuesAggregateService.getAggregateByYear({ statuses: selectedStatuses });
			const courses = await DuesAggregateService.getAggregateByCourse({ statuses: selectedStatuses });
			availableYears = years.map((y) => y.year).sort((a, b) => b - a);
			availableCourses = courses.map((c) => c.course).sort();
		} catch (err) {
			console.error('Error loading filter options:', err);
		}
	}

	async function loadAggregates() {
		loading = true;
		error = null;
		try {
			const params = {
				statuses: selectedStatuses,
				year: selectedYear || undefined,
				termNumber: selectedTermNumber || undefined,
				course: selectedCourse || undefined
			};
			if (groupBy === 'course') courseAggregates = await DuesAggregateService.getAggregateByCourse(params);
			else if (groupBy === 'year') yearAggregates = await DuesAggregateService.getAggregateByYear(params);
			else if (groupBy === 'term') termAggregates = await DuesAggregateService.getAggregateByTerm(params);
			detailsData.clear();
			detailsData = new Map();
			// Auto-select first group after load
			const first = groups[0];
			selectedKey = first?.key ?? null;
			if (first) loadDetails(first);
		} catch (err) {
			error = 'Failed to load aggregates. Please try again.';
		} finally {
			loading = false;
		}
	}

	async function loadDetails(g: DuesGroup) {
		if (detailsData.has(g.key)) return;
		loadingDetails = true;
		try {
			const filterParams = { statuses: selectedStatuses, ...g.params };
			const details = await FeeDuesService.getDuesWithFilters(filterParams);
			detailsData.set(g.key, details);
			detailsData = new Map(detailsData);
		} catch (err) {
			error = 'Failed to load details. Please try again.';
		} finally {
			loadingDetails = false;
		}
	}

	function selectGroup(g: DuesGroup) {
		selectedKey = g.key;
		loadDetails(g);
	}

	function clearFilters() {
		selectedYear = null;
		selectedTermNumber = null;
		selectedCourse = null;
		loadAggregates();
	}

	async function printOne() {
		if (!selectedGroup) return;
		printing = true;
		try {
			await loadDetails(selectedGroup);
			printGroups = [selectedGroup];
			await tick();
			window.print();
		} finally {
			printGroups = null;
			printing = false;
		}
	}

	async function printAll() {
		printing = true;
		try {
			await Promise.all(groups.map((g) => loadDetails(g)));
			printGroups = groups;
			await tick();
			window.print();
		} finally {
			printGroups = null;
			printing = false;
		}
	}

	function statusLabel(s: string): string {
		if (s === 'PAID') return 'Paid';
		if (s === 'PARTIALLY_PAID') return 'Partial';
		if (s === 'STUDENT_LEFT_DUE_CANCELLED') return 'Cancelled';
		if (s === 'DUE') return 'Due';
		return s;
	}

	function todayStr(): string {
		return new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
	}

	function statusFilterLabel(s: string): string {
		if (s === 'DUE,PARTIALLY_PAID') return 'Pending (Due + Partial)';
		if (s === '') return 'All statuses';
		return s
			.split(',')
			.map(statusLabel)
			.join(', ');
	}

	function downloadCSV() {
		let headers: string[] = [];
		let rows: any[][] = [];
		if (groupBy === 'course') {
			headers = ['Course', 'Count', 'Total Due'];
			rows = courseAggregates.map((a) => [a.course, a.count, a.totalDue]);
		} else if (groupBy === 'year') {
			headers = ['Year', 'Count', 'Total Due'];
			rows = yearAggregates.map((a) => [a.year, a.count, a.totalDue]);
		} else if (groupBy === 'term') {
			headers = ['Year', 'Term', 'Count', 'Total Due'];
			rows = termAggregates.map((a) => [a.year, a.termNumber, a.count, a.totalDue]);
		}
		const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
		const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
		const link = document.createElement('a');
		link.href = URL.createObjectURL(blob);
		link.download = `dues-aggregate-${groupBy}-${new Date().toISOString().split('T')[0]}.csv`;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	}

	let groups = $derived<DuesGroup[]>(
		groupBy === 'course'
			? courseAggregates.map((a) => ({
					key: `course-${a.course}`,
					label: a.course,
					sub: undefined,
					count: a.count,
					totalDue: a.totalDue,
					params: { course: a.course, year: selectedYear ?? undefined, termNumber: selectedTermNumber ?? undefined }
				}))
			: groupBy === 'year'
				? yearAggregates.map((a) => ({
						key: `year-${a.year}`,
						label: `Year ${a.year}`,
						sub: undefined,
						count: a.count,
						totalDue: a.totalDue,
						params: { year: a.year, course: selectedCourse ?? undefined, termNumber: selectedTermNumber ?? undefined }
					}))
				: termAggregates.map((a) => ({
						key: `term-${a.year}-${a.termNumber}`,
						label: `Term ${a.termNumber}`,
						sub: `${a.year}`,
						count: a.count,
						totalDue: a.totalDue,
						params: { year: a.year, termNumber: a.termNumber, course: selectedCourse ?? undefined }
					}))
	);

	let selectedGroup = $derived(groups.find((g) => g.key === selectedKey) ?? null);
	let selectedDetails = $derived(selectedGroup ? detailsData.get(selectedGroup.key) ?? [] : []);

	let totalDueAcrossGroups = $derived(groups.reduce((s, g) => s + g.totalDue, 0));
	let totalCountAcrossGroups = $derived(groups.reduce((s, g) => s + g.count, 0));
	let aggregateCount = $derived(groups.length);

	function initials(s: string): string {
		return s
			.split(/\s+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((w) => w[0]?.toUpperCase() ?? '')
			.join('');
	}
</script>

<svelte:head>
	<title>Dues — Revathi Arts</title>
</svelte:head>

<div class="page">
	<div class="page-head">
		<div class="page-head-row">
			<div>
				<h1 class="page-title">Outstanding <em>dues</em></h1>
				<p class="page-subtitle">Aggregated view of pending fees across courses, years and terms.</p>
			</div>
			<div style="display: flex; gap: 8px;">
				<button class="btn-s btn-secondary-s" onclick={printAll} disabled={printing || aggregateCount === 0}>
					<Printer size={14} strokeWidth={1.6} /> Print all
				</button>
				<button class="btn-s btn-secondary-s" onclick={downloadCSV}>
					<Download size={14} strokeWidth={1.6} /> Export CSV
				</button>
			</div>
		</div>
	</div>

	<div class="kpi-grid" style="margin-bottom: 18px;">
		<div class="kpi">
			<div class="kpi-label">Total outstanding</div>
			<div class="kpi-value" style="color: var(--danger);"><Money value={totalDueAcrossGroups} mono={false} /></div>
			<div class="kpi-meta"><span>Across all groups</span></div>
		</div>
		<div class="kpi">
			<div class="kpi-label">Open dues</div>
			<div class="kpi-value">{totalCountAcrossGroups}</div>
			<div class="kpi-meta"><span>Records</span></div>
		</div>
		<div class="kpi">
			<div class="kpi-label">Groups</div>
			<div class="kpi-value" style="color: var(--accent);">{aggregateCount}</div>
			<div class="kpi-meta"><span>By {groupBy}</span></div>
		</div>
		<div class="kpi">
			<div class="kpi-label">Avg per group</div>
			<div class="kpi-value"><Money value={aggregateCount > 0 ? totalDueAcrossGroups / aggregateCount : 0} mono={false} /></div>
			<div class="kpi-meta"><span>Mean</span></div>
		</div>
	</div>

	<div class="card-s" style="margin-bottom: 18px;">
		<div class="card-header">
			<h3 class="card-title-s" style="display: flex; align-items: center; gap: 8px;">
				<Filter size={16} strokeWidth={1.6} style="color: var(--fg-muted);" />
				Filters &amp; grouping
			</h3>
		</div>
		<div class="card-body-s">
			<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px;">
				<div class="field">
					<span class="field-label">Group by</span>
					<Select
						bind:value={groupBy}
						options={[
							{ value: 'course' as AggregateGroupBy, label: 'Course' },
							{ value: 'year' as AggregateGroupBy, label: 'Year' },
							{ value: 'term' as AggregateGroupBy, label: 'Term (year + number)' }
						]}
						onChange={() => loadAggregates()}
						ariaLabel="Group by"
					/>
				</div>
				<div class="field">
					<span class="field-label">Status</span>
					<Select
						bind:value={selectedStatuses}
						options={[
							{ value: 'DUE,PARTIALLY_PAID', label: 'Pending (Due + Partial)' },
							{ value: 'DUE', label: 'Due only' },
							{ value: 'PARTIALLY_PAID', label: 'Partial only' },
							{ value: 'PAID', label: 'Paid' },
							{ value: 'CANCELLED', label: 'Cancelled' },
							{ value: '', label: 'All statuses' }
						]}
						onChange={() => loadAggregates()}
						ariaLabel="Status filter"
					/>
				</div>
				<div class="field">
					<span class="field-label">Year</span>
					<Select
						bind:value={selectedYear}
						options={[{ value: null, label: 'All years' }, ...availableYears.map((y) => ({ value: y, label: String(y) }))]}
						onChange={() => loadAggregates()}
						disabled={groupBy === 'year'}
						ariaLabel="Year filter"
					/>
				</div>
				<div class="field">
					<span class="field-label">Term</span>
					<Select
						bind:value={selectedTermNumber}
						options={[
							{ value: null, label: 'All terms' },
							{ value: 1, label: 'Term 1' },
							{ value: 2, label: 'Term 2' },
							{ value: 3, label: 'Term 3' },
							{ value: 4, label: 'Term 4' }
						]}
						onChange={() => loadAggregates()}
						disabled={groupBy === 'term'}
						ariaLabel="Term filter"
					/>
				</div>
				<div class="field">
					<span class="field-label">Course</span>
					<Select
						bind:value={selectedCourse}
						options={[{ value: null, label: 'All courses' }, ...availableCourses.map((c) => ({ value: c, label: c }))]}
						onChange={() => loadAggregates()}
						disabled={groupBy === 'course'}
						ariaLabel="Course filter"
					/>
				</div>
			</div>
			{#if selectedYear || selectedTermNumber || selectedCourse}
				<div style="display: flex; justify-content: flex-end; margin-top: 12px;">
					<button class="btn-s btn-ghost-s btn-sm-s" onclick={clearFilters}>Clear filters</button>
				</div>
			{/if}
		</div>
	</div>

	{#if loading}
		<div style="display: flex; justify-content: center; padding: 60px 0; color: var(--fg-muted);"><span class="spinner spinner-lg"></span></div>
	{:else if error}
		<div class="callout danger">
			<AlertCircle size={18} strokeWidth={1.6} />
			<div class="callout-body">{error}</div>
		</div>
	{:else if aggregateCount === 0}
		<div class="card-s">
			<div class="card-body-s">
				<div class="empty-s">
					<div class="glyph">∅</div>
					<div style="font-family: var(--font-serif); font-size: 18px; color: var(--fg); margin-top: 6px;">No dues found</div>
					<div style="margin-top: 4px;">No outstanding dues match the selected filters.</div>
				</div>
			</div>
		</div>
	{:else}
		<div class="dues-split">
			<aside class="dues-list-card">
				<div class="dues-list-head">
					<span class="dues-list-title">
						{#if groupBy === 'course'}By course{:else if groupBy === 'year'}By year{:else}By term{/if}
					</span>
					<span class="dues-list-count">{aggregateCount}</span>
				</div>
				<div class="dues-list-body">
					{#each groups as g (g.key)}
						{@const isSel = g.key === selectedKey}
						<button type="button" class="dues-row" class:is-sel={isSel} onclick={() => selectGroup(g)}>
							<span class="dues-avatar">
								{#if groupBy === 'course'}<Book size={14} strokeWidth={1.6} />
								{:else if groupBy === 'year'}<Calendar size={14} strokeWidth={1.6} />
								{:else}<Hash size={14} strokeWidth={1.6} />{/if}
							</span>
							<span class="dues-row-body">
								<span class="dues-row-name">
									{#if groupBy === 'course'}{initials(g.label) || g.label}<span class="muted-inline"> · </span>{/if}{g.label}
								</span>
								<span class="dues-row-meta">
									<Users size={11} strokeWidth={1.6} /> {g.count} due{g.count !== 1 ? 's' : ''}{#if g.sub} · {g.sub}{/if}
								</span>
							</span>
							<span class="dues-row-amount"><Money value={g.totalDue} mono={false} /></span>
						</button>
					{/each}
				</div>
			</aside>

			<section class="dues-detail">
				{#if selectedGroup}
					<header class="dues-detail-head">
						<div style="display: flex; gap: 14px; align-items: flex-start; flex: 1; min-width: 0;">
							<span class="dues-avatar dues-avatar-lg">
								{#if groupBy === 'course'}<Book size={20} strokeWidth={1.4} />
								{:else if groupBy === 'year'}<Calendar size={20} strokeWidth={1.4} />
								{:else}<Hash size={20} strokeWidth={1.4} />{/if}
							</span>
							<div style="min-width: 0; flex: 1;">
								<h2 class="dues-detail-name">{selectedGroup.label}</h2>
								<p class="dues-detail-sub">
									{selectedGroup.count} record{selectedGroup.count !== 1 ? 's' : ''}
									{#if selectedGroup.sub} · {selectedGroup.sub}{/if}
								</p>
							</div>
						</div>
						<div class="dues-detail-kpis">
							<div>
								<div class="kpi-label">Total due</div>
								<div class="kpi-value" style="color: var(--danger); font-size: 22px;"><Money value={selectedGroup.totalDue} mono={false} /></div>
							</div>
							<div>
								<div class="kpi-label">Records</div>
								<div class="kpi-value" style="font-size: 22px;">{selectedGroup.count}</div>
							</div>
							<button class="btn-s btn-ghost-s btn-sm-s" onclick={printOne} disabled={printing} aria-label="Print this group">
								<Printer size={14} strokeWidth={1.6} /> Print
							</button>
						</div>
					</header>

					<div class="dues-detail-body">
						{#if loadingDetails && !detailsData.has(selectedGroup.key)}
							<div style="display: flex; justify-content: center; padding: 60px 0;"><span class="spinner spinner-lg"></span></div>
						{:else if selectedDetails.length === 0}
							<div class="callout info"><div class="callout-body">No matching records.</div></div>
						{:else}
							<div class="tbl-wrap">
								<table class="tbl">
									<thead>
										<tr>
											<th>Student</th>
											<th>Course</th>
											<th>Year</th>
											<th>Term</th>
											<th class="num">Total</th>
											<th class="num">Paid</th>
											<th class="num">Due</th>
											<th>Status</th>
										</tr>
									</thead>
									<tbody>
										{#each selectedDetails as due}
											<tr>
												<td>
													<a href="/students/{due.studentId}" target="_blank" rel="noopener noreferrer" style="color: var(--accent); font-family: var(--font-mono); font-size: 12px;">{due.studentName ?? `#${due.studentId}`}</a>
												</td>
												<td>{due.courseName}</td>
												<td>{due.termYear}</td>
												<td>{due.termNumber}</td>
												<td class="num"><Money value={due.totalFee} /></td>
												<td class="num"><Money value={due.amountPaid} /></td>
												<td class="num strong" style="color: var(--danger);"><Money value={due.amountDue} /></td>
												<td>
													{#if due.status === 'PAID'}<Badge kind="ok">Paid</Badge>
													{:else if due.status === 'PARTIALLY_PAID'}<Badge kind="warn">Partial</Badge>
													{:else if due.status === 'STUDENT_LEFT_DUE_CANCELLED'}<Badge kind="neutral">Cancelled</Badge>
													{:else}<Badge kind="danger">{due.status}</Badge>{/if}
												</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						{/if}
					</div>
				{:else}
					<div class="callout info"><div class="callout-body">Select a group to view its dues.</div></div>
				{/if}
			</section>
		</div>
	{/if}

	<!-- Print-only block: rendered only when printing, swaps in a paper-friendly layout -->
	{#if printGroups}
		<div class="dues-print">
			<div class="print-header">
				<div>
					<div class="print-brand">Revathi <em>Arts</em> &amp; Music School</div>
					<div class="print-title">
						Outstanding dues
						{#if printGroups.length === 1}— {printGroups[0].label}{/if}
					</div>
					<div class="print-meta">
						{statusFilterLabel(selectedStatuses)}
						{#if selectedYear} · Year {selectedYear}{/if}
						{#if selectedTermNumber} · Term {selectedTermNumber}{/if}
						{#if selectedCourse} · Course {selectedCourse}{/if}
						· Generated {todayStr()}
					</div>
				</div>
				<div class="print-totals">
					<div><span class="print-totals-label">Records</span> {printGroups.reduce((s, g) => s + g.count, 0)}</div>
					<div><span class="print-totals-label">Total due</span> <Money value={printGroups.reduce((s, g) => s + g.totalDue, 0)} mono={false} /></div>
				</div>
			</div>

			{#each printGroups as g (g.key)}
				{@const rows = detailsData.get(g.key) ?? []}
				<section class="print-section">
					<h3 class="print-section-title">
						{g.label}
						{#if g.sub}<span class="print-section-sub">· {g.sub}</span>{/if}
						<span class="print-section-amount"><Money value={g.totalDue} mono={false} /></span>
					</h3>
					<table class="print-tbl">
						<thead>
							<tr>
								<th>Student</th>
								<th>Course</th>
								<th>Year</th>
								<th>Term</th>
								<th class="num">Total</th>
								<th class="num">Paid</th>
								<th class="num">Due</th>
								<th>Status</th>
							</tr>
						</thead>
						<tbody>
							{#each rows as due}
								<tr>
									<td>{due.studentName ?? `#${due.studentId}`}</td>
									<td>{due.courseName}</td>
									<td>{due.termYear}</td>
									<td>{due.termNumber}</td>
									<td class="num"><Money value={due.totalFee} /></td>
									<td class="num"><Money value={due.amountPaid} /></td>
									<td class="num"><Money value={due.amountDue} /></td>
									<td>{statusLabel(due.status)}</td>
								</tr>
							{/each}
							<tr class="print-subtotal">
								<td colspan="6" style="text-align: right;">Subtotal</td>
								<td class="num"><Money value={g.totalDue} mono={false} /></td>
								<td></td>
							</tr>
						</tbody>
					</table>
				</section>
			{/each}
		</div>
	{/if}
</div>

<style>
	.dues-split {
		display: grid;
		grid-template-columns: 320px 1fr;
		gap: 16px;
		align-items: start;
	}
	@media (max-width: 980px) {
		.dues-split { grid-template-columns: 1fr; }
	}

	.dues-list-card {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 12px;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		max-height: 70vh;
	}
	.dues-list-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 14px;
		border-bottom: 1px solid var(--border);
	}
	.dues-list-title {
		font-size: 11px;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--fg-muted);
		font-weight: 600;
	}
	.dues-list-count {
		font-size: 12px;
		font-weight: 600;
		color: var(--fg-soft);
		background: var(--surface-2);
		border-radius: 999px;
		padding: 2px 8px;
		min-width: 24px;
		text-align: center;
	}
	.dues-list-body {
		padding: 6px;
		display: flex;
		flex-direction: column;
		gap: 2px;
		overflow-y: auto;
	}

	.dues-row {
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
	.dues-row:hover { background: var(--hover); }
	.dues-row.is-sel { background: var(--accent-soft); }
	.dues-row.is-sel .dues-row-name { color: var(--accent-deep); }

	.dues-avatar {
		width: 32px;
		height: 32px;
		border-radius: 8px;
		background: var(--accent-soft);
		color: var(--accent-deep);
		display: grid;
		place-items: center;
		flex-shrink: 0;
	}
	.dues-avatar-lg {
		width: 56px;
		height: 56px;
		border-radius: 12px;
	}

	.dues-row-body {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
		flex: 1;
	}
	.dues-row-name {
		font-size: 13px;
		font-weight: 500;
		color: var(--fg);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.dues-row-meta {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 11px;
		color: var(--fg-muted);
	}
	.dues-row-amount {
		font-family: var(--font-serif);
		font-size: 14px;
		color: var(--danger);
		flex-shrink: 0;
		margin-left: 8px;
	}
	.muted-inline { color: var(--fg-muted); font-weight: 400; }

	.dues-detail {
		display: flex;
		flex-direction: column;
		gap: 14px;
		min-width: 0;
	}
	.dues-detail-head {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 12px;
		padding: 18px 20px;
		display: flex;
		gap: 18px;
		flex-wrap: wrap;
		align-items: flex-start;
	}
	.dues-detail-name {
		font-family: var(--font-serif);
		font-size: 24px;
		font-weight: 500;
		letter-spacing: -0.01em;
		margin: 0;
	}
	.dues-detail-sub {
		margin: 4px 0 0;
		font-size: 13px;
		color: var(--fg-muted);
	}
	.dues-detail-kpis {
		display: flex;
		gap: 24px;
		padding-left: 18px;
		border-left: 1px solid var(--border);
	}
	.dues-detail-body {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 12px;
		overflow: hidden;
	}

	/* ---------- Print ---------- */
	.dues-print { display: none; }

	@media print {
		/* Hide everything outside the print block */
		:global(body) :global(*) { visibility: hidden !important; }
		.dues-print, .dues-print * { visibility: visible !important; }
		.dues-print {
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
		.print-brand {
			font-family: var(--font-serif);
			font-size: 18px;
		}
		.print-brand em { font-style: italic; color: #444; }
		.print-title {
			font-family: var(--font-serif);
			font-size: 22px;
			font-weight: 500;
			margin-top: 4px;
		}
		.print-meta { font-size: 11px; color: #555; margin-top: 4px; }
		.print-totals { font-size: 12px; text-align: right; }
		.print-totals-label {
			display: inline-block;
			min-width: 70px;
			text-transform: uppercase;
			letter-spacing: 0.08em;
			color: #777;
			font-size: 10px;
		}
		.print-section { margin-bottom: 18px; page-break-inside: avoid; }
		.print-section-title {
			font-family: var(--font-serif);
			font-size: 15px;
			font-weight: 500;
			margin: 14px 0 6px;
			padding-bottom: 4px;
			border-bottom: 1px solid #e6e6e6;
			display: flex;
			align-items: baseline;
			gap: 8px;
		}
		.print-section-sub { color: #777; font-size: 12px; }
		.print-section-amount { margin-left: auto; color: #b00020; }
		.print-tbl { width: 100%; border-collapse: collapse; font-size: 11px; }
		.print-tbl th, .print-tbl td {
			padding: 5px 6px;
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
		.print-tbl .num { text-align: right; font-variant-numeric: tabular-nums; }
		.print-subtotal td { font-weight: 600; border-top: 1px solid #ccc; border-bottom: 0; padding-top: 6px; }
		@page { margin: 12mm; }
	}
</style>
