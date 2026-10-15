<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { Filter, Download, Users, Book, Calendar, Hash, Printer } from 'lucide-svelte';
	import { api, errorMessage } from '$lib';
	import { DUE_STATUSES, type AggregateGroupBy, type AggregateRow, type Due, type DueStatus, type DuesSummary } from '$lib/api/types';
	import { formatDate, formatPeriod, isoDate } from '$lib/utils/format';
	import Money from '$lib/components/Money.svelte';
	import Select from '$lib/components/Select.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import ErrorCallout from '$lib/components/ErrorCallout.svelte';

	/** '' = open dues (DUE + PARTIALLY_PAID) */
	type StatusFilter = '' | 'ALL' | DueStatus;

	const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const STATUS_LABEL: Record<DueStatus, string> = { DUE: 'Due', PARTIALLY_PAID: 'Partially paid', PAID: 'Paid', OVERPAID: 'Overpaid', WAIVED: 'Waived' };

	let groupBy = $state<AggregateGroupBy>('course');
	let statusFilter = $state<StatusFilter>('');
	// filters on the period start date
	let from = $state('');
	let to = $state(isoDate());

	let rows = $state<AggregateRow[]>([]);
	let loading = $state(false);
	let error = $state<string | null>(null);

	let selectedKey = $state<string | null>(null);
	let details = $state<Map<string, Due[]>>(new Map());
	let loadingDetails = $state(false);
	let courseSummary = $state<DuesSummary | null>(null);

	let printKeys = $state<string[] | null>(null);
	let printing = $state(false);

	onMount(loadAggregates);

	async function loadAggregates() {
		loading = true;
		error = null;
		try {
			rows = await api.dues.aggregate(groupBy, from || undefined, to || undefined);
			rows.sort((a, b) => (groupBy === 'month' ? b.key.localeCompare(a.key) : b.balance - a.balance));
			details = new Map();
			selectedKey = rows[0]?.key ?? null;
			if (selectedKey) selectGroup(selectedKey);
		} catch (err) {
			error = errorMessage(err, 'Failed to load dues');
		} finally {
			loading = false;
		}
	}

	/** Query for the dues behind one aggregate row */
	function queryFor(key: string) {
		const q: { courseName?: string; status?: DueStatus; from?: string; to?: string } = { from: from || undefined, to: to || undefined };
		if (groupBy === 'course') q.courseName = key;
		if (groupBy === 'status') q.status = key as DueStatus;
		if (groupBy === 'month') {
			const [y, m] = key.split('-').map(Number);
			const start = `${key}-01`;
			const end = isoDate(new Date(y, m, 0));
			q.from = from && from > start ? from : start;
			q.to = to && to < end ? to : end;
		}
		if (statusFilter && statusFilter !== 'ALL' && groupBy !== 'status') q.status = statusFilter;
		return q;
	}

	function keepRow(d: Due) {
		return statusFilter === '' && groupBy !== 'status' ? d.status === 'DUE' || d.status === 'PARTIALLY_PAID' : true;
	}

	async function loadDetails(key: string) {
		if (details.has(key)) return;
		loadingDetails = true;
		try {
			const list = (await api.dues.list(queryFor(key))).filter(keepRow);
			details.set(key, list);
			details = new Map(details);
		} catch (err) {
			error = errorMessage(err, 'Failed to load dues');
		} finally {
			loadingDetails = false;
		}
	}

	async function selectGroup(key: string) {
		selectedKey = key;
		courseSummary = null;
		loadDetails(key);
		if (groupBy === 'course') {
			try {
				courseSummary = await api.dues.summary({ courseName: key });
			} catch {
				courseSummary = null;
			}
		}
	}

	function refilter() {
		details = new Map();
		if (selectedKey) loadDetails(selectedKey);
	}

	function clearFilters() {
		from = '';
		to = isoDate();
		statusFilter = '';
		loadAggregates();
	}

	function groupLabel(key: string): string {
		if (groupBy === 'month') {
			const [y, m] = key.split('-');
			return `${MONTHS[Number(m) - 1]} ${y}`;
		}
		if (groupBy === 'status') return STATUS_LABEL[key as DueStatus] ?? key;
		return key;
	}

	async function print(keys: string[]) {
		printing = true;
		try {
			await Promise.all(keys.map(loadDetails));
			printKeys = keys;
			await tick();
			window.print();
		} finally {
			printKeys = null;
			printing = false;
		}
	}

	function downloadCSV() {
		const headers = [groupBy === 'course' ? 'Course' : groupBy === 'month' ? 'Month' : 'Status', 'Dues', 'Billed', 'Balance'];
		const lines = rows.map((r) => [groupLabel(r.key), r.count, r.amount, r.balance]);
		const csv = [headers, ...lines]
			.map((r) => r.map((c) => (String(c).includes(',') ? `"${String(c).replace(/"/g, '""')}"` : String(c))).join(','))
			.join('\n');
		const link = document.createElement('a');
		link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
		link.download = `dues-by-${groupBy}-${isoDate()}.csv`;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	}

	function rangeLabel() {
		if (from && to) return `Periods starting ${formatDate(from)} – ${formatDate(to)}`;
		if (to) return `Periods starting up to ${formatDate(to)}`;
		if (from) return `Periods starting from ${formatDate(from)}`;
		return 'All periods';
	}
	function statusFilterLabel() {
		if (groupBy === 'status' || statusFilter === 'ALL') return 'All statuses';
		if (statusFilter === '') return 'Open (due + partially paid)';
		return STATUS_LABEL[statusFilter];
	}

	let selectedRow = $derived(rows.find((r) => r.key === selectedKey) ?? null);
	let selectedDetails = $derived(selectedKey ? details.get(selectedKey) ?? [] : []);
	let totalBalance = $derived(rows.reduce((s, r) => s + r.balance, 0));
	let totalBilled = $derived(rows.reduce((s, r) => s + r.amount, 0));
	let totalCount = $derived(rows.reduce((s, r) => s + r.count, 0));
	let detailBalance = $derived(selectedDetails.reduce((s, d) => s + d.balance, 0));
