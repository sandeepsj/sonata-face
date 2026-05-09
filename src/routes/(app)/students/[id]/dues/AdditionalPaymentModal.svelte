<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { X, Plus, AlertCircle, Trash2, Tag, CheckCircle2 } from 'lucide-svelte';
	import {
		FeeDuesService,
		currentStudentStore,
		calculateNetAmount,
		calculateTotalDiscount,
		validateDiscounts,
		type PaymentCreateRequest,
		type PaymentDiscount
	} from '$lib';
	import Money from '$lib/components/Money.svelte';
	import Badge from '$lib/components/Badge.svelte';

	export let isOpen = false;
	export let studentId: number;
	export let studentName = '';

	const dispatch = createEventDispatcher();

	function getLocalISOString() {
		const now = new Date();
		const offset = now.getTimezoneOffset() * 60000;
		return new Date(now.getTime() - offset).toISOString().slice(0, 16);
	}

	let amountPaid = 0;
	let label = '';
	let remarks = '';
	let date = getLocalISOString();
	let discounts: PaymentDiscount[] = [];
	let loading = false;
	let error = '';
	let success = false;

	$: if (isOpen) resetForm();

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
	function removeDiscount(i: number) {
		discounts = discounts.filter((_, idx) => idx !== i);
	}

	async function handleSubmit() {
		if (!validateForm()) return;
		loading = true;
		error = '';
		try {
			const validDiscounts = discounts.length > 0
				? discounts.filter((d) => d.discountAmount > 0 && d.label.trim() !== '')
				: undefined;
			const netAmount = calculateNetAmount(amountPaid, validDiscounts);
			const paymentRequest: PaymentCreateRequest = {
				studentId,
				termId: null,
				amountPaid: netAmount,
				discounts: validDiscounts,
				label: label || undefined,
				remarks: remarks || undefined,
				date: `${date}:00.000Z`
			};
			await FeeDuesService.createPayment(paymentRequest);
			await currentStudentStore.fetchDues(studentId, true);
			success = true;
			setTimeout(closeModal, 1500);
		} catch (err) {
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
		const validDiscounts = discounts.filter((d) => d.discountAmount > 0 || d.label.trim() !== '');
		if (validDiscounts.length > 0) {
			const v = validateDiscounts(amountPaid, validDiscounts);
			if (!v.valid) {
				error = v.error || 'Invalid discounts';
				return false;
			}
		}
		return true;
	}

	$: validDiscounts = discounts.filter((d) => d.discountAmount > 0 && d.label.trim() !== '');
	$: totalDiscount = calculateTotalDiscount(validDiscounts);
	$: netAmount = calculateNetAmount(amountPaid, validDiscounts);
</script>

{#if isOpen}
	<div class="modal-veil" on:click={closeModal} on:keydown={(e) => e.key === 'Escape' && closeModal()} role="presentation">
		<div class="modal-s modal-lg" role="dialog" aria-modal="true" on:click|stopPropagation on:keydown|stopPropagation>
			<div class="modal-head">
				<div>
					<h3 class="modal-title-s">Additional <em style="color: var(--accent); font-style: italic;">payment</em></h3>
					<div class="modal-sub">Record a miscellaneous payment{studentName ? ` for ${studentName}` : ''}.</div>
				</div>
				<button class="btn-s btn-ghost-s btn-icon-s" on:click={closeModal} disabled={loading} aria-label="Close"><X size={16} strokeWidth={1.6} /></button>
			</div>

			<div class="modal-body-s">
				<form on:submit|preventDefault={handleSubmit} style="display: flex; flex-direction: column; gap: 16px;">
					<div class="field">
						<label for="additionalAmount">Payment amount *</label>
						<div style="position: relative;">
							<span style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--fg-muted); font-weight: 600;">₹</span>
							<input id="additionalAmount" type="number" step="0.01" min="0.01" bind:value={amountPaid} class="input-s" style="padding-left: 28px; font-size: 18px; font-weight: 500;" placeholder="0.00" disabled={loading} required />
						</div>
					</div>

					<div class="card-s" style="background: var(--bg-elev);">
						<div style="padding: 12px 14px; display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 500;">
							<Tag size={14} strokeWidth={1.6} style="color: var(--fg-muted);" />
							<span>Discounts &amp; adjustments</span>
							{#if validDiscounts.length > 0}<Badge kind="ok">{validDiscounts.length} active</Badge>{/if}
							<button type="button" class="btn-s btn-ghost-s btn-sm-s" style="margin-left: auto;" on:click={addDiscount} disabled={loading}>
								<Plus size={12} strokeWidth={1.8} /> Add
							</button>
						</div>
						{#if discounts.length > 0}
							<div style="padding: 0 14px 14px; display: flex; flex-direction: column; gap: 8px;">
								{#each discounts as discount, index}
									<div style="display: flex; gap: 8px; align-items: center;">
										<input type="text" bind:value={discount.label} class="input-s input-sm" placeholder="Label" disabled={loading} style="flex: 1;" />
										<div style="position: relative; width: 140px;">
											<span style="position: absolute; left: 9px; top: 50%; transform: translateY(-50%); color: var(--fg-muted); font-size: 11px;">₹</span>
											<input type="number" step="0.01" min="0" bind:value={discount.discountAmount} class="input-s input-sm" style="padding-left: 22px;" placeholder="Amount" disabled={loading} />
										</div>
										<button type="button" class="btn-s btn-ghost-s btn-icon-s" style="color: var(--danger);" on:click={() => removeDiscount(index)} disabled={loading} aria-label="Remove">
											<Trash2 size={14} strokeWidth={1.6} />
										</button>
									</div>
								{/each}
							</div>
						{/if}
					</div>

					<div class="grid-2">
						<div class="field">
							<label for="additionalDate">Date &amp; time *</label>
							<input id="additionalDate" type="datetime-local" bind:value={date} class="input-s" disabled={loading} required />
						</div>
						<div class="field">
							<label for="additionalLabel">Label *</label>
							<input id="additionalLabel" type="text" bind:value={label} class="input-s" placeholder="e.g. Transport fee" disabled={loading} required />
						</div>
					</div>

					<div class="field">
						<label for="additionalRemarks">Remarks</label>
						<textarea id="additionalRemarks" bind:value={remarks} class="input-s" placeholder="Notes…" disabled={loading} style="min-height: 80px; resize: vertical;"></textarea>
					</div>

					<div class="card-s" style="background: var(--bg-elev);">
						<div class="card-body-s" style="display: flex; flex-direction: column; gap: 8px;">
							<div style="display: flex; justify-content: space-between; font-size: 13px; color: var(--fg-soft);">
								<span>Subtotal</span>
								<span style="font-family: var(--font-mono);"><Money value={amountPaid} mono={false} /></span>
							</div>
							{#if totalDiscount > 0}
								<div style="display: flex; justify-content: space-between; font-size: 13px; color: var(--ok);">
									<span>Discounts</span>
									<span style="font-family: var(--font-mono);">−<Money value={totalDiscount} mono={false} /></span>
								</div>
							{/if}
							<div class="divider-s" style="margin: 4px 0;"></div>
							<div style="display: flex; justify-content: space-between; align-items: center;">
								<span style="font-weight: 600;">Net payable</span>
								<span style="font-family: var(--font-serif); font-size: 22px; color: var(--accent-deep);"><Money value={netAmount} mono={false} /></span>
							</div>
						</div>
					</div>

					{#if error}
						<div class="callout danger">
							<AlertCircle size={16} strokeWidth={1.6} />
							<div class="callout-body">{error}</div>
						</div>
					{/if}
					{#if success}
						<div class="callout" style="background: var(--ok-soft); border-color: var(--ok); color: var(--ok);">
							<CheckCircle2 size={16} strokeWidth={1.6} />
							<div class="callout-body">Payment recorded successfully.</div>
						</div>
					{/if}
				</form>
			</div>

			<div class="modal-foot">
				<button type="button" class="btn-s btn-secondary-s" on:click={closeModal} disabled={loading}>Cancel</button>
				<button type="button" class="btn-s btn-primary-s" on:click={handleSubmit} disabled={loading || success}>
					{#if loading}<span class="spinner"></span>Processing…{:else}Confirm payment{/if}
				</button>
			</div>
		</div>
	</div>
{/if}
