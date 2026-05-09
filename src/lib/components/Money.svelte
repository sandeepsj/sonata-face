<script lang="ts">
	export let value: number | null | undefined = 0;
	export let mono: boolean = true;
	export let danger: boolean = false;

	function format(v: number | null | undefined): string {
		if (v == null || isNaN(Number(v))) return '0.00';
		return Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
	}

	$: formatted = format(value);
</script>

<span class:tnum={mono} style:color={danger ? 'var(--danger)' : undefined} style:font-family={mono ? 'var(--font-mono)' : undefined}>
	₹{formatted}
</span>
