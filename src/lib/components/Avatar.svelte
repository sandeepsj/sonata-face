<script lang="ts">
	export let name: string = '';
	export let size: 'sm' | 'md' | 'lg' | 'xl' = 'md';

	$: initials = (name || '?')
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((p) => p[0]?.toUpperCase() ?? '')
		.join('') || '?';

	$: sizeClass = size === 'lg' ? 'av av-lg' : size === 'xl' ? 'av av-xl' : size === 'sm' ? 'av av-sm' : 'av';
</script>

<span class={sizeClass} aria-label={name}>{initials}</span>

<style>
	.av-sm { width: 22px; height: 22px; font-size: 10px; }
</style>
