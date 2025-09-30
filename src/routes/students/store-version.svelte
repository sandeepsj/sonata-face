<script lang="ts">
	import { onMount } from 'svelte';
	import { Users, Search, ChevronLeft, ChevronRight, Mail } from 'lucide-svelte';
	import { studentStore } from '$lib';

	// Subscribe to the store - this automatically handles all state management
	$: ({ students, loading, error, currentPage, pageSize, totalElements, totalPages, searchQuery } = $studentStore);

	// Event handlers become much simpler
	function handleSearch() {
		studentStore.searchStudents(searchQuery);
	}

	function goToPage(page: number) {
		studentStore.goToPage(page);
	}

	function handlePageSizeChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		studentStore.changePageSize(parseInt(target.value));
	}

	// Load initial data
	onMount(() => {
		studentStore.fetchStudents();
	});
</script>

<!-- Rest of the template stays the same... -->
<svelte:head>
	<title>Students - Revathi Arts and Music School</title>
</svelte:head>

<!-- Same template as the main students page -->