<script lang="ts">
	import { authStore } from '$lib/stores/authStore';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	let email = '';
	let password = '';
	let showPassword = false;

	$: formValid = email && password;

	onMount(() => {
		// If already authenticated, redirect to students page
		if ($authStore.isAuthenticated) {
			goto('/students');
		}
	});

	async function handleLogin(e: Event) {
		e.preventDefault();

		if (!formValid) {
			return;
		}

		await authStore.login(email, password);
	}

	function navigateToSignup() {
		goto('/signup');
	}
</script>

<svelte:head>
	<title>Log In - Revathi Arts and Music School</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center bg-base-200 px-4">
	<div class="card w-full max-w-md bg-base-100 shadow-xl">
		<div class="card-body">
			<!-- Header -->
			<h1 class="text-3xl font-bold text-center mb-2">Welcome Back</h1>
			<p class="text-center text-base-content/70 mb-6">
				Log in to Revathi Arts and Music School
			</p>

			<!-- Error Alert -->
			{#if $authStore.error}
				<div class="alert alert-error mb-4">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="stroke-current shrink-0 h-6 w-6"
						fill="none"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
					<span>{$authStore.error}</span>
				</div>
			{/if}

			<!-- Login Form -->
			<form onsubmit={handleLogin} class="space-y-4">
				<!-- Email Input -->
				<div class="form-control">
					<label for="email" class="label">
						<span class="label-text">Email</span>
					</label>
					<input
						id="email"
						type="email"
						placeholder="your.email@example.com"
						class="input input-bordered w-full"
						bind:value={email}
						required
						disabled={$authStore.loading}
						autocomplete="email"
					/>
				</div>

				<!-- Password Input -->
				<div class="form-control">
					<label for="password" class="label">
						<span class="label-text">Password</span>
					</label>
					<div class="relative">
						<input
							id="password"
							type={showPassword ? 'text' : 'password'}
							placeholder="••••••••"
							class="input input-bordered w-full pr-12"
							bind:value={password}
							required
							disabled={$authStore.loading}
							autocomplete="current-password"
						/>
						<button
							type="button"
							class="absolute right-3 top-1/2 -translate-y-1/2 btn btn-ghost btn-sm btn-circle"
							onclick={() => (showPassword = !showPassword)}
							aria-label={showPassword ? 'Hide password' : 'Show password'}
						>
							{#if showPassword}
								<svg
									xmlns="http://www.w3.org/2000/svg"
									class="h-5 w-5"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
									/>
								</svg>
							{:else}
								<svg
									xmlns="http://www.w3.org/2000/svg"
									class="h-5 w-5"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
									/>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
									/>
								</svg>
							{/if}
						</button>
					</div>
				</div>

				<!-- Submit Button -->
				<div class="form-control mt-6">
					<button
						type="submit"
						class="btn btn-primary w-full"
						disabled={$authStore.loading || !formValid}
					>
						{#if $authStore.loading}
							<span class="loading loading-spinner"></span>
							Logging In...
						{:else}
							Log In
						{/if}
					</button>
				</div>
			</form>

			<!-- Divider -->
			<div class="divider">OR</div>

			<!-- Signup Link -->
			<div class="text-center">
				<p class="text-sm text-base-content/70">
					Don't have an account?
					<button
						type="button"
						class="link link-primary font-semibold"
						onclick={navigateToSignup}
					>
						Sign Up
					</button>
				</p>
			</div>
		</div>
	</div>
</div>
