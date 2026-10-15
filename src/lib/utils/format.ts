// Date and money formatting shared by the screens.
// API dates: 'YYYY-MM-DD'; API date-times: 'YYYY-MM-DDTHH:mm:ss' (local, no zone).

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Parse 'YYYY-MM-DD' or 'YYYY-MM-DDTHH:mm:ss' as a local date (no UTC shift). */
export function parseLocal(s: string | null | undefined): Date | null {
	if (!s) return null;
	const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(s);
	if (!m) {
		const d = new Date(s);
		return isNaN(d.getTime()) ? null : d;
	}
	return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0));
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Date → 'YYYY-MM-DD' (local). */
export function isoDate(d: Date = new Date()): string {
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Date → 'YYYY-MM-DDTHH:mm:ss' (local). */
export function isoDateTime(d: Date = new Date()): string {
	return `${isoDate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** Value for <input type="datetime-local"> ('YYYY-MM-DDTHH:mm'). */
export function dateTimeLocalInput(d: Date = new Date()): string {
	return isoDateTime(d).slice(0, 16);
}

/** <input type="datetime-local"> value → API date-time with seconds. */
export function fromDateTimeLocalInput(v: string): string {
	if (!v) return v;
	return v.length === 16 ? `${v}:00` : v;
}

/** '12 Mar 2025' */
export function formatDate(s: string | null | undefined): string {
	const d = parseLocal(s);
	if (!d) return '—';
	return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** '12 Mar 2025, 10:30' */
export function formatDateTime(s: string | null | undefined): string {
	const d = parseLocal(s);
	if (!d) return '—';
	return `${formatDate(s)}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function lastDayOfMonth(d: Date) {
	return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

/**
 * A billing period as words:
 * whole months → 'Mar 2025', 'Jan–Mar 2025', 'Nov 2025–Feb 2026';
 * otherwise → '15 Feb – 31 Mar 2025'.
 */
export function formatPeriod(start: string | null | undefined, end: string | null | undefined): string {
	const a = parseLocal(start);
	const b = parseLocal(end);
	if (!a) return '—';
	if (!b) return `from ${formatDate(start)}`;
	const wholeMonths = a.getDate() === 1 && b.getDate() === lastDayOfMonth(b);
	if (wholeMonths) {
		const sameMonth = a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
		if (sameMonth) return `${MONTHS[a.getMonth()]} ${a.getFullYear()}`;
		if (a.getFullYear() === b.getFullYear())
			return `${MONTHS[a.getMonth()]}–${MONTHS[b.getMonth()]} ${a.getFullYear()}`;
		return `${MONTHS[a.getMonth()]} ${a.getFullYear()}–${MONTHS[b.getMonth()]} ${b.getFullYear()}`;
	}
	if (a.getFullYear() === b.getFullYear())
		return `${a.getDate()} ${MONTHS[a.getMonth()]} – ${formatDate(end)}`;
	return `${formatDate(start)} – ${formatDate(end)}`;
}

/** 'Term 2 of 4' style label for a period. */
export function termLabel(termNumber: number, termsPerYear: number): string {
	if (termsPerYear === 12) return 'Monthly';
	if (termsPerYear === 1) return 'Yearly';
	return `Term ${termNumber} of ${termsPerYear}`;
}

/** '3 months', '1 year, 2 months' */
export function durationBetween(from: string, to: string | null | undefined): string {
	const a = parseLocal(from);
	const b = to ? parseLocal(to) : new Date();
	if (!a || !b) return '—';
	const days = Math.floor((b.getTime() - a.getTime()) / 86_400_000);
	if (days < 30) return `${days} day${days !== 1 ? 's' : ''}`;
	if (days < 365) {
		const m = Math.floor(days / 30);
		return `${m} month${m !== 1 ? 's' : ''}`;
	}
	const y = Math.floor(days / 365);
	const m = Math.floor((days % 365) / 30);
	return `${y} year${y !== 1 ? 's' : ''}${m > 0 ? `, ${m} month${m !== 1 ? 's' : ''}` : ''}`;
}

/** True when date-only `d` lies within [start, end] (strings compare correctly in ISO form). */
export function dateInRange(d: string, start: string, end: string | null): boolean {
	return d >= start && (end === null || d <= end);
}

/** '₹1,200.00' */
export function money(v: number | null | undefined): string {
	const n = Number(v ?? 0);
	return `₹${(isNaN(n) ? 0 : n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Calendar months covered by term `k` of a structure with `n` terms per year: 'Jan–Mar', 'Jul'. */
export function termMonths(k: number, n: number): string {
	if (n <= 0 || k <= 0 || k > n) return '—';
	const per = 12 / n;
	const a = MONTHS[(k - 1) * per];
	const b = MONTHS[k * per - 1];
	return a === b ? a : `${a}–${b}`;
}

/** 'Yearly', 'Half-yearly', 'Quarterly', 'Monthly', '3 terms', '6 terms' */
export function cadenceLabel(termsPerYear: number): string {
	return (
		{ 1: 'Yearly', 2: 'Half-yearly', 4: 'Quarterly', 12: 'Monthly' }[termsPerYear] ?? `${termsPerYear} terms a year`
	);
}
