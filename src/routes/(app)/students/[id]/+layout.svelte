<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { ArrowLeft, User, Edit, CreditCard, BookOpen, Clock, Banknote, Settings, Receipt } from 'lucide-svelte';
	import { currentStudentStore, StudentService } from '$lib';
	import type { LayoutData } from './$types';
	import type { Student } from '$lib/types/student';

	// Data from load function (just the admission number)
	export let data: LayoutData;
	
	// Client-side state
	let student: Student | null = null;
	let loading = true;
	let error: string | null = null;

	// Subscribe to current student store
	$: currentStudentState = $currentStudentStore;
	
	// Fetch student data client-side when component mounts
	onMount(async () => {
		if (!data.admissionNo) {
			error = 'Student admission number is required';
			loading = false;
			return;
		}

		try {
			loading = true;
			// Search for student by admission number using advanced search
			const response = await StudentService.advancedSearchStudents({ 
				admissionNo: data.admissionNo,
				size: 1 
			});
			
			// Check if we found the student
			if (!response.content || response.content.length === 0) {
				error = `Student with admission number ${data.admissionNo} not found`;
				loading = false;
				return;
			}

			student = response.content[0];
			
			// Initialize store with loaded data
			currentStudentStore.setStudent(student);
			loading = false;
		} catch (err) {
			console.error('Error loading student:', err);
			error = 'Failed to load student data';
			loading = false;
		}
	});

	// Get current path for navigation
	$: studentId = $page.params.id;
	$: currentPath = $page.url.pathname;

	// Navigation items for sidebar
	const navigationItems = [
		{ path: '', label: 'Overview', icon: User },
		{ path: '/edit', label: 'Edit Details', icon: Edit },
		{ path: '/sessions', label: 'Sessions', icon: BookOpen },
		{ path: '/payments', label: 'Payment History', icon: Banknote },
		{ path: '/manage-payments', label: 'Manage Payments', icon: Settings },
		{ path: '/receipts', label: 'Receipts', icon: Receipt },
		{ path: '/timeline', label: 'Timeline', icon: Clock },
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
	<title>{student?.studentName || 'Loading...'} - Revathi Arts and Music School</title>
</svelte:head>

{#if loading}
	<div class="min-h-screen bg-base-200 flex items-center justify-center">
		<div class="text-center">
			<span class="loading loading-spinner loading-lg text-primary"></span>
			<p class="mt-4 text-base-content/70">Loading student data...</p>
		</div>
	</div>
{:else if error}
	<div class="min-h-screen bg-base-200 flex items-center justify-center">
		<div class="card bg-base-100 shadow-xl max-w-md">
			<div class="card-body text-center">
				<div class="text-error text-5xl mb-4">⚠️</div>
				<h2 class="card-title justify-center">Error Loading Student</h2>
				<p class="text-base-content/70">{error}</p>
				<div class="card-actions justify-center mt-4">
					<button class="btn btn-primary" on:click={goBack}>
						<ArrowLeft class="w-4 h-4" />
						Back to Students
					</button>
				</div>
			</div>
		</div>
	</div>
{:else if student}
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
								{@const isDisabled = ('disabled' in item && item.disabled) === true}
								<li>
									<button
										class="flex items-center space-x-3 w-full text-left p-3 rounded-lg transition-colors"
										class:bg-primary={item.active}
										class:text-primary-content={item.active}
										class:opacity-50={isDisabled && !item.active}
										class:cursor-not-allowed={isDisabled}
										class:hover:bg-base-200={!item.active && !isDisabled}
										disabled={isDisabled}
										on:click={() => navigateToTab(item.path, isDisabled)}
									>
										<svelte:component this={item.icon} class="w-4 h-4" />
										<span class="text-sm">{item.label}</span>
										{#if isDisabled}
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
{/if}