<script lang="ts">
	import { Construction } from 'lucide-svelte';
	let { what = 'This page' }: { what?: string } = $props();
</script>

<div class="page">
	<div class="card-s" style="max-width: 520px; margin: 48px auto;">
		<div class="card-body-s" style="text-align: center; padding: 36px 28px;">
			<Construction size={28} strokeWidth={1.5} style="color: var(--fg-muted);" />
			<h2 style="font-family: var(--font-serif); font-weight: 500; margin: 12px 0 6px;">Not available yet</h2>
			<p class="muted" style="margin: 0;">{what} isn't supported by the current backend yet.</p>
		</div>
	</div>
</div>
