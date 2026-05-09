<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import {
		AlertCircle,
		CheckCircle,
		Plus,
		Calendar,
		Clock,
		Book,
		XCircle,
		AlertTriangle,
		RefreshCw,
		CreditCard
	} from 'lucide-svelte';
	import {
		currentStudentStore,
		FeeDuesService,
		type FeeDuesTrackerDTO,
		DuesStatus
	} from '$lib';
	import Badge from '$lib/components/Badge.svelte';
	import Money from '$lib/components/Money.svelte';
	import PaymentModal from './PaymentModal.svelte';
	import AdditionalPaymentModal from './AdditionalPaymentModal.svelte';

	$: studentId = Number($page.params.id);
	$: currentStudentState = $currentStudentStore;
	$: student = currentStudentState.student;
	$: dues = currentStudentState.dues;

	let paymentModalOpen = false;
	let additionalPaymentModalOpen = false;
	let selectedDue: FeeDuesTrackerDTO | null = null;

	let cancellingDueId: number | null = null;
	let showCancelConfirmModal = false;
	let dueToCancel: FeeDuesTrackerDTO | null = null;

	onMount(async () => {
		if (studentId) {
			await Promise.all([
				currentStudentStore.fetchDues(studentId, true),
				currentStudentStore.fetchSessions(studentId, true)
			]);
		}
	});

	async function refreshDues() {
		if (studentId) await currentStudentStore.fetchDues(studentId, true);
	}

	$: pendingDues = dues.data.filter(
		(d) =>
			d.status === DuesStatus.DUE ||
			d.status === DuesStatus.OVERDUE ||
			d.status === DuesStatus.PARTIALLY_PAID
	);
	$: paidDues = dues.data.filter((d) => d.status === DuesStatus.PAID);
	$: partiallyPaidDues = dues.data.filter(
		(d) => d.status === DuesStatus.PARTIALLY_PAID || d.status === DuesStatus.PARTIAL
	);
	$: cancelledDues = dues.data.filter((d) => d.status === DuesStatus.STUDENT_LEFT_DUE_CANCELLED);

	$: currentAndPastDues = pendingDues.filter((d) => !isFutureDue(d));
	$: futureDues = pendingDues.filter((d) => isFutureDue(d));
	$: totalDueAmount = currentAndPastDues.reduce(
		(sum, d) => sum + (d.dueAmount || d.amountDue || 0),
		0
	);

	function formatDate(d: string | undefined): string {
		if (!d) return '—';
		try {
			return new Date(d).toLocaleDateString('en-IN', {
				year: 'numeric',
				month: 'short',
				day: 'numeric'
			});
		} catch {
			return d;
		}
	}

	function getCurrentTerm(termsPerYear: number): { year: number; term: number } {
		const cur = new Date();
		const monthsPerTerm = 12 / termsPerYear;
		const term = Math.ceil((cur.getMonth() + 1) / monthsPerTerm);
		return { year: cur.getFullYear(), term: Math.min(term, termsPerYear) };
	}

	function isFutureDue(due: FeeDuesTrackerDTO): boolean {
		const c = getCurrentTerm(4);
		if (due.termYear > c.year) return true;
		if (due.termYear === c.year && due.termNumber > c.term) return true;
		return false;
	}

	function isOverdue(due: FeeDuesTrackerDTO): boolean {
		if (isFutureDue(due)) return false;
		const c = getCurrentTerm(4);
		if (due.termYear < c.year) return true;
		if (due.termYear === c.year) return due.termNumber < c.term;
		return false;
	}

	function handlePayDue(due: FeeDuesTrackerDTO) {
		selectedDue = due;
		paymentModalOpen = true;
	}
	function handleAdditionalPayment() {
		additionalPaymentModalOpen = true;
	}
	async function handlePaymentModalClose() {
		paymentModalOpen = false;
		selectedDue = null;
		if (studentId) await currentStudentStore.fetchDues(studentId, true);
	}
	async function handleAdditionalPaymentModalClose() {
		additionalPaymentModalOpen = false;
		if (studentId) await currentStudentStore.fetchDues(studentId, true);
	}

	function canCancelDue(d: FeeDuesTrackerDTO): boolean {
		if (
			d.status !== DuesStatus.DUE &&
			d.status !== DuesStatus.PARTIALLY_PAID &&
			d.status !== DuesStatus.PARTIAL
		)
			return false;
		return !currentStudentStore.isSessionActive(d.sessionId);
	}

	function handleCancelDue(due: FeeDuesTrackerDTO) {
		dueToCancel = due;
		showCancelConfirmModal = true;
	}
	function closeCancelConfirmModal() {
		showCancelConfirmModal = false;
		dueToCancel = null;
		cancellingDueId = null;
	}
	async function confirmCancelDue() {
		if (!dueToCancel) return;
		try {
			cancellingDueId = dueToCancel.id;
			await FeeDuesService.markDueAsStudentLeftCancelled(dueToCancel.id);
			if (studentId) await currentStudentStore.fetchDues(studentId, true);
			closeCancelConfirmModal();
		} catch (error) {
			alert(error instanceof Error ? error.message : 'Failed to cancel due. Please try again.');
			cancellingDueId = null;
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
			{#if student}Manage dues for {student.studentName}.{/if}
		</div>
	</div>
	<div style="display: flex; gap: 8px;">
		<button class="btn-s btn-secondary-s btn-sm-s" on:click={refreshDues} disabled={dues.loading}>
			{#if dues.loading}<span class="spinner"></span>{:else}<RefreshCw size={14} strokeWidth={1.6} />{/if}
			Refresh
		</button>
		<button class="btn-s btn-primary-s btn-sm-s" on:click={handleAdditionalPayment}>
			<Plus size={14} strokeWidth={1.8} /> Add payment
		</button>
	</div>
</div>

{#if dues.loading}
	<div style="display: flex; justify-content: center; padding: 60px 0; color: var(--fg-muted);">
		<span class="spinner spinner-lg"></span>
	</div>
{:else if dues.error}
	<div class="callout danger">
		<AlertCircle size={18} strokeWidth={1.6} />
		<div style="flex: 1;">
			<div class="callout-title">Couldn't load dues</div>
			<div class="callout-body">{dues.error}</div>
		</div>
		<button class="btn-s btn-secondary-s btn-sm-s" on:click={refreshDues}>Retry</button>
	</div>
{:else}
	<div class="kpi-grid" style="margin-bottom: 18px;">
		<div class="kpi">
			<div class="kpi-label">Current due</div>
			<div class="kpi-value" style="color: var(--danger);">
				<Money value={totalDueAmount} mono={false} />
			</div>
			<div class="kpi-meta">
				<span>{currentAndPastDues.length} pending{partiallyPaidDues.length > 0 ? ` · ${partiallyPaidDues.length} partial` : ''}</span>
				{#if futureDues.length > 0}<span class="muted">+{futureDues.length} future</span>{/if}
			</div>
		</div>
		<div class="kpi">
			<div class="kpi-label">Paid dues</div>
			<div class="kpi-value" style="color: var(--ok);">{paidDues.length}</div>
			<div class="kpi-meta"><span>Successfully cleared</span></div>
		</div>
		<div class="kpi">
			<div class="kpi-label">Cancelled</div>
			<div class="kpi-value">{cancelledDues.length}</div>
			<div class="kpi-meta"><span>Student left course</span></div>
		</div>
		<div class="kpi">
			<div class="kpi-label">Overdue</div>
			<div class="kpi-value" style="color: var(--warn);">
				{currentAndPastDues.filter((d) => isOverdue(d)).length}
			</div>
			<div class="kpi-meta"><span>Past due date</span></div>
		</div>
	</div>

	{#if currentAndPastDues.length > 0}
		<div class="card-s" style="margin-bottom: 18px;">
			<div class="card-header">
				<h3 class="card-title-s" style="display: flex; align-items: center; gap: 8px;">
					<AlertCircle size={16} strokeWidth={1.6} style="color: var(--warn);" />
					Current &amp; pending ({currentAndPastDues.length})
				</h3>
			</div>
			<div class="card-body-s tight">
				<table class="tbl">
					<thead>
						<tr>
							<th>Course</th>
							<th>Term</th>
							<th>Amount due</th>
							<th>Created</th>
							<th>Status</th>
							<th style="text-align: right;">Actions</th>
						</tr>
					</thead>
					<tbody>
						{#each currentAndPastDues as due}
							<tr>
								<td>
									<div style="display: flex; align-items: center; gap: 8px;">
										<Book size={14} strokeWidth={1.6} style="color: var(--accent);" />
										<span class="strong">{due.courseName}</span>
									</div>
								</td>
								<td>
									<div style="line-height: 1.3;">
										<div>Year {due.termYear}</div>
										<div class="muted" style="font-size: 11px;">Term {due.termNumber}</div>
									</div>
								</td>
								<td class="num strong" style:color={due.status === DuesStatus.PARTIALLY_PAID || due.status === DuesStatus.PARTIAL ? 'var(--info)' : undefined}>
									<Money value={due.dueAmount} />
									{#if due.status === DuesStatus.PARTIALLY_PAID || due.status === DuesStatus.PARTIAL}
										<div class="muted" style="font-size: 10px; text-align: right;">Remaining</div>
									{/if}
								</td>
								<td class="muted" style:color={isOverdue(due) ? 'var(--danger)' : undefined}>
									<div style="display: inline-flex; align-items: center; gap: 4px;">
										<Calendar size={12} strokeWidth={1.6} />
										{formatDate(due.createdAt)}
									</div>
								</td>
								<td>
									{#if due.status === DuesStatus.PAID}
										<Badge kind="ok">Paid</Badge>
									{:else if due.status === DuesStatus.PARTIALLY_PAID || due.status === DuesStatus.PARTIAL}
										<Badge kind="warn">Partial</Badge>
									{:else}
										<Badge kind="danger">{due.status}</Badge>
									{/if}
									{#if isOverdue(due)}
										<div style="margin-top: 4px;"><Badge kind="danger">Overdue</Badge></div>
									{/if}
								</td>
								<td style="text-align: right;">
									<div style="display: inline-flex; gap: 6px;">
										<button class="btn-s btn-primary-s btn-sm-s" on:click={() => handlePayDue(due)}>
											<CreditCard size={12} strokeWidth={1.8} />
											{due.status === DuesStatus.PARTIALLY_PAID || due.status === DuesStatus.PARTIAL ? 'Pay remaining' : 'Pay now'}
										</button>
										{#if canCancelDue(due)}
											<button class="btn-s btn-secondary-s btn-sm-s" style="color: var(--danger); border-color: var(--danger-soft);" on:click={() => handleCancelDue(due)} disabled={cancellingDueId === due.id} title="Mark as cancelled">
												{#if cancellingDueId === due.id}<span class="spinner"></span>{:else}<XCircle size={12} strokeWidth={1.8} />{/if}
											</button>
										{/if}
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/if}

	{#if futureDues.length > 0}
		<div class="card-s" style="margin-bottom: 18px; opacity: 0.85;">
			<div class="card-header">
				<h3 class="card-title-s" style="display: flex; align-items: center; gap: 8px; color: var(--fg-soft);">
					<Clock size={16} strokeWidth={1.6} />
					Upcoming ({futureDues.length})
					<Badge kind="neutral">Future terms</Badge>
				</h3>
			</div>
			<div class="card-body-s tight">
				<table class="tbl">
					<thead>
						<tr>
							<th>Course</th>
							<th>Term</th>
							<th>Amount</th>
							<th>Created</th>
							<th>Status</th>
							<th style="text-align: right;">Actions</th>
						</tr>
					</thead>
					<tbody>
						{#each futureDues as due}
							<tr>
								<td>
									<div style="display: flex; align-items: center; gap: 8px;">
										<Book size={14} strokeWidth={1.6} style="color: var(--fg-muted);" />
										<span>{due.courseName}</span>
									</div>
								</td>
								<td><div>Year {due.termYear} · <span class="muted">Term {due.termNumber}</span></div></td>
								<td class="num"><Money value={due.dueAmount} /></td>
								<td class="muted">{formatDate(due.createdAt)}</td>
								<td><Badge kind="neutral">{due.status === DuesStatus.PARTIALLY_PAID ? 'Partial' : due.status}</Badge></td>
								<td style="text-align: right;">
									<button class="btn-s btn-secondary-s btn-sm-s" on:click={() => handlePayDue(due)}>
										<CreditCard size={12} strokeWidth={1.8} />
										{due.status === DuesStatus.PARTIALLY_PAID || due.status === DuesStatus.PARTIAL ? 'Pay remaining' : 'Pay advance'}
									</button>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/if}

	{#if currentAndPastDues.length === 0 && futureDues.length === 0}
		<div class="card-s" style="margin-bottom: 18px;">
			<div class="card-body-s">
				<div class="empty-s">
					<div class="glyph">✓</div>
					<div style="font-family: var(--font-serif); font-size: 18px; color: var(--fg); margin-top: 6px;">
						All <em style="color: var(--accent); font-style: italic;">dues cleared</em>
					</div>
					<div style="margin-top: 4px;">
						{student?.studentName || 'This student'} has no pending dues.
					</div>
					<div style="margin-top: 14px;">
						<button class="btn-s btn-primary-s" on:click={handleAdditionalPayment}>
							<Plus size={14} strokeWidth={1.8} /> Make additional payment
						</button>
					</div>
				</div>
			</div>
		</div>
	{/if}

	{#if paidDues.length > 0}
		<div class="card-s" style="margin-bottom: 18px;">
			<div class="card-header">
				<h3 class="card-title-s" style="display: flex; align-items: center; gap: 8px;">
					<CheckCircle size={16} strokeWidth={1.6} style="color: var(--ok);" />
					Recent payments ({paidDues.length})
				</h3>
			</div>
			<div class="card-body-s tight">
				<table class="tbl">
					<thead>
						<tr>
							<th>Course</th>
							<th>Term</th>
							<th>Payment date</th>
							<th>Status</th>
						</tr>
					</thead>
					<tbody>
						{#each paidDues.slice(0, 5) as due}
							<tr>
								<td><div style="display: flex; align-items: center; gap: 8px;"><Book size={14} strokeWidth={1.6} style="color: var(--accent);" /><span class="strong">{due.courseName}</span></div></td>
								<td>Year {due.termYear} · <span class="muted">Term {due.termNumber}</span></td>
								<td class="muted">{formatDate(due.updatedAt)}</td>
								<td><Badge kind="ok">Paid</Badge></td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			{#if paidDues.length > 5}
				<div style="padding: 12px 16px; border-top: 1px solid var(--border); font-size: 12px; color: var(--fg-muted); text-align: center;">
					Showing 5 of {paidDues.length} paid dues
				</div>
			{/if}
		</div>
	{/if}

	{#if cancelledDues.length > 0}
		<div class="card-s" style="margin-bottom: 18px;">
			<div class="card-header">
				<h3 class="card-title-s" style="display: flex; align-items: center; gap: 8px;">
					<XCircle size={16} strokeWidth={1.6} style="color: var(--fg-muted);" />
					Cancelled ({cancelledDues.length})
					<Badge kind="neutral">Student left course</Badge>
				</h3>
			</div>
			<div class="card-body-s tight">
				<table class="tbl">
					<thead>
						<tr>
							<th>Course</th>
							<th>Term</th>
							<th>Amount</th>
							<th>Cancelled</th>
							<th>Status</th>
						</tr>
					</thead>
					<tbody>
						{#each cancelledDues as due}
							<tr style="opacity: 0.75;">
								<td>{due.courseName}</td>
								<td>Year {due.termYear} · <span class="muted">Term {due.termNumber}</span></td>
								<td class="num"><Money value={due.dueAmount || due.amountDue || 0} /></td>
								<td class="muted">{formatDate(due.updatedAt)}</td>
								<td><Badge kind="neutral">Cancelled</Badge></td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<div class="callout info" style="margin: 16px;">
				<AlertCircle size={16} strokeWidth={1.6} />
				<div class="callout-body">
					These dues were cancelled because the student left the course. No payment is required.
				</div>
			</div>
		</div>
	{/if}
{/if}

<PaymentModal bind:isOpen={paymentModalOpen} {studentId} due={selectedDue} on:close={handlePaymentModalClose} />
<AdditionalPaymentModal bind:isOpen={additionalPaymentModalOpen} {studentId} studentName={student?.studentName || ''} on:close={handleAdditionalPaymentModalClose} />

{#if showCancelConfirmModal && dueToCancel}
	<div class="modal-veil" on:click={closeCancelConfirmModal} on:keydown={(e) => e.key === 'Escape' && closeCancelConfirmModal()} role="presentation">
		<div class="modal-s" role="dialog" aria-modal="true" on:click|stopPropagation on:keydown|stopPropagation>
			<div class="modal-head">
				<div>
					<h3 class="modal-title-s">Cancel <em style="color: var(--danger); font-style: italic;">due</em>?</h3>
					<div class="modal-sub">This action cannot be undone.</div>
				</div>
				<button class="btn-s btn-ghost-s btn-icon-s" on:click={closeCancelConfirmModal} aria-label="Close"><XCircle size={16} strokeWidth={1.6} /></button>
			</div>
			<div class="modal-body-s">
				<div class="card-s" style="background: var(--bg-elev); margin-bottom: 14px;">
					<div class="card-body-s">
						<div style="display: flex; flex-direction: column; gap: 10px;">
							<div style="display: flex; justify-content: space-between;">
								<span class="muted">Course</span>
								<span class="strong">{dueToCancel.courseName}</span>
							</div>
							<div style="display: flex; justify-content: space-between;">
								<span class="muted">Term</span>
								<span class="strong">Year {dueToCancel.termYear} · Term {dueToCancel.termNumber}</span>
							</div>
							<div style="display: flex; justify-content: space-between;">
								<span class="muted">Amount</span>
								<span class="strong" style="color: var(--danger);"><Money value={dueToCancel.dueAmount || dueToCancel.amountDue || 0} /></span>
							</div>
						</div>
					</div>
				</div>
				<div class="callout">
					<AlertTriangle size={18} strokeWidth={1.6} />
					<div>
						<div class="callout-title">Reason: student left course</div>
						<div class="callout-body">Inactive session detected for this enrolment.</div>
					</div>
				</div>
			</div>
			<div class="modal-foot">
				<button class="btn-s btn-secondary-s" on:click={closeCancelConfirmModal} disabled={cancellingDueId !== null}>Keep due</button>
				<button class="btn-s btn-danger-s" on:click={confirmCancelDue} disabled={cancellingDueId !== null}>
					{#if cancellingDueId !== null}<span class="spinner"></span>{:else}<XCircle size={14} strokeWidth={1.8} />{/if}
					Yes, cancel due
				</button>
			</div>
		</div>
	</div>
{/if}
