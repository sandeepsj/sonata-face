<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { ArrowLeft, User, Edit, CreditCard, BookOpen, Clock, Receipt } from 'lucide-svelte';
	import { currentStudentStore } from '$lib';
	import type { LayoutData } from './$types';

	// Data from load function
	export let data: LayoutData;
	$: student = data.student;

	// Initialize store with loaded data
	$: if (student) {
		currentStudentStore.setStudent(student);
	}

	// Subscribe to current student store
	$: currentStudentState = $currentStudentStore;

	// Get current path for navigation
	$: studentId = $page.params.id;
	$: currentPath = $page.url.pathname;

	// Navigation items for sidebar
	const navigationItems = [
		{ path: '', label: 'Overview', icon: User },
		{ path: '/edit', label: 'Edit Details', icon: Edit },
		{ path: '/sessions', label: 'Sessions', icon: BookOpen },
		{ path: '/courses', label: 'Courses', icon: BookOpen, disabled: true },
		{ path: '/payments', label: 'Payment History', icon: Receipt },
		{ path: '/timeline', label: 'Timeline', icon: Clock, disabled: true },
		{ path: '/dues', label: 'Pay Fees', icon: CreditCard },
	];

	$: activeNavItems = navigationItems.map(item => ({
		...item,
		active: currentPath === `/students/${studentId}${item.path}` || 
		        (item.path === '' && currentPath === `/students/${studentId}`)
	}));

	function goBack() {
		goto('/students');
	}

	function navigateToTab(path: string, disabled = false) {
		if (disabled) return;
		goto(`/students/${studentId}${path}`);
	}
</script>

<svelte:head>
	<title>{student.studentName} - Revathi Arts and Music School</title>
</svelte:head>

<div class="min-h-screen bg-base-200">
	<!-- Header with student info -->
	<div class="bg-base-100 shadow-sm border-b">
		<div class="container mx-auto p-4">
			<div class="flex items-center justify-between">
				<div class="flex items-center space-x-4">
					<button 
						class="btn btn-ghost btn-circle"
						on:click={goBack}
						aria-label="Go back to students list"
					>
						<ArrowLeft class="w-5 h-5" />
					</button>
					
					<div class="flex items-center space-x-3">
						<div>
							<h1 class="text-xl font-bold">{student.studentName}</h1>
							<p class="text-sm text-base-content/70">
								Admission No: {student.admissionNo}
							</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>

	<div class="container mx-auto p-4">
		<div class="flex gap-6">
			<!-- Sidebar Navigation -->
			<div class="w-64 flex-shrink-0">
				<div class="card bg-base-100 shadow-sm">
					<div class="card-body p-4">
						<h3 class="font-semibold text-sm text-base-content/70 mb-3">STUDENT MENU</h3>
						<ul class="menu p-0 space-y-1">
							{#each activeNavItems as item}
								<li>
									<button
										class="flex items-center space-x-3 w-full text-left p-3 rounded-lg transition-colors"
										class:bg-primary={item.active}
										class:text-primary-content={item.active}
										class:opacity-50={item.disabled && !item.active}
										class:cursor-not-allowed={item.disabled}
										class:hover:bg-base-200={!item.active && !item.disabled}
										disabled={item.disabled}
										on:click={() => navigateToTab(item.path, item.disabled)}
									>
										<svelte:component this={item.icon} class="w-4 h-4" />
										<span class="text-sm">{item.label}</span>
										{#if item.disabled}
											<span class="badge badge-xs badge-outline ml-auto">Soon</span>
										{/if}
									</button>
								</li>
							{/each}
						</ul>
					</div>
				</div>
			</div>

			<!-- Main Content Area -->
			<div class="flex-1">
				<slot {student} />
			</div>
		</div>
	</div>
</div>