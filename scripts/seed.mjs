#!/usr/bin/env node
// Seed dummy data via the running backend's REST API (sonata-brain, new contract).
//
// Usage:
//   API_BASE=http://localhost:8080 \
//   EMAIL=admin@local.test \
//   PASSWORD=yourpassword \
//   STUDENT_COUNT=30 \
//   node scripts/seed.mjs
//
// Prereqs:
//   1. Backend running at $API_BASE, and a user with WRITE on every resource (e.g. the bootstrap admin).
//   2. (Recommended) Wipe first: psql -f scripts/wipe.sql
//
// What it creates:
//   - Courses (if missing) with fee structures and a fee timeline:
//     quarterly from 1 Jan 2024 to 31 Dec 2025, then monthly from 1 Jan 2026 (open-ended).
//     Existing courses that already have a timeline are left as they are.
//   - Students, each with 1–3 sessions (about 10% already ended).
//   - Course-fee payments against the dues the backend derives (full, partial with discounts, or none).
//   - A few additional payments, one of them converted to a course fee, and one waiver.

import process from 'node:process';

const API_BASE = process.env.API_BASE || 'http://localhost:8080';
const EMAIL = process.env.EMAIL;
const PASSWORD = process.env.PASSWORD;
const STUDENT_COUNT = parseInt(process.env.STUDENT_COUNT || '30', 10);
const SEED = parseInt(process.env.SEED || '42', 10);

if (!EMAIL || !PASSWORD) {
	console.error('ERROR: EMAIL and PASSWORD env vars are required.');
	process.exit(1);
}

