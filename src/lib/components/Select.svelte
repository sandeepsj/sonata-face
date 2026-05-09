<script lang="ts" module>
	export type SelectOption<T = string | number | null> = {
		value: T;
		label: string;
		sub?: string;
		swatch?: string;
		disabled?: boolean;
	};
</script>

<script lang="ts" generics="T extends string | number | null">
	import { ChevronDown, Check } from 'lucide-svelte';

	interface Props {
		value: T;
		options: SelectOption<T>[];
		placeholder?: string;
		disabled?: boolean;
		size?: 'sm' | 'md';
		fullWidth?: boolean;
		onChange?: (value: T) => void;
		ariaLabel?: string;
	}

	let {
		value = $bindable(),
		options,
		placeholder = 'Select…',
		disabled = false,
		size = 'md',
		fullWidth = true,
		onChange,
		ariaLabel
	}: Props = $props();

	let open = $state(false);
	let triggerEl: HTMLButtonElement | null = $state(null);
	let panelEl: HTMLDivElement | null = $state(null);
	let activeIndex = $state(-1);

	let selected = $derived(options.find((o) => o.value === value) ?? null);

	function toggle() {
		if (disabled) return;
		open = !open;
		if (open) {
			activeIndex = options.findIndex((o) => o.value === value);
			queueMicrotask(() => panelEl?.focus());
		}
	}
	function close() {
		open = false;
		activeIndex = -1;
	}
	function choose(opt: SelectOption<T>) {
		if (opt.disabled) return;
		value = opt.value;
		onChange?.(opt.value);
		close();
		triggerEl?.focus();
	}

	function onKeyTrigger(e: KeyboardEvent) {
		if (disabled) return;
		if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			open = true;
			activeIndex = Math.max(0, options.findIndex((o) => o.value === value));
			queueMicrotask(() => panelEl?.focus());
		}
	}

	function onKeyPanel(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			close();
			triggerEl?.focus();
			return;
		}
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			activeIndex = nextEnabled(activeIndex, 1);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			activeIndex = nextEnabled(activeIndex, -1);
		} else if (e.key === 'Home') {
			e.preventDefault();
			activeIndex = nextEnabled(-1, 1);
		} else if (e.key === 'End') {
			e.preventDefault();
			activeIndex = nextEnabled(options.length, -1);
		} else if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			const opt = options[activeIndex];
			if (opt) choose(opt);
		}
	}

	function nextEnabled(from: number, dir: 1 | -1): number {
		const n = options.length;
		let i = from;
		for (let step = 0; step < n; step++) {
			i = (i + dir + n) % n;
			if (!options[i].disabled) return i;
		}
		return from;
	}

	function onDocClick(e: MouseEvent) {
		if (!open) return;
		const target = e.target as Node;
		if (triggerEl?.contains(target) || panelEl?.contains(target)) return;
		close();
	}

	$effect(() => {
		if (!open) return;
		document.addEventListener('mousedown', onDocClick);
		return () => document.removeEventListener('mousedown', onDocClick);
	});
</script>

