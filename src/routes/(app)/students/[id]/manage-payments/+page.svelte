<script lang="ts">
	import { onMount } from 'svelte';
	import { currentStudentStore } from '$lib/stores/currentStudentStore';
	import { PaymentService } from '$lib/api/paymentService';
	import type { Student, Payment } from '$lib';
	import { Trash2, AlertTriangle, AlertCircle, X } from 'lucide-svelte';
	import Badge from '$lib/components/Badge.svelte';
	import Money from '$lib/components/Money.svelte';

	export let student: Student;

	let error: string | null = null;
	let showConfirmDialog = false;
	let selectedPayment: Payment | null = null;
	let deactivating = false;

	$: currentStudent = student || $currentStudentStore.student;
	$: studentId = currentStudent?.admissionNo;
	$: activePayments = $currentStudentStore.payments.data.filter((p) => p.isActive);
	$: dues = $currentStudentStore.dues.data;

	onMount(async () => {
		if (studentId) {
			await Promise.all([
				currentStudentStore.fetchPayments(studentId, true),
				currentStudentStore.fetchDues(studentId, true)
			]);
		}
	});

	function openConfirmDialog(p: Payment) {
		selectedPayment = p;
		showConfirmDialog = true;
	}
	function closeConfirmDialog() {
		showConfirmDialog = false;
		selectedPayment = null;
	}

	async function handleDeactivatePayment() {
		if (!selectedPayment || !studentId) return;
		deactivating = true;
		error = null;
		try {
			await PaymentService.deactivatePayment(selectedPayment.id);
			await Promise.all([
				currentStudentStore.fetchPayments(studentId, true),
				currentStudentStore.fetchDues(studentId, true)
			]);
			closeConfirmDialog();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to deactivate payment';
		} finally {
			deactivating = false;
		}
	}

	function getPaymentDetails(p: Payment) {
		if (p.feeStructure) {
			const m = dues.find((d) => d.feeStructureId === p.feeStructure?.id);
			if (m) return { termYear: m.termYear, termNumber: m.termNumber, courseName: m.courseName || p.courseName };
		}
		return { termYear: null, termNumber: null, courseName: p.courseName };
	}

	function formatDate(s: string): string {
		try { return new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
		catch { return s; }
	}
</script>

<div class="section-row">
	<div>
		<h2 class="section-title-s">Manage <em>payments</em></h2>
		<div style="color: var(--fg-muted); font-size: 13px;">Deactivate payment records that were created in error.</div>
	</div>
</div>

<div class="callout" style="margin-bottom: 18px;">
	<AlertTriangle size={18} strokeWidth={1.6} />
	<div>
		<div class="callout-title">This action is permanent</div>
		<div class="callout-body">Deactivating a regular payment will trigger dues recalculation.</div>
	</div>
</div>

{#if error}
	<div class="callout danger" style="margin-bottom: 18px;">
		<AlertCircle size={18} strokeWidth={1.6} />
		<div class="callout-body">{error}</div>
	</div>
{/if}

{#if $currentStudentStore.payments.loading}
	<div style="display: flex; justify-content: center; padding: 60px 0; color: var(--fg-muted);"><span class="spinner spinner-lg"></span></div>
{:else if activePayments.length === 0}
	<div class="card-s">
		<div class="card-body-s">
			<div class="empty-s">
				<div class="glyph">∅</div>
				<div style="font-family: var(--font-serif); font-size: 18px; color: var(--fg); margin-top: 6px;">No active payments</div>
				<div style="margin-top: 4px;">There are no active payment records for this student.</div>
			</div>
		</div>
	</div>
{:else}
	<div class="tbl-wrap">
		<div style="padding: 14px 16px; border-bottom: 1px solid var(--border); background: var(--bg-elev);">
			<h3 class="card-title-s">Active payments ({activePayments.length})</h3>
		</div>
		<div style="overflow-x: auto;">
			<table class="tbl">
				<thead>
					<tr>
						<th>Date</th>
						<th>Label</th>
						<th>Type</th>
						<th>Course</th>
						<th>Year / Term</th>
						<th>Remarks</th>
						<th style="text-align: right;">Paid</th>
						<th style="text-align: right;">Discount</th>
						<th style="text-align: right;">Total</th>
						<th style="text-align: center;">Action</th>
					</tr>
				</thead>
				<tbody>
					{#each activePayments as payment}
						{@const details = getPaymentDetails(payment)}
						<tr>
							<td><div class="strong">{formatDate(payment.date)}</div></td>
							<td>{payment.label || '—'}</td>
							<td>
								{#if payment.paymentType === 'REGULAR'}<Badge kind="info">Regular</Badge>
								{:else if payment.paymentType === 'ADDITIONAL'}<Badge kind="accent">Additional</Badge>
								{:else}<Badge kind="neutral">{payment.paymentType}</Badge>{/if}
							</td>
							<td>{details.courseName || '—'}</td>
							<td>
								{#if details.termYear && details.termNumber}
									<div>Year {details.termYear} · <span class="muted">Term {details.termNumber}</span></div>
								{:else if payment.feeStructure?.termName}
									<div>{payment.feeStructure.termName}</div>
								{:else}
									<span class="muted">—</span>
								{/if}
							</td>
							<td class="muted" style="max-width: 200px; white-space: normal;">{payment.remarks || '—'}</td>
							<td class="num"><Money value={payment.amountPaid} /></td>
							<td class="num"><Money value={payment.discountAmount || 0} /></td>
							<td class="num strong"><Money value={payment.amountPaid + (payment.discountAmount || 0)} /></td>
							<td style="text-align: center;">
								<button class="btn-s btn-secondary-s btn-sm-s" style="color: var(--danger); border-color: var(--danger-soft);" on:click={() => openConfirmDialog(payment)} disabled={deactivating}>
									<Trash2 size={12} strokeWidth={1.8} /> Deactivate
								</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
{/if}

{#if showConfirmDialog && selectedPayment}
	{@const details = getPaymentDetails(selectedPayment)}
	<div class="modal-veil" on:click={closeConfirmDialog} on:keydown={(e) => e.key === 'Escape' && closeConfirmDialog()} role="presentation">
		<div class="modal-s" role="dialog" aria-modal="true" on:click|stopPropagation on:keydown|stopPropagation>
			<div class="modal-head">
				<div>
					<h3 class="modal-title-s">Confirm <em style="color: var(--danger); font-style: italic;">deactivation</em></h3>
					<div class="modal-sub">This action cannot be undone.</div>
				</div>
				<button class="btn-s btn-ghost-s btn-icon-s" on:click={closeConfirmDialog} disabled={deactivating} aria-label="Close"><X size={16} strokeWidth={1.6} /></button>
			</div>
			<div class="modal-body-s">
				<div class="card-s" style="background: var(--bg-elev); margin-bottom: 14px;">
					<div class="card-body-s">
						<div style="display: flex; flex-direction: column; gap: 10px; font-size: 13px;">
							<div style="display: flex; justify-content: space-between;"><span class="muted">Date</span><span class="strong">{formatDate(selectedPayment.date)}</span></div>
							<div style="display: flex; justify-content: space-between;"><span class="muted">Label</span><span class="strong">{selectedPayment.label || '—'}</span></div>
							<div style="display: flex; justify-content: space-between; align-items: center;">
								<span class="muted">Type</span>
								{#if selectedPayment.paymentType === 'REGULAR'}<Badge kind="info">Regular</Badge>
								{:else if selectedPayment.paymentType === 'ADDITIONAL'}<Badge kind="accent">Additional</Badge>
								{:else}<Badge kind="neutral">{selectedPayment.paymentType}</Badge>{/if}
							</div>
							<div style="display: flex; justify-content: space-between;"><span class="muted">Course</span><span class="strong">{details.courseName || '—'}</span></div>
							{#if details.termYear && details.termNumber}
								<div style="display: flex; justify-content: space-between;"><span class="muted">Year / Term</span><span class="strong">Year {details.termYear} · Term {details.termNumber}</span></div>
							{:else if selectedPayment.feeStructure?.termName}
								<div style="display: flex; justify-content: space-between;"><span class="muted">Term</span><span class="strong">{selectedPayment.feeStructure.termName}</span></div>
							{/if}
							<div style="display: flex; justify-content: space-between;"><span class="muted">Amount paid</span><span class="strong"><Money value={selectedPayment.amountPaid} /></span></div>
							{#if selectedPayment.discountAmount > 0}
								<div style="display: flex; justify-content: space-between;"><span class="muted">Discount</span><span><Money value={selectedPayment.discountAmount} /></span></div>
							{/if}
						</div>
					</div>
				</div>
				{#if selectedPayment.paymentType === 'REGULAR'}
					<div class="callout">
						<AlertTriangle size={16} strokeWidth={1.6} />
						<div class="callout-body">This is a regular payment. Deactivation will trigger dues recalculation.</div>
					</div>
				{/if}
			</div>
			<div class="modal-foot">
				<button type="button" class="btn-s btn-secondary-s" on:click={closeConfirmDialog} disabled={deactivating}>Cancel</button>
				<button type="button" class="btn-s btn-danger-s" on:click={handleDeactivatePayment} disabled={deactivating}>
					{#if deactivating}<span class="spinner"></span>Deactivating…{:else}<Trash2 size={14} strokeWidth={1.8} /> Deactivate{/if}
				</button>
			</div>
		</div>
	</div>
{/if}
