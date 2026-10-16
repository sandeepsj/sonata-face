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

	<div class="fees-stack">
		{#if canReadTimeline}
			<FeeTimeline bind:this={timelinePanel} onChanged={() => structuresPanel?.load()} />
		{/if}
		<FeeStructures bind:this={structuresPanel} onChanged={() => timelinePanel?.load()} />
	</div>
</div>

<style>
	.fees-stack {
		display: flex;
		flex-direction: column;
		gap: 16px;
		max-width: 1100px;
	}
</style>
