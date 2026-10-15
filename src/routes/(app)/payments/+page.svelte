<script lang="ts">
	import { onMount } from 'svelte';
	import { api, errorMessage } from '$lib';
	import type { Payment, PaymentType } from '$lib/api/types';
	import { formatDate as formatPeriodDate } from '$lib/utils/format';
	import { Calendar, Filter, Download, Printer, AlertCircle } from 'lucide-svelte';
	import Badge from '$lib/components/Badge.svelte';
	import Money from '$lib/components/Money.svelte';
	import Select from '$lib/components/Select.svelte';

	let startDate = '';
	let endDate = '';

	let selectedCourse: string | null = null;
	let selectedType: string | null = null;
	let studentId = '';
	let includeInactive = false;

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
	type GroupBy = 'course' | 'month' | 'type' | 'label' | 'none';
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
					label = p.paymentType === 'REGULAR' ? 'Course fee' : 'Additional';
					break;
				case 'label':
					key = p.label || 'No label';
					label = key;
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

	function printReport() {
		// The print-only block in the template renders the on-screen state in
		// a paper-friendly layout; the @media print stylesheet hides everything else.
		window.print();
	}

	function todayStr(): string {
		return new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
	}

	const GROUP_LABELS: Record<GroupBy, string> = {
		course: 'Course',
		month: 'Month',
		type: 'Type',
		label: 'Label',
		none: 'Total'
	};

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
		api.courses.list().then((cs) => (courses = cs.map((c) => c.name).sort())).catch(() => {});
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


	async function loadPayments() {
		if (!startDate || !endDate) return;
		loading = true;
		error = null;
		try {
			payments = await api.payments.list({
				from: startDate,
				to: endDate,
				courseName: selectedCourse ?? undefined,
				type: (selectedType as PaymentType | null) ?? undefined,
				studentId: studentId.trim() ? Number(studentId.trim()) : undefined,
				active: includeInactive ? undefined : true
			});
			calculateAggregations();
		} catch (err) {
			error = errorMessage(err, 'Failed to load payments. Please try again.');
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
		studentId = '';
		includeInactive = false;
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
		const headers = ['Receipt','Date','Student Name','Student ID','Course','Type','Label','Payment Remarks','Active','Fee Paid','Discount','Total'];
		const rows = payments.map((p) => [
			p.id,
			formatDateShort(p.date),
			p.student?.studentName || 'N/A',
			p.student?.admissionNo,
			p.courseName || 'N/A',
			p.paymentType === 'REGULAR' ? 'Course fee' : 'Additional',
			p.label || '-',
			p.remarks || '-',
			p.isActive ? 'yes' : 'no',
			p.amountPaid,
			p.discountAmount || 0,
			p.amountPaid + (p.discountAmount || 0)
		]);
		const totalRow = ['','','','','','','','','','Total:', payments.reduce((s, p) => s + p.amountPaid, 0), payments.reduce((s, p) => s + (p.discountAmount || 0), 0), totalAmount];
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
				<button class="btn-s btn-secondary-s" onclick={printReport} disabled={payments.length === 0}>
					<Printer size={14} strokeWidth={1.6} /> Print
				</button>
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
							{ value: 'REGULAR', label: 'Course fee' },
							{ value: 'ADDITIONAL', label: 'Additional' }
						]}
						onChange={loadPayments}
						ariaLabel="Type filter"
					/>
				</div>
				<div class="field">
					<label for="studentFilter">Admission #</label>
					<input id="studentFilter" class="input-s" inputmode="numeric" placeholder="Any student" bind:value={studentId} onchange={loadPayments} />
				</div>
				<label class="field" style="flex-direction: row; align-items: center; gap: 6px; font-size: 12.5px; align-self: end;">
					<input type="checkbox" bind:checked={includeInactive} onchange={loadPayments} /> Include deactivated
				</label>
			</div>
			{#if selectedCourse || selectedType || studentId || includeInactive}
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
								<th>Type</th>
								<th>Label</th>
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
										<a href="/students/{p.student?.admissionNo}" target="_blank" rel="noopener noreferrer" class="link-id">{p.id}</a>
									</td>
									<td class="muted" style="white-space: nowrap;">{formatDateShort(p.date)}</td>
									<td>
										<div class="strong">{p.student?.studentName || '—'}</div>
										<a href="/students/{p.student?.admissionNo}" target="_blank" rel="noopener noreferrer" style="color: var(--accent); font-family: var(--font-mono); font-size: 11px;">{p.student?.admissionNo}</a>
									</td>
									<td>{#if p.courseName}<Badge kind="neutral">{p.courseName}</Badge>{:else}<span class="muted">—</span>{/if}</td>
									<td>
										{#if p.paymentType === 'REGULAR'}<Badge kind="info">Course fee</Badge>
										{:else}<Badge kind="accent">Additional</Badge>{/if}
										{#if !p.isActive}<Badge kind="neutral">Deactivated</Badge>{/if}
										{#if p.originalType}<div class="muted" style="font-size: 10.5px;" title="Converted by {p.convertedBy}">converted</div>{/if}
									</td>
									<td class="muted" style="max-width: 180px; white-space: normal; font-size: 11.5px;">{p.label || '—'}</td>
									<td class="muted" style="max-width: 180px; white-space: normal; font-size: 11.5px;">{p.remarks || '—'}</td>
									<td class="num"><Money value={p.amountPaid} /></td>
									<td class="num"><Money value={p.discountAmount || 0} /></td>
									<td class="num strong"><Money value={p.amountPaid + (p.discountAmount || 0)} /></td>
								</tr>
							{/each}
						</tbody>
						<tfoot>
							<tr style="background: var(--bg-elev); font-weight: 600;">
								<td colspan="8" style="text-align: right; padding: 12px 14px;">Total</td>
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

	<!-- Print-only block: rendered only on @media print -->
	<div class="pmt-print">
		<div class="print-header">
			<div>
				<div class="print-brand">Revathi <em>Arts</em> &amp; Music School</div>
				<div class="print-title">Payments report · {formatRangeLabel(startDate, endDate)}</div>
				<div class="print-meta">
					{#if selectedCourse}Course: {selectedCourse}{:else}All courses{/if}
					· {selectedType ? (selectedType === 'REGULAR' ? 'Course fees' : 'Additional') : 'All types'}
					· Generated {todayStr()}
				</div>
			</div>
			<div class="print-totals">
				<div><span class="print-totals-label">Fee cleared</span> ₹{totalFeeCleared.toLocaleString('en-IN')}</div>
				<div><span class="print-totals-label">Collected</span> ₹{totalCollected.toLocaleString('en-IN')}</div>
				<div><span class="print-totals-label">Discount</span> ₹{totalDiscount.toLocaleString('en-IN')}</div>
				<div><span class="print-totals-label">Txns</span> {totalPayments}</div>
			</div>
		</div>

		{#if summaryRows.length > 0}
			<section class="print-section">
				<h3 class="print-section-title">Summary by {GROUP_LABELS[summaryGroupBy].toLowerCase()}</h3>
				<table class="print-tbl">
					<thead>
						<tr>
							<th>{GROUP_LABELS[summaryGroupBy]}</th>
							<th class="num">Count</th>
							<th class="num">Amount</th>
						</tr>
					</thead>
					<tbody>
						{#each summaryRows as r (r.key)}
							<tr>
								<td>{r.label}{#if r.sub} <span style="color:#777">· {r.sub}</span>{/if}</td>
								<td class="num">{r.count}</td>
								<td class="num">₹{r.amount.toLocaleString('en-IN')}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</section>
		{/if}

		<section class="print-section">
			<h3 class="print-section-title">Records ({totalPayments})</h3>
			<table class="print-tbl">
				<thead>
					<tr>
						<th>R.No</th>
						<th>Date</th>
						<th>Student</th>
						<th>Course</th>
						<th>Type</th>
						<th class="num">Paid</th>
						<th class="num">Discount</th>
						<th class="num">Total</th>
					</tr>
				</thead>
				<tbody>
					{#each payments as p}
						<tr>
							<td>{p.id}</td>
							<td>{formatDateShort(p.date)}</td>
							<td>{p.student?.studentName ?? '—'}</td>
							<td>{p.courseName ?? '—'}</td>
							<td>{p.paymentType === 'REGULAR' ? 'Course fee' : 'Additional'}</td>
							<td class="num">₹{p.amountPaid.toLocaleString('en-IN')}</td>
							<td class="num">₹{(p.discountAmount ?? 0).toLocaleString('en-IN')}</td>
							<td class="num">₹{(p.amountPaid + (p.discountAmount ?? 0)).toLocaleString('en-IN')}</td>
						</tr>
					{/each}
					<tr class="print-subtotal">
						<td colspan="6" style="text-align: right;">Total</td>
						<td class="num">₹{totalCollected.toLocaleString('en-IN')}</td>
						<td class="num">₹{totalDiscount.toLocaleString('en-IN')}</td>
						<td class="num">₹{totalAmount.toLocaleString('en-IN')}</td>
					</tr>
				</tbody>
			</table>
		</section>
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

	/* ---------- Print ---------- */
	.pmt-print { display: none; }

	@media print {
		:global(body) :global(*) { visibility: hidden !important; }
		.pmt-print, .pmt-print * { visibility: visible !important; }
		.pmt-print {
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
		.print-totals { font-size: 12px; text-align: right; line-height: 1.6; }
		.print-totals-label {
			display: inline-block;
			min-width: 80px;
			text-transform: uppercase;
			letter-spacing: 0.08em;
			color: #777;
			font-size: 10px;
			margin-right: 6px;
		}
		.print-section { margin-bottom: 18px; page-break-inside: avoid; }
		.print-section-title {
			font-family: var(--font-serif);
			font-size: 15px;
			font-weight: 500;
			margin: 14px 0 6px;
			padding-bottom: 4px;
			border-bottom: 1px solid #e6e6e6;
		}
		.print-tbl { width: 100%; border-collapse: collapse; font-size: 10.5px; }
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
