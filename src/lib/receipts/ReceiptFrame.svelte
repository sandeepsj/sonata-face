<script lang="ts">
	// Shows a filled receipt template. The template is user-written HTML that may run scripts, so it lives in a
	// sandboxed iframe WITHOUT allow-same-origin (REQ-090.AC9): it gets an opaque origin and can't read the token,
	// localStorage or cookies, or call the API as the user. allow-modals lets it open the print dialog.
	import ErrorCallout from '$lib/components/ErrorCallout.svelte';
	import type { ReceiptData } from './data';
	import { PRINT_MESSAGE, renderReceipt } from './render';

	interface Props {
		html: string | null;
		data: ReceiptData;
		/** Wait this long after a change before re-rendering (the editor types into it) */
		debounce?: number;
		title?: string;
	}
	let { html, data, debounce = 0, title = 'Receipt' }: Props = $props();

	let iframe: HTMLIFrameElement | undefined = $state();
	let doc = $state('');
	let error = $state('');
	let run = 0;

	$effect(() => {
		const src = html;
		const d = data;
		const id = ++run;
		if (src == null) {
			doc = '';
			error = '';
			return;
		}
		if (!debounce) doc = '';
		const go = async () => {
			const r = await renderReceipt(src, d);
			if (id !== run) return;
			error = r.error ? `The template couldn't be filled in: ${r.error}` : '';
			if (r.doc != null) doc = r.doc;
		};
		if (!debounce) {
			go();
			return;
		}
		const t = setTimeout(go, debounce);
		return () => clearTimeout(t);
	});

	/** Opens the print dialog for the receipt (from inside the iframe) */
	export function print(): boolean {
		if (!iframe?.contentWindow || !doc || error) return false;
		iframe.contentWindow.postMessage({ type: PRINT_MESSAGE }, '*');
		return true;
	}
</script>

<div class="frame-wrap">
	<ErrorCallout message={error} />
	{#if html == null || !doc}
		{#if !error}<div class="frame-loading"><span class="spinner spinner-lg"></span></div>{/if}
	{:else}
		<!-- A new iframe per document: changing srcdoc in place sometimes leaves a blank frame -->
		{#key doc}
			<iframe bind:this={iframe} {title} sandbox="allow-scripts allow-modals" srcdoc={doc} class:stale={!!error}></iframe>
		{/key}
	{/if}
</div>

<style>
	.frame-wrap {
		display: flex;
		flex-direction: column;
		gap: 8px;
		height: 100%;
		min-height: 0;
	}
	iframe {
		flex: 1;
		width: 100%;
		min-height: 0;
		background: white;
		border: 1px solid var(--border);
		border-radius: 8px;
	}
	iframe.stale {
		opacity: 0.5;
	}
	.frame-loading {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--fg-muted);
	}
</style>
