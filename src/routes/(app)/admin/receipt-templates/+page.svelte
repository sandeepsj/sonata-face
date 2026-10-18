<script lang="ts">
	// Receipt templates (REQ-090/091): HTML documents with Handlebars variables. Edited here with a live preview
	// filled with sample data; the preview runs in the sandboxed ReceiptFrame like the real print.
	import { onDestroy, onMount, tick } from 'svelte';
	import { beforeNavigate, goto } from '$app/navigation';
	import { Plus, Save, CopyPlus, Star, Trash2, FileText } from 'lucide-svelte';
	import type { EditorView } from '@codemirror/view';
	import type { Compartment } from '@codemirror/state';
	import { api, canAccess, errorMessage, fieldErrors, toast } from '$lib';
	import type { ReceiptTemplate, ReceiptTemplateSummary } from '$lib';
	import Modal from '$lib/components/Modal.svelte';
	import ErrorCallout from '$lib/components/ErrorCallout.svelte';
	import FieldError from '$lib/components/FieldError.svelte';
	import Badge from '$lib/components/Badge.svelte';
	import ReceiptFrame from '$lib/receipts/ReceiptFrame.svelte';
	import { RECEIPT_VARIABLES, SAMPLE_RECEIPT, type ReceiptVariable } from '$lib/receipts/data';
	import { STANDARD_TEMPLATE_HTML } from '$lib/receipts/standard';

	let templates: ReceiptTemplateSummary[] = $state([]);
	let loading = $state(true);
	let loadError = $state('');

	/** The template open in the editor; `id: null` is a new, unsaved one */
	let current = $state<{ id: number | null; builtIn: boolean; isDefault: boolean } | null>(null);
	let opening = $state(false);
	let name = $state('');
	let code = $state('');
	let savedName = $state('');
	let savedCode = $state('');
	let dirty = $derived(current != null && (name !== savedName || code !== savedCode));

	let canWrite = $derived($canAccess('/api/receipt-templates/**', 'write'));
	let readOnly = $derived(!canWrite || !!current?.builtIn);

	let busy = $state(false);
	let formError = $state('');
	let errors: Record<string, string> = $state({});

	// dialogs
	let saveAsOpen = $state(false);
	let saveAsName = $state('');
	let saveAsError = $state('');
	let saveAsErrors: Record<string, string> = $state({});
	let deleteOpen = $state(false);
	let deleteError = $state('');
	let discardOpen = $state(false);
	let afterDiscard: (() => void) | null = null;

	// CodeMirror
	let editorEl: HTMLDivElement | undefined = $state();
	let view: EditorView | null = null;
	let readOnlyConf: Compartment | null = null;
	let cm: { EditorView: typeof import('@codemirror/view').EditorView; EditorState: typeof import('@codemirror/state').EditorState } | null = null;

	onMount(() => {
		load(true);
		const onUnload = (e: BeforeUnloadEvent) => {
			if (dirty) e.preventDefault();
		};
		window.addEventListener('beforeunload', onUnload);
		return () => window.removeEventListener('beforeunload', onUnload);
	});
	onDestroy(() => view?.destroy());

	beforeNavigate((nav) => {
		if (!dirty || nav.type === 'leave') return;
		nav.cancel();
		const to = nav.to?.url;
		if (to) confirmDiscard(() => goto(to));
	});

	async function load(openDefault = false) {
		loadError = '';
		try {
			templates = await api.receiptTemplates.list();
			if (openDefault) {
				const def = templates.find((t) => t.isDefault) ?? templates[0];
				if (def) await open(def.id);
			}
		} catch (e) {
			loadError = errorMessage(e, "Templates couldn't be loaded");
		} finally {
			loading = false;
		}
	}

	function confirmDiscard(then: () => void) {
		if (!dirty) return then();
		afterDiscard = then;
		discardOpen = true;
	}

	function discard() {
		discardOpen = false;
		savedName = name;
		savedCode = code;
		const then = afterDiscard;
		afterDiscard = null;
		then?.();
	}

	function show(t: { id: number | null; builtIn: boolean; isDefault: boolean; name: string; html: string }) {
		current = { id: t.id, builtIn: t.builtIn, isDefault: t.isDefault };
		name = savedName = t.name;
		code = savedCode = t.html;
		formError = '';
		errors = {};
		setEditorDoc(t.html);
	}

	async function open(id: number) {
		opening = true;
		try {
			show(await api.receiptTemplates.get(id));
		} catch (e) {
			toast.error(errorMessage(e, "The template couldn't be opened"));
		} finally {
			opening = false;
		}
	}

	async function startNew() {
		// Start from the built-in template's HTML
		const builtIn = templates.find((t) => t.builtIn);
		let html = STANDARD_TEMPLATE_HTML;
		if (builtIn) {
			try {
				html = (await api.receiptTemplates.get(builtIn.id)).html;
			} catch {
				/* the bundled copy will do */
			}
		}
		show({ id: null, builtIn: false, isDefault: false, name: '', html });
		savedCode = '';
		await tick();
		document.getElementById('tpl-name')?.focus();
	}

	// ---------- editor ----------

	$effect(() => {
		if (editorEl && !view) initEditor(editorEl);
	});

	$effect(() => {
		const ro = readOnly;
		if (view && readOnlyConf && cm) {
			view.dispatch({ effects: readOnlyConf.reconfigure([cm.EditorState.readOnly.of(ro), cm.EditorView.editable.of(!ro)]) });
		}
	});

	async function initEditor(el: HTMLDivElement) {
		const [{ basicSetup }, { EditorView }, { EditorState, Compartment }, { html }] = await Promise.all([
			import('codemirror'),
			import('@codemirror/view'),
			import('@codemirror/state'),
			import('@codemirror/lang-html')
		]);
		if (view) return;
		cm = { EditorView, EditorState };
		readOnlyConf = new Compartment();
		view = new EditorView({
			parent: el,
			doc: code,
			extensions: [
				basicSetup,
				html(),
				EditorView.lineWrapping,
				readOnlyConf.of([EditorState.readOnly.of(readOnly), EditorView.editable.of(!readOnly)]),
				EditorView.updateListener.of((u) => {
					if (u.docChanged) code = u.state.doc.toString();
				}),
				EditorView.theme({
					'&': { height: '100%', fontSize: '12.5px', backgroundColor: 'var(--surface)', color: 'var(--fg)' },
					'.cm-scroller': { fontFamily: 'var(--font-mono)' },
					'.cm-gutters': { backgroundColor: 'var(--bg-elev)', color: 'var(--fg-muted)', borderRight: '1px solid var(--border)' },
					'.cm-activeLine, .cm-activeLineGutter': { backgroundColor: 'color-mix(in srgb, var(--accent) 7%, transparent)' },
					'&.cm-focused': { outline: 'none' }
				})
			]
		});
	}

	function setEditorDoc(text: string) {
		if (view && view.state.doc.toString() !== text) {
			view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } });
		}
	}

	function insertVariable(v: ReceiptVariable) {
		if (!view || readOnly) return;
		view.dispatch(view.state.replaceSelection(v.insert));
		view.focus();
	}

	// ---------- actions ----------

	async function save() {
		if (!current || readOnly) return;
		formError = '';
		errors = {};
		busy = true;
		const body = { name: name.trim(), html: code };
		try {
			const t = current.id == null ? await api.receiptTemplates.create(body) : await api.receiptTemplates.update(current.id, body);
			toast.ok(current.id == null ? `Template "${t.name}" created` : `Template "${t.name}" saved`);
			show(t);
			await load();
		} catch (e) {
			formError = errorMessage(e, "The template wasn't saved");
			errors = fieldErrors(e);
		} finally {
			busy = false;
		}
	}

	function openSaveAs() {
		saveAsName = name.trim() ? `${name.trim()} copy` : '';
		saveAsError = '';
		saveAsErrors = {};
		saveAsOpen = true;
	}

	async function saveAs() {
		saveAsError = '';
		saveAsErrors = {};
		busy = true;
		try {
			const t = await api.receiptTemplates.create({ name: saveAsName.trim(), html: code });
			toast.ok(`Template "${t.name}" created`);
			saveAsOpen = false;
			show(t);
			await load();
		} catch (e) {
			saveAsError = errorMessage(e, "The template wasn't saved");
			saveAsErrors = fieldErrors(e);
		} finally {
			busy = false;
		}
	}

	async function makeDefault() {
		if (current?.id == null) return;
		busy = true;
		try {
			const t = await api.receiptTemplates.makeDefault(current.id);
			current = { ...current, isDefault: true };
			toast.ok(`"${t.name}" is now the default receipt`);
			await load();
		} catch (e) {
			toast.error(errorMessage(e, "The default wasn't changed"));
		} finally {
			busy = false;
		}
	}

	async function remove() {
		if (current?.id == null) return;
		deleteError = '';
		busy = true;
		try {
			await api.receiptTemplates.remove(current.id);
			toast.ok(`Template "${savedName}" deleted${current.isDefault ? '. Standard is the default again.' : ''}`);
			deleteOpen = false;
			current = null;
			name = savedName = code = savedCode = '';
			await load(true);
		} catch (e) {
			deleteError = errorMessage(e, "The template wasn't deleted");
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head><title>Receipt templates — Revathi Arts</title></svelte:head>

<div class="page tpl-page">
	<div class="page-head">
		<div class="page-head-row">
			<div>
				<h1 class="page-title">Receipt <em>templates</em></h1>
				<p class="page-subtitle">
					Each template is an HTML page. Variables in <code>{'{{…}}'}</code> are filled in when a receipt is printed. The default template is
					preselected when printing.
				</p>
			</div>
			{#if canWrite}
				<button class="btn-s btn-primary-s" onclick={() => confirmDiscard(startNew)} disabled={busy}><Plus size={14} strokeWidth={1.8} /> New template</button>
			{/if}
		</div>
	</div>

	{#if loading}
		<div class="empty-s"><span class="spinner"></span></div>
	{:else if loadError}
		<ErrorCallout message={loadError} />
	{:else}
		<div class="tpl-grid">
			<!-- list -->
			<div class="card-s tpl-list">
				{#each templates as t (t.id)}
					<button class="tpl-row" class:active={current?.id === t.id} onclick={() => current?.id !== t.id && confirmDiscard(() => open(t.id))}>
						<FileText size={14} strokeWidth={1.6} />
						<span class="tpl-row-text">
							<span class="tpl-row-name">{t.name}</span>
							{#if t.isDefault || t.builtIn}
								<span class="tpl-row-badges">
									{#if t.isDefault}<Badge kind="ok">Default</Badge>{/if}
									{#if t.builtIn}<Badge kind="neutral">Built-in</Badge>{/if}
								</span>
							{/if}
						</span>
					</button>
				{/each}
				{#if current && current.id == null}
					<div class="tpl-row active">
						<Plus size={14} strokeWidth={1.6} />
						<span class="tpl-row-text">
							<span class="tpl-row-name">{name.trim() || 'New template'}</span>
							<span class="tpl-row-badges"><Badge kind="warn">Unsaved</Badge></span>
						</span>
					</div>
				{/if}
			</div>

			<!-- editor -->
			<div class="card-s tpl-editor">
				{#if current}
					<div class="tpl-editor-head">
						<div class="field" style="flex: 1; margin: 0;">
							<input
								id="tpl-name"
								class="input-s"
								class:input-error-s={errors.name}
								bind:value={name}
								disabled={readOnly || busy}
								placeholder="Template name"
								aria-label="Template name"
								maxlength="80"
							/>
							<FieldError {errors} field="name" />
						</div>
						<div class="tpl-actions">
							{#if canWrite}
								{#if !current.builtIn}
									<button class="btn-s btn-primary-s btn-sm-s" onclick={save} disabled={busy || (!dirty && current.id != null)}>
										{#if busy}<span class="spinner"></span>{:else}<Save size={13} strokeWidth={1.8} />{/if} Save
									</button>
								{/if}
								{#if current.id != null}
									<button class="btn-s btn-secondary-s btn-sm-s" onclick={openSaveAs} disabled={busy}><CopyPlus size={13} strokeWidth={1.8} /> Save as new…</button>
									{#if !current.isDefault}
										<button class="btn-s btn-secondary-s btn-sm-s" onclick={makeDefault} disabled={busy || dirty} title={dirty ? 'Save your changes first' : undefined}>
											<Star size={13} strokeWidth={1.8} /> Make default
										</button>
									{/if}
									{#if !current.builtIn}
										<button class="btn-s btn-ghost-s btn-icon-s" style="color: var(--danger);" onclick={() => ((deleteError = ''), (deleteOpen = true))} disabled={busy} title="Delete" aria-label="Delete template">
											<Trash2 size={14} />
										</button>
									{/if}
								{/if}
							{/if}
						</div>
					</div>
					{#if current.builtIn && canWrite}
						<div class="muted tpl-note">The built-in template can't be changed. Use “Save as new…” to make your own copy.</div>
					{:else if !canWrite}
						<div class="muted tpl-note">You can view templates but not change them.</div>
					{/if}
					<ErrorCallout message={formError} />
					<FieldError {errors} field="html" />

					{#if !readOnly}
						<div class="tpl-vars">
							{#each RECEIPT_VARIABLES as g}
								<div class="tpl-vars-group">{g.group}</div>
								<div class="tpl-vars-chips">
									{#each g.items as v}
										<button class="tpl-chip" title="{v.meaning} — click to insert" onclick={() => insertVariable(v)}>{v.label}</button>
									{/each}
								</div>
							{/each}
						</div>
					{/if}
				{:else if opening}
					<div class="empty-s"><span class="spinner"></span></div>
				{:else}
					<div class="empty-s">Pick a template to edit.</div>
				{/if}
				<div class="tpl-code" class:hidden-editor={!current} bind:this={editorEl}></div>
			</div>

			<!-- preview -->
			<div class="card-s tpl-preview">
				<div class="tpl-preview-head">Preview <span class="muted">· sample data</span></div>
				<div class="tpl-preview-body">
					{#if current}
						<ReceiptFrame html={code} data={SAMPLE_RECEIPT} debounce={300} title="Template preview" />
					{/if}
				</div>
			</div>
		</div>
	{/if}
</div>

<Modal open={saveAsOpen} title="Save as a new template" busy={busy} onClose={() => (saveAsOpen = false)}>
	<form
		id="save-as-form"
		onsubmit={(e) => {
			e.preventDefault();
			saveAs();
		}}
		style="display: flex; flex-direction: column; gap: 12px;"
	>
		<div class="field">
			<label for="save-as-name">Name *</label>
			<input id="save-as-name" class="input-s" class:input-error-s={saveAsErrors.name} bind:value={saveAsName} disabled={busy} maxlength="80" />
			<FieldError errors={saveAsErrors} field="name" />
		</div>
		<FieldError errors={saveAsErrors} field="html" />
		<ErrorCallout message={saveAsError} />
	</form>
	{#snippet footer()}
		<button class="btn-s btn-secondary-s" onclick={() => (saveAsOpen = false)} disabled={busy}>Cancel</button>
		<button class="btn-s btn-primary-s" type="submit" form="save-as-form" disabled={busy}>
			{#if busy}<span class="spinner"></span>{:else}<CopyPlus size={14} strokeWidth={1.8} />{/if} Save
		</button>
	{/snippet}
</Modal>

<Modal open={deleteOpen} title="Delete template" subtitle={`"${savedName}"`} busy={busy} onClose={() => (deleteOpen = false)}>
	<p style="margin: 0;">
		This template will be deleted.{#if current?.isDefault}{' '}It is the default, so the built-in Standard template becomes the default again.{/if}
	</p>
	<ErrorCallout message={deleteError} />
	{#snippet footer()}
		<button class="btn-s btn-secondary-s" onclick={() => (deleteOpen = false)} disabled={busy}>Cancel</button>
		<button class="btn-s btn-primary-s" style="background: var(--danger); border-color: var(--danger);" onclick={remove} disabled={busy}>
			{#if busy}<span class="spinner"></span>{:else}<Trash2 size={14} strokeWidth={1.8} />{/if} Delete
		</button>
	{/snippet}
</Modal>

<Modal open={discardOpen} title="Discard changes?" onClose={() => ((discardOpen = false), (afterDiscard = null))}>
	<p style="margin: 0;">“{savedName || name || 'New template'}” has changes that aren't saved.</p>
	{#snippet footer()}
		<button class="btn-s btn-secondary-s" onclick={() => ((discardOpen = false), (afterDiscard = null))}>Keep editing</button>
		<button class="btn-s btn-primary-s" style="background: var(--danger); border-color: var(--danger);" onclick={discard}>Discard</button>
	{/snippet}
</Modal>

<style>
	.tpl-page {
		max-width: none;
	}
	.tpl-grid {
		display: grid;
		grid-template-columns: 220px minmax(0, 1fr) minmax(0, 1fr);
		gap: 16px;
		height: calc(100vh - 230px);
		min-height: 520px;
	}
	.tpl-list {
		padding: 6px;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.tpl-row {
		display: flex;
		align-items: flex-start;
		gap: 8px;
		width: 100%;
		padding: 8px 10px;
		border: 0;
		border-radius: 8px;
		background: none;
		color: var(--fg);
		font: inherit;
		font-size: 13.5px;
		text-align: left;
		cursor: pointer;
	}
	.tpl-row:hover {
		background: var(--bg-elev);
	}
	.tpl-row.active {
		background: var(--accent-soft);
	}
	.tpl-row-text {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 3px;
	}
	.tpl-row-badges {
		display: flex;
		gap: 4px;
	}
	.tpl-row-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.tpl-editor,
	.tpl-preview {
		display: flex;
		flex-direction: column;
		min-height: 0;
		overflow: hidden;
	}
	.tpl-editor-head {
		display: flex;
		gap: 8px;
		align-items: flex-start;
		padding: 10px 12px;
		border-bottom: 1px solid var(--border);
	}
	.tpl-actions {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
		justify-content: flex-end;
	}
	.tpl-note {
		font-size: 12.5px;
		padding: 8px 12px 0;
	}
	.tpl-editor :global(.callout),
	.tpl-editor :global(.field-error) {
		margin: 8px 12px 0;
	}
	.tpl-vars {
		padding: 8px 12px;
		border-bottom: 1px solid var(--border);
		max-height: 132px;
		overflow-y: auto;
	}
	.tpl-vars-group {
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--fg-muted);
		margin: 2px 0 4px;
	}
	.tpl-vars-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		margin-bottom: 6px;
	}
	.tpl-chip {
		font-family: var(--font-mono);
		font-size: 11.5px;
		padding: 2px 7px;
		border: 1px solid var(--border);
		border-radius: 999px;
		background: var(--bg-elev);
		color: var(--fg);
		cursor: pointer;
	}
	.tpl-chip:hover {
		border-color: var(--accent);
		color: var(--accent);
	}
	.tpl-code {
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}
	.tpl-code.hidden-editor {
		display: none;
	}
	.tpl-code :global(.cm-editor) {
		height: 100%;
	}
	.tpl-preview-head {
		padding: 10px 12px;
		border-bottom: 1px solid var(--border);
		font-size: 13px;
		font-weight: 500;
	}
	.tpl-preview-body {
		flex: 1;
		min-height: 0;
		padding: 10px;
		background: var(--bg-elev);
	}
	@media (max-width: 1100px) {
		.tpl-grid {
			grid-template-columns: 1fr;
			height: auto;
		}
		.tpl-list {
			max-height: 200px;
		}
		.tpl-editor {
			height: 70vh;
		}
		.tpl-preview {
			height: 70vh;
		}
	}
</style>
