<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import {
		ArrowLeft,
		User,
		Edit,
		CreditCard,
		BookOpen,
		Clock,
		Banknote,
		Settings,
		Receipt,
		Star,
		AlertCircle,
		Phone,
		Hash
	} from 'lucide-svelte';
	import { currentStudentStore, StudentService } from '$lib';
	import { recentsStore, favoritesStore } from '$lib/stores/recentsStore';
	import Avatar from '$lib/components/Avatar.svelte';
	import Badge from '$lib/components/Badge.svelte';
	import type { LayoutData } from './$types';
	import type { Student } from '$lib/types/student';

	export let data: LayoutData;

	let student: Student | null = null;
	let loading = true;
	let error: string | null = null;
	let isFavorite = false;

	$: currentStudentState = $currentStudentStore;

	onMount(async () => {
		if (!data.admissionNo) {
			error = 'Student admission number is required';
			loading = false;
			return;
		}
		try {
			loading = true;
			const response = await StudentService.advancedSearchStudents({
				admissionNo: data.admissionNo,
				size: 1
			});
			if (!response.content || response.content.length === 0) {
				error = `Student with admission number ${data.admissionNo} not found`;
				loading = false;
				return;
			}
			student = response.content[0];
			currentStudentStore.setStudent(student);
			recentsStore.push({
				id: String(student.admissionNo || student.admissionId),
				name: student.studentName || 'Unknown',
				admissionNo: student.admissionNo ? String(student.admissionNo) : undefined
			});
			isFavorite = favoritesStore.isFav(String(student.admissionNo || student.admissionId));
			loading = false;
		} catch (err) {
			console.error('Error loading student:', err);
			error = 'Failed to load student data';
			loading = false;
		}
	});

	function toggleFav() {
		if (!student) return;
		isFavorite = favoritesStore.toggle({
			id: String(student.admissionNo || student.admissionId),
			name: student.studentName || 'Unknown',
			admissionNo: student.admissionNo ? String(student.admissionNo) : undefined
		});
	}

	$: studentId = $page.params.id;
	$: currentPath = $page.url.pathname;

	const navigationItems = [
		{ path: '', label: 'Overview', icon: User },
		{ path: '/edit', label: 'Edit', icon: Edit },
		{ path: '/sessions', label: 'Sessions', icon: BookOpen },
		{ path: '/payments', label: 'Payment history', icon: Banknote },
		{ path: '/manage-payments', label: 'Manage payments', icon: Settings },
		{ path: '/receipts', label: 'Receipts', icon: Receipt },
		{ path: '/timeline', label: 'Timeline', icon: Clock },
		{ path: '/dues', label: 'Pay fees', icon: CreditCard }
	];

	$: activeNavItems = navigationItems.map((item) => ({
		...item,
		active:
			currentPath === `/students/${studentId}${item.path}` ||
			(item.path === '' && currentPath === `/students/${studentId}`)
	}));

	function navigateToTab(path: string) {
		goto(`/students/${studentId}${path}`);
	}

	function goBack() {
		goto('/students');
	}
</script>

<svelte:head>
	<title>{student?.studentName || 'Loading…'} — Revathi Arts</title>
</svelte:head>

{#if loading}
	<div class="page" style="display: flex; align-items: center; justify-content: center; min-height: 60vh;">
		<div style="text-align: center; color: var(--fg-muted);">
			<span class="spinner spinner-lg"></span>
			<div style="margin-top: 12px;">Loading student…</div>
		</div>
	</div>
{:else if error}
	<div class="page">
		<div class="callout danger" style="max-width: 520px; margin: 60px auto;">
			<AlertCircle size={20} strokeWidth={1.6} />
			<div style="flex: 1;">
				<div class="callout-title">Couldn't load student</div>
				<div class="callout-body">{error}</div>
				<button class="btn-s btn-secondary-s btn-sm-s" style="margin-top: 10px;" on:click={goBack}>
					<ArrowLeft size={12} strokeWidth={1.8} /> Back to students
				</button>
			</div>
		</div>
	</div>
{:else if student}
	<div class="page">
		<button class="btn-s btn-ghost-s btn-sm-s" style="margin-bottom: 12px;" on:click={goBack}>
			<ArrowLeft size={14} strokeWidth={1.6} /> All students
		</button>

		<div class="detail-hero" style="margin-bottom: 18px;">
			<Avatar name={student.studentName || ''} size="xl" />
			<div class="hero-body">
				<div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
					<h1 class="hero-name">{student.studentName}</h1>
					<button class="btn-s btn-ghost-s btn-icon-s" on:click={toggleFav} aria-label="Toggle favorite" title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}>
						<Star size={16} strokeWidth={1.6} fill={isFavorite ? 'currentColor' : 'none'} style={isFavorite ? 'color: var(--accent);' : ''} />
					</button>
					{#if student.status === 'active'}
						<Badge kind="ok" dot>Active</Badge>
					{:else if student.status}
						<Badge kind="warn">{student.status}</Badge>
					{/if}
				</div>
				<div class="hero-meta">
					<span style="display: inline-flex; align-items: center; gap: 4px;">
						<Hash size={12} strokeWidth={1.6} />
						<span style="font-family: var(--font-mono);">{student.admissionNo || '—'}</span>
					</span>
					{#if student.className}
						<span>· {student.className}</span>
					{/if}
					{#if student.school}
						<span>· {student.school}</span>
					{/if}
					{#if student.contactNo}
						<span style="display: inline-flex; align-items: center; gap: 4px;">
							<Phone size={12} strokeWidth={1.6} />
							<span style="font-family: var(--font-mono);">{student.contactNo}</span>
						</span>
					{/if}
				</div>
				<div class="hero-actions" style="margin-top: 10px;">
					<button class="btn-s btn-primary-s btn-sm-s" on:click={() => navigateToTab('/dues')}>
						<CreditCard size={14} strokeWidth={1.6} /> Pay fees
					</button>
					<button class="btn-s btn-secondary-s btn-sm-s" on:click={() => navigateToTab('/receipts')}>
						<Receipt size={14} strokeWidth={1.6} /> Receipts
					</button>
					<button class="btn-s btn-secondary-s btn-sm-s" on:click={() => navigateToTab('/edit')}>
						<Edit size={14} strokeWidth={1.6} /> Edit
					</button>
				</div>
			</div>
		</div>

		<div class="view-tabs" style="margin-bottom: 18px; overflow-x: auto; overflow-y: hidden;">
			{#each activeNavItems as item}
				<button class="view-tab" class:active={item.active} on:click={() => navigateToTab(item.path)}>
					<svelte:component this={item.icon} size={14} strokeWidth={1.6} />
					{item.label}
				</button>
			{/each}
		</div>

		<slot {student} />
	</div>
{/if}
