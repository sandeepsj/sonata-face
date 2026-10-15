<script lang="ts">
	import { canAccess } from '$lib';
	import FeeStructures from './FeeStructures.svelte';
	import FeeTimeline from './FeeTimeline.svelte';

	let canReadTimeline = $derived($canAccess('/api/fee-timeline/**'));

	let structuresPanel: FeeStructures | undefined = $state();
	let timelinePanel: FeeTimeline | undefined = $state();
</script>

<svelte:head>
	<title>Fees — Revathi Arts</title>
</svelte:head>

<div class="page">
	<div class="page-head">
		<div class="page-head-row">
			<div>
				<h1 class="page-title">Fees &amp; <em>timeline</em></h1>
				<p class="page-subtitle">
					School-wide fee structures and when each applies. Dues are calculated from these, from enrolments and from payments.
				</p>
			</div>
		</div>
	</div>

	<div class="fees-grid">
		<div class="fees-col">
			<FeeStructures bind:this={structuresPanel} onChanged={() => timelinePanel?.load()} />
		</div>
		{#if canReadTimeline}
			<div class="fees-col">
				<FeeTimeline bind:this={timelinePanel} onChanged={() => structuresPanel?.load()} />
			</div>
		{/if}
	</div>
</div>

<style>
	.fees-grid {
		display: grid;
		grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
		gap: 16px;
		align-items: start;
	}
	.fees-col {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	@media (max-width: 1100px) {
		.fees-grid {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
