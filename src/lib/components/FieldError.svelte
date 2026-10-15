<script lang="ts">
	let { errors = {}, field }: { errors?: Record<string, string>; field: string } = $props();
</script>

{#if errors[field]}<div class="field-error">{errors[field]}</div>{/if}
