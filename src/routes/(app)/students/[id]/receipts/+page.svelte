<script lang="ts">
	import { onMount } from 'svelte';
	import { currentStudentStore } from '$lib/stores/currentStudentStore';
	import type { Student, Payment } from '$lib';
	import { Printer, Receipt, CheckSquare, Square, Calendar, IndianRupee } from 'lucide-svelte';

	export let student: Student;

	let selectedPaymentIds = new Set<number>();
	let showReceiptPreview = false;
	let selectedPaymentsForReceipt: Payment[] = [];
	let receiptUrl = '';
	let iframeElement: HTMLIFrameElement;

	$: currentStudent = student || $currentStudentStore.student;
	$: studentId = currentStudent?.admissionNo;
	$: activePayments = $currentStudentStore.payments.data.filter((p) => p.isActive);
	$: dues = $currentStudentStore.dues.data;
	$: allSelected = activePayments.length > 0 && selectedPaymentIds.size === activePayments.length;

	onMount(async () => {
		if (studentId) {
			await Promise.all([
				currentStudentStore.fetchPayments(studentId, true),
				currentStudentStore.fetchDues(studentId, true)
			]);
		}
	});

	function togglePaymentSelection(paymentId: number) {
		if (selectedPaymentIds.has(paymentId)) {
			selectedPaymentIds.delete(paymentId);
		} else {
			selectedPaymentIds.add(paymentId);
		}
		selectedPaymentIds = selectedPaymentIds;
	}

	function toggleSelectAll() {
		if (allSelected) {
			selectedPaymentIds.clear();
		} else {
			selectedPaymentIds = new Set(activePayments.map(p => p.id));
		}
		selectedPaymentIds = selectedPaymentIds;
	}

	function generateReceipt() {
		if (selectedPaymentIds.size === 0) return;
		
		selectedPaymentsForReceipt = activePayments.filter(p => selectedPaymentIds.has(p.id));
		
		// Prepare payment data with term/year enrichment
		const enrichedPayments = selectedPaymentsForReceipt.map(payment => {
			const details = getPaymentDetails(payment);
			return {
				id: payment.id,
				date: payment.date,
				label: payment.label,
				courseName: details.courseName,
				termYear: details.termYear,
				termNumber: details.termNumber,
				termName: payment.feeStructure?.termName,
				amountPaid: payment.amountPaid,
				discountAmount: payment.discountAmount,
				discounts: payment.discounts
			};
		});
		
		// Create receipt data object
		const receiptData = {
			studentName: currentStudent?.studentName,
			admissionNo: currentStudent?.admissionNo,
			receiptId: getCombinedReceiptId(),
			payments: enrichedPayments
		};
		
		// Encode data as URL parameter
		const encodedData = encodeURIComponent(JSON.stringify(receiptData));
		receiptUrl = `/receipt-print?data=${encodedData}`;
		
		showReceiptPreview = true;
	}

	function closePreview() {
		showReceiptPreview = false;
		receiptUrl = '';
	}

	function printReceipt() {
		if (iframeElement && iframeElement.contentWindow) {
			iframeElement.contentWindow.print();
		}
	}

	function getPaymentDetails(payment: Payment) {
		if (payment.feeStructure) {
			const matchingDue = dues.find(due => 
				due.feeStructureId === payment.feeStructure?.id
			);
			
			if (matchingDue) {
				return {
					termYear: matchingDue.termYear,
					termNumber: matchingDue.termNumber,
					courseName: matchingDue.courseName || payment.courseName
				};
			}
		}

		return {
			termYear: null,
			termNumber: null,
			courseName: payment.courseName
		};
	}

	function formatDate(dateStr: string): string {
		const date = new Date(dateStr);
		return date.toLocaleDateString('en-IN', { 
			day: '2-digit', 
			month: 'short', 
			year: 'numeric' 
		});
	}

	function formatCurrency(amount: number | null | undefined): string {
		if (amount === null || amount === undefined || isNaN(amount)) {
			return '0';
		}
		return amount.toLocaleString('en-IN');
	}

	function getReceiptId(payment: Payment): string {
		return `R-${payment.id}`;
	}

	function getCombinedReceiptId(): string {
		const ids = selectedPaymentsForReceipt.map(p => p.id).sort((a, b) => a - b);
		return `R-${ids.join('-')}`;
	}
</script>

<svelte:head>
	<title>Generate Receipt - {currentStudent?.studentName || 'Student'}</title>
</svelte:head>

