<script lang="ts">
	import { onMount } from 'svelte';
	import { Pencil, Mail } from 'lucide-svelte';
	import { api, authStore, canAccess, errorMessage, toast } from '$lib';
	import type { Role, UserAccount } from '$lib/api/types';
	import Modal from '$lib/components/Modal.svelte';
	import ErrorCallout from '$lib/components/ErrorCallout.svelte';
	import Badge from '$lib/components/Badge.svelte';

	let users: UserAccount[] = $state([]);
	let roles: Role[] = $state([]);
	let loading = $state(true);
	let loadError = $state('');
	let filter = $state('');

	let editing: UserAccount | null = $state(null);
	let selected: number[] = $state([]);
	let saving = $state(false);
	let formError = $state('');

	let canWrite = $derived($canAccess('/api/users/**', 'write'));
	let shown = $derived(
		users.filter((u) => !filter.trim() || u.email.toLowerCase().includes(filter.trim().toLowerCase()))
	);

	async function load() {
		loading = true;
		loadError = '';
		try {
			// Assigning roles lists them, which needs read on /api/roles/**
			[users, roles] = await Promise.all([
				api.users.list(),
				$canAccess('/api/roles/**') ? api.roles.list() : Promise.resolve([])
			]);
			users.sort((a, b) => a.email.localeCompare(b.email));
			roles.sort((a, b) => a.name.localeCompare(b.name));
		} catch (e) {
			loadError = errorMessage(e, 'Failed to load users');
		} finally {
			loading = false;
		}
	}

	onMount(load);

	function edit(u: UserAccount) {
		editing = u;
		selected = u.roles.map((r) => r.id);
		formError = '';
	}

	function toggle(id: number) {
		selected = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
	}

	async function save() {
		if (!editing) return;
		saving = true;
		formError = '';
		try {
			await api.users.setRoles(editing.id, selected);
			toast.ok(`Roles updated for ${editing.email}`);
			if (editing.id === $authStore.user?.id) authStore.loadMe(true);
			editing = null;
			await load();
		} catch (e) {
			formError = errorMessage(e, 'Failed to update roles');
		} finally {
			saving = false;
		}
	}
</script>

<svelte:head><title>Users — Revathi Arts</title></svelte:head>

<div class="page">
	<div class="page-head">
		<div class="page-head-row">
			<div>
				<h1 class="page-title">Users</h1>
				<p class="page-subtitle">People who sign up get no access until you give them a role.</p>
			</div>
			<a class="btn-s btn-secondary-s" href="/admin/roles">Manage roles</a>
		</div>
	</div>

	<ErrorCallout message={loadError} />

	<div class="tbl-wrap">
		<div class="tbl-toolbar">
			<input class="input-s" style="max-width: 280px;" placeholder="Filter by email…" bind:value={filter} />
			<div class="grow"></div>
			<span class="muted" style="font-size: 12px;">{shown.length} of {users.length}</span>
		</div>
		{#if loading}
			<div class="empty-s"><span class="spinner"></span></div>
		{:else}
			<table class="tbl">
				<thead><tr><th>Email</th><th>Roles</th><th></th></tr></thead>
				<tbody>
					{#each shown as u (u.id)}
						<tr>
							<td>
								<span style="display:inline-flex; align-items:center; gap:6px;"><Mail size={13} strokeWidth={1.6} style="color: var(--fg-muted);" />{u.email}</span>
								{#if u.id === $authStore.user?.id}<span class="muted" style="font-size: 11px;"> (you)</span>{/if}
							</td>
							<td>
								{#each u.roles as r}<span style="margin-right: 4px;"><Badge kind={r.name === 'ADMIN' ? 'accent' : 'info'}>{r.name}</Badge></span>{:else}<Badge kind="warn">No access</Badge>{/each}
							</td>
							<td style="text-align: right;">
								{#if canWrite}
									<button class="btn-s btn-ghost-s btn-sm-s" onclick={() => edit(u)}><Pencil size={13} /> Roles</button>
								{/if}
							</td>
						</tr>
					{:else}
						<tr><td colspan="3" class="muted" style="text-align:center; padding: 24px;">No users found.</td></tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</div>
</div>

<Modal open={editing !== null} title="Assign roles" subtitle={editing?.email} busy={saving} onClose={() => (editing = null)}>
	<div style="display:flex; flex-direction:column; gap:8px;">
		{#each roles as r (r.id)}
			<label class="card-s" style="display:flex; align-items:flex-start; gap:10px; padding: 10px 12px; cursor: pointer;">
				<input type="checkbox" checked={selected.includes(r.id)} onchange={() => toggle(r.id)} disabled={saving} style="margin-top: 3px;" />
				<span>
					<span style="font-weight: 500;">{r.name}</span>
					{#if r.description}<span class="muted" style="display:block; font-size: 12px;">{r.description}</span>{/if}
				</span>
			</label>
		{/each}
		{#if selected.length === 0}
			<div class="callout"><div class="callout-body">With no roles, this user can log in but can't see anything.</div></div>
		{/if}
		<ErrorCallout message={formError} />
	</div>
	{#snippet footer()}
		<button class="btn-s btn-secondary-s" onclick={() => (editing = null)} disabled={saving}>Cancel</button>
		<button class="btn-s btn-primary-s" onclick={save} disabled={saving}>{#if saving}<span class="spinner"></span>{/if}Save</button>
	{/snippet}
</Modal>
