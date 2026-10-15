<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import {
		Plus,
		Search,
		ChevronLeft,
		ChevronRight,
		Filter,
		X,
		ChevronDown,
		ChevronUp,
		Hash,
		Phone,
		School,
		MapPin,
		Calendar,
		User
	} from 'lucide-svelte';
	import { api, errorMessage, canAccess, type Student, type StudentSearchParams } from '$lib';
	import { recentsStore } from '$lib/stores/recentsStore';
	import Avatar from '$lib/components/Avatar.svelte';
	import Badge from '$lib/components/Badge.svelte';
	import Select from '$lib/components/Select.svelte';

	let students: Student[] = $state([]);
	let loading = $state(false);
	let error = $state('');
	let currentPage = $state(0);
	let pageSize = $state(10);
	let totalElements = $state(0);
	let totalPages = $state(0);
	let searchQuery = $state('');
	let showAdvancedSearch = $state(false);

	type SearchForm = StudentSearchParams & { admissionDate?: string; page?: number; size?: number };
	let advancedSearchParams: SearchForm = $state({
		name: '',
		contactNo: '',
		admissionNo: '',
		school: '',
		className: '',
		pinCode: '',
		admissionDate: '',
		admissionDateFrom: '',
		admissionDateTo: ''
	});

	function getActiveAdvancedFiltersCount(): number {
		return Object.values(advancedSearchParams).filter((v) => v !== undefined && v !== null && v !== '').length;
	}

	function getActiveFilters() {
		const filters: { key: string; label: string }[] = [];
		if (searchQuery) filters.push({ key: 'searchQuery', label: `Name: "${searchQuery}"` });
		const labels: Record<string, string> = {
			name: 'Name',
			contactNo: 'Phone',
			admissionNo: 'Admission',
			school: 'School',
			className: 'Class',
			pinCode: 'Pin',
			admissionDate: 'Date',
			admissionDateFrom: 'From',
			admissionDateTo: 'To'
		};
		for (const [k, v] of Object.entries(advancedSearchParams)) {
			if (v) filters.push({ key: k, label: `${labels[k] || k}: "${v}"` });
		}
		return filters;
	}

	let activeFilters = $derived(getActiveFilters());
	let activeAdvancedFiltersCount = $derived(getActiveAdvancedFiltersCount());

	function navigateToStudent(student: Student) {
		const studentId = student.admissionNo;
		if (!studentId) return;
		recentsStore.push({
			id: String(studentId),
			name: student.studentName || 'Unknown',
			admissionNo: student.admissionNo ? String(student.admissionNo) : undefined
		});
		goto(`/students/${studentId}`);
	}

	async function fetchStudents(p: number = 0, size: number = pageSize) {
		loading = true;
		error = '';
		try {
			const hasAdvancedSearch = Object.values(advancedSearchParams).some((v) => v !== undefined && v !== null && v !== '');
			const hasQuickSearch = searchQuery && searchQuery.trim() !== '';
			let response;
			if (hasQuickSearch || hasAdvancedSearch) {
				const searchParams: SearchForm = { page: p, size, ...advancedSearchParams };
				if (hasQuickSearch) searchParams.name = searchQuery.trim();
				Object.keys(searchParams).forEach((k) => {
					const v = searchParams[k as keyof SearchForm];
					if (v === undefined || v === null || v === '') delete searchParams[k as keyof SearchForm];
				});
				// /search returns every match; page through them here
				const { page: _p, size: _s, admissionDate, ...filters } = searchParams;
				if (admissionDate) {
					filters.admissionDateFrom = admissionDate;
					filters.admissionDateTo = admissionDate;
				}
				const all = await api.students.search(filters);
				response = {
					content: all.slice(p * size, (p + 1) * size),
					totalElements: all.length,
					totalPages: Math.ceil(all.length / size),
					number: p,
					size
				};
			} else {
				response = await api.students.page(p, size);
			}
			students = response.content;
			totalElements = response.totalElements;
			totalPages = response.totalPages;
			currentPage = response.number;
			pageSize = response.size;
		} catch (err) {
			error = errorMessage(err, 'Failed to fetch students');
			students = [];
			totalElements = 0;
			totalPages = 0;
		} finally {
			loading = false;
		}
	}

	function goToPage(p: number) {
		if (p >= 0 && p < totalPages) fetchStudents(p, pageSize);
	}

	function handleSearch() {
		currentPage = 0;
		fetchStudents(0, pageSize);
	}

	function clearFilter(key: string) {
		if (key === 'searchQuery') searchQuery = '';
		else (advancedSearchParams as any)[key] = '';
		pageSize = 10;
		currentPage = 0;
		handleSearch();
	}

	function clearAllFilters() {
		searchQuery = '';
		advancedSearchParams = {
			name: '',
			contactNo: '',
			admissionNo: '',
			school: '',
			className: '',
			pinCode: '',
			admissionDate: '',
			admissionDateFrom: '',
			admissionDateTo: ''
		};
		pageSize = 10;
		currentPage = 0;
		handleSearch();
	}

	function handlePageSizeChange(size: number) {
		pageSize = size;
		currentPage = 0;
		fetchStudents(0, pageSize);
	}

	onMount(() => {
		const q = $page.url.searchParams.get('q');
		if (q) searchQuery = q;
		fetchStudents();
	});
