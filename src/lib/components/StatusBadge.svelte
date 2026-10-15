<script lang="ts">
	import Badge from './Badge.svelte';

	let { status = '' }: { status?: string | null } = $props();

	type Kind = 'neutral' | 'ok' | 'warn' | 'danger' | 'info' | 'accent';

	function classify(s: string): { kind: Kind; label: string } {
		const u = (s || '').toUpperCase();
		switch (u) {
			case 'PAID':
				return { kind: 'ok', label: 'Paid' };
			case 'ACTIVE':
				return { kind: 'ok', label: 'Active' };
			case 'DUE':
				return { kind: 'danger', label: 'Due' };
			case 'PARTIALLY_PAID':
				return { kind: 'warn', label: 'Partial' };
			case 'CLOSED':
				return { kind: 'neutral', label: 'Closed' };
			case 'INACTIVE':
				return { kind: 'neutral', label: 'Inactive' };
			case 'REGULAR':
				return { kind: 'info', label: 'Course fee' };
			case 'ADDITIONAL':
				return { kind: 'accent', label: 'Additional' };
			default:
				return { kind: 'neutral', label: s || '—' };
		}
	}

	let meta = $derived(classify(status ?? ''));
</script>

<Badge kind={meta.kind}>{meta.label}</Badge>
