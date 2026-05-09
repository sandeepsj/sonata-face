<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { X, AlertCircle, Trash2, Plus, Tag, CheckCircle2 } from 'lucide-svelte';
	import {
		FeeDuesService,
		currentStudentStore,
		calculateNetAmount,
		calculateTotalDiscount,
		validateDiscounts,
		type FeeDuesTrackerDTO,
		type PaymentCreateRequest,
		type PaymentDiscount
	} from '$lib';
	import Money from '$lib/components/Money.svelte';
	import Badge from '$lib/components/Badge.svelte';

	export let isOpen = false;
	export let due: FeeDuesTrackerDTO | null = null;
	export let studentId: number;

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

	$: if (isOpen && due) resetForm();

	function resetForm() {
		if (!due) return;
		amountPaid = due.dueAmount;
		label = `Payment for ${due.courseName} - Term ${due.termNumber}, ${due.termYear}`;
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
			const termId = due!.feeStructureId;
			if (!termId) throw new Error(`Fee structure ID not found for ${due!.courseName} - Term ${due!.termNumber}, ${due!.termYear}`);
			const validDiscounts = discounts.length > 0
				? discounts.filter((d) => d.discountAmount > 0 && d.label.trim() !== '')
				: undefined;
			const netAmount = calculateNetAmount(amountPaid, validDiscounts);
			const paymentRequest: PaymentCreateRequest = {
				studentId,
				termId,
				amountPaid: netAmount,
				discounts: validDiscounts,
				courseName: due!.courseName,
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
					<h3 class="modal-title-s">Record <em style="color: var(--accent); font-style: italic;">payment</em></h3>
					<div class="modal-sub">Apply funds against an open due.</div>
				</div>
				<button class="btn-s btn-ghost-s btn-icon-s" on:click={closeModal} disabled={loading} aria-label="Close"><X size={16} strokeWidth={1.6} /></button>
			</div>

			<div class="modal-body-s">
				{#if due}
					<div class="card-s" style="background: var(--bg-elev); margin-bottom: 18px;">
						<div class="card-body-s" style="display: flex; justify-content: space-between; align-items: flex-start; gap: 14px; flex-wrap: wrap;">
							<div>
								<div class="kpi-label" style="margin-bottom: 4px;">Payment for</div>
								<div style="font-family: var(--font-serif); font-size: 17px; font-weight: 500;">{due.courseName}</div>
								<div class="muted" style="font-size: 12px; margin-top: 2px;">Term {due.termNumber}, {due.termYear}</div>
							</div>
							<div style="text-align: right;">
								<div class="kpi-label" style="margin-bottom: 4px;">Due amount</div>
								<div style="font-family: var(--font-serif); font-size: 24px; color: var(--danger);"><Money value={due.dueAmount} mono={false} /></div>
								<div style="margin-top: 4px;"><Badge kind="warn">{due.status}</Badge></div>
							</div>
						</div>
					</div>

					<form on:submit|preventDefault={handleSubmit} style="display: flex; flex-direction: column; gap: 16px;">
						<div class="field">
							<label for="amount">Payment amount <span class="muted" style="float: right;">Max: <Money value={due.dueAmount} mono={false} /></span></label>
							<div style="position: relative;">
								<span style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--fg-muted); font-weight: 600;">₹</span>
								<input id="amount" type="number" step="0.01" min="0.01" max={due.dueAmount} bind:value={amountPaid} class="input-s" style="padding-left: 28px; font-size: 18px; font-weight: 500;" placeholder="0.00" disabled={loading} required />
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
								<label for="date">Date &amp; time</label>
								<input id="date" type="datetime-local" bind:value={date} class="input-s" disabled={loading} required />
							</div>
							<div class="field">
								<label for="label">Label</label>
								<input id="label" type="text" bind:value={label} class="input-s" placeholder="e.g. Term 1 fee" disabled={loading} />
							</div>
						</div>

						<div class="field">
							<label for="remarks">Remarks</label>
							<textarea id="remarks" bind:value={remarks} class="input-s" placeholder="Notes…" disabled={loading} style="min-height: 80px; resize: vertical;"></textarea>
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
				{/if}
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
