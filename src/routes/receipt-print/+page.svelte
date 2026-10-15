<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';

	// Parse URL parameters
	let receiptData: any = null;
	let studentName = '';
	let admissionNo = '';
	let receiptId = '';
	let payments: any[] = [];
	let totalAmount = 0;
	let totalDiscount = 0;
	let grandTotal = 0;

	onMount(() => {
		const urlParams = $page.url.searchParams;
		const dataParam = urlParams.get('data');
		
		if (dataParam) {
			try {
				receiptData = JSON.parse(decodeURIComponent(dataParam));
				studentName = receiptData.studentName || '';
				admissionNo = receiptData.admissionNo || '';
				receiptId = receiptData.receiptId || '';
				payments = receiptData.payments || [];
				
				// Calculate totals
				totalAmount = payments.reduce((sum: number, p: any) => sum + (p.amountPaid || 0), 0);
				totalDiscount = payments.reduce((sum: number, p: any) => sum + (p.discountAmount || 0), 0);
			} catch (err) {
				console.error('Error parsing receipt data:', err);
			}
		}
	});

	function formatDate(dateStr: string): string {
		if (!dateStr) return '';
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
</script>

<svelte:head>
	<title>Receipt {receiptId}</title>
</svelte:head>

<style>
	@page {
		size: A5 landscape;
		margin: 10mm;
	}

	:global(body) {
		margin: 0;
		padding: 10mm;
		font-family: Arial, sans-serif;
		background: white;
	}

	.receipt-container {
		width: 100%;
		max-width: 100%;
		margin: 0 auto;
		background: white;
		font-size: 9pt;
	}

	.receipt-header {
		text-align: center;
		margin-bottom: 15px;
	}

	.receipt-header h1 {
		font-size: 14pt;
		margin: 0 0 3px 0;
		font-weight: bold;
	}

	.receipt-header h2 {
		font-size: 11pt;
		margin: 0 0 3px 0;
		font-weight: 600;
	}

	.receipt-header p {
		font-size: 8pt;
		margin: 0 0 2px 0;
	}

	.receipt-content {
		font-size: 9pt;
	}

	.receipt-content table {
		font-size: 8pt;
		width: 100%;
		border-collapse: collapse;
		margin-bottom: 10px;
	}

	.receipt-content th,
	.receipt-content td {
		padding: 3px 5px;
		border: 1px solid #000;
		text-align: left;
	}

	.receipt-content th {
		background: #f0f0f0;
		font-weight: bold;
	}

	.receipt-content .text-right {
		text-align: right;
	}

	.receipt-content tfoot tr {
		border-top: 2px solid #000;
		font-weight: bold;
	}

	.receipt-footer {
		margin-top: 20px;
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 20px;
	}

	.signature-line {
		border-top: 1px solid #000;
		margin-top: 30px;
		padding-top: 5px;
		text-align: center;
		font-size: 8pt;
	}

	.discount-details {
		padding-left: 20px;
		color: #666;
		font-size: 7pt;
		font-style: italic;
	}

	@media print {
		:global(body) {
			padding: 0;
		}
	}
</style>

<div class="receipt-container">
	<!-- Receipt Header -->
	<div class="receipt-header">
		<h1>REVATHI EDUCATION ART & CULTURAL TRUST</h1>
		<h2>INSTITUTE OF ARTS</h2>
		<p>In Collaboration with Kalai Kaviri School Of Fine Arts, Tiruchirappalli, Tamilnadu</p>
		<p>Reg.No. 46/4/2000</p>
	</div>

	<!-- Receipt Details -->
	<div class="receipt-content">
		<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
			<div>
				<p style="margin: 2px 0;"><strong>Receipt ID:</strong> {receiptId}</p>
			</div>
			<div style="text-align: right;">
				<p style="margin: 2px 0;"><strong>Admn No:</strong> {admissionNo}</p>
			</div>
		</div>

		<div style="margin-bottom: 10px;">
			<p style="margin: 2px 0;"><strong>Name:</strong> {studentName}</p>
		</div>

		<!-- Payment Details -->
		<table>
			<thead>
				<tr>
					<th>Date</th>
					<th>Subject/Course</th>
					<th>Period</th>
					<th class="text-right">Fee</th>
					<th class="text-right">Discount</th>
					<th class="text-right">Total</th>
				</tr>
			</thead>
			<tbody>
				{#each payments as payment}
					<tr>
						<td>{formatDate(payment.date)}</td>
						<td>{ payment.courseName || payment.label || 'Fee Payment'}</td>
						<td>
							{payment.period || '-'}
						</td>
						<td class="text-right" style="font-weight: 600;">
							₹{formatCurrency(payment.amountPaid + (payment.discountAmount || 0))}
						</td>
						<td class="text-right">
							{#if payment.discountAmount}
								₹{formatCurrency(payment.discountAmount)}
							{:else}
								-
							{/if}
						</td>
						<td class="text-right">₹{formatCurrency(payment.amountPaid)}</td>
					</tr>
					{#if payment.discounts && payment.discounts.length > 0}
						<tr>
							<td colspan="6" class="discount-details">
								Discounts applied:
								{#each payment.discounts as discount, idx}
									{discount.label} (₹{formatCurrency(discount.discountAmount)}){idx < payment.discounts.length - 1 ? ', ' : ''}
								{/each}
							</td>
						</tr>
					{/if}
				{/each}
			</tbody>
			<tfoot>
				<tr>
					<td colspan="5" class="text-right">Total Amount Paid:</td>
					<td class="text-right">₹{formatCurrency(totalAmount)}</td>
				</tr>
			</tfoot>
		</table>

		<div class="receipt-footer">
			<div>
				<p style="margin: 2px 0; font-size: 8pt;">
					<strong>Date:</strong> {formatDate(new Date().toISOString())}
				</p>
			</div>
			<div style="text-align: right;">
				<div class="signature-line">
					Secretary/Clerk
				</div>
			</div>
		</div>
	</div>
</div>
