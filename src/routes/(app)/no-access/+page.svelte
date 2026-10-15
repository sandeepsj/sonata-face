<script lang="ts">
	import { goto } from '$app/navigation';
	import { Lock } from 'lucide-svelte';
	import { authStore, landingPath } from '$lib/stores/authStore';

	// Leave as soon as an admin grants a role (permissions are re-read periodically)
	$effect(() => {
		const target = landingPath($authStore.user?.routes ?? []);
		if (target !== '/no-access') goto(target);
	});
</script>

<div class="page">
	<div class="card-s" style="max-width: 560px; margin: 48px auto;">
		<div class="card-body-s" style="text-align: center; padding: 36px 28px;">
			<Lock size={28} strokeWidth={1.5} style="color: var(--fg-muted);" />
			<h2 style="font-family: var(--font-serif); font-weight: 500; margin: 12px 0 6px;">Your account has no access yet</h2>
			<p class="muted" style="margin: 0 0 18px;">
				You're signed in as <strong>{$authStore.user?.email}</strong>, but no role has been assigned.
				Ask an administrator to give you a role. This page updates by itself once they do.
			</p>
			<button class="btn-s btn-secondary-s" onclick={() => authStore.loadMe(true)}>Check again</button>
		</div>
	</div>
</div>
