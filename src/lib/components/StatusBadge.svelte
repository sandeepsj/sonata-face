<script lang="ts">
	import Badge from './Badge.svelte';

	export let status: string = '';

	function classify(s: string): { kind: 'neutral' | 'ok' | 'warn' | 'danger' | 'info' | 'accent'; label: string } {
		const u = (s || '').toUpperCase();
		switch (u) {
			case 'PAID':
			case 'ACTIVE':
				return { kind: 'ok', label: u === 'ACTIVE' ? 'Active' : 'Paid' };
			case 'DUE':
			case 'OVERDUE':
				return { kind: 'danger', label: u.charAt(0) + u.slice(1).toLowerCase() };
			case 'PARTIALLY_PAID':
			case 'PARTIAL':
				return { kind: 'warn', label: 'Partial' };
			case 'CANCELLED':
			case 'INACTIVE':
				return { kind: 'neutral', label: u.charAt(0) + u.slice(1).toLowerCase() };
			case 'REGULAR':
				return { kind: 'info', label: 'Regular' };
			case 'ADDITIONAL':
				return { kind: 'accent', label: 'Additional' };
			default:
				return { kind: 'neutral', label: s || '—' };
		}
	}

	$: meta = classify(status);
</script>

<Badge kind={meta.kind}>{meta.label}</Badge>