</script>

<svelte:head>
	<title>Dues — Revathi Arts</title>
</svelte:head>

<div class="page">
	<div class="page-head">
		<div class="page-head-row">
			<div>
				<h1 class="page-title">Outstanding <em>dues</em></h1>
				<p class="page-subtitle">Dues across the school by course, month or status. They're recalculated automatically.</p>
			</div>
			<div style="display: flex; gap: 8px;">
				<button class="btn-s btn-secondary-s" onclick={() => print(rows.map((r) => r.key))} disabled={printing || rows.length === 0}>
					<Printer size={14} strokeWidth={1.6} /> Print all
				</button>
				<button class="btn-s btn-secondary-s" onclick={downloadCSV} disabled={rows.length === 0}>
					<Download size={14} strokeWidth={1.6} /> Export CSV
				</button>
			</div>
		</div>
	</div>

	<div class="kpi-grid" style="margin-bottom: 18px;">
		<div class="kpi">
			<div class="kpi-label">Balance</div>
			<div class="kpi-value" style="color: var(--danger);"><Money value={totalBalance} mono={false} /></div>
			<div class="kpi-meta"><span>{rangeLabel()}</span></div>
		</div>
		<div class="kpi">
			<div class="kpi-label">Billed</div>
			<div class="kpi-value"><Money value={totalBilled} mono={false} /></div>
			<div class="kpi-meta"><span>Same periods</span></div>
		</div>
		<div class="kpi">
			<div class="kpi-label">Collected or discounted</div>
			<div class="kpi-value" style="color: var(--ok);"><Money value={totalBilled - totalBalance} mono={false} /></div>
			<div class="kpi-meta"><span>Billed minus balance (incl. waived)</span></div>
		</div>
		<div class="kpi">
			<div class="kpi-label">Dues</div>
			<div class="kpi-value" style="color: var(--accent);">{totalCount}</div>
			<div class="kpi-meta"><span>{rows.length} group{rows.length !== 1 ? 's' : ''} by {groupBy}</span></div>
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
							{ value: 'month' as AggregateGroupBy, label: 'Month (period start)' },
							{ value: 'status' as AggregateGroupBy, label: 'Status' }
						]}
						onChange={() => loadAggregates()}
						ariaLabel="Group by"
					/>
				</div>
				<div class="field">
					<span class="field-label">Show dues</span>
					<Select
						bind:value={statusFilter}
						options={[
							{ value: '' as StatusFilter, label: 'Open (due + partial)' },
							...DUE_STATUSES.map((st) => ({ value: st as StatusFilter, label: STATUS_LABEL[st] })),
							{ value: 'ALL' as StatusFilter, label: 'All statuses' }
						]}
						onChange={refilter}
						disabled={groupBy === 'status'}
						ariaLabel="Status filter"
					/>
				</div>
				<div class="field">
					<label for="due-from">Period starts from</label>
					<input id="due-from" type="date" class="input-s" bind:value={from} onchange={loadAggregates} />
				</div>
				<div class="field">
					<label for="due-to">Period starts up to</label>
					<input id="due-to" type="date" class="input-s" bind:value={to} onchange={loadAggregates} />
				</div>
			</div>
			<div style="display: flex; justify-content: space-between; align-items: center; margin-top: 12px; gap: 10px;">
				<span class="muted" style="font-size: 12px;">Group totals include every status; the list on the right follows "Show dues".</span>
				{#if from || statusFilter || to !== isoDate()}
					<button class="btn-s btn-ghost-s btn-sm-s" onclick={clearFilters}>Clear filters</button>
				{/if}
			</div>
		</div>
	</div>

	<ErrorCallout message={error} />

	{#if loading}
		<div style="display: flex; justify-content: center; padding: 60px 0; color: var(--fg-muted);"><span class="spinner spinner-lg"></span></div>
	{:else if rows.length === 0 && !error}
		<div class="card-s">
			<div class="card-body-s">
				<div class="empty-s">
					<div class="glyph">∅</div>
					<div style="font-family: var(--font-serif); font-size: 18px; color: var(--fg); margin-top: 6px;">No dues found</div>
					<div style="margin-top: 4px;">No dues match the selected dates.</div>
				</div>
			</div>
		</div>
	{:else if rows.length > 0}
		<div class="dues-split">
			<aside class="dues-list-card">
				<div class="dues-list-head">
					<span class="dues-list-title">By {groupBy}</span>
					<span class="dues-list-count">{rows.length}</span>
				</div>
				<div class="dues-list-body">
					{#each rows as r (r.key)}
						<button type="button" class="dues-row" class:is-sel={r.key === selectedKey} onclick={() => selectGroup(r.key)}>
							<span class="dues-avatar">
								{#if groupBy === 'course'}<Book size={14} strokeWidth={1.6} />
								{:else if groupBy === 'month'}<Calendar size={14} strokeWidth={1.6} />
								{:else}<Hash size={14} strokeWidth={1.6} />{/if}
							</span>
							<span class="dues-row-body">
								<span class="dues-row-name">{groupLabel(r.key)}</span>
								<span class="dues-row-meta"><Users size={11} strokeWidth={1.6} /> {r.count} due{r.count !== 1 ? 's' : ''} · billed <Money value={r.amount} mono={false} /></span>
							</span>
							<span class="dues-row-amount"><Money value={r.balance} mono={false} /></span>
						</button>
					{/each}
				</div>
			</aside>

			<section class="dues-detail">
				{#if selectedRow}
					<header class="dues-detail-head">
						<div style="display: flex; gap: 14px; align-items: flex-start; flex: 1; min-width: 0;">
							<span class="dues-avatar dues-avatar-lg">
								{#if groupBy === 'course'}<Book size={20} strokeWidth={1.4} />
								{:else if groupBy === 'month'}<Calendar size={20} strokeWidth={1.4} />
								{:else}<Hash size={20} strokeWidth={1.4} />{/if}
							</span>
							<div style="min-width: 0; flex: 1;">
								<h2 class="dues-detail-name">{groupLabel(selectedRow.key)}</h2>
								<p class="dues-detail-sub">
									{selectedRow.count} due{selectedRow.count !== 1 ? 's' : ''} · showing {statusFilterLabel().toLowerCase()}
									{#if courseSummary}
										<br />All time for this course: billed <Money value={courseSummary.amount} mono={false} />, paid <Money value={courseSummary.paid} mono={false} />,
										discounts <Money value={courseSummary.discount} mono={false} />, balance <Money value={courseSummary.balance} mono={false} />
										{#if courseSummary.overpaid > 0}, overpaid <Money value={courseSummary.overpaid} mono={false} />{/if}
									{/if}
								</p>
							</div>
						</div>
						<div class="dues-detail-kpis">
							<div>
								<div class="kpi-label">Balance</div>
								<div class="kpi-value" style="color: var(--danger); font-size: 22px;"><Money value={selectedRow.balance} mono={false} /></div>
							</div>
							<div>
								<div class="kpi-label">Billed</div>
								<div class="kpi-value" style="font-size: 22px;"><Money value={selectedRow.amount} mono={false} /></div>
							</div>
							<button class="btn-s btn-ghost-s btn-sm-s" onclick={() => print([selectedRow!.key])} disabled={printing} aria-label="Print this group">
								<Printer size={14} strokeWidth={1.6} /> Print
							</button>
						</div>
					</header>

					<div class="dues-detail-body">
						{#if loadingDetails && !details.has(selectedRow.key)}
							<div style="display: flex; justify-content: center; padding: 60px 0;"><span class="spinner spinner-lg"></span></div>
						{:else if selectedDetails.length === 0}
							<div class="callout info"><div class="callout-body">No {statusFilterLabel().toLowerCase()} dues in this group.</div></div>
						{:else}
							<div class="tbl-wrap">
								<table class="tbl">
									<thead>
										<tr>
											<th>Student</th>
											<th>Course</th>
											<th>Period</th>
											<th class="num">Amount</th>
											<th class="num">Paid</th>
											<th class="num">Discount</th>
											<th class="num">Balance</th>
											<th>Status</th>
										</tr>
									</thead>
									<tbody>
										{#each selectedDetails as due (due.id)}
											<tr>
												<td>
													<a href="/students/{due.studentId}/dues" style="color: var(--accent); font-size: 12.5px;">{due.studentName ?? `#${due.studentId}`}</a>
													<div class="muted" style="font-family: var(--font-mono); font-size: 11px;">{due.studentId}</div>
												</td>
												<td>{due.courseName}</td>
												<td>{formatPeriod(due.periodStart, due.periodEnd)}</td>
												<td class="num"><Money value={due.amount} /></td>
												<td class="num"><Money value={due.paidAmount} /></td>
												<td class="num"><Money value={due.discountAmount} /></td>
												<td class="num strong" style:color={due.balance > 0 ? 'var(--danger)' : undefined}><Money value={due.balance} /></td>
												<td><StatusBadge status={due.status} /></td>
											</tr>
										{/each}
									</tbody>
									<tfoot>
										<tr>
											<td colspan="6" class="muted">{selectedDetails.length} shown</td>
											<td class="num strong"><Money value={detailBalance} /></td>
											<td></td>
										</tr>
									</tfoot>
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

	<!-- Print-only block: rendered only when printing -->
	{#if printKeys}
		<div class="dues-print">
			<div class="print-header">
				<div>
					<div class="print-brand">Revathi <em>Arts</em> &amp; Music School</div>
					<div class="print-title">
						Dues by {groupBy}
						{#if printKeys.length === 1}— {groupLabel(printKeys[0])}{/if}
					</div>
					<div class="print-meta">{statusFilterLabel()} · {rangeLabel()} · Generated {formatDate(isoDate())}</div>
				</div>
				<div class="print-totals">
					<div><span class="print-totals-label">Dues</span> {printKeys.reduce((s, k) => s + (details.get(k)?.length ?? 0), 0)}</div>
					<div><span class="print-totals-label">Balance</span> <Money value={printKeys.reduce((s, k) => s + (details.get(k) ?? []).reduce((a, d) => a + d.balance, 0), 0)} mono={false} /></div>
				</div>
			</div>

			{#each printKeys as k (k)}
				{@const list = details.get(k) ?? []}
				{@const sub = list.reduce((a, d) => a + d.balance, 0)}
				<section class="print-section">
					<h3 class="print-section-title">
						{groupLabel(k)}
						<span class="print-section-amount"><Money value={sub} mono={false} /></span>
					</h3>
					<table class="print-tbl">
						<thead>
							<tr>
								<th>Student</th>
								<th>Course</th>
								<th>Period</th>
								<th class="num">Amount</th>
								<th class="num">Paid</th>
								<th class="num">Balance</th>
								<th>Status</th>
							</tr>
						</thead>
						<tbody>
							{#each list as due}
								<tr>
									<td>{due.studentName ?? `#${due.studentId}`} ({due.studentId})</td>
									<td>{due.courseName}</td>
									<td>{formatPeriod(due.periodStart, due.periodEnd)}</td>
									<td class="num"><Money value={due.amount} /></td>
									<td class="num"><Money value={due.paidAmount + due.discountAmount} /></td>
									<td class="num"><Money value={due.balance} /></td>
									<td>{STATUS_LABEL[due.status]}</td>
								</tr>
							{/each}
							<tr class="print-subtotal">
								<td colspan="5" style="text-align: right;">Subtotal</td>
								<td class="num"><Money value={sub} mono={false} /></td>
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
