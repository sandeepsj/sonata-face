<script lang="ts">
	import { AlertCircle } from 'lucide-svelte';
	let { message = '' }: { message?: string | null } = $props();
</script>

{#if message}
	<div class="callout danger" role="alert">
		<AlertCircle size={16} strokeWidth={1.6} />
		<div class="callout-body">{message}</div>
	</div>
{/if}
