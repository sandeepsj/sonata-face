<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { X, Plus, AlertCircle, Trash2, CreditCard, Tag, Banknote } from 'lucide-svelte';
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

	// Helper to get local ISO string (YYYY-MM-DDTHH:mm)
	function getLocalISOString() {
		const now = new Date();
		const offset = now.getTimezoneOffset() * 60000;
		return new Date(now.getTime() - offset).toISOString().slice(0, 16);
	}

	// Payment form state
	let amountPaid = 0;
	let label = '';
	let remarks = '';
	let date = getLocalISOString();
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
		date = getLocalISOString();
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
				date: `${date}:00.000Z` // Send as Indian time (server assumes IST)
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
	<div class="modal modal-open bg-black/50 backdrop-blur-sm">
		<div class="modal-box w-11/12 max-w-2xl p-0 overflow-hidden rounded-2xl shadow-2xl">
			
			<!-- Header -->
			<div class="bg-base-100 px-6 py-4 border-b border-base-200 flex items-center justify-between sticky top-0 z-20">
				<div class="flex items-center gap-3">
					<div class="p-2 bg-primary/10 rounded-lg text-primary">
						<CreditCard class="w-5 h-5" />
					</div>
					<div>
						<h3 class="font-bold text-lg leading-tight">Additional Payment</h3>
						<p class="text-xs text-base-content/60">Record a miscellaneous payment for {studentName}</p>
					</div>
				</div>
				<button 
					class="btn btn-sm btn-circle btn-ghost hover:bg-base-200 transition-colors" 
					on:click={closeModal}
					disabled={loading}
				>
					<X class="w-4 h-4" />
				</button>
			</div>

			<div class="max-h-[calc(90vh-8rem)] overflow-y-auto px-6 py-6 space-y-6">
				<form on:submit|preventDefault={handleSubmit} class="space-y-6">
					
					<!-- Main Amount Input -->
					<div class="form-control w-full">
						<label class="label" for="additionalAmount">
							<span class="label-text font-medium">Payment Amount *</span>
						</label>
						<div class="relative">
							<div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
								<span class="text-base-content/40 font-semibold">₹</span>
							</div>
							<input 
								id="additionalAmount"
								type="number" 
								step="0.01"
								min="0.01"
								bind:value={amountPaid}
								class="input input-lg input-bordered w-full pl-10 font-bold text-xl focus:input-primary transition-all"
								placeholder="0.00"
								disabled={loading}
								required
							/>
						</div>
					</div>

					<!-- Discounts Section -->
					<div class="collapse collapse-arrow bg-base-100 border border-base-200 rounded-xl overflow-visible">
						<input type="checkbox" class="peer" checked={discounts.length > 0} /> 
						<div class="collapse-title flex items-center gap-2 font-medium py-3 min-h-0">
							<Tag class="w-4 h-4 text-base-content/60" />
							<span>Discounts & Adjustments</span>
							{#if validDiscounts.length > 0}
								<span class="badge badge-sm badge-success gap-1">
									{validDiscounts.length} active
								</span>
							{/if}
						</div>
						<div class="collapse-content px-4 pb-4 peer-checked:pt-2">
							<div class="space-y-3">
								{#each discounts as discount, index}
									<div class="flex flex-col sm:flex-row gap-3 items-start bg-base-200/50 p-3 rounded-lg group">
										<div class="flex-1 w-full sm:w-auto grid grid-cols-1 sm:grid-cols-2 gap-3">
											<input 
												type="text"
												bind:value={discount.label}
												class="input input-bordered input-sm w-full"
												placeholder="Discount Label (e.g. Early Bird)"
												disabled={loading}
											/>
											<div class="relative">
												<span class="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-base-content/50">₹</span>
												<input 
													type="number" 
													step="0.01"
													min="0"
													bind:value={discount.discountAmount}
													class="input input-bordered input-sm w-full pl-6"
													placeholder="Amount"
													disabled={loading}
												/>
											</div>
										</div>
										<button 
											type="button"
											class="btn btn-ghost btn-xs btn-square text-error opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity"
											on:click={() => removeDiscount(index)}
											disabled={loading}
											title="Remove discount"
										>
											<Trash2 class="w-4 h-4" />
										</button>
									</div>
								{/each}
								
								<button 
									type="button"
									class="btn btn-ghost btn-sm text-primary w-full border-dashed border border-base-300 hover:border-primary hover:bg-primary/5"
									on:click={addDiscount}
									disabled={loading}
								>
									<Plus class="w-4 h-4 mr-1" />
									Add Discount
								</button>
							</div>
						</div>
					</div>

					<!-- Additional Details Grid -->
					<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<div class="form-control">
							<label class="label py-1" for="additionalDate">
								<span class="label-text text-xs uppercase tracking-wider font-semibold text-base-content/50">Date & Time *</span>
							</label>
							<div class="relative">
								<input 
									id="additionalDate"
									type="datetime-local" 
									bind:value={date}
									class="input input-bordered w-full text-sm"
									disabled={loading}
									required
								/>
							</div>
						</div>
						
						<div class="form-control">
							<label class="label py-1" for="additionalLabel">
								<span class="label-text text-xs uppercase tracking-wider font-semibold text-base-content/50">Payment Label *</span>
							</label>
							<input 
								id="additionalLabel"
								type="text" 
								bind:value={label}
								class="input input-bordered w-full text-sm"
								placeholder="e.g. Transport Fee"
								disabled={loading}
								required
							/>
						</div>
					</div>

					<div class="form-control">
						<label class="label py-1" for="additionalRemarks">
							<span class="label-text text-xs uppercase tracking-wider font-semibold text-base-content/50">Remarks</span>
						</label>
						<textarea 
							id="additionalRemarks"
							bind:value={remarks}
							class="textarea textarea-bordered w-full text-sm min-h-[80px]"
							placeholder="Add any additional notes here..."
							disabled={loading}
						></textarea>
					</div>

					<!-- Payment Summary Box -->
					<div class="bg-base-200 rounded-xl p-4 space-y-2">
						<div class="flex justify-between text-sm text-base-content/70">
							<span>Subtotal</span>
							<span>{formatCurrency(amountPaid)}</span>
						</div>
						{#if totalDiscount > 0}
							<div class="flex justify-between text-sm text-success">
								<span>Total Discounts</span>
								<span>-{formatCurrency(totalDiscount)}</span>
							</div>
						{/if}
						<div class="divider my-1"></div>
						<div class="flex justify-between items-center">
							<span class="font-bold">Net Payable</span>
							<span class="font-bold text-xl text-primary">{formatCurrency(netAmount)}</span>
						</div>
					</div>

					<!-- Error Display -->
					{#if error}
						<div class="alert alert-error shadow-sm rounded-lg text-sm py-2">
							<AlertCircle class="w-4 h-4" />
							<span>{error}</span>
						</div>
					{/if}

					<!-- Success Display -->
					{#if success}
						<div class="alert alert-success shadow-sm rounded-lg text-sm py-2">
							<Banknote class="w-4 h-4" />
							<span>Additional payment processed successfully!</span>
						</div>
					{/if}

				</form>
			</div>

			<!-- Footer Actions -->
			<div class="p-4 bg-base-100 border-t border-base-200 flex justify-end gap-3">
				<button 
					type="button" 
					class="btn btn-ghost"
					on:click={closeModal}
					disabled={loading}
				>
					Cancel
				</button>
				<button 
					type="button" 
					class="btn btn-primary px-8"
					on:click={handleSubmit}
					disabled={loading || success}
				>
					{#if loading}
						<span class="loading loading-spinner loading-sm"></span>
					{:else}
						Confirm Payment
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}
