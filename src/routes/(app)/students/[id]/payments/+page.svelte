<script lang="ts">
	import { onMount } from 'svelte';
	import type { Student } from '$lib';
	import { currentStudentStore } from '$lib';
	import { formatDate, formatDateTime } from '$lib/utils/format';
	import { amountCleared as calculateAmountCleared, conversionNote, paymentPeriodLabel } from '$lib/utils/payments';
	import {
		AlertCircle,
		Calendar,
		ChevronDown,
		ChevronRight,
		Tag,
		FileText,
		BookOpen
	} from 'lucide-svelte';
	import Badge from '$lib/components/Badge.svelte';
	import Money from '$lib/components/Money.svelte';

	export let student: Student | undefined = undefined;

	$: currentStudentState = $currentStudentStore;
	$: currentStudent = student || currentStudentState.student;
	$: payments = currentStudentState.payments.data;
	$: loading = currentStudentState.payments.loading;
	$: error = currentStudentState.payments.error;
	$: dues = currentStudentState.dues.data;

	let expandedPaymentIds = new Set<number>();
	let showInactive = false;
	let selectedPaymentType: string = 'ALL';

	$: filteredPayments = payments.filter((p) => {
		if (!showInactive && !p.isActive) return false;
		if (selectedPaymentType !== 'ALL' && p.paymentType !== selectedPaymentType) return false;
		return true;
	});

	$: totalPayments = filteredPayments.length;
	$: totalAmountPaid = filteredPayments.reduce((s, p) => s + p.amountPaid, 0);
	$: totalDiscounts = filteredPayments.reduce((s, p) => s + (p.discountAmount || 0), 0);
	$: totalAmountCleared = filteredPayments.reduce((s, p) => s + calculateAmountCleared(p), 0);

	onMount(async () => {
		const sd = currentStudent;
		if (!sd?.admissionNo) return;
		await currentStudentStore.fetchDues(sd.admissionNo, true);
		await currentStudentStore.fetchPayments(sd.admissionNo, true);
	});

	async function fetchPaymentHistory() {
		const s = $currentStudentStore.student;
		if (s?.admissionNo) await currentStudentStore.fetchPayments(s.admissionNo, true);
	}

	function toggle(id: number) {
		if (expandedPaymentIds.has(id)) expandedPaymentIds.delete(id);
		else expandedPaymentIds.add(id);
		expandedPaymentIds = expandedPaymentIds;
	}

</script>

