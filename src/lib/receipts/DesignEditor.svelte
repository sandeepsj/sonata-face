<script lang="ts">
	// Visual editor for a receipt template: the template is shown in a canvas where text can be typed over and
	// formatted (font, size, colours, bold/italic/underline, alignment) and variables appear as locked chips.
	// Every change is written back as template HTML through `onChange`. See ./design.ts for how the Handlebars
	// survives editing.
	//
	// The canvas iframe is sandboxed with allow-same-origin but NOT allow-scripts, so this component can edit its
	// document while nothing in the template runs. Printing and the sample-data preview still use ReceiptFrame.
	import { onDestroy, untrack } from 'svelte';
	import { Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, Undo2, Redo2, Eraser, Baseline, PaintBucket, ChevronRight } from 'lucide-svelte';
	import {
		CHIP_CLASS,
		FONTS,
		FONT_LINK_ATTR,
		SELECTED_CLASS,
		decorate,
		fontLinkHref,
		fromEditable,
		makeChip,
		tryEditable,
		type Editable
	} from './design';
	import { RECEIPT_VARIABLES } from './data';

	interface Props {
		/** Read once when the editor opens; remount (e.g. {#key}) to load another template */
		html: string;
		readOnly?: boolean;
		onChange: (html: string) => void;
	}
	let { html, readOnly = false, onChange }: Props = $props();

	const initial = untrack(() => tryEditable(html));
	const ed: Editable | null = 'error' in initial ? null : initial;
	const loadError = 'error' in initial ? initial.error : '';

	let iframe: HTMLIFrameElement | undefined = $state();
	let doc: Document | null = null;
	let selected: HTMLElement | null = $state(null);
	let crumbs: { el: HTMLElement; label: string }[] = $state([]);
	let savedRange: Range | null = null;
	let textSelected = $state(false);

	// toolbar state, read from the selection
	let font = $state('');
	let size = $state('');
	let color = $state('#000000');
	let background = $state('#ffffff');
	let isBold = $state(false);
	let isItalic = $state(false);
	let isUnderline = $state(false);
	let align = $state('left');

	// undo: snapshots of the body
	let undoStack: string[] = [];
	let redoStack: string[] = [];
	let canUndo = $state(false);
	let canRedo = $state(false);
	let lastSnapshotAt = 0;

	let emitTimer: ReturnType<typeof setTimeout> | undefined;
	onDestroy(() => {
		if (emitTimer) {
			clearTimeout(emitTimer);
			emit();
		}
	});

	const SIZES = [7, 8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32];
	const FIELDS = RECEIPT_VARIABLES.map((g) => ({ group: g.group, items: g.items.filter((v) => !v.label.startsWith('#')) }));

	const EDITOR_CSS = `
		.${CHIP_CLASS}{background:#e8f0fe;color:#1a4fb4;border-radius:4px;padding:0 4px;margin:0 1px;font-style:normal;white-space:nowrap;cursor:default;user-select:all;box-shadow:inset 0 0 0 1px #c6d7fb}
		.${CHIP_CLASS}.__ed-cond{box-shadow:inset 0 0 0 1px #9db8f5;background:#eef3ff;border-bottom:1px dashed #6b8fe6}
		[data-ed-block]{outline:1px dashed #8fb0f0;outline-offset:-1px}
		[data-ed-block=each]{background-image:linear-gradient(rgba(37,99,235,.05),rgba(37,99,235,.05))}
		.${SELECTED_CLASS}{outline:2px solid #2563eb !important;outline-offset:1px}
		body[contenteditable=true]{outline:none;cursor:text}
		body[contenteditable=true] :hover:not(.${CHIP_CLASS}):not(body){box-shadow:0 0 0 1px rgba(37,99,235,.25)}
	`;

	function onLoad() {
		if (!iframe?.contentDocument || !ed) return;
		doc = iframe.contentDocument;
		const style = doc.createElement('style');
		style.id = '__ed-style';
		style.textContent = EDITOR_CSS;
		doc.head?.appendChild(style);
		decorate(doc, ed.tokens);
		if (!readOnly) {
			doc.body.contentEditable = 'true';
			doc.body.spellcheck = false;
			doc.execCommand('styleWithCSS', false, 'true');
		}
		if (readOnly) return;
		doc.addEventListener('selectionchange', onSelectionChange);
		doc.addEventListener('click', onClick);
		doc.addEventListener('keydown', onKeyDown);
		doc.addEventListener('beforeinput', () => snapshot(false));
		doc.addEventListener('input', () => scheduleEmit());
		doc.addEventListener('paste', onPaste);
		doc.addEventListener('drop', (e) => e.preventDefault());
		select(doc.body.querySelector<HTMLElement>('h1, h2, p, td') ?? doc.body);
	}

	// ---------- selection ----------

	function elementOf(n: Node | null): HTMLElement | null {
		let el = n && n.nodeType === Node.ELEMENT_NODE ? (n as HTMLElement) : (n?.parentElement ?? null);
		while (el && el.classList.contains(CHIP_CLASS)) el = el.parentElement;
		return el;
	}

	function onClick(e: MouseEvent) {
		const el = elementOf(e.target as Node);
		if (el) select(el);
	}

	function select(el: HTMLElement) {
		if (!doc) return;
		doc.querySelectorAll('.' + SELECTED_CLASS).forEach((x) => x.classList.remove(SELECTED_CLASS));
		selected = el;
		if (el !== doc.body) el.classList.add(SELECTED_CLASS);
		const chain: { el: HTMLElement; label: string }[] = [];
		for (let x: HTMLElement | null = el; x; x = x.parentElement) {
			chain.unshift({ el: x, label: describe(x) });
			if (x === doc.body) break;
		}
		crumbs = chain;
		readStyles();
	}

	function onSelectionChange() {
		const sel = doc?.getSelection();
		if (!sel || !sel.rangeCount) return;
		const r = sel.getRangeAt(0);
		if (!doc!.body.contains(r.commonAncestorContainer)) return;
		savedRange = r.cloneRange();
		textSelected = !r.collapsed;
		const el = elementOf(r.collapsed ? r.startContainer : r.commonAncestorContainer);
		if (el && el !== selected && r.collapsed) select(el);
		else readStyles();
	}

	function hasTextSelection(): boolean {
		return !!savedRange && !savedRange.collapsed && !!doc?.body.contains(savedRange.commonAncestorContainer);
	}

	const NAMES: Record<string, string> = {
		BODY: 'Page',
		H1: 'Heading',
		H2: 'Subheading',
		H3: 'Heading 3',
		H4: 'Heading 4',
		P: 'Paragraph',
		TABLE: 'Table',
		THEAD: 'Table header',
		TBODY: 'Table body',
		TFOOT: 'Table footer',
		TR: 'Row',
		TH: 'Header cell',
		TD: 'Cell',
		DIV: 'Box',
		SPAN: 'Text',
		STRONG: 'Bold text',
		B: 'Bold text',
		EM: 'Italic text',
		I: 'Italic text',
		U: 'Underlined text',
		UL: 'List',
		OL: 'List',
		LI: 'List item',
		IMG: 'Image'
	};

	function describe(el: HTMLElement): string {
		const base = NAMES[el.tagName] ?? el.tagName.toLowerCase();
		const cls = Array.from(el.classList).find((c) => !c.startsWith('__ed'));
		return cls ? `${base} · ${cls}` : base;
	}

	function hex(c: string): string {
		const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/);
		if (!m) return c.startsWith('#') ? c : '#000000';
		if (m[4] !== undefined && Number(m[4]) === 0) return '';
		return '#' + [m[1], m[2], m[3]].map((x) => Number(x).toString(16).padStart(2, '0')).join('');
	}

	function readStyles() {
		if (!doc) return;
		const target = hasTextSelection() ? elementOf(savedRange!.startContainer) : selected;
		if (!target) return;
		const cs = doc.defaultView!.getComputedStyle(target);
		const fam = cs.fontFamily.split(',')[0].replace(/["']/g, '').trim();
		font = FONTS.find((f) => f.name.toLowerCase() === fam.toLowerCase())?.name ?? '';
		const pt = Math.round(parseFloat(cs.fontSize) * 0.75);
		size = SIZES.includes(pt) ? String(pt) : '';
		color = hex(cs.color) || '#000000';
		let bg = '';
		for (let x: HTMLElement | null = target; x && !bg; x = x.parentElement) bg = hex(doc.defaultView!.getComputedStyle(x).backgroundColor);
		background = bg || '#ffffff';
		isBold = Number(cs.fontWeight) >= 600 || cs.fontWeight === 'bold';
		isItalic = cs.fontStyle === 'italic';
		isUnderline = cs.textDecorationLine.includes('underline');
		const block = blockOf(target);
		const ta = block ? doc.defaultView!.getComputedStyle(block).textAlign : 'left';
		align = ta === 'center' ? 'center' : ta === 'right' || ta === 'end' ? 'right' : 'left';
	}

	function blockOf(el: HTMLElement | null): HTMLElement | null {
		for (let x = el; x; x = x.parentElement) {
			const d = doc!.defaultView!.getComputedStyle(x).display;
			if (d !== 'inline' && d !== 'contents') return x;
		}
		return null;
	}

	// ---------- changes ----------

	function snapshot(force: boolean) {
		if (!doc) return;
		const now = Date.now();
		if (!force && now - lastSnapshotAt < 1200) return;
		lastSnapshotAt = now;
		undoStack.push(doc.body.innerHTML);
		if (undoStack.length > 100) undoStack.shift();
		redoStack = [];
		canUndo = true;
		canRedo = false;
	}

	function restore(from: string[], to: string[]) {
		if (!doc || !from.length) return;
		to.push(doc.body.innerHTML);
		doc.body.innerHTML = from.pop()!;
		canUndo = undoStack.length > 0;
		canRedo = redoStack.length > 0;
		savedRange = null;
		textSelected = false;
		const keep = doc.body.querySelector<HTMLElement>('.' + SELECTED_CLASS);
		select(keep ?? doc.body);
		emit();
	}
	const undo = () => restore(undoStack, redoStack);
	const redo = () => restore(redoStack, undoStack);

	function emit() {
		emitTimer = undefined;
		if (doc && ed) onChange(fromEditable(doc, ed));
	}

	function scheduleEmit() {
		if (emitTimer) clearTimeout(emitTimer);
		emitTimer = setTimeout(emit, 250);
	}

	function changed() {
		readStyles();
		if (emitTimer) clearTimeout(emitTimer);
		emit();
	}

	function onKeyDown(e: KeyboardEvent) {
		const mod = e.ctrlKey || e.metaKey;
		if (!mod) return;
		const k = e.key.toLowerCase();
		if (k === 'z' && !e.shiftKey) {
			e.preventDefault();
			undo();
		} else if ((k === 'z' && e.shiftKey) || k === 'y') {
			e.preventDefault();
			redo();
		} else if (k === 'b' || k === 'i' || k === 'u') {
			e.preventDefault();
			toggle(k === 'b' ? 'bold' : k === 'i' ? 'italic' : 'underline');
		}
	}

	function onPaste(e: ClipboardEvent) {
		// plain text only, so pasted formatting can't break the layout
		e.preventDefault();
		const text = e.clipboardData?.getData('text/plain') ?? '';
		snapshot(true);
		doc?.execCommand('insertText', false, text);
	}

	/** Puts the canvas selection back after a toolbar control took focus */
	function restoreRange() {
		if (!doc || !iframe) return;
		iframe.contentWindow?.focus();
		if (savedRange) {
			const sel = doc.getSelection();
			sel?.removeAllRanges();
			sel?.addRange(savedRange);
		}
	}

	/** Formats the selected text if there is any, otherwise the selected element */
	function apply(onRange: () => void, onElement: (el: HTMLElement) => void) {
		if (!doc || readOnly) return;
		snapshot(true);
		if (hasTextSelection()) {
			restoreRange();
			onRange();
		} else if (selected) {
			onElement(selected);
		}
		changed();
	}

	function toggle(kind: 'bold' | 'italic' | 'underline') {
		const on = kind === 'bold' ? isBold : kind === 'italic' ? isItalic : isUnderline;
		apply(
			() => doc!.execCommand(kind),
			(el) => {
				if (kind === 'bold') el.style.fontWeight = on ? 'normal' : 'bold';
				else if (kind === 'italic') el.style.fontStyle = on ? 'normal' : 'italic';
				else el.style.textDecoration = on ? 'none' : 'underline';
			}
		);
	}

	function setFont(name: string) {
		const f = FONTS.find((x) => x.name === name);
		if (!f) return;
		if (f.google) ensureFontLoaded(f.name);
		apply(
			() => doc!.execCommand('fontName', false, f.css),
			(el) => (el.style.fontFamily = f.css)
		);
	}

	function ensureFontLoaded(name: string) {
		if (!doc) return;
		const existing = doc.head.querySelector<HTMLLinkElement>(`link[${FONT_LINK_ATTR}]`);
		const names = new Set((existing?.href.match(/family=([^:&]+)/g) ?? []).map((s) => decodeURIComponent(s.slice(7)).replace(/\+/g, ' ')));
		if (names.has(name)) return;
		names.add(name);
		const link = existing ?? doc.createElement('link');
		link.rel = 'stylesheet';
		link.setAttribute(FONT_LINK_ATTR, '');
		link.href = fontLinkHref([...names]);
		if (!existing) doc.head.appendChild(link);
	}

	function setSize(pt: string) {
		if (!pt) return;
		apply(
			() => {
				// execCommand only knows sizes 1–7: mark with 7, then replace it with the size in points
				doc!.execCommand('fontSize', false, '7');
				doc!.body.querySelectorAll<HTMLElement>('[style*="xxx-large"], font[size="7"]').forEach((el) => {
					el.removeAttribute('size');
					el.style.fontSize = `${pt}pt`;
				});
			},
			(el) => (el.style.fontSize = `${pt}pt`)
		);
	}

	function setColor(c: string) {
		apply(
			() => doc!.execCommand('foreColor', false, c),
			(el) => (el.style.color = c)
		);
	}

	function setBackground(c: string) {
		apply(
			() => doc!.execCommand('hiliteColor', false, c),
			(el) => {
				el.style.backgroundColor = c;
				// cells usually have their own background in the stylesheet, which would hide a row's or table's
				if (/^(TR|THEAD|TBODY|TFOOT|TABLE)$/.test(el.tagName)) el.querySelectorAll<HTMLElement>('td, th').forEach((cell) => (cell.style.backgroundColor = c));
			}
		);
	}

	function setAlign(a: 'left' | 'center' | 'right') {
		if (!doc || readOnly) return;
		const block = blockOf(hasTextSelection() ? elementOf(savedRange!.startContainer) : selected);
		if (!block) return;
		snapshot(true);
		block.style.textAlign = a;
		changed();
	}

	function clearFormatting() {
		apply(
			() => doc!.execCommand('removeFormat'),
			(el) => el.removeAttribute('style')
		);
	}

	function insertField(insert: string) {
		if (!doc || !ed || readOnly || !insert) return;
		snapshot(true);
		restoreRange();
		const n = ed.tokens.push(insert) - 1;
		const chip = makeChip(doc, ed.tokens, n);
		const sel = doc.getSelection();
		let range = sel && sel.rangeCount ? sel.getRangeAt(0) : null;
		if (!range || !doc.body.contains(range.commonAncestorContainer)) {
			range = doc.createRange();
			range.selectNodeContents(selected ?? doc.body);
			range.collapse(false);
		}
		range.deleteContents();
		range.insertNode(chip);
		range.setStartAfter(chip);
		range.collapse(true);
		sel?.removeAllRanges();
		sel?.addRange(range);
		savedRange = range.cloneRange();
		changed();
	}

	/** Toolbar buttons must not take the caret out of the canvas */
	const keepFocus = (e: MouseEvent) => e.preventDefault();
</script>

{#if loadError}
	<div class="callout warn" style="margin: 12px;">
		<div class="callout-body">{loadError} Fix it in the HTML tab; the visual editor needs matching blocks.</div>
	</div>
{:else}
	<div class="ed-wrap">
		{#if !readOnly}
			<div class="ed-toolbar" role="toolbar" aria-label="Formatting">
				<select class="ed-select" style="width: 150px;" value={font} onchange={(e) => setFont(e.currentTarget.value)} aria-label="Font" title="Font">
					<option value="" disabled>Font</option>
					{#each FONTS as f}<option value={f.name} style="font-family: {f.css}">{f.name}</option>{/each}
				</select>
				<select class="ed-select" style="width: 70px;" value={size} onchange={(e) => setSize(e.currentTarget.value)} aria-label="Size" title="Size (pt)">
					<option value="" disabled>Size</option>
					{#each SIZES as s}<option value={String(s)}>{s}</option>{/each}
				</select>
				<span class="ed-sep"></span>
				<button class="ed-btn" class:on={isBold} onmousedown={keepFocus} onclick={() => toggle('bold')} title="Bold (Ctrl+B)" aria-label="Bold"><Bold size={15} /></button>
				<button class="ed-btn" class:on={isItalic} onmousedown={keepFocus} onclick={() => toggle('italic')} title="Italic (Ctrl+I)" aria-label="Italic"><Italic size={15} /></button>
				<button class="ed-btn" class:on={isUnderline} onmousedown={keepFocus} onclick={() => toggle('underline')} title="Underline (Ctrl+U)" aria-label="Underline"><Underline size={15} /></button>
				<span class="ed-sep"></span>
				<label class="ed-color" title="Text colour">
					<Baseline size={15} />
					<span class="ed-swatch" style="background: {color};"></span>
					<input type="color" value={color} onchange={(e) => setColor(e.currentTarget.value)} aria-label="Text colour" />
				</label>
				<label class="ed-color" title="Background colour">
					<PaintBucket size={15} />
					<span class="ed-swatch" style="background: {background};"></span>
					<input type="color" value={background} onchange={(e) => setBackground(e.currentTarget.value)} aria-label="Background colour" />
				</label>
				<span class="ed-sep"></span>
				<button class="ed-btn" class:on={align === 'left'} onmousedown={keepFocus} onclick={() => setAlign('left')} title="Align left" aria-label="Align left"><AlignLeft size={15} /></button>
				<button class="ed-btn" class:on={align === 'center'} onmousedown={keepFocus} onclick={() => setAlign('center')} title="Centre" aria-label="Centre"><AlignCenter size={15} /></button>
				<button class="ed-btn" class:on={align === 'right'} onmousedown={keepFocus} onclick={() => setAlign('right')} title="Align right" aria-label="Align right"><AlignRight size={15} /></button>
				<span class="ed-sep"></span>
				<button class="ed-btn" onmousedown={keepFocus} onclick={clearFormatting} title="Clear formatting" aria-label="Clear formatting"><Eraser size={15} /></button>
				<select
					class="ed-select"
					style="width: 130px;"
					value=""
					onchange={(e) => {
						insertField(e.currentTarget.value);
						e.currentTarget.value = '';
					}}
					aria-label="Insert field"
					title="Insert a field at the cursor"
				>
					<option value="" disabled>+ Insert field</option>
					{#each FIELDS as g}
						<optgroup label={g.group}>
							{#each g.items as v}<option value={v.insert}>{v.meaning}</option>{/each}
						</optgroup>
					{/each}
				</select>
				<div class="grow"></div>
				<button class="ed-btn" onmousedown={keepFocus} onclick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)" aria-label="Undo"><Undo2 size={15} /></button>
				<button class="ed-btn" onmousedown={keepFocus} onclick={redo} disabled={!canRedo} title="Redo (Ctrl+Y)" aria-label="Redo"><Redo2 size={15} /></button>
			</div>
			<div class="ed-crumbs" aria-label="Selected element">
				<span class="muted">Formatting applies to:</span>
				{#if textSelected}
					<span class="ed-crumb current">the selected text</span>
				{:else}
					{#each crumbs as c, i}
						{#if i > 0}<ChevronRight size={12} class="muted" />{/if}
						<button class="ed-crumb" class:current={c.el === selected} onclick={() => select(c.el)}>{c.label}</button>
					{/each}
				{/if}
			</div>
		{/if}
		<div class="ed-canvas">
			<iframe bind:this={iframe} title="Receipt design" sandbox="allow-same-origin" srcdoc={ed?.doc} onload={onLoad}></iframe>
		</div>
		{#if !readOnly}
			<div class="ed-help muted">
				Click any text to change it. Blue chips are filled in when printing; rows with a dashed outline repeat for each payment or show only sometimes.
			</div>
		{/if}
	</div>
{/if}

<style>
	.ed-wrap {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
	}
	.ed-toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px;
		padding: 8px 12px;
		border-bottom: 1px solid var(--border);
	}
	.ed-select {
		height: 30px;
		padding: 0 6px;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: var(--surface);
		color: var(--fg);
		font: inherit;
		font-size: 12.5px;
	}
	.ed-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 30px;
		height: 30px;
		border: 1px solid transparent;
		border-radius: 6px;
		background: none;
		color: var(--fg);
		cursor: pointer;
	}
	.ed-btn:hover:not(:disabled) {
		background: var(--bg-elev);
	}
	.ed-btn.on {
		background: var(--accent-soft);
		border-color: var(--accent);
		color: var(--accent);
	}
	.ed-btn:disabled {
		opacity: 0.35;
		cursor: default;
	}
	.ed-sep {
		width: 1px;
		height: 20px;
		background: var(--border);
		margin: 0 4px;
	}
	.ed-color {
		position: relative;
		display: inline-flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		width: 30px;
		height: 30px;
		border-radius: 6px;
		cursor: pointer;
		color: var(--fg);
	}
	.ed-color:hover {
		background: var(--bg-elev);
	}
	.ed-swatch {
		width: 18px;
		height: 4px;
		border-radius: 2px;
		margin-top: 1px;
		box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.2);
	}
	.ed-color input {
		position: absolute;
		inset: 0;
		opacity: 0;
		cursor: pointer;
	}
	.ed-crumbs {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 2px;
		padding: 6px 12px;
		border-bottom: 1px solid var(--border);
		font-size: 12px;
	}
	.ed-crumbs > .muted {
		margin-right: 6px;
	}
	.ed-crumb {
		border: 0;
		background: none;
		padding: 2px 6px;
		border-radius: 4px;
		color: var(--fg-muted);
		font: inherit;
		cursor: pointer;
	}
	.ed-crumb:hover {
		background: var(--bg-elev);
		color: var(--fg);
	}
	.ed-crumb.current {
		background: var(--accent-soft);
		color: var(--accent);
	}
	.ed-canvas {
		flex: 1;
		min-height: 0;
		padding: 12px;
		background: var(--bg-elev);
	}
	.ed-canvas iframe {
		width: 100%;
		height: 100%;
		background: white;
		border: 1px solid var(--border);
		border-radius: 8px;
	}
	.ed-help {
		font-size: 12px;
		padding: 6px 12px 10px;
	}
	.grow {
		flex: 1;
	}
</style>
