<script lang="ts">
	import { authStore } from '$lib/stores/authStore';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { Eye, EyeOff, ArrowRight, AlertCircle } from 'lucide-svelte';
	import { paletteStore } from '$lib/stores/paletteStore';

	let email = $state('');
	let password = $state('');
	let showPassword = $state(false);

	let formValid = $derived(email && password);

	onMount(() => {
		paletteStore.init();
		if ($authStore.isAuthenticated) goto('/students');
	});

	async function handleLogin(e: Event) {
		e.preventDefault();
		if (!email || !password) return;
		await authStore.login(email, password);
	}
</script>

<svelte:head>
	<title>Sign in — Revathi Arts</title>
</svelte:head>

<div class="auth-shell">
	<div class="auth-side">
		<div class="auth-quote">
			<span>“Music gives a soul to the universe — </span><em>this is the place where it begins.</em>”
			<div class="auth-quote-cite">— Revathi Arts &amp; Music School</div>
		</div>
	</div>

	<div class="auth-form">
		<div class="auth-brand">
			<div class="sb-mark">R</div>
			<div>
				<div class="sb-name">Revathi <em>Arts</em></div>
				<div class="sb-tag">Music School</div>
			</div>
		</div>

		<h1 style="font-family: var(--font-serif); font-weight: 500; font-size: 28px; letter-spacing: -0.02em; margin: 0 0 6px;">
			Welcome <em style="color: var(--accent); font-style: italic;">back</em>
		</h1>
		<p style="color: var(--fg-muted); margin: 0 0 28px; font-size: 13.5px;">
			Sign in to manage students, dues and payments.
		</p>

		{#if $authStore.error}
			<div class="callout danger" style="margin-bottom: 18px;">
				<AlertCircle size={18} strokeWidth={1.6} style="flex-shrink:0;" />
				<div>
					<div class="callout-title">Sign-in failed</div>
					<div class="callout-body">{$authStore.error}</div>
				</div>
			</div>
		{/if}

		<form onsubmit={handleLogin} style="display: flex; flex-direction: column; gap: 14px;">
			<div class="field">
				<label for="email">Email</label>
				<input
					id="email"
					type="email"
					class="input-s"
					placeholder="you@school.in"
					bind:value={email}
					required
					disabled={$authStore.loading}
					autocomplete="email"
				/>
			</div>

			<div class="field">
				<label for="password">Password</label>
				<div style="position: relative;">
					<input
						id="password"
						type={showPassword ? 'text' : 'password'}
						class="input-s"
						placeholder="••••••••"
						bind:value={password}
						required
						disabled={$authStore.loading}
						autocomplete="current-password"
						style="padding-right: 38px;"
					/>
					<button
						type="button"
						onclick={() => (showPassword = !showPassword)}
						aria-label={showPassword ? 'Hide password' : 'Show password'}
						style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); width: 28px; height: 28px; display: grid; place-items: center; color: var(--fg-muted); background: transparent; border: 0; border-radius: 6px; cursor: pointer;"
					>
						{#if showPassword}
							<EyeOff size={16} strokeWidth={1.6} />
						{:else}
							<Eye size={16} strokeWidth={1.6} />
						{/if}
					</button>
				</div>
			</div>

			<button type="submit" class="btn-s btn-primary-s btn-lg-s" style="justify-content: center; margin-top: 8px;" disabled={$authStore.loading || !formValid}>
				{#if $authStore.loading}
					<span class="spinner" style="border-top-color: var(--accent-fg);"></span>
					Signing in…
				{:else}
					Sign in
					<ArrowRight size={16} strokeWidth={1.6} />
				{/if}
			</button>
		</form>

		<div style="margin-top: 22px; padding-top: 22px; border-top: 1px solid var(--border); text-align: center; font-size: 13px; color: var(--fg-muted);">
			Setting up a new school?
			<a href="/signup" style="color: var(--accent); font-weight: 500; margin-left: 4px;">Create account</a>
		</div>
	</div>
</div>
