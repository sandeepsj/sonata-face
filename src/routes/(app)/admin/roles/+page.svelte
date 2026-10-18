<script lang="ts">
	import { onMount } from 'svelte';
	import { Plus, Pencil, Trash2, ShieldCheck } from 'lucide-svelte';
	import { api, canAccess, errorMessage, fieldErrors, toast } from '$lib';
	import { ROUTE_PATHS, type RoutePath, type Role, type RouteAccess } from '$lib/api/types';
	import Modal from '$lib/components/Modal.svelte';
	import ErrorCallout from '$lib/components/ErrorCallout.svelte';
	import FieldError from '$lib/components/FieldError.svelte';
	import Badge from '$lib/components/Badge.svelte';

	const ROUTE_LABELS: Record<RoutePath, string> = {
		'/api/students/**': 'Students',
		'/api/student-sessions/**': 'Sessions (enrolment)',
		'/api/courses/**': 'Courses',
		'/api/fee-structures/**': 'Fee structures',
		'/api/fee-timeline/**': 'Fee timeline',
		'/api/payments/**': 'Payments',
		'/api/discounts/**': 'Discounts',
		'/api/dues/**': 'Dues',
		'/api/users/**': 'Users',
		'/api/roles/**': 'Roles',
		'/api/logging/**': 'Logging',
		'/api/receipt-templates/**': 'Receipt templates'
	};

	let roles: Role[] = $state([]);
	let loading = $state(true);
	let loadError = $state('');

	// editor
	let editorOpen = $state(false);
	let editing: Role | null = $state(null);
	let name = $state('');
	let description = $state('');
	/** One row per catalogue path, in catalogue order */
	let routes: RouteAccess[] = $state(blankRoutes());
	let saving = $state(false);
	let formError = $state('');
	let errors: Record<string, string> = $state({});

	let canWrite = $derived($canAccess('/api/roles/**', 'write'));

	function blankRoutes(): RouteAccess[] {
		return ROUTE_PATHS.map((path) => ({ path, read: false, write: false }));
	}

	/** The role's flags for every catalogue path (missing paths → false). */
	function routesOf(role: Role): RouteAccess[] {
		return ROUTE_PATHS.map((path) => {
			const r = role.routes.find((x) => x.path === path);
			return { path, read: !!r?.read, write: !!r?.write };
		});
	}

	/** Server field errors for row `i` (`routes[i]`, `routes[i].path`, …). */
	function rowError(i: number): string | undefined {
		return Object.entries(errors).find(([k]) => k.startsWith(`routes[${i}]`))?.[1];
	}

	async function load() {
		loading = true;
		loadError = '';
		try {
			roles = (await api.roles.list()).sort((a, b) => Number(b.builtIn) - Number(a.builtIn) || a.name.localeCompare(b.name));
		} catch (e) {
			loadError = errorMessage(e, 'Failed to load roles');
		} finally {
			loading = false;
		}
	}

	onMount(load);

	function openEditor(role: Role | null) {
		editing = role;
		name = role?.name ?? '';
		description = role?.description ?? '';
		routes = role ? routesOf(role) : blankRoutes();
		formError = '';
		errors = {};
		editorOpen = true;
	}

	async function save() {
		formError = '';
		errors = {};
		if (!name.trim()) {
			errors = { name: 'Name is required' };
			return;
		}
		saving = true;
		const body = {
			name: name.trim(),
			description: description.trim() || null,
			routes: routes.map(({ path, read, write }) => ({ path, read, write }))
		};
		try {
			if (editing) await api.roles.update(editing.id, body);
			else await api.roles.create(body);
			toast.ok(editing ? `Role "${body.name}" saved` : `Role "${body.name}" created`);
			editorOpen = false;
			await load();
		} catch (e) {
			formError = errorMessage(e, 'Failed to save role');
			errors = fieldErrors(e);
		} finally {
			saving = false;
		}
	}

	async function remove(role: Role) {
		if (!confirm(`Delete role "${role.name}"? It will be removed from every user who has it.`)) return;
		try {
			await api.roles.remove(role.id);
			toast.ok(`Role "${role.name}" deleted`);
			await load();
		} catch (e) {
			toast.error(errorMessage(e, 'Failed to delete role'));
		}
	}

	function flags(role: Role, path: RoutePath): { label: string; kind: 'ok' | 'info' | 'warn' | 'neutral' } {
		const r = role.routes.find((x) => x.path === path);
		if (r?.read && r?.write) return { label: 'R W', kind: 'ok' };
		if (r?.read) return { label: 'R', kind: 'info' };
		if (r?.write) return { label: 'W', kind: 'warn' };
		return { label: '—', kind: 'neutral' };
	}
</script>

<svelte:head><title>Roles — Revathi Arts</title></svelte:head>

