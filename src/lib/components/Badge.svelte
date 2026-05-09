<script lang="ts">
	export let kind: 'neutral' | 'ok' | 'warn' | 'danger' | 'info' | 'accent' = 'neutral';
	export let dot: boolean = false;
</script>

<span class="bdg bdg-{kind}">
	{#if dot}<span class="bdg-dot"></span>{/if}
	<slot />
</span>
