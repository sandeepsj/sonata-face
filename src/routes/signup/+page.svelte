<script lang="ts">
	import { authStore, landingPath } from '$lib/stores/authStore';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { Eye, EyeOff, ArrowRight, AlertCircle } from 'lucide-svelte';
	import { paletteStore } from '$lib/stores/paletteStore';
	import Wordmark from '$lib/components/Wordmark.svelte';

	let email = $state('');
	let password = $state('');
	let confirmPassword = $state('');
	let showPassword = $state(false);

	let passwordsMatch = $derived(password === confirmPassword);
	let formValid = $derived(email && password && confirmPassword && passwordsMatch);

	onMount(() => {
		paletteStore.init();
		if ($authStore.isAuthenticated) goto(landingPath($authStore.user?.routes ?? []));
	});

	async function handleSignup(e: Event) {
		e.preventDefault();
		if (!formValid) return;
		await authStore.signup(email, password);
	}
</script>

<svelte:head>
	<title>Create account — Revathi Arts</title>
</svelte:head>

<div class="auth-shell">
	<div class="auth-side">
		<div class="auth-quote">
			<span>Set up your </span><em>workspace</em><span> in minutes.</span>
			<div class="auth-quote-cite">Track students, dues and receipts in one place.</div>
		</div>
	</div>

	<div class="auth-form">
		<div style="display: flex; justify-content: center; margin-bottom: 28px;">
			<Wordmark size="md" />
		</div>

		<h1 style="font-family: var(--font-serif); font-weight: 500; font-size: 28px; letter-spacing: -0.02em; margin: 0 0 6px; text-align: center;">
			Create <em style="color: var(--accent); font-style: italic;">account</em>
		</h1>
		<p style="color: var(--fg-muted); margin: 0 0 28px; font-size: 13.5px;">
			Get your school onboarded with Sonata.
		</p>

		{#if $authStore.error}
			<div class="callout danger" style="margin-bottom: 18px;">
				<AlertCircle size={18} strokeWidth={1.6} />
				<div>
					<div class="callout-title">Sign-up failed</div>
					<div class="callout-body">{$authStore.error}</div>
				</div>
			</div>
		{/if}

		<form onsubmit={handleSignup} style="display: flex; flex-direction: column; gap: 14px;">
			<div class="field">
				<label for="email">Email</label>
				<input id="email" type="email" class="input-s" placeholder="you@school.in" bind:value={email} required disabled={$authStore.loading} />
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
						style="padding-right: 38px;"
					/>
					<button
						type="button"
						onclick={() => (showPassword = !showPassword)}
						aria-label="Toggle password"
						style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); width: 28px; height: 28px; display: grid; place-items: center; color: var(--fg-muted); background: transparent; border: 0; border-radius: 6px; cursor: pointer;"
					>
						{#if showPassword}<EyeOff size={16} strokeWidth={1.6} />{:else}<Eye size={16} strokeWidth={1.6} />{/if}
					</button>
				</div>
			</div>

			<div class="field">
				<label for="confirmPassword">Confirm password</label>
				<input
					id="confirmPassword"
					type={showPassword ? 'text' : 'password'}
					class="input-s"
					class:input-error-s={confirmPassword && !passwordsMatch}
					placeholder="••••••••"
					bind:value={confirmPassword}
					required
					disabled={$authStore.loading}
				/>
				{#if confirmPassword && !passwordsMatch}
					<span class="field-error">Passwords do not match</span>
				{/if}
			</div>

			<button type="submit" class="btn-s btn-primary-s btn-lg-s" style="justify-content: center; margin-top: 8px;" disabled={$authStore.loading || !formValid}>
				{#if $authStore.loading}
					<span class="spinner"></span>
					Creating…
				{:else}
					Create account
					<ArrowRight size={16} strokeWidth={1.6} />
				{/if}
			</button>
		</form>

		<div style="margin-top: 22px; padding-top: 22px; border-top: 1px solid var(--border); text-align: center; font-size: 13px; color: var(--fg-muted);">
			Already have an account?
			<a href="/login" style="color: var(--accent); font-weight: 500; margin-left: 4px;">Sign in</a>
		</div>
	</div>
</div>