<div class="page">
	<div class="page-head">
		<div class="page-head-row">
			<div>
				<h1 class="page-title">Roles &amp; <em>access</em></h1>
				<p class="page-subtitle">A role grants read and/or write access per area. Users get the combined access of all their roles.</p>
			</div>
			{#if canWrite}
				<button class="btn-s btn-primary-s" onclick={() => openEditor(null)}><Plus size={14} strokeWidth={1.8} /> New role</button>
			{/if}
		</div>
	</div>

	<ErrorCallout message={loadError} />

	{#if loading}
		<div class="empty-s"><span class="spinner"></span></div>
	{:else}
		<div class="tbl-wrap" style="overflow-x: auto;">
			<table class="tbl">
				<thead>
					<tr>
						<th>Role</th>
						{#each ROUTE_PATHS as p}<th title={p}>{ROUTE_LABELS[p]}</th>{/each}
						<th></th>
					</tr>
				</thead>
				<tbody>
					{#each roles as role (role.id)}
						<tr>
							<td>
								<div style="display:flex; align-items:center; gap:8px; font-weight:500;">
									<ShieldCheck size={14} strokeWidth={1.6} style="color: var(--fg-muted);" />
									{role.name}
									{#if role.builtIn}<Badge kind="accent">Built-in</Badge>{/if}
								</div>
								{#if role.description}<div class="muted" style="font-size: 12px;">{role.description}</div>{/if}
							</td>
							{#each ROUTE_PATHS as p}
								{@const f = flags(role, p)}
								<td><Badge kind={f.kind}>{f.label}</Badge></td>
							{/each}
							<td style="white-space: nowrap; text-align: right;">
								{#if canWrite}
									<button class="btn-s btn-ghost-s btn-icon-s" title="Edit" aria-label="Edit {role.name}" onclick={() => openEditor(role)}><Pencil size={14} /></button>
									{#if !role.builtIn}
										<button class="btn-s btn-ghost-s btn-icon-s" style="color: var(--danger);" title="Delete" aria-label="Delete {role.name}" onclick={() => remove(role)}><Trash2 size={14} /></button>
									{/if}
								{/if}
							</td>
						</tr>
					{:else}
						<tr><td colspan={ROUTE_PATHS.length + 2} class="muted" style="text-align:center; padding: 24px;">No roles yet.</td></tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

<Modal open={editorOpen} title={editing ? `Edit role` : 'New role'} subtitle="Tick what this role may read and change in each area." size="lg" busy={saving} onClose={() => (editorOpen = false)}>
	<form id="role-form" onsubmit={(e) => { e.preventDefault(); save(); }} style="display:flex; flex-direction:column; gap:14px;">
		<div class="grid-2">
			<div class="field">
				<label for="role-name">Name *</label>
				<input id="role-name" class="input-s" class:input-error-s={errors.name} bind:value={name} disabled={saving} placeholder="e.g. Front desk" />
				<FieldError {errors} field="name" />
			</div>
			<div class="field">
				<label for="role-desc">Description</label>
				<input id="role-desc" class="input-s" bind:value={description} disabled={saving} />
			</div>
		</div>
		{#if editing?.builtIn}
			<div class="callout info"><div class="callout-body">This is the built-in ADMIN role. It can't be deleted.</div></div>
		{/if}
		<div class="tbl-wrap">
			<table class="tbl">
				<thead>
					<tr>
						<th>Area</th>
						<th style="width: 80px; text-align: center;">Read</th>
						<th style="width: 80px; text-align: center;">Write</th>
					</tr>
				</thead>
				<tbody>
					{#each routes as route, i (route.path)}
						<tr>
							<td>
								<div style="font-weight: 500;">{ROUTE_LABELS[route.path as RoutePath] ?? route.path}</div>
								<div class="muted" style="font-size: 11px; font-family: var(--font-mono);">{route.path}</div>
								{#if rowError(i)}<div class="field-error">{rowError(i)}</div>{/if}
							</td>
							<td style="text-align: center;">
								<input type="checkbox" bind:checked={route.read} disabled={saving} aria-label="Read {route.path}" />
							</td>
							<td style="text-align: center;">
								<input type="checkbox" bind:checked={route.write} disabled={saving} aria-label="Write {route.path}" />
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<FieldError {errors} field="routes" />
		<div class="muted" style="font-size: 12px;">
			Read and write are separate: viewing needs Read, adding/editing/deleting needs Write. Users get changes within
			about a minute, without logging in again.
		</div>
		<ErrorCallout message={formError} />
	</form>
	{#snippet footer()}
		<button class="btn-s btn-secondary-s" onclick={() => (editorOpen = false)} disabled={saving}>Cancel</button>
		<button class="btn-s btn-primary-s" type="submit" form="role-form" disabled={saving}>
			{#if saving}<span class="spinner"></span>{/if}{editing ? 'Save role' : 'Create role'}
		</button>
	{/snippet}
</Modal>
