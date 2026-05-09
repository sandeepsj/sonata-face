<script lang="ts">
	import { onMount } from 'svelte';
	import { PaymentService, type DateRangeParams } from '$lib/api/paymentService';
	import type { Payment } from '$lib/types/payment';
	import { Calendar, Filter, Download, AlertCircle } from 'lucide-svelte';
	import Badge from '$lib/components/Badge.svelte';
	import Money from '$lib/components/Money.svelte';
	import Select from '$lib/components/Select.svelte';

	let startDate = '';
	let endDate = '';

	let selectedCourse: string | null = null;
	let selectedType: string | null = null;
	let selectedTerm: number | null = null;

	let payments: Payment[] = [];
	let loading = false;
	let error: string | null = null;

	let courses: string[] = [];
	const paymentTypes = ['REGULAR', 'ADDITIONAL'];

	let totalAmount = 0;
	let totalPayments = 0;
	let totalCollected = 0;
	let totalDiscount = 0;
	let totalFeeCleared = 0;
	type GroupBy = 'course' | 'month' | 'type' | 'label' | 'term' | 'none';
	type SummaryRow = { key: string; label: string; sub?: string; amount: number; count: number };

	let summaryGroupBy: GroupBy = 'course';
	let summaryRows: SummaryRow[] = [];
	let summaryMax = 1;

	const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

	function paymentTotal(p: Payment): number {
		return p.amountPaid + (p.discountAmount || 0);
	}

	function rebuildSummary() {
		if (summaryGroupBy === 'none') {
			summaryRows = [
				{
					key: 'total',
					label: 'All payments',
					amount: payments.reduce((s, p) => s + paymentTotal(p), 0),
					count: payments.length
				}
			];
			summaryMax = summaryRows[0].amount || 1;
			return;
		}
		const map = new Map<string, SummaryRow>();
		for (const p of payments) {
			const dt = new Date(p.date);
			let key: string;
			let label: string;
			let sub: string | undefined;
			switch (summaryGroupBy) {
				case 'course':
					key = p.courseName || 'Other';
					label = key;
					break;
				case 'month':
					key = `${dt.getFullYear()}-${String(dt.getMonth()).padStart(2, '0')}`;
					label = `${MONTHS[dt.getMonth()]} ${dt.getFullYear()}`;
					break;
				case 'type':
					key = p.paymentType;
					label = p.paymentType === 'REGULAR' ? 'Term payment' : p.paymentType === 'ADDITIONAL' ? 'Additional' : 'Other';
					break;
				case 'label':
					key = p.label || 'No label';
					label = key;
					break;
				case 'term':
					key = `${p.feeStructure?.year ?? '—'}-T${p.feeStructure?.termName ?? '—'}`;
					label = p.feeStructure?.termName ? `Term ${p.feeStructure.termName}` : 'No term';
					sub = p.feeStructure?.year ? String(p.feeStructure.year) : undefined;
					break;
			}
			const ex = map.get(key) ?? { key, label, sub, amount: 0, count: 0 };
			ex.amount += paymentTotal(p);
			ex.count += 1;
			map.set(key, ex);
		}
		summaryRows = Array.from(map.values()).sort((a, b) =>
			summaryGroupBy === 'month' ? a.key.localeCompare(b.key) : b.amount - a.amount
		);
		summaryMax = Math.max(...summaryRows.map((r) => r.amount), 1);
	}

	function setGroupBy(g: GroupBy) {
		summaryGroupBy = g;
		rebuildSummary();
	}

	function setQuickThisYear() {
		const now = new Date();
		startDate = formatDateForInput(new Date(now.getFullYear(), 0, 1));
		endDate = formatDateForInput(new Date(now.getFullYear(), 11, 31, 23, 59, 59));
		loadPayments();
	}
	function setQuickLastYear() {
		const now = new Date();
		startDate = formatDateForInput(new Date(now.getFullYear() - 1, 0, 1));
		endDate = formatDateForInput(new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59));
		loadPayments();
	}

	function formatRangeLabel(s: string, e: string): string {
		if (!s || !e) return '';
		const sd = new Date(s);
		const ed = new Date(e);
		const opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' };
		// If full year range, just show the year
		if (
			sd.getMonth() === 0 && sd.getDate() === 1 &&
			ed.getMonth() === 11 && ed.getDate() === 31 &&
			sd.getFullYear() === ed.getFullYear()
		) return String(sd.getFullYear());
		return `${sd.toLocaleDateString('en-IN', opts)} → ${ed.toLocaleDateString('en-IN', opts)}`;
	}

	onMount(() => {
		// Default to the current year so the summary is meaningful out of the gate.
		const now = new Date();
		const firstDay = new Date(now.getFullYear(), 0, 1);
		const lastDay = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
		startDate = formatDateForInput(firstDay);
		endDate = formatDateForInput(lastDay);
		loadPayments();
	});

	function formatDateForInput(d: Date): string {
		const y = d.getFullYear();
		const m = String(d.getMonth() + 1).padStart(2, '0');
		const day = String(d.getDate()).padStart(2, '0');
		return `${y}-${m}-${day}`;
	}

	function toISOString(s: string, isEnd = false): string {
		const [y, m, d] = s.split('-');
		return isEnd ? `${y}-${m}-${d}T23:59:59` : `${y}-${m}-${d}T00:00:00`;
	}

	async function loadPayments() {
		if (!startDate || !endDate) return;
		loading = true;
		error = null;
		try {
			const params: DateRangeParams = {
				startDate: toISOString(startDate),
				endDate: toISOString(endDate, true)
			};
			if (selectedCourse) payments = await PaymentService.getPaymentsByCourse(selectedCourse, params);
			else if (selectedType) payments = await PaymentService.getPaymentsByType(selectedType, params);
			else if (selectedTerm) payments = await PaymentService.getPaymentsByTerm(selectedTerm, params);
			else payments = await PaymentService.getPaymentsByDateRange(params);

			courses = [...new Set(payments.map((p) => p.courseName).filter(Boolean) as string[])];
			calculateAggregations();
		} catch (err) {
			error = 'Failed to load payments. Please try again.';
		} finally {
			loading = false;
		}
	}

	function calculateAggregations() {
		totalPayments = payments.length;
		totalAmount = payments.reduce((s, p) => s + paymentTotal(p), 0);
		totalCollected = payments.reduce((s, p) => s + p.amountPaid, 0);
		totalDiscount = payments.reduce((s, p) => s + (p.discountAmount || 0), 0);
		totalFeeCleared = totalCollected + totalDiscount;
		rebuildSummary();
	}

	function formatDateShort(s: string): string {
		try { return new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
		catch { return s; }
	}

	function clearFilters() {
		selectedCourse = null;
		selectedType = null;
		selectedTerm = null;
		loadPayments();
	}

	function setQuickRange(range: string) {
		const now = new Date();
		let start: Date;
		let end: Date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
		switch (range) {
			case 'today': start = new Date(now.getFullYear(), now.getMonth(), now.getDate()); break;
			case 'yesterday':
				start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
				end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59);
				break;
			case 'week': start = new Date(now.getTime() - 7 * 86400000); break;
			case 'month':
				start = new Date(now.getFullYear(), now.getMonth(), 1);
				end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
				break;
			case 'lastMonth':
				start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
				end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
				break;
			default: start = new Date(now.getFullYear(), now.getMonth(), 1);
		}
		startDate = formatDateForInput(start);
		endDate = formatDateForInput(end);
		loadPayments();
	}

	function downloadCSV() {
		const headers = ['Date','Student Name','Student ID','Course','Year','Term','Type','Student Remarks','Payment Remarks','Fee Paid','Discount','Total'];
		const rows = payments.map((p) => [
			formatDateShort(p.date),
			p.student.studentName || 'N/A',
			p.student.admissionNo || 'N/A',
			p.courseName || 'N/A',
			p.feeStructure?.year || 'N/A',
			p.feeStructure?.term || 'N/A',
			p.paymentType === 'REGULAR' ? 'Regular' : 'Additional',
			p.student.remarks || '-',
			p.remarks || '-',
			p.amountPaid,
			p.discountAmount || 0,
			p.amountPaid + (p.discountAmount || 0)
		]);
		const totalRow = ['','','','','','','','','Total:', payments.reduce((s, p) => s + p.amountPaid, 0), payments.reduce((s, p) => s + (p.discountAmount || 0), 0), totalAmount];
		const csv = [
			headers.join(','),
			...rows.map((r) => r.map((cell) => {
				const s = String(cell);
				return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
			}).join(',')),
			totalRow.join(',')
		].join('\n');
		const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
		const link = document.createElement('a');
		link.href = URL.createObjectURL(blob);
		link.download = `payment-report-${startDate}-to-${endDate}.csv`;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	}

