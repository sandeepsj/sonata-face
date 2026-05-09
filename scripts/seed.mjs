#!/usr/bin/env node
// Seed dummy students, sessions, and payments via the running backend's REST API.
//
// Usage:
//   API_BASE=http://localhost:8080 \
//   EMAIL=sandeepsj0000@gmail.com \
//   PASSWORD=yourpassword \
//   STUDENT_COUNT=30 \
//   node scripts/seed.mjs
//
// Prereqs:
//   1. Backend running at $API_BASE.
//   2. (Recommended) Wipe first: psql -f scripts/wipe.sql
//   3. Courses + fee structures already exist (this script does NOT create them;
//      it picks the existing ones it finds).
//
// What it creates per student:
//   - 1 student record
//   - 1–3 enrollments (student_session)
//   - For each enrollment, payments covering 0–100% of the student's fee
//     dues across the years the course has fee structures defined.

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
const PAYMENT_LABELS = ['Term fee', 'Quarterly tuition', 'Monthly fee'];

function randomPhone() {
	let n = '9';
	for (let i = 0; i < 9; i++) n += Math.floor(rnd() * 10);
	return n;
}
function randomDob() {
	const year = range(2008, 2017);
	const month = String(range(1, 12)).padStart(2, '0');
	const day = String(range(1, 28)).padStart(2, '0');
	return `${year}-${month}-${day}`;
}
function isoDate(d) {
	return d.toISOString().slice(0, 10);
}
function isoDateTime(d) {
	// Backend uses Java LocalDateTime — strip the trailing "Z" so Jackson parses it.
	return d.toISOString().slice(0, 19);
}
function dateInYear(year, monthIdx, dayHint = null) {
	const day = dayHint ?? range(1, 28);
	return new Date(Date.UTC(year, monthIdx, day));
}

// --- HTTP helpers ---------------------------------------------------------
let accessToken = null;
async function call(method, path, body = undefined) {
	const headers = { 'Content-Type': 'application/json' };
	if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
	const res = await fetch(`${API_BASE}${path}`, {
		method,
		headers,
		body: body !== undefined ? JSON.stringify(body) : undefined
	});
	if (!res.ok) {
		const text = await res.text().catch(() => '');
		throw new Error(`${method} ${path} -> ${res.status} ${res.statusText} ${text.slice(0, 200)}`);
	}
	const text = await res.text();
	if (!text) return null;
	try { return JSON.parse(text); } catch { return text; }
}
const get = (p) => call('GET', p);
const post = (p, b) => call('POST', p, b);

// --- Steps ----------------------------------------------------------------
async function login() {
	const out = await post('/api/auth/login', { email: EMAIL, password: PASSWORD });
	if (!out?.accessToken) throw new Error('Login response missing accessToken');
	accessToken = out.accessToken;
	console.log(`✓ Logged in as ${EMAIL}`);
}

async function loadCatalog() {
	// Pull fee structures across recent years; use whatever exists.
	const years = [2024, 2025, 2026];
	const all = [];
	for (const y of years) {
		try {
			const fs = await get(`/api/fee-structures/by-year/${y}`);
			if (Array.isArray(fs)) all.push(...fs);
		} catch (e) {
			console.warn(`! Skipping year ${y}: ${e.message}`);
		}
	}
	// Index: courseName -> { years: { year: [feeStructure...] } }
	const byCourse = new Map();
	for (const fs of all) {
		const courseName = fs.course?.name;
		if (!courseName) continue;
		if (!byCourse.has(courseName)) byCourse.set(courseName, { years: new Map() });
		const yMap = byCourse.get(courseName).years;
		if (!yMap.has(fs.year)) yMap.set(fs.year, []);
		yMap.get(fs.year).push(fs);
	}
	for (const { years } of byCourse.values()) {
		for (const arr of years.values()) arr.sort((a, b) => a.term - b.term);
	}
	console.log(`✓ Catalog: ${byCourse.size} courses · ${all.length} fee structures`);
	return byCourse;
}

async function createStudent(i) {
	const first = pick(FIRST_NAMES);
	const last = pick(LAST_NAMES);
	const admissionDate = isoDate(dateInYear(range(2023, 2025), range(0, 11)));
	const body = {
		studentName: `${first} ${last}`,
		admissionDate,
		contactNo: randomPhone(),
		className: pick(CLASSES),
		school: pick(SCHOOLS),
		pinCode: pick(PIN_CODES),
		address: `${range(1, 200)} ${pick(['MG Road', 'Brigade Rd', '5th Cross', 'Church St', '12th Main'])}, Bengaluru`,
		dob: randomDob(),
		status: rnd() < 0.9 ? 'active' : 'closed',
		remarks: rnd() < 0.2 ? 'Seed data — dummy record' : ''
	};
	const out = await post('/api/students', body);
	return out;
}