<div class="section-row">
	<div>
		<h2 class="section-title-s">Payment <em>history</em></h2>
		{#if currentStudent}<div style="color: var(--fg-muted); font-size: 13px;">All payments for {currentStudent.studentName}.</div>{/if}
	</div>
</div>

<div class="kpi-grid" style="margin-bottom: 18px;">
	<div class="kpi">
		<div class="kpi-label">Total payments</div>
		<div class="kpi-value">{totalPayments}</div>
	</div>
	<div class="kpi">
		<div class="kpi-label">Amount paid</div>
		<div class="kpi-value" style="color: var(--ok);"><Money value={totalAmountPaid} mono={false} /></div>
	</div>
	<div class="kpi">
		<div class="kpi-label">Total discounts</div>
		<div class="kpi-value" style="color: var(--warn);"><Money value={totalDiscounts} mono={false} /></div>
	</div>
	<div class="kpi">
		<div class="kpi-label">Amount cleared</div>
		<div class="kpi-value" style="color: var(--info);"><Money value={totalAmountCleared} mono={false} /></div>
	</div>
</div>

<div class="card-s" style="margin-bottom: 18px;">
	<div class="card-body-s" style="display: flex; gap: 16px; flex-wrap: wrap; align-items: center;">
		<label style="display: inline-flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer;">
			<input type="checkbox" bind:checked={showInactive} />
			Show inactive payments
		</label>
		<div class="field" style="min-width: 200px;">
			<label for="payment-type-filter">Payment type</label>
			<select id="payment-type-filter" class="select-s" bind:value={selectedPaymentType}>
				<option value="ALL">All types</option>
				<option value="REGULAR">Course fees</option>
				<option value="ADDITIONAL">Additional payments</option>
			</select>
		</div>
	</div>
</div>

{#if loading}
	<div style="display: flex; justify-content: center; padding: 60px 0; color: var(--fg-muted);"><span class="spinner spinner-lg"></span></div>
{:else if error}
	<div class="callout danger">
		<AlertCircle size={18} strokeWidth={1.6} />
		<div style="flex: 1;">
			<div class="callout-title">Couldn't load payments</div>
			<div class="callout-body">{error}</div>
		</div>
		<button class="btn-s btn-secondary-s btn-sm-s" on:click={fetchPaymentHistory}>Retry</button>
	</div>
{:else if filteredPayments.length === 0}
	<div class="card-s">
		<div class="card-body-s">
			<div class="empty-s">
				<div class="glyph">∅</div>
				<div style="font-family: var(--font-serif); font-size: 18px; color: var(--fg); margin-top: 6px;">No payment records</div>
				<div style="margin-top: 4px;">{showInactive ? 'No payments match the filters.' : 'Try including inactive payments.'}</div>
			</div>
		</div>
	</div>
{:else}
	<div style="display: flex; flex-direction: column; gap: 12px;">
		{#each filteredPayments as payment (payment.id)}
			{@const isExpanded = expandedPaymentIds.has(payment.id)}
			{@const amountCleared = calculateAmountCleared(payment)}
			{@const totalDiscount = payment.discountAmount || 0}
			{@const hasDiscounts = payment.discounts && payment.discounts.length > 0}

			<div class="card-s" style="border-left: 4px solid {payment.isActive ? 'var(--ok)' : 'var(--border-strong)'};">
				<div class="card-body-s">
					<div style="display: flex; justify-content: space-between; gap: 14px; flex-wrap: wrap;">
						<div style="flex: 1; min-width: 240px;">
							<div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px; flex-wrap: wrap;">
								<h3 style="font-family: var(--font-serif); font-weight: 500; font-size: 17px; margin: 0;">
									{payment.label || `Payment #${payment.id}`}
								</h3>
								{#if payment.paymentType === 'REGULAR'}<Badge kind="info">Course fee</Badge>
								{:else}<Badge kind="accent">Additional</Badge>{/if}
								{#if !payment.isActive}<Badge kind="neutral">Inactive</Badge>{/if}
							</div>
							{#if payment.courseName}
								<div style="font-size: 13px; color: var(--fg-soft); display: flex; align-items: center; gap: 6px; margin-bottom: 2px;">
									<BookOpen size={13} strokeWidth={1.6} style="color: var(--fg-muted);" />
									<span style="color: var(--fg-muted);">Course:</span>
									<span class="strong">{payment.courseName}</span>
								</div>
							{/if}
							{#if payment.periodDate}
								<div style="font-size: 12.5px; color: var(--fg-muted);">Period: {paymentPeriodLabel(payment, dues)}</div>
							{/if}
							{#if conversionNote(payment)}
								<div style="font-size: 12px; color: var(--fg-muted);">{conversionNote(payment)}</div>
							{/if}
						</div>

						<div style="text-align: right;">
							<div style="display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--fg-muted);">
								<Calendar size={13} strokeWidth={1.6} /> {formatDate(payment.date)}
							</div>
							<div style="font-size: 11px; color: var(--fg-muted); margin-top: 2px;">Created: {formatDateTime(payment.createdAt)}</div>
						</div>
					</div>

					<div class="grid-3" style="margin-top: 14px;">
						<div style="background: var(--ok-soft); padding: 10px 12px; border-radius: 8px;">
							<div class="kpi-label" style="margin-bottom: 4px;">Amount paid</div>
							<div style="font-family: var(--font-serif); font-size: 20px; color: var(--ok);"><Money value={payment.amountPaid} mono={false} /></div>
						</div>
						{#if totalDiscount > 0}
							<div style="background: var(--warn-soft); padding: 10px 12px; border-radius: 8px;">
								<div class="kpi-label" style="margin-bottom: 4px;">Discount</div>
								<div style="font-family: var(--font-serif); font-size: 20px; color: var(--warn);"><Money value={totalDiscount} mono={false} /></div>
							</div>
						{/if}
						<div style="background: var(--info-soft); padding: 10px 12px; border-radius: 8px;">
							<div class="kpi-label" style="margin-bottom: 4px;">Cleared</div>
							<div style="font-family: var(--font-serif); font-size: 20px; color: var(--info);"><Money value={amountCleared} mono={false} /></div>
						</div>
					</div>

					{#if payment.remarks}
						<div style="margin-top: 12px; display: flex; gap: 8px; align-items: flex-start; font-size: 13px; color: var(--fg-soft);">
							<FileText size={14} strokeWidth={1.6} style="color: var(--fg-muted); margin-top: 2px;" />
							<div><span class="muted">Remarks:</span> {payment.remarks}</div>
						</div>
					{/if}

					{#if hasDiscounts}
						<div style="margin-top: 12px;">
							<button class="btn-s btn-ghost-s btn-sm-s" on:click={() => toggle(payment.id)}>
								{#if isExpanded}<ChevronDown size={14} strokeWidth={1.6} />{:else}<ChevronRight size={14} strokeWidth={1.6} />{/if}
								<Tag size={14} strokeWidth={1.6} /> Discount details ({payment.discounts.length})
							</button>
							{#if isExpanded}
								<div style="margin-top: 10px; background: var(--bg-elev); border-radius: 8px; padding: 10px;">
									<table class="tbl" style="font-size: 12.5px;">
										<thead>
											<tr>
												<th>Label</th>
												<th>Amount</th>
												<th>Remarks</th>
											</tr>
										</thead>
										<tbody>
											{#each payment.discounts as discount}
												<tr>
													<td>{discount.label || 'Discount'}</td>
													<td class="num strong" style="color: var(--warn);"><Money value={discount.discountAmount} /></td>
													<td class="muted">{discount.remarks || '—'}</td>
												</tr>
											{/each}
											<tr style="border-top: 1px solid var(--border);">
												<td class="strong">Total</td>
												<td class="num strong" style="color: var(--warn);"><Money value={totalDiscount} /></td>
												<td></td>
											</tr>
										</tbody>
									</table>
								</div>
							{/if}
						</div>
					{/if}
				</div>
			</div>
		{/each}
	</div>
{/if}
