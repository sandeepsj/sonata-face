<script lang="ts">
	import { page } from '$app/stores';
	import { AlertCircle, Plus, RefreshCw, CreditCard, Ban, Undo2 } from 'lucide-svelte';
	import { api, canAccess, currentStudentStore, errorMessage, toast } from '$lib';
	import type { Due, DuesSummary } from '$lib/api/types';
	import { formatDate, formatDateTime, formatPeriod, isoDate, money, termLabel } from '$lib/utils/format';
	import Money from '$lib/components/Money.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import ErrorCallout from '$lib/components/ErrorCallout.svelte';
	import PaymentModal from './PaymentModal.svelte';
	import AdditionalPaymentModal from './AdditionalPaymentModal.svelte';

	let studentId = $derived(Number($page.params.id));
	let st = $derived($currentStudentStore);
	let student = $derived(st.student);
	let dues = $derived(st.dues);
	let waivers = $derived(st.waivers.data);

	let canPay = $derived($canAccess('/api/payments/**', 'write'));
	let canWaive = $derived($canAccess('/api/dues/**', 'write'));

	let summary: DuesSummary | null = $state(null);

	let paymentOpen = $state(false);
	let additionalOpen = $state(false);
	let payDue: Due | null = $state(null);

	let waiveDue: Due | null = $state(null);
	let waiveReason = $state('');
	let waiving = $state(false);
	let waiveError = $state('');

	let showUpcoming = $state(false);
	let showSettled = $state(true);

	const today = isoDate();

	$effect(() => {
		const id = studentId;
		if (!id) return;
		currentStudentStore.fetchDues(id, true);
		currentStudentStore.fetchSessions(id, true);
		currentStudentStore.fetchWaivers(id, true);
	});

	// re-read the summary whenever the dues list changes
	$effect(() => {
		dues.lastFetched;
		loadSummary();
	});

	async function loadSummary() {
		if (!studentId) return;
		try {
			summary = await api.dues.summary({ studentId });
		} catch {
			summary = null;
		}
	}

	let open = $derived(dues.data.filter((d) => d.status === 'DUE' || d.status === 'PARTIALLY_PAID'));
	let outstanding = $derived(open.filter((d) => d.periodStart <= today));
	let upcoming = $derived(open.filter((d) => d.periodStart > today));
	let settled = $derived(dues.data.filter((d) => !(d.status === 'DUE' || d.status === 'PARTIALLY_PAID')).reverse());
	let outstandingTotal = $derived(outstanding.reduce((s, d) => s + d.balance, 0));

	let sessionById = $derived(new Map(st.sessions.data.map((s) => [s.id, s])));
	function sessionDisjoined(d: Due) {
		const s = sessionById.get(d.sessionId);
		return !!s && s.dateOfDisjoining !== null;
	}

	function refresh() {
		currentStudentStore.fetchDues(studentId, true);
		currentStudentStore.fetchWaivers(studentId, true);
	}

	function pay(d: Due | null) {
		payDue = d;
		paymentOpen = true;
	}

	function openWaive(d: Due) {
		waiveDue = d;
		waiveReason = '';
		waiveError = '';
	}

	async function confirmWaive() {
		if (!waiveDue) return;
		if (!waiveReason.trim()) {
			waiveError = 'Give a reason for the waiver';
			return;
		}
		waiving = true;
		waiveError = '';
		try {
			await api.dues.createWaiver({ sessionId: waiveDue.sessionId, periodStart: waiveDue.periodStart, reason: waiveReason.trim() });
			toast.ok(`Waived ${waiveDue.courseName} · ${formatPeriod(waiveDue.periodStart, waiveDue.periodEnd)}`);
			waiveDue = null;
			await currentStudentStore.refreshAfterWrite(studentId);
		} catch (e) {
			waiveError = errorMessage(e, 'Failed to waive');
		} finally {
			waiving = false;
		}
	}

	async function removeWaiver(id: number) {
		if (!confirm('Remove this waiver? The period goes back to its calculated status.')) return;
		try {
			await api.dues.removeWaiver(id);
			toast.ok('Waiver removed');
			await currentStudentStore.refreshAfterWrite(studentId);
		} catch (e) {
			toast.error(errorMessage(e, 'Failed to remove waiver'));
		}
	}
</script>

<svelte:head>
	<title>Dues — {student?.studentName || 'Student'}</title>
</svelte:head>