async function enrollStudent(student, catalog) {
	const allCourses = Array.from(catalog.keys());
	const enrollCount = range(1, Math.min(3, allCourses.length));
	const chosen = pickN(allCourses, enrollCount);
	const sessions = [];
	for (const courseName of chosen) {
		// Random join date in 2024 or 2025
		const joinYear = rnd() < 0.6 ? 2024 : 2025;
		const joinDate = dateInYear(joinYear, range(0, 11));
		const body = {
			studentId: student.admissionNo,
			courseName,
			dateOfJoining: isoDateTime(joinDate)
		};
		// 10% chance the session has been ended
		let disjoinDate = null;
		if (rnd() < 0.10) {
			const end = new Date(joinDate);
			end.setMonth(end.getMonth() + range(6, 18));
			if (end < new Date()) {
				disjoinDate = end;
				body.dateOfDisjoining = isoDateTime(end);
			}
		}
		try {
			const session = await post('/api/student-sessions', body);
			sessions.push({ session, courseName, joinDate, disjoinDate });
		} catch (e) {
			console.warn(`  ! enroll ${student.studentName} → ${courseName}: ${e.message}`);
		}
	}
	return sessions;
}

async function payForSession({ session, courseName, joinDate, disjoinDate }, student, catalog) {
	const courseEntry = catalog.get(courseName);
	if (!courseEntry) return 0;
	let payments = 0;
	const today = new Date();
	for (const [year, structures] of courseEntry.years) {
		// Skip years before the student joined
		if (year < joinDate.getUTCFullYear()) continue;
		for (const fs of structures) {
			if (!fs.isActive) continue;
			// Approximate term start/end
			const termsPerYear = structures.length || 4;
			const monthsPerTerm = 12 / termsPerYear;
			const termStartMonth = Math.floor((fs.term - 1) * monthsPerTerm);
			const termStart = new Date(Date.UTC(year, termStartMonth, 5));
			const termEndForFilter = new Date(Date.UTC(year, termStartMonth + Math.ceil(monthsPerTerm), 0));
			// Only pay terms where the session was active at some point during the term.
			if (termEndForFilter < joinDate) continue;
			if (disjoinDate && termStart > disjoinDate) continue;
			if (termStart > today) continue; // future terms, leave unpaid

			// Decide whether/how to pay this term
			const r = rnd();
			let amountPaid;
			if (r < 0.65) amountPaid = fs.amount;             // paid in full
			else if (r < 0.80) amountPaid = Math.round(fs.amount * 0.5); // partial
			else if (r < 0.92) amountPaid = 0;                // not paid
			else continue;                                    // skip entirely

			if (amountPaid === 0) continue;

			// Pay date = somewhere between term start and (today or term end)
			const termEnd = new Date(Date.UTC(year, termStartMonth + Math.ceil(monthsPerTerm), 0));
			const upper = termEnd > today ? today : termEnd;
			const span = upper.getTime() - termStart.getTime();
			const payDate = new Date(termStart.getTime() + rnd() * Math.max(span, 86_400_000));

			const body = {
				studentId: student.admissionNo,
				termId: fs.id,
				amountPaid,
				courseName,
				label: pick(PAYMENT_LABELS),
				date: isoDateTime(payDate)
			};
			try {
				await post('/api/payments', body);
				payments++;
			} catch (e) {
				console.warn(`  ! pay ${student.studentName} ${courseName} Y${year}T${fs.term}: ${e.message}`);
			}
		}
	}
	return payments;
}

// --- Main ----------------------------------------------------------------
async function main() {
	console.log(`Seeding ${STUDENT_COUNT} students against ${API_BASE}`);
	await login();
	const catalog = await loadCatalog();
	if (catalog.size === 0) {
		console.error('No courses with fee structures found. Aborting.');
		process.exit(1);
	}

	let totalSessions = 0;
	let totalPayments = 0;
	for (let i = 0; i < STUDENT_COUNT; i++) {
		try {
			const student = await createStudent(i);
			const sessions = await enrollStudent(student, catalog);
			totalSessions += sessions.length;
			for (const s of sessions) totalPayments += await payForSession(s, student, catalog);
			process.stdout.write(`\r  students: ${i + 1}/${STUDENT_COUNT}  sessions: ${totalSessions}  payments: ${totalPayments}`);
		} catch (e) {
			console.warn(`\n! student #${i + 1}: ${e.message}`);
		}
	}
	console.log(`\n✓ Done — ${STUDENT_COUNT} students, ${totalSessions} sessions, ${totalPayments} payments.`);
}

main().catch((e) => {
	console.error('FATAL:', e);
	process.exit(1);
});
