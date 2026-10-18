<script lang="ts">
	import { onMount } from 'svelte';
	import { currentStudentStore } from '$lib/stores/currentStudentStore';
	import { api, canAccess, errorMessage } from '$lib';
	import type { Student, Payment, ReceiptTemplateSummary } from '$lib';
	import { formatDate } from '$lib/utils/format';
	import { amountCleared } from '$lib/utils/payments';
	import { Printer, Receipt, CheckSquare, Square, X } from 'lucide-svelte';
	import Badge from '$lib/components/Badge.svelte';
	import Money from '$lib/components/Money.svelte';
	import Select from '$lib/components/Select.svelte';
	import ReceiptFrame from '$lib/receipts/ReceiptFrame.svelte';
	import { buildReceiptData, type ReceiptData } from '$lib/receipts/data';
	import { STANDARD_TEMPLATE_HTML } from '$lib/receipts/standard';

	export let student: Student;

	let selectedPaymentIds = new Set<number>();
	let showReceiptPreview = false;
	let selectedPaymentsForReceipt: Payment[] = [];
	let receiptData: ReceiptData | null = null;
	let frame: ReceiptFrame;

	// templates: list + default loaded once, each template's HTML cached by id
	let templates: ReceiptTemplateSummary[] = [];
	let templateId: number | null = null;
	let templateHtml: string | null = null;
	let templatesLoaded = false;
	let templateNote = '';
	const htmlCache = new Map<number, string>();

	$: currentStudent = student || $currentStudentStore.student;
	$: studentId = currentStudent?.admissionNo;
	$: activePayments = $currentStudentStore.payments.data.filter((p) => p.isActive);
	$: allSelected = activePayments.length > 0 && selectedPaymentIds.size === activePayments.length;
	$: canReadTemplates = $canAccess('/api/receipt-templates/**');
	$: templateOptions = templates.map((t) => ({
		value: t.id as number | null,
		label: t.name,
		sub: [t.isDefault ? 'Default' : '', t.builtIn ? 'Built-in' : ''].filter(Boolean).join(' · ') || undefined
	}));

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
		receiptData = buildReceiptData(currentStudent ?? {}, selectedPaymentsForReceipt);
		showReceiptPreview = true;
		if (!templatesLoaded) loadTemplates();
	}

	async function loadTemplates() {
		templatesLoaded = true;
		if (!canReadTemplates) {
			useStandard('');
			return;
		}
		templateHtml = null;
		try {
			const [list, def] = await Promise.all([api.receiptTemplates.list(), api.receiptTemplates.getDefault()]);
			templates = list;
			htmlCache.set(def.id, def.html);
			templateId = def.id;
			templateHtml = def.html;
			templateNote = '';
		} catch (e) {
			templatesLoaded = false;
			useStandard(`${errorMessage(e, "Templates couldn't be loaded")}. Showing the standard receipt.`);
		}
	}

	function useStandard(note: string) {
		templates = [];
		templateId = null;
		templateHtml = STANDARD_TEMPLATE_HTML;
		templateNote = note;
	}

	async function pickTemplate(id: number | null) {
		if (id == null) return;
		templateId = id;
		const cached = htmlCache.get(id);
		if (cached != null) {
			templateHtml = cached;
			return;
		}
		templateHtml = null;
		try {
			const t = await api.receiptTemplates.get(id);
			htmlCache.set(id, t.html);
			if (templateId === id) templateHtml = t.html;
		} catch (e) {
			if (templateId === id) templateNote = errorMessage(e, "The template couldn't be loaded");
		}
	}

	function closePreview() {
		showReceiptPreview = false;
	}

	function printReceipt() {
		frame?.print();
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

{#if showReceiptPreview && receiptData}
	<div class="modal-veil" on:click={closePreview} on:keydown={(e) => e.key === 'Escape' && closePreview()} role="presentation">
		<div class="modal-s modal-xl" style="height: 85vh; display: flex; flex-direction: column;" role="dialog" aria-modal="true" on:click|stopPropagation on:keydown|stopPropagation>
			<div class="modal-head">
				<div>
					<h3 class="modal-title-s">Receipt <em style="color: var(--accent); font-style: italic;">preview</em></h3>
					<div class="modal-sub">{selectedPaymentsForReceipt.length} payment{selectedPaymentsForReceipt.length > 1 ? 's' : ''} compiled</div>
				</div>
				<button class="btn-s btn-ghost-s btn-icon-s" on:click={closePreview} aria-label="Close"><X size={16} strokeWidth={1.6} /></button>
			</div>
			<div style="flex: 1; padding: 16px 22px 22px; overflow: hidden; background: var(--bg-elev); display: flex; flex-direction: column; gap: 10px;">
				{#if templates.length > 0}
					<div style="display: flex; align-items: center; gap: 10px;">
						<span class="muted" style="font-size: 13px;">Template</span>
						<div style="min-width: 240px;">
							<Select value={templateId} options={templateOptions} size="sm" ariaLabel="Receipt template" onChange={pickTemplate} />
						</div>
						{#if $canAccess('/api/receipt-templates/**')}
							<a href="/admin/receipt-templates" class="muted" style="font-size: 12.5px;">Edit templates</a>
						{/if}
					</div>
				{/if}
				{#if templateNote}<div class="muted" style="font-size: 12.5px;">{templateNote}</div>{/if}
				<div style="flex: 1; min-height: 0;">
					<ReceiptFrame bind:this={frame} html={templateHtml} data={receiptData} title="Receipt preview" />
				</div>
			</div>
			<div class="modal-foot">
				<button class="btn-s btn-secondary-s" on:click={closePreview}>Close</button>
				<button class="btn-s btn-primary-s" on:click={printReceipt} disabled={templateHtml == null}>
					<Printer size={14} strokeWidth={1.8} /> Print receipt
				</button>
			</div>
		</div>
	</div>
{/if}
