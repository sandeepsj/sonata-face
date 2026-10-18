// Fills a receipt template (an HTML document with Handlebars variables) and prepares it for the sandboxed iframe in
// ReceiptFrame.svelte. Templates may contain scripts written by any user with write access, so the result must only
// ever be shown in that iframe (REQ-090.AC9), never inserted into the app's own page.

import type { ReceiptData } from './data';

export type Rendered = { doc: string; error?: undefined } | { doc?: undefined; error: string };

/** Message the parent posts to the iframe to print it (the parent can't call print() across the sandbox) */
export const PRINT_MESSAGE = 'sonata:print';

type HandlebarsLike = { compile: (src: string, opts?: object) => (data: unknown) => string };
let handlebars: Promise<HandlebarsLike> | null = null;

function loadHandlebars(): Promise<HandlebarsLike> {
	handlebars ??= import('handlebars').then((m) => ((m as { default?: HandlebarsLike }).default ?? m) as HandlebarsLike);
	return handlebars;
}

/** JSON that is safe inside a <script> element */
function scriptJson(value: unknown): string {
	return JSON.stringify(value)
		.replace(/</g, '\\u003c')
		.split(String.fromCharCode(0x2028)).join('\\u2028')
		.split(String.fromCharCode(0x2029)).join('\\u2029');
}

function runtime(data: ReceiptData): string {
	return (
		`<script>window.receipt=${scriptJson(data)};` +
		`window.addEventListener('message',function(e){if(e.data&&e.data.type===${JSON.stringify(PRINT_MESSAGE)})window.print();});</script>`
	);
}

/** Puts the runtime script first in <head>, so template scripts can already read window.receipt */
function inject(html: string, script: string): string {
	const head = /<head(\s[^>]*)?>/i.exec(html);
	if (head) return html.slice(0, head.index + head[0].length) + script + html.slice(head.index + head[0].length);
	const htmlTag = /<html(\s[^>]*)?>/i.exec(html);
	if (htmlTag) return html.slice(0, htmlTag.index + htmlTag[0].length) + `<head>${script}</head>` + html.slice(htmlTag.index + htmlTag[0].length);
	return script + html;
}

export async function renderReceipt(html: string, data: ReceiptData): Promise<Rendered> {
	try {
		const hb = await loadHandlebars();
		const filled = hb.compile(html)(data);
		return { doc: inject(filled, runtime(data)) };
	} catch (e) {
		return { error: e instanceof Error ? e.message : String(e) };
	}
}
