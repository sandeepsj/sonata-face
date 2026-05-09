<script lang="ts">
	import { ArrowUp, ArrowDown, Minus } from 'lucide-svelte';
	import Sparkline from './Sparkline.svelte';
	import type { ComponentType } from 'svelte';

	export let label: string;
	export let value: string | number;
	export let sub: string | undefined = undefined;
	export let delta: number | null = null; // percent
	export let trend: number[] | null = null;
	export let icon: ComponentType | null = null;
	export let tone: 'primary' | 'success' | 'warning' | 'destructive' | 'muted' = 'primary';

	$: hasDelta = delta !== null && delta !== undefined && !Number.isNaN(delta);
	$: deltaClass = !hasDelta ? 'flat' : delta! > 0 ? 'up' : delta! < 0 ? 'down' : 'flat';
	$: deltaArrow = !hasDelta ? Minus : delta! > 0 ? ArrowUp : delta! < 0 ? ArrowDown : Minus;
</script>

<div class="card-x card-x-hover p-4 flex flex-col gap-3 h-full">
	<div class="flex items-start justify-between gap-3">
		<div class="flex-1 min-w-0">
			<div class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
				{label}
			</div>
			<div class="mt-2 flex items-baseline gap-2">
				<div class="text-[24px] font-semibold tracking-tight tnum leading-none truncate">
					{value}
				</div>
				{#if hasDelta}
					<span class="delta {deltaClass}">
						<svelte:component this={deltaArrow} size={10} strokeWidth={2.4} />
						{Math.abs(delta!).toFixed(1)}%
					</span>
				{/if}
			</div>
			{#if sub}
				<div class="text-[11.5px] text-muted-foreground mt-1.5">{sub}</div>
			{/if}
		</div>
		{#if icon}
			<div
				class="h-8 w-8 rounded-md flex items-center justify-center flex-shrink-0"
				style="background: hsl(var(--{tone === 'muted' ? 'muted' : tone}) / {tone === 'muted' ? 1 : 0.12}); color: hsl(var(--{tone === 'muted' ? 'muted-foreground' : tone}));"
			>
				<svelte:component this={icon} size={14} strokeWidth={1.8} />
			</div>
		{/if}
	</div>
	{#if trend && trend.length > 0}
		<div class="-mb-1">
			<Sparkline data={trend} color={tone} width={220} height={32} area showDots />
		</div>
	{/if}
</div>
