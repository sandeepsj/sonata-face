<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { X, Plus, AlertCircle, Trash2 } from 'lucide-svelte';
	import { 
		FeeDuesService,
		currentStudentStore,
		calculateNetAmount,
		calculateTotalDiscount,
		validateDiscounts,
		type PaymentCreateRequest,
		type PaymentDiscount
	} from '$lib';

	export let isOpen = false;
	export let studentId: number;
	export let studentName = '';

	const dispatch = createEventDispatcher();

	// Payment form state
	let amountPaid = 0;
	let label = '';
	let remarks = '';
	let date = new Date().toISOString().slice(0, 16);
	let discounts: PaymentDiscount[] = [];

	// Form validation and UI state
	let loading = false;
	let error = '';
	let success = false;

	// Reset form when modal opens
	$: if (isOpen) {
		resetForm();
	}

	function resetForm() {
		amountPaid = 0;
		label = '';
		remarks = '';
		date = new Date().toISOString().slice(0, 16);
		discounts = [];
		error = '';
		success = false;
	}

	function closeModal() {
		isOpen = false;
		dispatch('close');
	}

	function addDiscount() {
		discounts = [...discounts, { discountAmount: 0, label: '' }];
	}

	function removeDiscount(index: number) {
		discounts = discounts.filter((_, i) => i !== index);
	}

	async function handleSubmit() {
		if (!validateForm()) return;

		loading = true;
		error = '';

		try {
			// Filter valid discounts
			const validDiscounts = discounts.length > 0 
				? discounts.filter(d => d.discountAmount > 0 && d.label.trim() !== '') 
				: undefined;

			// Calculate net amount (amount paid after discounts)
			const netAmount = calculateNetAmount(amountPaid, validDiscounts);

			const paymentRequest: PaymentCreateRequest = {
				studentId,
				termId: null, // null for additional payments
				amountPaid: netAmount, // Send net amount (actual amount collected)
				discounts: validDiscounts,
				label: label || undefined,
				remarks: remarks || undefined,
				date: new Date(date).toISOString()
			};

			// Create the payment
			await FeeDuesService.createPayment(paymentRequest);
			
			// Refresh dues data to reflect any new entries
			await currentStudentStore.fetchDues(studentId, true);
			
			success = true;
			
			// Close modal after short delay
			setTimeout(() => {
				closeModal();
			}, 1500);

		} catch (err) {
			console.error('Additional payment error:', err);
			error = err instanceof Error ? err.message : 'Failed to process payment';
		} finally {
			loading = false;
		}
	}

	function validateForm(): boolean {
		if (!amountPaid || amountPaid <= 0) {
			error = 'Please enter a valid amount';
			return false;
		}

		if (!label?.trim()) {
			error = 'Please provide a label for this payment';
			return false;
		}

		// Validate discounts
		const validDiscounts = discounts.filter(d => d.discountAmount > 0 || d.label.trim() !== '');
		if (validDiscounts.length > 0) {
			const validation = validateDiscounts(amountPaid, validDiscounts);
			if (!validation.valid) {
				error = validation.error || 'Invalid discounts';
				return false;
			}
		}

		return true;
	}

	// Calculate net amount and total discount for display
	$: validDiscounts = discounts.filter(d => d.discountAmount > 0 && d.label.trim() !== '');
	$: totalDiscount = calculateTotalDiscount(validDiscounts);
	$: netAmount = calculateNetAmount(amountPaid, validDiscounts);

	// Format currency for display
	function formatCurrency(amount: number): string {
		return new Intl.NumberFormat('en-IN', {
			style: 'currency',
			currency: 'INR',
		}).format(amount);
	}
</script>