</script>

<svelte:head>
	<title>Payments — Revathi Arts</title>
</svelte:head>

<div class="page">
	<div class="page-head">
		<div class="page-head-row">
			<div>
				<h1 class="page-title">Payments <em>dashboard</em></h1>
				<p class="page-subtitle">Track collections across the school by date, course or type.</p>
			</div>
			<div style="display: flex; gap: 8px;">
				<button class="btn-s btn-primary-s" onclick={downloadCSV}>
					<Download size={14} strokeWidth={1.6} /> Export CSV
				</button>
			</div>
		</div>
	</div>

	<div class="card-s" style="margin-bottom: 18px;">
		<div class="card-header">
			<h3 class="card-title-s" style="display: flex; align-items: center; gap: 8px;">
				<Filter size={16} strokeWidth={1.6} style="color: var(--fg-muted);" />
				Filters
			</h3>
		</div>
		<div class="card-body-s">
			<div style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 14px;">
				<button class="btn-s btn-secondary-s btn-sm-s" onclick={() => setQuickRange('today')}>Today</button>
				<button class="btn-s btn-secondary-s btn-sm-s" onclick={() => setQuickRange('yesterday')}>Yesterday</button>
				<button class="btn-s btn-secondary-s btn-sm-s" onclick={() => setQuickRange('week')}>Last 7 days</button>
				<button class="btn-s btn-secondary-s btn-sm-s" onclick={() => setQuickRange('month')}>This month</button>
				<button class="btn-s btn-secondary-s btn-sm-s" onclick={() => setQuickRange('lastMonth')}>Last month</button>
				<button class="btn-s btn-secondary-s btn-sm-s" onclick={setQuickThisYear}>This year</button>
				<button class="btn-s btn-secondary-s btn-sm-s" onclick={setQuickLastYear}>Last year</button>
			</div>
			<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px;">
				<div class="field">
					<label for="startDate">Start date</label>
					<input id="startDate" type="date" class="input-s" bind:value={startDate} onchange={loadPayments} />
				</div>
				<div class="field">
					<label for="endDate">End date</label>
					<input id="endDate" type="date" class="input-s" bind:value={endDate} onchange={loadPayments} />
				</div>
				<div class="field">
					<span class="field-label">Course</span>
					<Select
						bind:value={selectedCourse}
						options={[{ value: null, label: 'All courses' }, ...courses.map((c) => ({ value: c, label: c }))]}
						onChange={loadPayments}
						ariaLabel="Course filter"
					/>
				</div>
				<div class="field">
					<span class="field-label">Type</span>
					<Select
						bind:value={selectedType}
						options={[
							{ value: null, label: 'All types' },
							{ value: 'REGULAR', label: 'Regular' },
							{ value: 'ADDITIONAL', label: 'Additional' }
						]}
						onChange={loadPayments}
						ariaLabel="Type filter"
					/>
				</div>
			</div>
			{#if selectedCourse || selectedType || selectedTerm}
				<div style="display: flex; justify-content: flex-end; margin-top: 12px;">
					<button class="btn-s btn-ghost-s btn-sm-s" onclick={clearFilters}>Clear filters</button>
				</div>
			{/if}
		</div>
	</div>

	<div class="kpi-grid" style="margin-bottom: 18px;">
		<div class="kpi">
			<div class="kpi-label">Fee cleared</div>
			<div class="kpi-value" style="color: var(--accent);"><Money value={totalFeeCleared} mono={false} /></div>
			<div class="kpi-meta"><span>Fee + discount</span></div>
		</div>
		<div class="kpi">
			<div class="kpi-label">Collected</div>
			<div class="kpi-value" style="color: var(--ok);"><Money value={totalCollected} mono={false} /></div>
			<div class="kpi-meta"><span>Amount received</span></div>
		</div>
		<div class="kpi">
			<div class="kpi-label">Discount</div>
			<div class="kpi-value" style="color: var(--warn);"><Money value={totalDiscount} mono={false} /></div>
			<div class="kpi-meta"><span>Concessions given</span></div>
		</div>
		<div class="kpi">
			<div class="kpi-label">Transactions</div>
			<div class="kpi-value">{totalPayments}</div>
			<div class="kpi-meta"><span>Payment count</span></div>
		</div>
	</div>

	<div class="card-s summary-card" style="margin-bottom: 18px;">
		<div class="card-header">
			<h3 class="card-title-s">
				Summary <span class="summary-range">· {formatRangeLabel(startDate, endDate)}</span>
			</h3>
			<div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
				<span class="muted" style="font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.08em;">Group by</span>
				<div class="seg seg-sm">
					<button class:active={summaryGroupBy === 'course'} onclick={() => setGroupBy('course')}>Course</button>
					<button class:active={summaryGroupBy === 'month'} onclick={() => setGroupBy('month')}>Month</button>
					<button class:active={summaryGroupBy === 'type'} onclick={() => setGroupBy('type')}>Type</button>
					<button class:active={summaryGroupBy === 'label'} onclick={() => setGroupBy('label')}>Label</button>
					<button class:active={summaryGroupBy === 'term'} onclick={() => setGroupBy('term')}>Term</button>
					<button class:active={summaryGroupBy === 'none'} onclick={() => setGroupBy('none')}>Total</button>
				</div>
			</div>
		</div>
		<div class="card-body-s">
			{#if summaryRows.length === 0}
				<div class="muted" style="text-align: center; padding: 30px 0;">No data in range</div>
			{:else}
				<div class="summary-list">
					{#each summaryRows as r (r.key)}
						<div class="summary-row">
							<span class="summary-name">
								{r.label}
								{#if r.sub}<span class="muted" style="font-size: 11px;"> · {r.sub}</span>{/if}
							</span>
							<span class="summary-bar"><span style="width: {(r.amount / summaryMax) * 100}%;"></span></span>
							<span class="summary-count">{r.count}</span>
							<span class="summary-amount">₹{r.amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>

	<div class="card-s">
		<div class="card-header">
			<h3 class="card-title-s">Records ({totalPayments})</h3>
		</div>
		<div class="card-body-s tight">
			{#if loading}
				<div style="display: flex; justify-content: center; padding: 60px 0;"><span class="spinner spinner-lg"></span></div>
			{:else if error}
				<div class="callout danger" style="margin: 16px;">
					<AlertCircle size={18} strokeWidth={1.6} />
					<div class="callout-body">{error}</div>
				</div>
			{:else if payments.length === 0}
				<div class="empty-s">
					<div class="glyph">∅</div>
					<div style="font-family: var(--font-serif); font-size: 18px; color: var(--fg); margin-top: 6px;">No payments found</div>
					<div style="margin-top: 4px;">No records for the selected date range and filters.</div>
				</div>
			{:else}
				<div style="overflow-x: auto;">
					<table class="tbl">
						<thead>
							<tr>
								<th>R.No</th>
								<th>Date</th>
								<th>Student</th>
								<th>Course</th>
								<th>Year</th>
								<th>Term</th>
								<th>Type</th>
								<th>Student remarks</th>
								<th>Payment remarks</th>
								<th class="num">Paid</th>
								<th class="num">Discount</th>
								<th class="num">Total</th>
							</tr>
						</thead>
						<tbody>
							{#each payments as p}
								<tr>
									<td>
										{#if p.student?.admissionNo}
											<a href="/students/{p.student.admissionNo}" target="_blank" rel="noopener noreferrer" class="link-id">{p.id}</a>
										{:else}
											<span class="id">{p.id}</span>
										{/if}
									</td>
									<td class="muted" style="white-space: nowrap;">{formatDateShort(p.date)}</td>
									<td>
										<div class="strong">{p.student.studentName || '—'}</div>
										{#if p.student.admissionNo}
											<a href="/students/{p.student.admissionNo}" target="_blank" rel="noopener noreferrer" style="color: var(--accent); font-family: var(--font-mono); font-size: 11px;">{p.student.admissionNo}</a>
										{/if}
									</td>
									<td>{#if p.courseName}<Badge kind="neutral">{p.courseName}</Badge>{:else}<span class="muted">—</span>{/if}</td>
									<td class="muted">{p.feeStructure?.year || '—'}</td>
									<td class="muted">{p.feeStructure?.term || '—'}</td>
									<td>
										{#if p.paymentType === 'REGULAR'}<Badge kind="info">Regular</Badge>
										{:else}<Badge kind="accent">Additional</Badge>{/if}
									</td>
									<td class="muted" style="max-width: 180px; white-space: normal; font-size: 11.5px;">{p.student.remarks || '—'}</td>
									<td class="muted" style="max-width: 180px; white-space: normal; font-size: 11.5px;">{p.remarks || '—'}</td>
									<td class="num"><Money value={p.amountPaid} /></td>
									<td class="num"><Money value={p.discountAmount || 0} /></td>
									<td class="num strong"><Money value={p.amountPaid + (p.discountAmount || 0)} /></td>
								</tr>
							{/each}
						</tbody>
						<tfoot>
							<tr style="background: var(--bg-elev); font-weight: 600;">
								<td colspan="9" style="text-align: right; padding: 12px 14px;">Total</td>
								<td class="num"><Money value={payments.reduce((s, p) => s + p.amountPaid, 0)} /></td>
								<td class="num"><Money value={payments.reduce((s, p) => s + (p.discountAmount || 0), 0)} /></td>
								<td class="num"><Money value={totalAmount} /></td>
							</tr>
						</tfoot>
					</table>
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.summary-card .card-header { gap: 12px; flex-wrap: wrap; }
	.summary-range { color: var(--fg-muted); font-weight: 400; font-size: 13px; }

	.seg-sm {
		display: inline-flex;
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 2px;
	}
	.seg-sm button {
		appearance: none;
		background: transparent;
		border: 0;
		padding: 5px 10px;
		font: inherit;
		font-size: 12px;
		color: var(--fg-soft);
		border-radius: 6px;
		cursor: pointer;
		transition: background 120ms, color 120ms;
	}
	.seg-sm button:hover { color: var(--fg); }
	.seg-sm button.active {
		background: var(--surface);
		color: var(--accent-deep);
		box-shadow: 0 1px 2px oklch(0.30 0.02 60 / 0.06);
		font-weight: 500;
	}

	.summary-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.summary-row {
		display: grid;
		grid-template-columns: minmax(140px, 1.2fr) minmax(180px, 3fr) auto auto;
		align-items: center;
		gap: 12px;
		padding: 6px 4px;
		font-size: 13px;
	}
	.summary-name {
		font-weight: 500;
		color: var(--fg);
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.summary-bar {
		height: 8px;
		background: var(--surface-2);
		border-radius: 999px;
		overflow: hidden;
	}
	.summary-bar > span {
		display: block;
		height: 100%;
		background: var(--accent);
		border-radius: 999px;
		transition: width 220ms ease-out;
	}
	.summary-count {
		font-family: var(--font-mono);
		font-size: 11.5px;
		color: var(--fg-muted);
		min-width: 28px;
		text-align: right;
	}
	.summary-amount {
		font-family: var(--font-mono);
		font-size: 13px;
		color: var(--fg);
		min-width: 90px;
		text-align: right;
	}
	@media (max-width: 700px) {
		.summary-row { grid-template-columns: 1fr auto; }
		.summary-bar, .summary-count { display: none; }
	}
</style>