<div class="msel" class:msel-fw={fullWidth}>
	<button
		type="button"
		bind:this={triggerEl}
		class="msel-trigger"
		class:msel-sm={size === 'sm'}
		class:is-open={open}
		{disabled}
		aria-haspopup="listbox"
		aria-expanded={open}
		aria-label={ariaLabel}
		onclick={toggle}
		onkeydown={onKeyTrigger}
	>
		<span class="msel-value" class:placeholder={!selected}>
			{#if selected?.swatch}
				<span class="msel-swatch" style="background: {selected.swatch};"></span>
			{/if}
			<span class="msel-label">{selected ? selected.label : placeholder}</span>
		</span>
		<ChevronDown size={14} strokeWidth={1.6} class="msel-chev" />
	</button>

	{#if open}
		<div
			bind:this={panelEl}
			class="msel-panel"
			role="listbox"
			tabindex="-1"
			aria-activedescendant={activeIndex >= 0 ? `msel-opt-${activeIndex}` : undefined}
			onkeydown={onKeyPanel}
		>
			{#each options as opt, i (opt.value)}
				{@const isSel = opt.value === value}
				<button
					type="button"
					id="msel-opt-{i}"
					class="msel-opt"
					class:is-sel={isSel}
					class:is-active={i === activeIndex}
					class:is-disabled={opt.disabled}
					role="option"
					aria-selected={isSel}
					aria-disabled={opt.disabled || undefined}
					onmousemove={() => (activeIndex = i)}
					onclick={() => choose(opt)}
				>
					{#if opt.swatch}
						<span class="msel-swatch" style="background: {opt.swatch};"></span>
					{/if}
					<span class="msel-opt-text">
						<span class="msel-opt-label">{opt.label}</span>
						{#if opt.sub}<span class="msel-opt-sub">{opt.sub}</span>{/if}
					</span>
					{#if isSel}
						<Check size={14} strokeWidth={2} class="msel-check" />
					{/if}
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.msel { position: relative; display: inline-block; }
	.msel-fw { display: block; width: 100%; }

	.msel-trigger {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		width: 100%;
		min-height: 36px;
		padding: 8px 10px 8px 12px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 8px;
		color: var(--fg);
		font: inherit;
		font-size: 13px;
		text-align: left;
		cursor: pointer;
		transition: border-color 120ms, box-shadow 120ms, background 120ms;
	}
	.msel-trigger:hover:not(:disabled) { border-color: var(--border-strong); }
	.msel-trigger:focus-visible { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
	.msel-trigger.is-open { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
	.msel-trigger:disabled { opacity: 0.55; cursor: not-allowed; }
	.msel-sm { min-height: 30px; padding: 4px 8px 4px 10px; font-size: 12.5px; border-radius: 6px; }

	.msel-value {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
		flex: 1;
		overflow: hidden;
	}
	.msel-value.placeholder { color: var(--fg-muted); }
	.msel-label {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.msel-swatch {
		width: 12px;
		height: 12px;
		border-radius: 999px;
		flex-shrink: 0;
		border: 1px solid var(--border-strong);
	}
	.msel-trigger :global(.msel-chev) { color: var(--fg-muted); flex-shrink: 0; transition: transform 160ms; }
	.msel-trigger.is-open :global(.msel-chev) { transform: rotate(180deg); }

	.msel-panel {
		position: absolute;
		top: calc(100% + 4px);
		left: 0;
		right: 0;
		min-width: 100%;
		max-height: 280px;
		overflow-y: auto;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 10px;
		box-shadow: var(--shadow-pop);
		padding: 4px;
		z-index: 60;
		outline: none;
		animation: msel-pop 120ms ease-out;
	}
	@keyframes msel-pop {
		from { opacity: 0; transform: translateY(-4px); }
		to { opacity: 1; transform: translateY(0); }
	}

	.msel-opt {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 8px 10px;
		border: 0;
		border-radius: 6px;
		background: transparent;
		color: var(--fg);
		font: inherit;
		font-size: 13px;
		text-align: left;
		cursor: pointer;
		transition: background 100ms, color 100ms;
	}
	.msel-opt + .msel-opt { margin-top: 2px; }
	.msel-opt.is-active:not(.is-disabled) { background: var(--hover); }
	.msel-opt.is-sel {
		background: var(--accent-soft);
		color: var(--accent-deep);
		font-weight: 500;
	}
	.msel-opt.is-disabled { opacity: 0.5; cursor: not-allowed; }
	.msel-opt-text {
		display: flex;
		flex-direction: column;
		gap: 1px;
		min-width: 0;
		flex: 1;
	}
	.msel-opt-label {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.msel-opt-sub {
		font-size: 11px;
		color: var(--fg-muted);
		font-weight: 400;
	}
	.msel-opt :global(.msel-check) { color: var(--accent-deep); flex-shrink: 0; }
</style>