{#if isOpen}
	<!-- Modal Backdrop -->
	<div class="modal modal-open">
		<div class="modal-box w-11/12 max-w-3xl max-h-[90vh] overflow-y-auto">
			<!-- Modal Header -->
			<div class="flex items-center justify-between mb-6 sticky top-0 bg-base-100 pb-4 border-b z-10">
				<h3 class="font-bold text-lg flex items-center">
					<Plus class="w-5 h-5 mr-2 text-primary" />
					Add Additional Payment
				</h3>
				<button 
					class="btn btn-sm btn-circle btn-ghost" 
					on:click={closeModal}
					disabled={loading}
				>
					<X class="w-4 h-4" />
				</button>
			</div>

			<!-- Student Info -->
			<div class="bg-base-200 p-4 rounded-lg mb-6">
				<div>
					<span class="text-base-content/70">Student:</span>
					<span class="font-medium ml-2">{studentName}</span>
				</div>
			</div>

			<!-- Payment Form -->
			<form on:submit|preventDefault={handleSubmit} class="space-y-4">
				<!-- Amount -->
				<div class="form-control">
					<label class="label" for="additionalAmount">
						<span class="label-text font-semibold">Payment Amount *</span>
					</label>
					<input 
						id="additionalAmount"
						type="number" 
						step="0.01"
						min="0.01"
						bind:value={amountPaid}
						class="input input-bordered"
						placeholder="Enter amount"
						disabled={loading}
						required
					/>
				</div>

				<!-- Label (Required for additional payments) -->
				<div class="form-control">
					<label class="label" for="additionalLabel">
						<span class="label-text font-semibold">Payment Label * <span class="text-error"></span></span>
					</label>
					<input 
						id="additionalLabel"
						type="text"
						bind:value={label}
						class="input input-bordered"
						placeholder="e.g., Transport fee, Late fine, Lab charges"
						disabled={loading}
						required
					/>
					<div class="label">
						<span class="label-text-alt">Describe what this payment is for</span>
					</div>
				</div>

				<!-- Discounts Section -->
				<div class="divider">Discounts (Optional)</div>
				
				{#each discounts as discount, index}
					<div class="card bg-base-200 p-4">
						<div class="flex items-start gap-4">
							<div class="flex-1 space-y-3">
								<div class="form-control">
									<label class="label" for="additional-discount-amount-{index}">
										<span class="label-text">Discount Amount</span>
									</label>
									<input 
										id="additional-discount-amount-{index}"
										type="number" 
										step="0.01"
										min="0"
										bind:value={discount.discountAmount}
										class="input input-bordered input-sm"
										placeholder="Enter discount amount"
										disabled={loading}
									/>
								</div>
								<div class="form-control">
									<label class="label" for="additional-discount-label-{index}">
										<span class="label-text">Label *</span>
									</label>
									<input 
										id="additional-discount-label-{index}"
										type="text"
										bind:value={discount.label}
										class="input input-bordered input-sm"
										placeholder="e.g., Early bird discount"
										disabled={loading}
									/>
								</div>
								<div class="form-control">
									<label class="label" for="additional-discount-remarks-{index}">
										<span class="label-text">Remarks</span>
									</label>
									<input 
										id="additional-discount-remarks-{index}"
										type="text"
										bind:value={discount.remarks}
										class="input input-bordered input-sm"
										placeholder="Additional notes"
										disabled={loading}
									/>
								</div>
							</div>
							<button 
								type="button"
								class="btn btn-error btn-sm btn-circle mt-8"
								on:click={() => removeDiscount(index)}
								disabled={loading}
							>
								<Trash2 class="w-4 h-4" />
							</button>
						</div>
					</div>
				{/each}

				<button 
					type="button"
					class="btn btn-outline btn-sm w-full"
					on:click={addDiscount}
					disabled={loading}
				>
					<Plus class="w-4 h-4 mr-2" />
					Add Discount
				</button>

				<!-- Payment Summary -->
				{#if validDiscounts.length > 0}
					<div class="bg-info/10 p-4 rounded-lg">
						<h5 class="font-semibold text-sm mb-3">Payment Summary</h5>
						<div class="space-y-2 text-sm">
							<div class="flex justify-between">
								<span>Original Amount:</span>
								<span class="font-medium">{formatCurrency(amountPaid)}</span>
							</div>
							{#each validDiscounts as discount}
								<div class="flex justify-between text-success">
									<span class="truncate mr-2">{discount.label}:</span>
									<span>-{formatCurrency(discount.discountAmount)}</span>
								</div>
							{/each}
							<div class="divider my-2"></div>
							<div class="flex justify-between font-bold text-lg">
								<span>Net Amount:</span>
								<span class="text-primary">{formatCurrency(netAmount)}</span>
							</div>
						</div>
					</div>
				{/if}

				<!-- Payment Date -->
				<div class="form-control">
					<label class="label" for="additionalDate">
						<span class="label-text">Payment Date & Time *</span>
					</label>
					<input 
						id="additionalDate"
						type="datetime-local" 
						bind:value={date}
						class="input input-bordered"
						disabled={loading}
						required
					/>
				</div>

				<!-- Remarks -->
				<div class="form-control">
					<label class="label" for="additionalRemarks">
						<span class="label-text">Remarks</span>
					</label>
					<textarea 
						id="additionalRemarks"
						bind:value={remarks}
						class="textarea textarea-bordered"
						placeholder="Additional notes..."
						disabled={loading}
						rows="2"
					></textarea>
				</div>

				<!-- Error Display -->
				{#if error}
					<div class="alert alert-error">
						<AlertCircle class="w-5 h-5" />
						<span>{error}</span>
					</div>
				{/if}

				<!-- Success Display -->
				{#if success}
					<div class="alert alert-success">
						<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current flex-shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
						<span>Additional payment processed successfully!</span>
					</div>
				{/if}

				<!-- Form Actions -->
				<div class="modal-action sticky bottom-0 bg-base-100 pt-4 border-t">
					<button 
						type="button" 
						class="btn btn-ghost"
						on:click={closeModal}
						disabled={loading}
					>
						Cancel
					</button>
					<button 
						type="submit" 
						class="btn btn-primary"
						disabled={loading || success}
					>
						{#if loading}
							<span class="loading loading-spinner loading-sm"></span>
							Processing...
						{:else}
							Submit Payment
						{/if}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
