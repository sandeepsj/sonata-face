// Visual ("Design") editing of a receipt template without breaking its Handlebars.
//
// toEditable() turns the template into a document the design canvas can edit:
// - <head> and everything outside <body> is kept aside untouched (styles, @page, scripts);
// - every {{variable}}, and every {{#if}}…{{/if}} / {{#each}}…{{/each}} that contains no HTML tags, becomes a token
//   that decorate() shows as a locked chip ("Student name");
// - block tags that wrap HTML ({{#each payments}} around a <tr>) become HTML comments, which the HTML parser keeps in
//   place even inside tables (bare text there would be moved out of the table).
// fromEditable() reads the edited <body> back and restores every token, so the result is the same kind of template.
//
// The canvas iframe is sandboxed WITHOUT allow-scripts: nothing in the template can run while it is edited.

const OPEN = '⟦hb'; // ⟦hb
const CLOSE = '⟧'; // ⟧
const TOKEN_RE = /⟦hb(\d+)⟧/g;
const COMMENT_TOKEN_RE = /<!--⟦hb(\d+)⟧-->/g;

export interface Editable {
	/** Full document for the canvas iframe */
	doc: string;
	/** Raw Handlebars text of every token, by number */
	tokens: string[];
	/** Everything before the body's content, without the <body> tag itself */
	before: string;
	/** `</body>` and everything after it */
	after: string;
	hadBody: boolean;
}

type Mustache = { start: number; end: number; raw: string; kind: 'open' | 'else' | 'close' | 'var'; name: string };

function classify(raw: string, start: number): Mustache {
	const inner = raw
		.replace(/^\{\{\{?~?/, '')
		.replace(/~?\}?\}\}$/, '')
		.trim();
	const end = start + raw.length;
	if (inner.startsWith('#') || inner.startsWith('^')) return { start, end, raw, kind: 'open', name: inner.slice(1).trim().split(/\s+/)[0] };
	if (inner.startsWith('/')) return { start, end, raw, kind: 'close', name: inner.slice(1).trim() };
	if (inner === 'else' || inner.startsWith('else ') || inner === '^') return { start, end, raw, kind: 'else', name: '' };
	return { start, end, raw, kind: 'var', name: inner };
}

/** [start, end) ranges where a block tag can't become an HTML comment (raw text elements and existing comments) */
function rawRanges(body: string): [number, number][] {
	const ranges: [number, number][] = [];
	const re = /<(script|style|textarea|title)\b[\s\S]*?<\/\1\s*>|<!--[\s\S]*?-->/gi;
	for (let m; (m = re.exec(body)); ) ranges.push([m.index, m.index + m[0].length]);
	return ranges;
}

export function toEditable(html: string): Editable | { error: string } {
	const open = /<body\b[^>]*>/i.exec(html);
	const closeAt = html.search(/<\/body\s*>/i);
	const hadBody = !!open && closeAt > open.index;
	const before = hadBody ? html.slice(0, open!.index) : '';
	const bodyTag = hadBody ? open![0] : '<body>';
	const body = hadBody ? html.slice(open!.index + open![0].length, closeAt) : html;
	const after = hadBody ? html.slice(closeAt) : '';

	const marks: Mustache[] = [];
	const re = /\{\{\{[\s\S]*?\}\}\}|\{\{[\s\S]*?\}\}/g;
	for (let m; (m = re.exec(body)); ) marks.push(classify(m[0], m.index));

	// match blocks
	const closeOf = new Map<number, number>();
	const stack: number[] = [];
	marks.forEach((m, i) => {
		if (m.kind === 'open') stack.push(i);
		else if (m.kind === 'close') {
			const o = stack.pop();
			if (o === undefined || marks[o].name !== m.name) throw null;
			closeOf.set(o, i);
		}
	});
	if (stack.length) return { error: 'A {{#…}} block in the template is never closed.' };

	const raws = rawRanges(body);
	const inRaw = (pos: number) => raws.some(([a, b]) => pos >= a && pos < b);
	const tokens: string[] = [];
	const token = (raw: string) => `${OPEN}${tokens.push(raw) - 1}${CLOSE}`;

	let out = '';
	let pos = 0;
	for (let i = 0; i < marks.length; i++) {
		const m = marks[i];
		out += body.slice(pos, m.start);
		if (m.kind === 'open') {
			const c = marks[closeOf.get(i)!];
			const span = body.slice(m.start, c.end);
			if (!span.includes('<')) {
				// a block without HTML inside: one chip
				out += token(span);
				pos = c.end;
				i = closeOf.get(i)!;
				continue;
			}
		}
		if (m.kind === 'var') out += token(m.raw);
		else out += inRaw(m.start) ? token(m.raw) : `<!--${token(m.raw)}-->`;
		pos = m.end;
	}
	out += body.slice(pos);

	return { doc: `${before}${bodyTag}${out}${after}`, tokens, before, after, hadBody };
}

