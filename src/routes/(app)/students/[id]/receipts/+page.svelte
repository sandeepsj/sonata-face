<script lang="ts">
	import { onMount } from 'svelte';
	import { currentStudentStore } from '$lib/stores/currentStudentStore';
	import type { Student, Payment } from '$lib';
	import { formatDate } from '$lib/utils/format';
	import { amountCleared } from '$lib/utils/payments';
	import { Printer, Receipt, CheckSquare, Square, X } from 'lucide-svelte';
	import Badge from '$lib/components/Badge.svelte';
	import Money from '$lib/components/Money.svelte';

	export let student: Student;

	let selectedPaymentIds = new Set<number>();
	let showReceiptPreview = false;
	let selectedPaymentsForReceipt: Payment[] = [];
	let receiptUrl = '';
	let iframeElement: HTMLIFrameElement;

	$: currentStudent = student || $currentStudentStore.student;
	$: studentId = currentStudent?.admissionNo;
	$: activePayments = $currentStudentStore.payments.data.filter((p) => p.isActive);
	$: allSelected = activePayments.length > 0 && selectedPaymentIds.size === activePayments.length;

	onMount(async () => {
		if (studentId) {
			await Promise.all([
				currentStudentStore.fetchPayments(studentId, true),
			]);
		}
	});

	function togglePaymentSelection(id: number) {
		if (selectedPaymentIds.has(id)) selectedPaymentIds.delete(id);
		else selectedPaymentIds.add(id);
		selectedPaymentIds = selectedPaymentIds;
	}
	function toggleSelectAll() {
		if (allSelected) selectedPaymentIds.clear();
		else selectedPaymentIds = new Set(activePayments.map((p) => p.id));
		selectedPaymentIds = selectedPaymentIds;
	}

	function generateReceipt() {
		if (selectedPaymentIds.size === 0) return;
		selectedPaymentsForReceipt = activePayments.filter((p) => selectedPaymentIds.has(p.id));
		const enriched = selectedPaymentsForReceipt.map((payment) => {
			return {
				id: payment.id,
				date: payment.date,
				label: payment.label,
				courseName: payment.courseName,
				amountPaid: payment.amountPaid,
				discountAmount: payment.discountAmount,
				discounts: payment.discounts
			};
		});
		const receiptData = {
			studentName: currentStudent?.studentName,
			admissionNo: currentStudent?.admissionNo,
			receiptId: getCombinedReceiptId(),
			payments: enriched
		};
		receiptUrl = `/receipt-print?data=${encodeURIComponent(JSON.stringify(receiptData))}`;
		showReceiptPreview = true;
	}

	function closePreview() {
		showReceiptPreview = false;
		receiptUrl = '';
	}

	function printReceipt() {
		if (iframeElement?.contentWindow) iframeElement.contentWindow.print();
	}

	function getCombinedReceiptId(): string {
		const ids = selectedPaymentsForReceipt.map((p) => p.id).sort((a, b) => a - b);
		return `R-${ids.join('-')}`;
	}
</script>

<div class="section-row">
	<div>
		<h2 class="section-title-s">Generate <em>receipt</em></h2>
		<div style="color: var(--fg-muted); font-size: 13px;">
			Select active payments to compile a printable receipt.
		</div>
	</div>
</div>

{#if selectedPaymentIds.size > 0}
	<div class="callout" style="background: var(--ok-soft); border-color: var(--ok); color: var(--ok); margin-bottom: 18px;">
		<Receipt size={18} strokeWidth={1.6} />
		<div style="flex: 1;">
			<div class="callout-title" style="color: var(--ok);">{selectedPaymentIds.size} payment{selectedPaymentIds.size > 1 ? 's' : ''} selected</div>
			<div class="callout-body" style="color: var(--ok);">Click "Generate receipt" to preview and print.</div>
		</div>
		<button class="btn-s btn-primary-s" on:click={generateReceipt}>
			<Printer size={14} strokeWidth={1.8} /> Generate receipt
		</button>
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
				<div style="margin-top: 4px;">There are no payments available for receipt generation.</div>
			</div>
		</div>
	</div>
{:else}
	<div class="tbl-wrap">
		<div class="tbl-toolbar">
			<h3 class="card-title-s">Active payments ({activePayments.length})</h3>
			<div class="grow"></div>
			<button class="btn-s btn-secondary-s btn-sm-s" on:click={toggleSelectAll}>
				{#if allSelected}<CheckSquare size={14} strokeWidth={1.6} /> Deselect all{:else}<Square size={14} strokeWidth={1.6} /> Select all{/if}
			</button>
		</div>
		<table class="tbl">
			<thead>
				<tr>
					<th style="width: 36px;">
						<input type="checkbox" checked={allSelected} on:change={toggleSelectAll} />
					</th>
					<th>Date</th>
					<th>Label</th>
					<th>Course</th>
					<th>Type</th>
					<th style="text-align: right;">Amount</th>
					<th style="text-align: right;">Discount</th>
					<th style="text-align: right;">Total</th>
				</tr>
			</thead>
			<tbody>
				{#each activePayments as payment}
					{@const isSelected = selectedPaymentIds.has(payment.id)}
					<tr style:background={isSelected ? 'var(--accent-soft)' : undefined}>
						<td>
							<input type="checkbox" checked={isSelected} on:change={() => togglePaymentSelection(payment.id)} />
						</td>
						<td>
							<div class="strong">{formatDate(payment.date)}</div>
							<div class="muted" style="font-family: var(--font-mono); font-size: 11px;">R-{payment.id}</div>
						</td>
						<td>{payment.label || '—'}</td>
						<td>
							<div class="strong">{payment.courseName || '—'}</div>
						</td>
						<td>
							{#if payment.paymentType === 'REGULAR'}<Badge kind="info">Course fee</Badge>
							{:else}<Badge kind="accent">Additional</Badge>{/if}
						</td>
						<td class="num"><Money value={payment.amountPaid} /></td>
						<td class="num"><Money value={payment.discountAmount || 0} /></td>
						<td class="num strong"><Money value={amountCleared(payment)} /></td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

{#if showReceiptPreview}
	<div class="modal-veil" on:click={closePreview} on:keydown={(e) => e.key === 'Escape' && closePreview()} role="presentation">
		<div class="modal-s modal-xl" style="height: 85vh; display: flex; flex-direction: column;" role="dialog" aria-modal="true" on:click|stopPropagation on:keydown|stopPropagation>
			<div class="modal-head">
				<div>
					<h3 class="modal-title-s">Receipt <em style="color: var(--accent); font-style: italic;">preview</em></h3>
					<div class="modal-sub">{selectedPaymentsForReceipt.length} payment{selectedPaymentsForReceipt.length > 1 ? 's' : ''} compiled</div>
				</div>
				<button class="btn-s btn-ghost-s btn-icon-s" on:click={closePreview} aria-label="Close"><X size={16} strokeWidth={1.6} /></button>
			</div>
			<div style="flex: 1; padding: 22px; overflow: hidden; background: var(--bg-elev);">
				<iframe
					bind:this={iframeElement}
					src={receiptUrl}
					title="Receipt preview"
					style="width: 100%; height: 100%; background: white; border: 1px solid var(--border); border-radius: 8px;"
				></iframe>
			</div>
			<div class="modal-foot">
				<button class="btn-s btn-secondary-s" on:click={closePreview}>Close</button>
				<button class="btn-s btn-primary-s" on:click={printReceipt}>
					<Printer size={14} strokeWidth={1.8} /> Print receipt
				</button>
			</div>
		</div>
	</div>
{/if}
