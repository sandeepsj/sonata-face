<script lang="ts">
	import type { Snippet } from 'svelte';
	import { X } from 'lucide-svelte';

	interface Props {
		open: boolean;
		title: string;
		subtitle?: string;
		size?: 'md' | 'lg' | 'xl';
		busy?: boolean;
		onClose: () => void;
		children: Snippet;
		footer?: Snippet;
	}
	let { open, title, subtitle, size = 'md', busy = false, onClose, children, footer }: Props = $props();

	function close() {
		if (!busy) onClose();
	}
</script>

{#if open}
	<div class="modal-veil" onclick={close} onkeydown={(e) => e.key === 'Escape' && close()} role="presentation">
		<div
			class="modal-s"
			class:modal-lg={size === 'lg'}
			class:modal-xl={size === 'xl'}
			role="dialog"
			aria-modal="true"
			aria-label={title}
			tabindex="-1"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
		>
			<div class="modal-head">
				<div>
					<h3 class="modal-title-s">{title}</h3>
					{#if subtitle}<div class="modal-sub">{subtitle}</div>{/if}
				</div>
				<button class="btn-s btn-ghost-s btn-icon-s" onclick={close} disabled={busy} aria-label="Close"><X size={16} strokeWidth={1.6} /></button>
			</div>
			<div class="modal-body-s">{@render children()}</div>
			{#if footer}<div class="modal-foot">{@render footer()}</div>{/if}
		</div>
	</div>
{/if}
