<script lang="ts">
	import {
		FeeStructureService,
		feeStructureStore,
		StudentSessionService,
		type Course,
		type FeeStructure,
		type StudentSession
	} from '$lib';
	import { Users, Pencil, MoreHorizontal, Plus, TrendingUp, BookOpen, Printer } from 'lucide-svelte';
	import Badge from '$lib/components/Badge.svelte';
	import Select from '$lib/components/Select.svelte';

	type CourseGroup = { course: Course; structures: FeeStructure[]; yearlyFee: number; termsPerYear: number };
	type DetailTab = 'schedule' | 'students' | 'policy' | 'analytics';

	let feeStructures: FeeStructure[] = [];
	let loading = true;
	let error = '';

	let selectedCourseId: string | null = null;
	let activeTab: DetailTab = 'schedule';

	let detailSessions: StudentSession[] = [];
	let loadingSessions = false;

	let courseStudentCounts = new Map<string, number>();

	const currentYear = new Date().getFullYear();
	const availableYears = Array.from({ length: 12 }, (_, i) => currentYear + 1 - i);
	let selectedYear: number = currentYear;

	$: courseGroups = buildCourseGroups(feeStructures);
	$: selectedGroup = courseGroups.find((g) => g.course.id === selectedCourseId) ?? courseGroups[0] ?? null;
	$: termFee = selectedGroup ? (selectedGroup.structures[0]?.amount ?? 0) : 0;
	$: annualFee = selectedGroup?.yearlyFee ?? 0;
	$: stats = computeStats(courseGroups, courseStudentCounts);

	function buildCourseGroups(structures: FeeStructure[]): CourseGroup[] {
		const map = new Map<string, FeeStructure[]>();
		for (const fs of structures) {
			if (!map.has(fs.course.id)) map.set(fs.course.id, []);
			map.get(fs.course.id)!.push(fs);
		}
		const groups: CourseGroup[] = [];
		for (const [, items] of map) {
			items.sort((a, b) => a.term - b.term);
			const course = items[0].course;
			groups.push({
				course,
				structures: items,
				yearlyFee: FeeStructureService.calculateYearlyFee(items),
				termsPerYear: FeeStructureService.getTermsPerYear(course.id, selectedYear, structures) || items.length
			});
		}
		groups.sort((a, b) => a.course.name.localeCompare(b.course.name));
		return groups;
	}

	function computeStats(groups: CourseGroup[], counts: Map<string, number>) {
		const courseCount = groups.length;
		const avgTermsPerYear = groups.length
			? groups.reduce((s, g) => s + (g.termsPerYear || 0), 0) / groups.length
			: 0;
		const totalStudents = Array.from(counts.values()).reduce((s, n) => s + n, 0);
		const avgAnnual = groups.length
			? Math.round(groups.reduce((s, g) => s + g.yearlyFee, 0) / groups.length)
			: 0;
		let topCourse: { name: string; count: number } | null = null;
		for (const g of groups) {
			const c = counts.get(g.course.id) ?? 0;
			if (!topCourse || c > topCourse.count) topCourse = { name: g.course.name, count: c };
		}
		return { courseCount, avgTermsPerYear, totalStudents, avgAnnual, topCourse };
	}

	function getTermMonthRange(termNumber: number, termsPerYear: number): string {
		const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
		if (termsPerYear <= 0 || termNumber <= 0 || termNumber > termsPerYear) return '—';
		const monthsPerTerm = 12 / termsPerYear;
		const startIdx = Math.floor((termNumber - 1) * monthsPerTerm);
		const endIdx = Math.min(Math.floor(termNumber * monthsPerTerm) - 1, months.length - 1);
		const start = months[startIdx];
		const end = months[endIdx];
		return start === end ? `${start} ${selectedYear}` : `${start} – ${end} ${selectedYear}`;
	}

	function getTermStatus(termNumber: number, termsPerYear: number): 'closed' | 'active' | 'upcoming' {
		if (termsPerYear <= 0) return 'upcoming';
		const now = new Date();
		const sameYear = now.getFullYear();
		if (selectedYear < sameYear) return 'closed';
		if (selectedYear > sameYear) return 'upcoming';
		const monthsPerTerm = 12 / termsPerYear;
		const startMonth = Math.floor((termNumber - 1) * monthsPerTerm);
		const endMonth = Math.floor(termNumber * monthsPerTerm) - 1;
		const m = now.getMonth();
		if (m < startMonth) return 'upcoming';
		if (m > endMonth) return 'closed';
		return 'active';
	}

	async function loadFeeStructures(year: number) {
		try {
			loading = true;
			error = '';
			feeStructures = await feeStructureStore.getByYear(year);
			courseStudentCounts = new Map();
			if (feeStructures.length && !selectedCourseId) {
				const groups = buildCourseGroups(feeStructures);
				selectedCourseId = groups[0]?.course.id ?? null;
			}
			refreshStudentCounts();
			if (selectedGroup) loadDetailSessions(selectedGroup.course.name);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load courses';
		} finally {
			loading = false;
		}
	}

	async function refreshStudentCounts() {
		const groups = buildCourseGroups(feeStructures);
		await Promise.all(
			groups.map(async (g) => {
				try {
					const sessions = await StudentSessionService.getStudentsByCourseAndYear(g.course.name, selectedYear);
					courseStudentCounts.set(g.course.id, sessions.filter(isSessionActive).length);
					courseStudentCounts = courseStudentCounts;
				} catch {
					/* ignore per-course count failures */
				}
			})
		);
	}

	async function loadDetailSessions(courseName: string) {
		try {
			loadingSessions = true;
			detailSessions = await StudentSessionService.getStudentsByCourseAndYear(courseName, selectedYear);
		} catch {
			detailSessions = [];
		} finally {
			loadingSessions = false;
		}
	}

	function selectCourse(courseId: string) {
		selectedCourseId = courseId;
		const g = courseGroups.find((c) => c.course.id === courseId);
		if (g) loadDetailSessions(g.course.name);
	}

	function isSessionActive(s: StudentSession): boolean {
		return s.dateOfDisjoining === null || s.dateOfDisjoining === undefined;
	}

	function formatDate(d: string | null | undefined): string {
		if (!d) return '—';
		try {
			return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
		} catch {
			return d;
		}
	}

	function todayStr(): string {
		return new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
	}

	function printStudents() {
		window.print();
	}

	function initials(name: string): string {
		return name
			.split(/\s+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((w) => w[0]?.toUpperCase() ?? '')
			.join('');
	}

	$: if (selectedYear) loadFeeStructures(selectedYear);
	$: activeStudentCount = detailSessions.filter(isSessionActive).length;
</script>

<svelte:head>
	<title>Courses — Revathi Arts</title>
</svelte:head>

<div class="page">
	<div class="page-head">
		<div class="page-head-row">
			<div>
				<h1 class="page-title">Courses &amp; <em>fee</em> structure</h1>
				<p class="page-subtitle">Programme catalogue with term fees and student enrolments.</p>
			</div>
			<div class="field" style="min-width: 140px;">
				<span class="field-label">Year</span>
				<Select
					bind:value={selectedYear}
					options={availableYears.map((y) => ({ value: y, label: String(y) }))}
					ariaLabel="Year"
				/>
			</div>
		</div>
	</div>

	<!-- Top stat cards -->
	<div class="course-stats">
		<div class="stat-card">
			<div class="stat-value">{stats.courseCount}</div>
			<div class="stat-meta">
				{stats.avgTermsPerYear > 0 ? `across ${stats.avgTermsPerYear.toFixed(1)} terms avg` : 'courses'}
			</div>
		</div>
		<div class="stat-card">
			<div class="stat-value">{stats.totalStudents}</div>
			<div class="stat-meta">
				<span class="muted">students enrolled · {selectedYear}</span>
			</div>
		</div>
		<div class="stat-card">
			<div class="stat-value">₹{stats.avgAnnual.toLocaleString('en-IN')}</div>
			<div class="stat-meta muted">avg annual fee</div>
		</div>
		<div class="stat-card">
			{#if stats.topCourse && stats.topCourse.count > 0}
				<div class="stat-value-text">{stats.topCourse.name}</div>
				<div class="stat-meta">
					<Badge kind="ok">{stats.topCourse.count} students</Badge>
					<span class="muted" style="margin-left: 8px;">top enrolment</span>
				</div>
			{:else}
				<div class="stat-value-text muted" style="font-size: 18px;">—</div>
				<div class="stat-meta muted">top enrolment</div>
			{/if}
		</div>
	</div>

	{#if loading}
		<div style="display: flex; justify-content: center; padding: 60px 0;"><span class="spinner spinner-lg"></span></div>
	{:else if error}
		<div class="callout danger"><div class="callout-body">{error}</div></div>
	{:else if courseGroups.length === 0}
		<div class="card-s">
			<div class="card-body-s">
				<div class="empty-s">
					<div class="glyph">∅</div>
					<div style="font-family: var(--font-serif); font-size: 18px; color: var(--fg); margin-top: 6px;">No courses found</div>
					<div style="margin-top: 4px;">Try a different year.</div>
				</div>
			</div>
		</div>
	{:else}
		<div class="course-split">
			<!-- Left: course list -->
			<aside class="course-list-card">
				<div class="course-list-head">
					<span class="course-list-title">All courses</span>
					<span class="course-list-count">{courseGroups.length}</span>
				</div>
				<div class="course-list-body">
					{#each courseGroups as g}
						{@const isSel = selectedGroup?.course.id === g.course.id}
						{@const studentCount = courseStudentCounts.get(g.course.id) ?? 0}
						<button
							type="button"
							class="course-row"
							class:is-sel={isSel}
							on:click={() => selectCourse(g.course.id)}
						>
							<span class="course-avatar">{initials(g.course.name)}</span>
							<span class="course-row-body">
								<span class="course-row-name">{g.course.name}</span>
								<span class="course-row-meta">
									<Users size={11} strokeWidth={1.6} />
									{studentCount} · ₹{(g.structures[0]?.amount ?? 0).toLocaleString('en-IN')}/term
								</span>
							</span>
						</button>
					{/each}
				</div>
				<button class="course-add" type="button" disabled>
					<Plus size={14} strokeWidth={1.6} /> Add course
				</button>
			</aside>

			<!-- Right: course detail -->
			<section class="course-detail">
				{#if selectedGroup}
					<header class="course-detail-head">
						<div style="display: flex; gap: 14px; align-items: flex-start; flex: 1; min-width: 0;">
							<span class="course-avatar course-avatar-lg">{initials(selectedGroup.course.name)}</span>
							<div style="min-width: 0; flex: 1;">
								<h2 class="course-detail-name">{selectedGroup.course.name}</h2>
								<p class="course-detail-sub">
									{selectedGroup.termsPerYear} terms · {activeStudentCount} students enrolled · year {selectedYear}
								</p>
								<div style="display: flex; gap: 8px; margin-top: 12px;">
									<button class="btn-s btn-secondary-s btn-sm-s" disabled>
										<Pencil size={12} strokeWidth={1.6} /> Edit course
									</button>
									<button class="btn-s btn-secondary-s btn-sm-s" disabled>
										<Users size={12} strokeWidth={1.6} /> Manage roster
									</button>
									<button class="btn-s btn-ghost-s btn-icon-s btn-sm-s" disabled aria-label="More">
										<MoreHorizontal size={14} strokeWidth={1.6} />
									</button>
								</div>
							</div>
						</div>
						<div class="course-detail-kpis">
							<div>
								<div class="kpi-label">Term fee</div>
								<div class="kpi-value">₹{termFee.toLocaleString('en-IN')}</div>
							</div>
							<div>
								<div class="kpi-label">Annual</div>
								<div class="kpi-value accent">₹{annualFee.toLocaleString('en-IN')}</div>
							</div>
							<div>
								<div class="kpi-label">Students</div>
								<div class="kpi-value">{activeStudentCount}</div>
							</div>
						</div>
					</header>

					<div class="course-tabs">
						<button class:is-active={activeTab === 'schedule'} on:click={() => (activeTab = 'schedule')}>
							Terms &amp; schedule
						</button>
						<button class:is-active={activeTab === 'students'} on:click={() => (activeTab = 'students')}>
							Students <span class="tab-badge">{activeStudentCount}</span>
						</button>
						<button class:is-active={activeTab === 'policy'} on:click={() => (activeTab = 'policy')}>Fee policy</button>
						<button class:is-active={activeTab === 'analytics'} on:click={() => (activeTab = 'analytics')}>Analytics</button>
					</div>

					{#if activeTab === 'schedule'}
						<div class="course-card">
							<div class="course-card-head">
								<span class="course-card-title">Term schedule</span>
							</div>
							<div class="tbl-wrap">
								<table class="tbl">
									<thead>
										<tr>
											<th>Term</th>
											<th>Period</th>
											<th style="text-align: right;">Fee</th>
											<th>Status</th>
										</tr>
									</thead>
									<tbody>
										{#each selectedGroup.structures as fs}
											{@const status = getTermStatus(fs.term, selectedGroup.termsPerYear)}
											<tr>
												<td><span class="strong">Term {fs.term}</span></td>
												<td class="muted">{getTermMonthRange(fs.term, selectedGroup.termsPerYear)}</td>
												<td class="num strong">₹{fs.amount.toLocaleString('en-IN')}</td>
												<td>
													{#if !fs.isActive}
														<Badge kind="neutral">Inactive</Badge>
													{:else if status === 'active'}
														<Badge kind="ok">Active</Badge>
													{:else if status === 'closed'}
														<Badge kind="neutral">Closed</Badge>
													{:else}
														<Badge kind="warn">Upcoming</Badge>
													{/if}
												</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						</div>
					{:else if activeTab === 'students'}
						<div class="course-card">
							<div class="course-card-head" style="display: flex; align-items: center; justify-content: space-between;">
								<span class="course-card-title">Enrolled students · {selectedYear}</span>
								<button
									class="btn-s btn-secondary-s btn-sm-s"
									onclick={printStudents}
									disabled={detailSessions.length === 0}
								>
									<Printer size={14} strokeWidth={1.6} /> Print
								</button>
							</div>
							{#if loadingSessions}
								<div style="display: flex; justify-content: center; padding: 30px 0;"><span class="spinner spinner-lg"></span></div>
							{:else if detailSessions.length === 0}
								<div class="callout info"><div class="callout-body">No students enrolled in {selectedYear}.</div></div>
							{:else}
								<div class="tbl-wrap">
									<table class="tbl">
										<thead>
											<tr>
												<th>Admission #</th>
												<th>Name</th>
												<th>Joined</th>
												<th>Left</th>
												<th>Status</th>
											</tr>
										</thead>
										<tbody>
											{#each detailSessions as s}
												<tr>
													<td>
														<a href="/students/{s.student.admissionNo}" style="color: var(--accent); font-family: var(--font-mono); font-size: 12px;">
															{s.student.admissionNo}
														</a>
													</td>
													<td><span class="strong">{s.student.studentName}</span></td>
													<td class="muted">{formatDate(s.dateOfJoining)}</td>
													<td class="muted">{isSessionActive(s) ? '—' : formatDate(s.dateOfDisjoining)}</td>
													<td>
														{#if isSessionActive(s)}
															<Badge kind="ok">Active</Badge>
														{:else}
															<Badge kind="neutral">Inactive</Badge>
														{/if}
													</td>
												</tr>
											{/each}
										</tbody>
									</table>
									<div style="padding: 10px 16px; font-size: 12px; color: var(--fg-muted); border-top: 1px solid var(--border);">
										Total: {detailSessions.length} student{detailSessions.length !== 1 ? 's' : ''} · {activeStudentCount} active
									</div>
								</div>
							{/if}
						</div>
					{:else if activeTab === 'policy'}
						<div class="course-card">
							<div class="course-card-head"><span class="course-card-title">Fee policy</span></div>
							<div style="padding: 18px;">
								<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px;">
									<div>
										<div class="kpi-label">Term fee</div>
										<div class="kpi-value">₹{termFee.toLocaleString('en-IN')}</div>
									</div>
									<div>
										<div class="kpi-label">Annual</div>
										<div class="kpi-value accent">₹{annualFee.toLocaleString('en-IN')}</div>
									</div>
									<div>
										<div class="kpi-label">Terms / year</div>
										<div class="kpi-value">{selectedGroup.termsPerYear}</div>
									</div>
								</div>
							</div>
						</div>
					{:else if activeTab === 'analytics'}
						<div class="course-card">
							<div class="course-card-head"><span class="course-card-title">Analytics</span></div>
							<div style="padding: 28px; text-align: center; color: var(--fg-muted);">
								<TrendingUp size={20} strokeWidth={1.4} />
								<div style="margin-top: 8px;">Analytics for this course are not available yet.</div>
							</div>
						</div>
					{/if}
				{:else}
					<div class="callout info"><div class="callout-body">Select a course to view details.</div></div>
				{/if}
			</section>
		</div>
	{/if}

	<!-- Print-only block: students roster for the selected course -->
	{#if selectedGroup && activeTab === 'students' && detailSessions.length > 0}
		<div class="course-print">
			<div class="print-header">
				<div>
					<div class="print-brand">Revathi <em>Arts</em> &amp; Music School</div>
					<div class="print-title">{selectedGroup.course.name} · students roster</div>
					<div class="print-meta">
						Year {selectedYear} · {selectedGroup.termsPerYear} terms · {activeStudentCount} active of {detailSessions.length} · Generated {todayStr()}
					</div>
				</div>
				<div class="print-totals">
					<div><span class="print-totals-label">Term fee</span> ₹{(selectedGroup.structures[0]?.amount ?? 0).toLocaleString('en-IN')}</div>
					<div><span class="print-totals-label">Annual</span> ₹{selectedGroup.yearlyFee.toLocaleString('en-IN')}</div>
				</div>
			</div>

			<table class="print-tbl">
				<thead>
					<tr>
						<th style="width: 40px;">#</th>
						<th>Admission #</th>
						<th>Name</th>
						<th>Joined</th>
						<th>Left</th>
						<th>Status</th>
					</tr>
				</thead>
				<tbody>
					{#each detailSessions as s, i}
						<tr>
							<td>{i + 1}</td>
							<td>{s.student.admissionNo}</td>
							<td>{s.student.studentName}</td>
							<td>{formatDate(s.dateOfJoining)}</td>
							<td>{isSessionActive(s) ? '—' : formatDate(s.dateOfDisjoining)}</td>
							<td>{isSessionActive(s) ? 'Active' : 'Inactive'}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

<style>
	.course-stats {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 12px;
		margin-bottom: 18px;
	}
	@media (max-width: 1100px) {
		.course-stats { grid-template-columns: repeat(2, 1fr); }
	}
	.stat-card {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 12px;
		padding: 16px 18px;
		min-height: 88px;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
	}
	.stat-value {
		font-family: var(--font-serif);
		font-size: 28px;
		font-weight: 500;
		letter-spacing: -0.02em;
		color: var(--fg);
		line-height: 1.1;
	}
	.stat-value-text {
		font-family: var(--font-serif);
		font-size: 22px;
		font-weight: 500;
		letter-spacing: -0.01em;
		color: var(--fg);
		line-height: 1.2;
	}
	.stat-meta {
		font-size: 12px;
		color: var(--fg-soft);
		margin-top: 8px;
		display: flex;
		align-items: center;
	}
	.stat-meta .muted { color: var(--fg-muted); }

	.course-split {
		display: grid;
		grid-template-columns: 320px 1fr;
		gap: 16px;
		align-items: start;
	}
	@media (max-width: 980px) {
		.course-split { grid-template-columns: 1fr; }
	}

	.course-list-card {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 12px;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}
	.course-list-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 14px;
		border-bottom: 1px solid var(--border);
	}
	.course-list-title {
		font-size: 11px;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--fg-muted);
		font-weight: 600;
	}
	.course-list-count {
		font-size: 12px;
		font-weight: 600;
		color: var(--fg-soft);
		background: var(--surface-2);
		border-radius: 999px;
		padding: 2px 8px;
		min-width: 24px;
		text-align: center;
	}
	.course-list-body {
		padding: 6px;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.course-row {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px;
		background: transparent;
		border: 0;
		border-radius: 8px;
		cursor: pointer;
		text-align: left;
		font: inherit;
		color: inherit;
		transition: background 120ms ease;
	}
	.course-row:hover { background: var(--hover); }
	.course-row.is-sel { background: var(--accent-soft); }
	.course-row.is-sel .course-row-name { color: var(--accent-deep); }
	.course-row-body {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
		flex: 1;
	}
	.course-row-name {
		font-size: 13px;
		font-weight: 500;
		color: var(--fg);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.course-row-meta {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 11px;
		color: var(--fg-muted);
	}
	.course-avatar {
		width: 32px;
		height: 32px;
		border-radius: 8px;
		background: var(--accent-soft);
		color: var(--accent-deep);
		display: grid;
		place-items: center;
		font-family: var(--font-serif);
		font-style: italic;
		font-weight: 600;
		font-size: 13px;
		flex-shrink: 0;
	}
	.course-avatar-lg {
		width: 56px;
		height: 56px;
		border-radius: 12px;
		font-size: 22px;
	}
	.course-add {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 12px;
		margin: 6px;
		background: transparent;
		border: 1px dashed var(--border-strong);
		border-radius: 8px;
		color: var(--fg-soft);
		font: inherit;
		font-size: 13px;
		cursor: pointer;
		transition: background 120ms ease, color 120ms ease;
	}
	.course-add:hover:not(:disabled) {
		background: var(--hover);
		color: var(--fg);
	}
	.course-add:disabled { opacity: 0.55; cursor: not-allowed; }

	.course-detail {
		display: flex;
		flex-direction: column;
		gap: 14px;
		min-width: 0;
	}
	.course-detail-head {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 12px;
		padding: 18px 20px;
		display: flex;
		gap: 18px;
		flex-wrap: wrap;
		align-items: flex-start;
	}
	.course-detail-name {
		font-family: var(--font-serif);
		font-size: 24px;
		font-weight: 500;
		letter-spacing: -0.01em;
		margin: 0;
	}
	.course-detail-sub {
		margin: 4px 0 0;
		font-size: 13px;
		color: var(--fg-muted);
	}
	.course-detail-kpis {
		display: flex;
		gap: 24px;
		padding-left: 18px;
		border-left: 1px solid var(--border);
	}
	.kpi-value {
		font-family: var(--font-serif);
		font-size: 20px;
		font-weight: 500;
		letter-spacing: -0.01em;
	}
	.kpi-value.accent { color: var(--accent-deep); }

	.course-tabs {
		display: flex;
		gap: 6px;
		border-bottom: 1px solid var(--border);
		padding: 0 4px;
	}
	.course-tabs button {
		background: transparent;
		border: 0;
		padding: 10px 14px;
		font: inherit;
		font-size: 13px;
		color: var(--fg-soft);
		cursor: pointer;
		border-bottom: 2px solid transparent;
		margin-bottom: -1px;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		transition: color 120ms ease, border-color 120ms ease;
	}
	.course-tabs button:hover { color: var(--fg); }
	.course-tabs button.is-active {
		color: var(--accent-deep);
		border-bottom-color: var(--accent);
		font-weight: 500;
	}
	.tab-badge {
		font-size: 11px;
		background: var(--surface-2);
		color: var(--fg-soft);
		padding: 1px 6px;
		border-radius: 999px;
	}

	.course-card {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 12px;
		overflow: hidden;
	}
	.course-card-head {
		padding: 14px 18px;
		border-bottom: 1px solid var(--border);
	}
	.course-card-title {
		font-family: var(--font-serif);
		font-size: 16px;
		font-weight: 500;
	}

	/* ---------- Print ---------- */
	.course-print { display: none; }

	@media print {
		:global(body) :global(*) { visibility: hidden !important; }
		.course-print, .course-print * { visibility: visible !important; }
		.course-print {
			display: block;
			position: absolute;
			inset: 0;
			padding: 18mm 14mm;
			background: white;
			color: #1a1a1a;
			font-family: var(--font-sans);
		}
		.print-header {
			display: flex;
			justify-content: space-between;
			align-items: flex-start;
			gap: 24px;
			border-bottom: 1px solid #d0d0d0;
			padding-bottom: 10px;
			margin-bottom: 16px;
		}
		.print-brand { font-family: var(--font-serif); font-size: 18px; }
		.print-brand em { font-style: italic; color: #444; }
		.print-title { font-family: var(--font-serif); font-size: 22px; font-weight: 500; margin-top: 4px; }
		.print-meta { font-size: 11px; color: #555; margin-top: 4px; }
		.print-totals { font-size: 12px; text-align: right; line-height: 1.6; }
		.print-totals-label {
			display: inline-block;
			min-width: 70px;
			text-transform: uppercase;
			letter-spacing: 0.08em;
			color: #777;
			font-size: 10px;
			margin-right: 6px;
		}
		.print-tbl { width: 100%; border-collapse: collapse; font-size: 11px; }
		.print-tbl th, .print-tbl td {
			padding: 5px 7px;
			border-bottom: 1px solid #ececec;
			text-align: left;
			vertical-align: top;
		}
		.print-tbl th {
			text-transform: uppercase;
			letter-spacing: 0.06em;
			font-size: 9.5px;
			color: #555;
			font-weight: 500;
			background: #f6f6f6;
		}
		@page { margin: 12mm; }
	}
</style>
