<script lang="ts">
	import { X, AlertCircle, CheckCircle2, Info } from 'lucide-svelte';
	import { toast } from '$lib/stores/toastStore';
</script>

<div class="toaster" aria-live="polite">
	{#each $toast as t (t.id)}
		<div class="toast" class:error={t.kind === 'error'} class:ok={t.kind === 'ok'} role="status">
			{#if t.kind === 'error'}<AlertCircle size={16} strokeWidth={1.7} />
			{:else if t.kind === 'ok'}<CheckCircle2 size={16} strokeWidth={1.7} />
			{:else}<Info size={16} strokeWidth={1.7} />{/if}
			<span style="flex:1;">{t.message}</span>
			<button class="btn-s btn-ghost-s btn-icon-s" onclick={() => toast.dismiss(t.id)} aria-label="Dismiss"><X size={14} /></button>
		</div>
	{/each}
</div>

<style>
	.toaster { position: fixed; right: 18px; bottom: 18px; display: flex; flex-direction: column; gap: 8px; z-index: 200; max-width: 380px; }
	.toast { display: flex; align-items: center; gap: 10px; padding: 10px 10px 10px 14px; border-radius: 10px; background: var(--surface); border: 1px solid var(--border); box-shadow: var(--shadow-pop); font-size: 13px; }
	.toast.error { border-color: var(--danger); color: var(--danger); background: var(--danger-soft); }
	.toast.ok { border-color: var(--ok); color: var(--ok); background: var(--ok-soft); }
</style>