<div class="container mx-auto p-6 max-w-6xl no-print">
	<!-- Header -->
	<div class="mb-6">
		<h1 class="text-3xl font-bold mb-2 flex items-center gap-3">
			<Receipt class="w-8 h-8 text-primary" />
			Generate Receipt
		</h1>
		<p class="text-base-content/70">
			Select active payments to generate printable receipt for {currentStudent?.studentName || 'student'}
		</p>
	</div>

	<!-- Selection Summary -->
	{#if selectedPaymentIds.size > 0}
		<div class="alert alert-success mb-6">
			<Receipt class="h-5 w-5" />
			<div>
				<h3 class="font-bold">{selectedPaymentIds.size} payment{selectedPaymentIds.size > 1 ? 's' : ''} selected</h3>
				<div class="text-sm">Click "Generate Receipt" to preview and print</div>
			</div>
			<button class="btn btn-sm btn-neutral" on:click={generateReceipt}>
				<Printer class="w-4 h-4" />
				Generate Receipt
			</button>
		</div>
	{/if}

	<!-- Payments List -->
	{#if $currentStudentStore.payments.loading}
		<div class="flex justify-center items-center py-12">
			<span class="loading loading-spinner loading-lg"></span>
		</div>
	{:else if activePayments.length === 0}
		<div class="card bg-base-100 shadow-xl">
			<div class="card-body items-center text-center py-12">
				<Receipt class="w-16 h-16 text-base-content/30 mb-4" />
				<h3 class="text-xl font-bold mb-2">No Active Payments</h3>
				<p class="text-base-content/70">
					There are no active payment records available for receipt generation.
				</p>
			</div>
		</div>
	{:else}
		<div class="card bg-base-100 shadow-xl">
			<div class="card-body">
				<div class="flex justify-between items-center mb-4">
					<h2 class="card-title">Active Payments ({activePayments.length})</h2>
					<button 
						class="btn btn-sm btn-outline"
						on:click={toggleSelectAll}
					>
						{#if allSelected}
							<CheckSquare class="w-4 h-4" />
							Deselect All
						{:else}
							<Square class="w-4 h-4" />
							Select All
						{/if}
					</button>
				</div>

				<div class="overflow-x-auto">
					<table class="table">
						<thead>
							<tr class="bg-base-200">
								<th class="w-12">
									<input 
										type="checkbox" 
										class="checkbox checkbox-primary"
										checked={allSelected}
										on:change={toggleSelectAll}
									/>
								</th>
								<th>Date</th>
								<th>Label</th>
								<th>Course</th>
								<th>Type</th>
								<th class="text-right">Amount</th>
								<th class="text-right">Discount</th>
								<th class="text-right">Total</th>
							</tr>
						</thead>
						<tbody>
							{#each activePayments as payment}
								{@const details = getPaymentDetails(payment)}
								{@const isSelected = selectedPaymentIds.has(payment.id)}
								<tr class="hover" class:bg-base-200={isSelected}>
									<td>
										<input 
											type="checkbox" 
											class="checkbox checkbox-primary"
											checked={isSelected}
											on:change={() => togglePaymentSelection(payment.id)}
										/>
									</td>
									<td>
										<div class="font-medium">{formatDate(payment.date)}</div>
										<div class="text-xs text-base-content/70">
											Receipt: {getReceiptId(payment)}
										</div>
									</td>
									<td>
										<div class="font-medium">{payment.label || 'N/A'}</div>
									</td>
									<td>
										<div class="font-medium">{details.courseName || 'N/A'}</div>
										{#if details.termYear && details.termNumber}
											<div class="text-xs text-base-content/70">
												Year {details.termYear}, Term {details.termNumber}
											</div>
										{/if}
									</td>
									<td>
										<span class="badge badge-sm">
											{payment.paymentType === 'REGULAR' ? 'Regular' : 
											 payment.paymentType === 'ADDITIONAL' ? 'Additional' : 'Other'}
										</span>
									</td>
									<td class="text-right font-mono">
										₹{formatCurrency(payment.amountPaid)}
									</td>
									<td class="text-right font-mono">
										₹{formatCurrency(payment.discountAmount || 0)}
									</td>
									<td class="text-right font-mono font-bold">
										₹{formatCurrency(payment.amountPaid + (payment.discountAmount || 0))}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	{/if}
</div>

<!-- Receipt Preview Modal -->
{#if showReceiptPreview}
	<dialog class="modal modal-open">
		<div class="modal-box max-w-5xl h-[80vh]">
			<h3 class="font-bold text-lg mb-4">Receipt Preview</h3>
			
			<!-- Receipt in iframe -->
			<div class="bg-base-200 p-4 rounded-lg mb-4" style="height: calc(100% - 120px);">
				<iframe
					bind:this={iframeElement}
					src={receiptUrl}
					title="Receipt Preview"
					class="w-full h-full bg-white rounded shadow-lg"
				></iframe>
			</div>

			<div class="modal-action">
				<button type="button" class="btn btn-ghost" on:click={closePreview}>
					Close
				</button>
				<button type="button" class="btn btn-primary" on:click={printReceipt}>
					<Printer class="w-4 h-4" />
					Print Receipt
				</button>
			</div>
		</div>
		<form method="dialog" class="modal-backdrop">
			<button type="button" on:click={closePreview}>close</button>
		</form>
	</dialog>
{/if}
