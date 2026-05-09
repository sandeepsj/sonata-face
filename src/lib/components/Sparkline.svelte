<script lang="ts">
	export let data: number[] = [];
	export let width = 96;
	export let height = 28;
	export let color: 'primary' | 'success' | 'warning' | 'destructive' | 'muted' = 'primary';
	export let area = true;
	export let showDots = false;
	export let strokeWidth = 1.5;

	$: max = Math.max(...data, 1);
	$: min = Math.min(...data, 0);
	$: range = max - min || 1;

	$: points = data.map((v, i) => {
		const x = (i / Math.max(data.length - 1, 1)) * width;
		const y = height - ((v - min) / range) * (height - strokeWidth * 2) - strokeWidth;
		return [x, y] as const;
	});

	$: pathD = points
		.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(2)},${p[1].toFixed(2)}`)
		.join(' ');

	$: areaD =
		points.length > 0
			? `${pathD} L${width},${height} L0,${height} Z`
			: '';

	$: stroke =
		color === 'primary'
			? 'hsl(var(--primary))'
			: color === 'success'
				? 'hsl(var(--success))'
				: color === 'warning'
					? 'hsl(var(--warning))'
					: color === 'destructive'
						? 'hsl(var(--destructive))'
						: 'hsl(var(--muted-foreground))';

	$: gradientId = `spark-grad-${Math.random().toString(36).slice(2, 9)}`;
</script>

{#if data.length > 0}
	<svg {width} {height} viewBox="0 0 {width} {height}" class="overflow-visible">
		{#if area}
			<defs>
				<linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
					<stop offset="0%" stop-color={stroke} stop-opacity="0.25" />
					<stop offset="100%" stop-color={stroke} stop-opacity="0" />
				</linearGradient>
			</defs>
			<path d={areaD} fill="url(#{gradientId})" />
		{/if}
		<path
			d={pathD}
			fill="none"
			{stroke}
			stroke-width={strokeWidth}
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
		{#if showDots && points.length > 0}
			<circle cx={points[points.length - 1][0]} cy={points[points.length - 1][1]} r="2.5" fill={stroke} />
		{/if}
	</svg>
{/if}