</script>

<svelte:head>
	<title>Students — Revathi Arts</title>
</svelte:head>

<div class="page">
	<div class="page-head">
		<div class="page-head-row">
			<div>
				<h1 class="page-title">All <em>students</em></h1>
				<p class="page-subtitle">Master list of admissions across every programme.</p>
			</div>
			<div style="display: flex; gap: 8px; align-items: center;">
				<button class="btn-s btn-primary-s" onclick={() => goto('/students/add')} hidden={!$canAccess('/api/students/**', 'write')}>
					<Plus size={14} strokeWidth={1.8} />
					Add student
				</button>
			</div>
		</div>
	</div>

	<div class="tbl-wrap" style="margin-bottom: 18px;">
		<div class="tbl-toolbar">
			<div class="input-icon-wrap" style="flex: 1; max-width: 360px;">
				<Search size={14} strokeWidth={1.6} />
				<input
					class="input-s"
					type="text"
					placeholder="Search by name…"
					bind:value={searchQuery}
					onkeydown={(e) => e.key === 'Enter' && handleSearch()}
				/>
			</div>

			<button class="btn-s btn-secondary-s" onclick={handleSearch}>
				<Search size={14} strokeWidth={1.6} />
				Search
			</button>

			<div style="position: relative;">
				<button class="btn-s btn-secondary-s" onclick={() => (showAdvancedSearch = !showAdvancedSearch)}>
					<Filter size={14} strokeWidth={1.6} />
					Filters
					{#if showAdvancedSearch}
						<ChevronUp size={14} strokeWidth={1.6} />
					{:else}
						<ChevronDown size={14} strokeWidth={1.6} />
					{/if}
				</button>
				{#if !showAdvancedSearch && activeAdvancedFiltersCount > 0}
					<span style="position: absolute; top: -5px; right: -5px; background: var(--accent); color: var(--accent-fg); font-size: 10px; font-family: var(--font-mono); width: 18px; height: 18px; border-radius: 50%; display: grid; place-items: center;">
						{activeAdvancedFiltersCount}
					</span>
				{/if}
			</div>

			<div class="grow"></div>

			<div style="min-width: 130px;">
				<Select
					value={pageSize}
					onChange={handlePageSizeChange}
					options={[
						{ value: 5, label: '5 / page' },
						{ value: 10, label: '10 / page' },
						{ value: 20, label: '20 / page' },
						{ value: 50, label: '50 / page' }
					]}
					size="sm"
					ariaLabel="Page size"
				/>
			</div>
		</div>

		{#if showAdvancedSearch}
			<div style="padding: 16px; border-bottom: 1px solid var(--border); background: var(--bg-elev); display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
				<div class="field">
					<label><User size={12} strokeWidth={1.6} style="display:inline; margin-right:4px;" />Student name</label>
					<input class="input-s" type="text" placeholder="Name" bind:value={advancedSearchParams.name} onkeydown={(e) => e.key === 'Enter' && handleSearch()} />
				</div>
				<div class="field">
					<label><Phone size={12} strokeWidth={1.6} style="display:inline; margin-right:4px;" />Contact</label>
					<input class="input-s" type="text" placeholder="Phone" bind:value={advancedSearchParams.contactNo} onkeydown={(e) => e.key === 'Enter' && handleSearch()} />
				</div>
				<div class="field">
					<label><Hash size={12} strokeWidth={1.6} style="display:inline; margin-right:4px;" />Admission #</label>
					<input class="input-s" type="text" placeholder="ID" bind:value={advancedSearchParams.admissionNo} onkeydown={(e) => e.key === 'Enter' && handleSearch()} />
				</div>
				<div class="field">
					<label><School size={12} strokeWidth={1.6} style="display:inline; margin-right:4px;" />School</label>
					<input class="input-s" type="text" placeholder="School" bind:value={advancedSearchParams.school} onkeydown={(e) => e.key === 'Enter' && handleSearch()} />
				</div>
				<div class="field">
					<label>Class</label>
					<input class="input-s" type="text" placeholder="Class" bind:value={advancedSearchParams.className} onkeydown={(e) => e.key === 'Enter' && handleSearch()} />
				</div>
				<div class="field">
					<label><MapPin size={12} strokeWidth={1.6} style="display:inline; margin-right:4px;" />Pin code</label>
					<input class="input-s" type="text" placeholder="Pin" bind:value={advancedSearchParams.pinCode} onkeydown={(e) => e.key === 'Enter' && handleSearch()} />
				</div>
				<div class="field">
					<label><Calendar size={12} strokeWidth={1.6} style="display:inline; margin-right:4px;" />Admission date</label>
					<input class="input-s" type="date" bind:value={advancedSearchParams.admissionDate} onchange={handleSearch} />
				</div>
				<div class="field">
					<label>Date from</label>
					<input class="input-s" type="date" bind:value={advancedSearchParams.admissionDateFrom} onchange={handleSearch} />
				</div>
				<div class="field">
					<label>Date to</label>
					<input class="input-s" type="date" bind:value={advancedSearchParams.admissionDateTo} onchange={handleSearch} />
				</div>
			</div>

			<div style="display: flex; gap: 8px; padding: 10px 16px; border-bottom: 1px solid var(--border); background: var(--bg-elev);">
				<button class="btn-s btn-primary-s btn-sm-s" onclick={handleSearch}>
					<Search size={12} strokeWidth={1.8} /> Apply
				</button>
				<button class="btn-s btn-ghost-s btn-sm-s" onclick={clearAllFilters}>
					<X size={12} strokeWidth={1.8} /> Clear all
				</button>
			</div>
		{/if}

		{#if activeFilters.length > 0}
			<div style="display: flex; flex-wrap: wrap; gap: 6px; padding: 10px 16px; border-bottom: 1px solid var(--border); background: var(--bg-elev);">
				{#each activeFilters as f}
					<span class="chip">
						{f.label}
						<button onclick={() => clearFilter(f.key)} aria-label="Remove filter"><X size={10} strokeWidth={2} /></button>
					</span>
				{/each}
				{#if activeFilters.length > 1}
					<button class="btn-s btn-ghost-s btn-sm-s" onclick={clearAllFilters}>Clear all</button>
				{/if}
			</div>
		{/if}

		{#if loading}
			<div style="padding: 60px 0; display: flex; justify-content: center; align-items: center; gap: 10px; color: var(--fg-muted);">
				<span class="spinner spinner-lg"></span>
				<span>Loading students…</span>
			</div>
		{:else if error}
			<div class="callout danger" style="margin: 16px;">
				<div>
					<div class="callout-title">Couldn't load students</div>
					<div class="callout-body">{error}</div>
				</div>
				<button class="btn-s btn-secondary-s btn-sm-s" style="margin-left: auto;" onclick={() => fetchStudents(currentPage, pageSize)}>
					Retry
				</button>
			</div>
		{:else if students.length === 0}
			<div class="empty-s">
				<div class="glyph">∅</div>
				<div style="font-family: var(--font-serif); font-size: 18px; color: var(--fg); margin-top: 6px;">No students found</div>
				<div style="margin-top: 4px;">
					{searchQuery || activeAdvancedFiltersCount > 0 ? 'Try a different filter.' : 'Add your first student to begin.'}
				</div>
				<div style="margin-top: 14px;">
					<button class="btn-s btn-primary-s" onclick={() => goto('/students/add')} hidden={!$canAccess('/api/students/**', 'write')}>
						<Plus size={14} strokeWidth={1.8} /> Add student
					</button>
				</div>
			</div>
		{:else}
			<table class="tbl">
				<thead>
					<tr>
						<th>Student</th>
						<th>Admission #</th>
						<th>Class</th>
						<th>School</th>
						<th>Contact</th>
						<th>Status</th>
					</tr>
				</thead>
				<tbody>
					{#each students as student, i (student.admissionNo || `s-${i}`)}
						<tr class="clickable" onclick={() => navigateToStudent(student)} role="button" tabindex="0" onkeydown={(e) => e.key === 'Enter' && navigateToStudent(student)}>
							<td>
								<div class="row-name">
									<Avatar name={student.studentName || ''} />
									<div class="meta">
										<div class="nm">{student.studentName || 'Unknown'}</div>
										{#if student.admissionDate}
											<div class="sub">Admitted {student.admissionDate}</div>
										{/if}
									</div>
								</div>
							</td>
							<td class="id">{student.admissionNo || `#${i + 1}`}</td>
							<td>
								{#if student.className}
									<Badge kind="neutral">{student.className}</Badge>
								{:else}
									<span class="muted">—</span>
								{/if}
							</td>
							<td class="muted" style="max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{student.school || '—'}</td>
							<td class="muted" style="font-family: var(--font-mono); font-size: 12px;">{student.contactNo || '—'}</td>
							<td>
								{#if student.status === 'active'}
									<Badge kind="ok">Active</Badge>
								{:else if student.status}
									<Badge kind="warn">{student.status}</Badge>
								{:else}
									<Badge kind="neutral">—</Badge>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>

			<div class="pager">
				<div class="info">
					Showing {currentPage * pageSize + 1}–{Math.min((currentPage + 1) * pageSize, totalElements)} of {totalElements}
				</div>
				<div style="display: flex; gap: 4px; align-items: center; margin-left: auto;">
					<button class="pg-btn" onclick={() => goToPage(currentPage - 1)} disabled={currentPage === 0} aria-label="Previous page">
						<ChevronLeft size={14} strokeWidth={1.6} />
					</button>
					{#each Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
						const startPage = Math.max(0, Math.min(currentPage - 2, totalPages - 5));
						return startPage + i;
					}) as p}
						<button class="pg-btn" class:active={p === currentPage} onclick={() => goToPage(p)}>{p + 1}</button>
					{/each}
					<button class="pg-btn" onclick={() => goToPage(currentPage + 1)} disabled={currentPage >= totalPages - 1} aria-label="Next page">
						<ChevronRight size={14} strokeWidth={1.6} />
					</button>
				</div>
			</div>
		{/if}
	</div>
</div>