// --- Tiny seeded RNG so runs are reproducible -----------------------------
let rngState = SEED;
function rnd() {
	rngState = (rngState * 9301 + 49297) % 233280;
	return rngState / 233280;
}
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const pickN = (arr, n) => {
	const copy = [...arr];
	const out = [];
	for (let i = 0; i < n && copy.length; i++) {
		out.push(copy.splice(Math.floor(rnd() * copy.length), 1)[0]);
	}
	return out;
};
const range = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- Sample data ----------------------------------------------------------
const FIRST_NAMES = [
	'Aarav', 'Ananya', 'Ishaan', 'Diya', 'Vihaan', 'Aadhya', 'Kabir', 'Meera',
	'Rohan', 'Sara', 'Arjun', 'Saanvi', 'Aryan', 'Anika', 'Reyansh', 'Kiara',
	'Vivaan', 'Riya', 'Aditya', 'Tara', 'Karthik', 'Lakshmi', 'Pranav', 'Nithya',
	'Siddharth', 'Pooja', 'Rahul', 'Sneha', 'Varun', 'Maya'
];
const LAST_NAMES = [
	'Iyer', 'Krishnan', 'Iyengar', 'Rao', 'Menon', 'Pillai', 'Nair',
	'Kumar', 'Sharma', 'Reddy', 'Gupta', 'Bhat', 'Shetty', 'Naidu', 'Patel'
];
const SCHOOLS = [
	'Bangalore Public School', 'NPS Indiranagar', 'Inventure Academy',
	'DPS North', 'Mallya Aditi', 'Sishu Griha', 'Greenwood High', 'Vidyashilp'
];
const CLASSES = ['III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
const PIN_CODES = [560001, 560034, 560038, 560066, 560078, 560100];
const ADDITIONAL_LABELS = ['Admission fee', 'Books', 'Exam fee', 'Instrument rental'];

// course → [quarterly term amounts, monthly amount]
const CATALOG = {
	Violin: [[3000, 3000, 3300, 3300], 1200],
	Keyboard: [[2700, 2700, 2700, 2700], 1000],
	'Carnatic Vocal': [[2400, 2400, 2600, 2600], 900],
	Guitar: [[3000, 3000, 3000, 3000], 1100]
};

function randomPhone() {
	let n = '9';
	for (let i = 0; i < 9; i++) n += Math.floor(rnd() * 10);
	return n;
}
function randomDob() {
	return `${range(2008, 2017)}-${String(range(1, 12)).padStart(2, '0')}-${String(range(1, 28)).padStart(2, '0')}`;
}
const pad = (n) => String(n).padStart(2, '0');
/** Local date → 'YYYY-MM-DD' */
function isoDate(d) {
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
/** Local date → 'YYYY-MM-DDTHH:mm:ss' (the backend uses LocalDateTime) */
function isoDateTime(d) {
	return `${isoDate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
function dateInYear(year, monthIdx) {
	return new Date(year, monthIdx, range(1, 28), range(9, 18), range(0, 59));
}

// --- HTTP helpers ---------------------------------------------------------
let accessToken = null;
class HttpError extends Error {
	constructor(status, message) {
		super(message);
		this.status = status;
	}
}
async function call(method, path, body = undefined) {
	const headers = { 'Content-Type': 'application/json' };
	if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
	const res = await fetch(`${API_BASE}${path}`, {
		method,
		headers,
		body: body !== undefined ? JSON.stringify(body) : undefined
	});
	const text = await res.text().catch(() => '');
	if (!res.ok) {
		let msg = text.slice(0, 200);
		try {
			msg = JSON.parse(text).message ?? msg;
		} catch {
			/* not JSON */
		}
		throw new HttpError(res.status, `${method} ${path} -> ${res.status} ${msg}`);
	}
	if (!text) return null;
	try {
		return JSON.parse(text);
	} catch {
		return text;
	}
}
const get = (p) => call('GET', p);
const post = (p, b) => call('POST', p, b);
const qs = (o) => '?' + new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined)).toString();

// --- Steps ----------------------------------------------------------------
async function login() {
	const out = await post('/api/auth/login', { email: EMAIL, password: PASSWORD });
	if (!out?.accessToken) throw new Error('Login response missing accessToken');
	accessToken = out.accessToken;
	console.log(`✓ Logged in as ${EMAIL}`);
}

/** Make sure every catalog course exists, is active and has a fee timeline. Returns the active course names. */
async function ensureCatalog() {
	const existing = new Map((await get('/api/courses')).map((c) => [c.name.toLowerCase(), c]));
	for (const [name, [quarterly, monthly]] of Object.entries(CATALOG)) {
		const course = existing.get(name.toLowerCase());
		if (!course) {
			await post('/api/courses', { name });
			console.log(`  + course ${name}`);
		}
		const courseName = course?.name ?? name;
		if (course?.status === 'CLOSED') continue;
		const timeline = await get(`/api/fee-timeline${qs({ courseName })}`);
		if (timeline.length > 0) continue;

		let structures = await get(`/api/fee-structures${qs({ courseName })}`);
		const ensure = async (sName, termsPerYear, amounts) =>
			structures.find((s) => s.name === sName) ??
			(await post('/api/fee-structures', {
				name: sName,
				courseName,
				termsPerYear,
				terms: amounts.map((amount, i) => ({ termNumber: i + 1, amount }))
			}));
		const q = await ensure(`${courseName} quarterly`, 4, quarterly);
		const m = await ensure(`${courseName} monthly`, 12, Array(12).fill(monthly));
		await post('/api/fee-timeline', { courseName, feeStructureId: q.id, effectiveFrom: '2024-01-01', effectiveTo: '2025-12-31' });
		await post('/api/fee-timeline', { courseName, feeStructureId: m.id, effectiveFrom: '2026-01-01', effectiveTo: null });
		console.log(`  + fee timeline for ${courseName}: quarterly 2024–2025, monthly from 2026`);
	}
	const active = (await get('/api/courses?status=ACTIVE')).map((c) => c.name);
	console.log(`✓ Catalog: ${active.length} active courses`);
	return active;
}

async function createStudent() {
	const body = {
		studentName: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
		admissionDate: isoDate(dateInYear(range(2023, 2025), range(0, 11))),
		contactNo: randomPhone(),
		className: pick(CLASSES),
		school: pick(SCHOOLS),
		pinCode: pick(PIN_CODES),
		address: `${range(1, 200)} ${pick(['MG Road', 'Brigade Rd', '5th Cross', 'Church St', '12th Main'])}, Bengaluru`,
		dob: randomDob(),
		status: rnd() < 0.9 ? 'active' : 'closed',
		remarks: rnd() < 0.2 ? 'Seed data — dummy record' : ''
	};
	return post('/api/students', body);
}

async function enrollStudent(student, courses) {
	const chosen = pickN(courses, range(1, Math.min(3, courses.length)));
	const sessions = [];
	const now = new Date();
	for (const courseName of chosen) {
		const joinDate = dateInYear(rnd() < 0.6 ? 2024 : 2025, range(0, 11));
		const body = { studentId: student.admissionNo, courseName, dateOfJoining: isoDateTime(joinDate) };
		if (rnd() < 0.1) {
			const end = new Date(joinDate);
			end.setMonth(end.getMonth() + range(6, 18));
			if (end < now) body.dateOfDisjoining = isoDateTime(end);
		}
		try {
			sessions.push(await post('/api/student-sessions', body));
		} catch (e) {
			console.warn(`\n  ! enroll ${student.studentName} → ${courseName}: ${e.message}`);
		}
	}
	return sessions;
}

/** Dues are derived in the background; wait until they show up. */
async function waitForDues(studentId, minCount = 1) {
	for (let i = 0; i < 20; i++) {
		const dues = await get(`/api/dues${qs({ studentId })}`);
		if (dues.length >= minCount) return dues;
		await sleep(500);
	}
	return get(`/api/dues${qs({ studentId })}`);
}

async function payDues(student, dues) {
	const today = isoDate(new Date());
	let count = 0;
	for (const due of dues) {
		if (due.periodStart > today || due.balance <= 0) continue;
		const r = rnd();
		if (r >= 0.85) continue; // leave unpaid
		const partial = r >= 0.65;
		const discount = !partial && rnd() < 0.15 ? Math.round(due.balance * 0.1) : 0;
		const amountPaid = partial ? Math.round(due.balance * 0.5) : due.balance - discount;
		const start = new Date(`${due.periodStart}T10:00:00`);
		const payDate = new Date(start.getTime() + rnd() * 20 * 86_400_000);
		const body = {
			studentId: student.admissionNo,
			paymentType: 'REGULAR',
			courseName: due.courseName,
			periodDate: due.periodStart,
			amountPaid,
			label: `${due.courseName} fee`,
			remarks: pick(['cash', 'UPI', 'bank transfer', '']),
			date: isoDateTime(payDate > new Date() ? new Date() : payDate),
			discounts: discount > 0 ? [{ discountAmount: discount, label: 'Sibling discount' }] : undefined
		};
		try {
			await post('/api/payments', body);
			count++;
		} catch (e) {
			console.warn(`\n  ! pay ${student.studentName} ${due.courseName} ${due.periodStart}: ${e.message}`);
		}
	}
	return count;
}

async function additionalPayment(student, courseName) {
	return post('/api/payments', {
		studentId: student.admissionNo,
		paymentType: 'ADDITIONAL',
		courseName,
		amountPaid: pick([500, 750, 1000]),
		label: pick(ADDITIONAL_LABELS),
		date: isoDateTime(new Date())
	});
}

// --- Main ----------------------------------------------------------------
async function main() {
	console.log(`Seeding ${STUDENT_COUNT} students against ${API_BASE}`);
	await login();
	const courses = await ensureCatalog();
	if (courses.length === 0) {
		console.error('No active courses. Aborting.');
		process.exit(1);
	}

	let totalSessions = 0;
	let totalPayments = 0;
	let converted = false;
	let waived = false;
	for (let i = 0; i < STUDENT_COUNT; i++) {
		try {
			const student = await createStudent();
			const sessions = await enrollStudent(student, courses);
			totalSessions += sessions.length;
			if (sessions.length === 0) continue;
			const dues = await waitForDues(student.admissionNo);
			totalPayments += await payDues(student, dues);

			if (rnd() < 0.3) {
				await additionalPayment(student, rnd() < 0.5 ? sessions[0].course.name : undefined);
				totalPayments++;
			}

			// One additional payment that should have been a course fee → convert it
			if (!converted) {
				const open = (await get(`/api/dues${qs({ studentId: student.admissionNo })}`)).find(
					(d) => d.balance >= 500 && d.periodStart <= isoDate(new Date())
				);
				if (open) {
					const p = await post('/api/payments', {
						studentId: student.admissionNo,
						paymentType: 'ADDITIONAL',
						amountPaid: 500,
						label: `${open.courseName} fee (entered as additional)`,
						date: isoDateTime(new Date())
					});
					await post(`/api/payments/${p.id}/convert-to-course-fee`, { courseName: open.courseName, periodDate: open.periodStart });
					converted = true;
					totalPayments++;
				}
			}

			// One waiver for a student who left
			if (!waived) {
				const left = sessions.find((s) => s.dateOfDisjoining);
				if (left) {
					const open = (await get(`/api/dues${qs({ studentId: student.admissionNo })}`)).find(
						(d) => d.sessionId === left.id && (d.status === 'DUE' || d.status === 'PARTIALLY_PAID')
					);
					if (open) {
						await post('/api/dues/waivers', { sessionId: left.id, periodStart: open.periodStart, reason: 'Left mid-term (seed)' });
						waived = true;
					}
				}
			}
			process.stdout.write(`\r  students: ${i + 1}/${STUDENT_COUNT}  sessions: ${totalSessions}  payments: ${totalPayments}`);
		} catch (e) {
			console.warn(`\n! student #${i + 1}: ${e.message}`);
		}
	}
	console.log(
		`\n✓ Done — ${STUDENT_COUNT} students, ${totalSessions} sessions, ${totalPayments} payments` +
			`${converted ? ', 1 converted payment' : ''}${waived ? ', 1 waiver' : ''}.`
	);
}

main().catch((e) => {
	console.error('FATAL:', e);
	process.exit(1);
});