<div class="section-row">
	<div>
		<h2 class="section-title-s">Fee <em>dues</em> &amp; payments</h2>
		<div style="color: var(--fg-muted); font-size: 13px;">
			Dues are calculated from {student?.studentName ?? 'the student'}'s sessions and each course's fee timeline.
		</div>
	</div>
	<div style="display: flex; gap: 8px;">
		<button class="btn-s btn-secondary-s btn-sm-s" onclick={refresh} disabled={dues.loading}>
			{#if dues.loading}<span class="spinner"></span>{:else}<RefreshCw size={14} strokeWidth={1.6} />{/if} Refresh
		</button>
		{#if canPay}
			<button class="btn-s btn-secondary-s btn-sm-s" onclick={() => (additionalOpen = true)}><Plus size={14} strokeWidth={1.8} /> Additional payment</button>
			<button class="btn-s btn-primary-s btn-sm-s" onclick={() => pay(null)}><CreditCard size={14} strokeWidth={1.6} /> Record course fee</button>
		{/if}
	</div>
</div>

{#if dues.loading && dues.data.length === 0}
	<div style="display: flex; justify-content: center; padding: 60px 0;"><span class="spinner spinner-lg"></span></div>
{:else if dues.error}
	<div class="callout danger">
		<AlertCircle size={18} strokeWidth={1.6} />
		<div style="flex: 1;">
			<div class="callout-title">Couldn't load dues</div>
			<div class="callout-body">{dues.error}</div>
		</div>
		<button class="btn-s btn-secondary-s btn-sm-s" onclick={refresh}>Retry</button>
	</div>
{:else}
	<div class="kpi-grid" style="margin-bottom: 18px;">
		<div class="kpi">
			<div class="kpi-label">Outstanding now</div>
			<div class="kpi-value" style="color: var(--danger);"><Money value={outstandingTotal} mono={false} /></div>
			<div class="kpi-meta"><span>{outstanding.length} period{outstanding.length !== 1 ? 's' : ''} started</span></div>
		</div>
		<div class="kpi">
			<div class="kpi-label">Total balance</div>
			<div class="kpi-value"><Money value={summary?.balance ?? 0} mono={false} /></div>
			<div class="kpi-meta"><span>incl. {upcoming.length} upcoming this year</span></div>
		</div>
		<div class="kpi">
			<div class="kpi-label">Paid</div>
			<div class="kpi-value" style="color: var(--ok);"><Money value={summary?.paid ?? 0} mono={false} /></div>
			<div class="kpi-meta"><span>+ <Money value={summary?.discount ?? 0} mono={false} /> discounts</span></div>
		</div>
		<div class="kpi">
			<div class="kpi-label">Billed</div>
			<div class="kpi-value"><Money value={summary?.amount ?? 0} mono={false} /></div>
			<div class="kpi-meta">
				{#if (summary?.overpaid ?? 0) > 0}<span style="color: var(--info);">Overpaid <Money value={summary?.overpaid} mono={false} /></span>
				{:else}<span>{summary ? `${summary.counts.PAID ?? 0} paid · ${summary.counts.WAIVED ?? 0} waived` : ''}</span>{/if}
			</div>
		</div>
	</div>

	{#snippet dueTable(rows: Due[], actions: boolean)}
		<table class="tbl">
			<thead>
				<tr>
					<th>Course</th><th>Period</th><th style="text-align:right;">Amount</th><th style="text-align:right;">Paid</th>
					<th style="text-align:right;">Discount</th><th style="text-align:right;">Balance</th><th>Status</th>
					{#if actions}<th style="text-align:right;"></th>{/if}
				</tr>
			</thead>
			<tbody>
				{#each rows as d (d.id)}
					<tr>
						<td class="strong">{d.courseName}</td>
						<td>
							{formatPeriod(d.periodStart, d.periodEnd)}
							<div class="muted" style="font-size: 11px;">{termLabel(d.termNumber, d.termsPerYear)}</div>
						</td>
						<td class="num" style="text-align:right;"><Money value={d.amount} /></td>
						<td class="num" style="text-align:right;"><Money value={d.paidAmount} /></td>
						<td class="num" style="text-align:right;">{#if d.discountAmount > 0}<Money value={d.discountAmount} />{:else}<span class="muted">—</span>{/if}</td>
						<td class="num" style="text-align:right;">
							<Money value={d.balance} danger={d.balance > 0} />
							{#if d.overpaidAmount > 0}<div style="font-size: 11px; color: var(--info);">+{money(d.overpaidAmount)} over</div>{/if}
						</td>
						<td><StatusBadge status={d.status} /></td>
						{#if actions}
							<td style="text-align:right; white-space: nowrap;">
								{#if canWaive && sessionDisjoined(d)}
									<button class="btn-s btn-ghost-s btn-sm-s" onclick={() => openWaive(d)} title="Student left: don't charge this period"><Ban size={13} /> Waive</button>
								{/if}
								{#if canPay}<button class="btn-s btn-primary-s btn-sm-s" onclick={() => pay(d)}>Pay</button>{/if}
							</td>
						{/if}
					</tr>
				{/each}
			</tbody>
		</table>
	{/snippet}

	<div class="card-s" style="margin-bottom: 18px;">
		<div class="card-header"><h3 class="card-title-s">Outstanding ({outstanding.length})</h3></div>
		<div class="card-body-s tight">
			{#if outstanding.length === 0}
				<div class="empty-s" style="padding: 22px;">Nothing outstanding.</div>
			{:else}
				{@render dueTable(outstanding, true)}
			{/if}
		</div>
	</div>

	{#if upcoming.length > 0}
		<div class="card-s" style="margin-bottom: 18px;">
			<div class="card-header" style="display:flex; justify-content: space-between; align-items:center;">
				<h3 class="card-title-s">Upcoming this year ({upcoming.length})</h3>
				<button class="btn-s btn-ghost-s btn-sm-s" onclick={() => (showUpcoming = !showUpcoming)}>{showUpcoming ? 'Hide' : 'Show'}</button>
			</div>
			{#if showUpcoming}<div class="card-body-s tight">{@render dueTable(upcoming, true)}</div>{/if}
		</div>
	{/if}

	{#if settled.length > 0}
		<div class="card-s" style="margin-bottom: 18px;">
			<div class="card-header" style="display:flex; justify-content: space-between; align-items:center;">
				<h3 class="card-title-s">Settled ({settled.length})</h3>
				<button class="btn-s btn-ghost-s btn-sm-s" onclick={() => (showSettled = !showSettled)}>{showSettled ? 'Hide' : 'Show'}</button>
			</div>
			{#if showSettled}<div class="card-body-s tight">{@render dueTable(settled, false)}</div>{/if}
		</div>
	{/if}

	{#if waivers.length > 0}
		<div class="card-s" style="margin-bottom: 18px;">
			<div class="card-header"><h3 class="card-title-s">Waivers ({waivers.length})</h3></div>
			<div class="card-body-s tight">
				<table class="tbl">
					<thead><tr><th>Course</th><th>Period from</th><th>Reason</th><th>By</th><th></th></tr></thead>
					<tbody>
						{#each waivers as w (w.id)}
							<tr>
								<td>{sessionById.get(w.sessionId)?.course.name ?? `Session ${w.sessionId}`}</td>
								<td>{formatDate(w.periodStart)}</td>
								<td>{w.reason}</td>
								<td class="muted" style="font-size: 12px;">{w.createdBy}<br />{formatDateTime(w.createdAt)}</td>
								<td style="text-align:right;">
									{#if canWaive}<button class="btn-s btn-ghost-s btn-sm-s" onclick={() => removeWaiver(w.id)}><Undo2 size={13} /> Remove</button>{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/if}

	{#if dues.data.length === 0}
		<div class="callout info"><div class="callout-body">No dues yet. Dues appear once the student is enrolled in a course that has a fee timeline.</div></div>
	{/if}
{/if}

<PaymentModal open={paymentOpen} {studentId} due={payDue} onClose={() => (paymentOpen = false)} />
<AdditionalPaymentModal open={additionalOpen} {studentId} studentName={student?.studentName} onClose={() => (additionalOpen = false)} />

<Modal open={waiveDue !== null} title="Waive this period" subtitle={waiveDue ? `${waiveDue.courseName} · ${formatPeriod(waiveDue.periodStart, waiveDue.periodEnd)}` : ''} busy={waiving} onClose={() => (waiveDue = null)}>
	<div style="display:flex; flex-direction:column; gap: 12px;">
		<div class="callout info"><div class="callout-body">The student has left this course. A waived period isn't charged (balance 0). You can remove the waiver later.</div></div>
		<div class="field">
			<label for="waive-reason">Reason *</label>
			<input id="waive-reason" class="input-s" bind:value={waiveReason} placeholder="e.g. Left mid-term" disabled={waiving} />
		</div>
		<ErrorCallout message={waiveError} />
	</div>
	{#snippet footer()}
		<button class="btn-s btn-secondary-s" onclick={() => (waiveDue = null)} disabled={waiving}>Cancel</button>
		<button class="btn-s btn-danger-s" onclick={confirmWaive} disabled={waiving}>{#if waiving}<span class="spinner"></span>{/if}Waive period</button>
	{/snippet}
</Modal>