/** Wraps toEditable so a malformed template reports instead of throwing */
export function tryEditable(html: string): Editable | { error: string } {
	try {
		return toEditable(html);
	} catch {
		return { error: "The template's {{#…}} and {{/…}} blocks don't match." };
	}
}

// ---------- chips ----------

const LABELS: Record<string, string> = {
	'receipt.id': 'Receipt no.',
	'receipt.printedDate': 'Print date',
	'student.name': 'Student name',
	'student.admissionNo': 'Admission no.',
	'totals.fee': 'Total fee',
	'totals.discount': 'Total discount',
	'totals.paid': 'Total paid',
	date: 'Payment date',
	courseName: 'Course',
	label: 'Payment label',
	fee: 'Fee',
	discount: 'Discount',
	amountPaid: 'Paid',
	amount: 'Discount amount',
	payments: 'payments',
	discounts: 'discounts',
	hasDiscounts: 'discounts'
};

function labelOfExpr(expr: string): string {
	const e = expr.replace(/^(this\.|\.\.\/)+/, '').trim();
	return LABELS[e] ?? e;
}

/** What a token's chip says */
export function chipLabel(raw: string): { text: string; conditional: boolean } {
	const m = classify(raw.match(/^\{\{\{?[\s\S]*?\}?\}\}/)?.[0] ?? raw, 0);
	if (m.kind === 'var') {
		if (m.name.startsWith('!')) return { text: 'Note', conditional: false };
		return { text: labelOfExpr(m.name.replace(/^>\s*/, '')), conditional: false };
	}
	const arg = m.name ? raw.replace(/^\{\{[#^]\s*\S+\s*/, '').split(/[\s}]/)[0] : '';
	const helper = raw.replace(/^\{\{[#^]\s*/, '').split(/\s/)[0];
	if (helper === 'each') return { text: `List of ${labelOfExpr(arg)}`, conditional: true };
	const firstVar = /\{\{\s*([^#/^!>{}\s][^}]*)\}\}/.exec(raw.slice(raw.indexOf('}}') + 2));
	return { text: firstVar && firstVar[1].trim() !== 'else' ? labelOfExpr(firstVar[1].trim()) : labelOfExpr(arg), conditional: true };
}

export const CHIP_CLASS = '__ed-chip';
export const SELECTED_CLASS = '__ed-sel';

export function makeChip(doc: Document, tokens: string[], n: number): HTMLElement {
	const raw = tokens[n];
	const { text, conditional } = chipLabel(raw);
	const chip = doc.createElement('span');
	chip.className = CHIP_CLASS + (conditional ? ' __ed-cond' : '');
	chip.contentEditable = 'false';
	chip.dataset.hbToken = String(n);
	chip.title = raw;
	chip.textContent = text;
	return chip;
}

/** Replaces tokens in the canvas body's text with chips, and marks repeated / conditional sections */
export function decorate(doc: Document, tokens: string[]) {
	const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_COMMENT);
	const texts: Text[] = [];
	const comments: Comment[] = [];
	for (let n = walker.nextNode(); n; n = walker.nextNode()) {
		if (n.nodeType === Node.COMMENT_NODE) comments.push(n as Comment);
		else if (!(n.parentElement && /^(SCRIPT|STYLE|TEXTAREA|TITLE)$/.test(n.parentElement.tagName))) texts.push(n as Text);
	}
	for (const t of texts) {
		const s = t.data;
		if (!s.includes(OPEN)) continue;
		const frag = doc.createDocumentFragment();
		let last = 0;
		for (const m of s.matchAll(TOKEN_RE)) {
			frag.append(s.slice(last, m.index));
			frag.append(makeChip(doc, tokens, Number(m[1])));
			last = m.index! + m[0].length;
		}
		frag.append(s.slice(last));
		t.replaceWith(frag);
	}
	// sections between a block's opening and closing comments (same parent)
	for (const c of comments) {
		const m = /^⟦hb(\d+)⟧$/.exec(c.data);
		if (!m) continue;
		const raw = tokens[Number(m[1])];
		if (!/^\{\{[#^]/.test(raw)) continue;
		const kind = /^\{\{#\s*each\b/.test(raw) ? 'each' : 'if';
		const arg = raw.replace(/^\{\{[#^]\s*\S+\s*/, '').split(/[\s}]/)[0];
		const label = kind === 'each' ? `Repeats for each of the ${labelOfExpr(arg)}` : arg === 'hasDiscounts'
					? 'Shown only when there are discounts'
					: `Shown only when “${labelOfExpr(arg)}” has a value`;
		let depth = 0;
		for (let n = c.nextSibling; n; n = n.nextSibling) {
			if (n.nodeType === Node.COMMENT_NODE) {
				const r = /^⟦hb(\d+)⟧$/.exec((n as Comment).data);
				const rr = r ? tokens[Number(r[1])] : '';
				if (/^\{\{[#^]/.test(rr)) depth++;
				else if (/^\{\{\//.test(rr)) {
					if (depth === 0) break;
					depth--;
				}
			} else if (n.nodeType === Node.ELEMENT_NODE && depth === 0) {
				(n as HTMLElement).dataset.edBlock = kind;
				(n as HTMLElement).dataset.edLabel = label;
			}
		}
	}
}

function attrs(el: Element): string {
	return Array.from(el.attributes)
		.map((a) => ` ${a.name}="${a.value.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"`)
		.join('');
}

/** The template from the canvas: tokens back to Handlebars, editor-only markup removed */
export function fromEditable(doc: Document, ed: Editable): string {
	const body = doc.body.cloneNode(true) as HTMLElement;
	body.querySelectorAll<HTMLElement>('.' + CHIP_CLASS).forEach((c) => c.replaceWith(doc.createTextNode(`${OPEN}${c.dataset.hbToken}${CLOSE}`)));
	body.querySelectorAll<HTMLElement>('[data-ed-block]').forEach((e) => {
		delete e.dataset.edBlock;
		delete e.dataset.edLabel;
	});
	body.querySelectorAll('.' + SELECTED_CLASS).forEach((e) => {
		e.classList.remove(SELECTED_CLASS);
		if (!e.classList.length) e.removeAttribute('class');
	});
	body.querySelectorAll('[class=""]').forEach((e) => e.removeAttribute('class'));
	body.querySelectorAll('[style=""]').forEach((e) => e.removeAttribute('style'));
	for (const el of [body, ...Array.from(body.querySelectorAll('[contenteditable]'))]) el.removeAttribute('contenteditable');
	body.removeAttribute('spellcheck');
	if (body.getAttribute('style') === '') body.removeAttribute('style');
	const restore = (s: string) => s.replace(COMMENT_TOKEN_RE, (_, n) => ed.tokens[Number(n)]).replace(TOKEN_RE, (_, n) => ed.tokens[Number(n)]);
	const inner = restore(body.innerHTML);
	const html = ed.hadBody ? `${ed.before}<body${attrs(body)}>${inner}${ed.after}` : inner;
	return withFontLinks(html);
}

// ---------- fonts ----------

export interface FontOption {
	name: string;
	css: string;
	google?: boolean;
}

export const FONTS: FontOption[] = [
	{ name: 'Arial', css: 'Arial, sans-serif' },
	{ name: 'Verdana', css: 'Verdana, sans-serif' },
	{ name: 'Tahoma', css: 'Tahoma, sans-serif' },
	{ name: 'Trebuchet MS', css: "'Trebuchet MS', sans-serif" },
	{ name: 'Georgia', css: 'Georgia, serif' },
	{ name: 'Times New Roman', css: "'Times New Roman', serif" },
	{ name: 'Courier New', css: "'Courier New', monospace" },
	{ name: 'Roboto', css: 'Roboto, sans-serif', google: true },
	{ name: 'Lato', css: 'Lato, sans-serif', google: true },
	{ name: 'Open Sans', css: "'Open Sans', sans-serif", google: true },
	{ name: 'Merriweather', css: 'Merriweather, serif', google: true },
	{ name: 'Playfair Display', css: "'Playfair Display', serif", google: true },
	{ name: 'Noto Sans', css: "'Noto Sans', sans-serif", google: true },
	{ name: 'Noto Serif', css: "'Noto Serif', serif", google: true },
	{ name: 'Noto Sans Tamil', css: "'Noto Sans Tamil', sans-serif", google: true },
	{ name: 'Noto Serif Tamil', css: "'Noto Serif Tamil', serif", google: true }
];

export const FONT_LINK_ATTR = 'data-receipt-fonts';

export function fontLinkHref(names: string[]): string {
	return `https://fonts.googleapis.com/css2?${names.map((n) => `family=${n.replace(/ /g, '+')}:ital,wght@0,400;0,700;1,400`).join('&')}&display=swap`;
}

/** Keeps one Google Fonts <link> in <head> for the web fonts the template uses */
export function withFontLinks(html: string): string {
	const linkRe = new RegExp(`<link[^>]*${FONT_LINK_ATTR}[^>]*>\\n?`, 'i');
	const without = html.replace(linkRe, '');
	const text = without.replace(/&quot;/g, "'");
	// the whole name, so "Noto Sans" doesn't match "Noto Sans Tamil"
	const used = FONTS.filter((f) => f.google && new RegExp(`font-family:[^;"}]*?'?${f.name}'?\\s*[,;"}]`, 'i').test(text)).map((f) => f.name);
	if (!used.length) return without;
	const link = `<link rel="stylesheet" ${FONT_LINK_ATTR} href="${fontLinkHref(used).replace(/&/g, '&amp;')}">\n`;
	const headEnd = without.search(/<\/head\s*>/i);
	return headEnd < 0 ? html : without.slice(0, headEnd) + link + without.slice(headEnd);
}
