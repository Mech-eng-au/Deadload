<script lang="ts">
	import '../app.css';
	import { base } from '$app/paths';
	import { onNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { registerBackHandler } from '$lib/nav/back.js';

	/**
	 * Slide between screens in the direction you actually moved: forward from the
	 * right, back from the left. The direction is the point — it says where you
	 * went, which an instant swap does not. Skipped entirely where the View
	 * Transitions API is missing or motion is unwanted (§12).
	 */
	onNavigate((navigation) => {
		if (!document.startViewTransition) return;
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

		// `delta` is only set for history navigations; a link is always forward.
		const back = (navigation.delta ?? 0) < 0;
		document.documentElement.dataset.nav = back ? 'back' : 'forward';

		return new Promise((resolve) => {
			document.startViewTransition(async () => {
				resolve();
				await navigation.complete;
			});
		});
	});

	let { children } = $props();

	/**
	 * Everywhere but mid-session. The header is ~80 dp of a 808 dp phone and does
	 * nothing during a set, and the top inset has to belong to the player itself
	 * so the Leave row is not painted under the status bar (§7).
	 */
	const chrome = $derived(!page.route.id?.startsWith('/session/'));

	onMount(() => {
		let unregister: (() => void) | undefined;
		void registerBackHandler().then((fn) => (unregister = fn));

		// In the Android build the assets ship inside the APK; a service worker
		// there would only serve stale copies after an app update.
		if (import.meta.env.VITE_CAPACITOR !== '1' && 'serviceWorker' in navigator) {
			void import('virtual:pwa-register').then(({ registerSW }) => registerSW({ immediate: true }));
		}

		return () => unregister?.();
	});
</script>

<!-- Android 15+ draws the WebView edge to edge, so the system bars overlap the
	 content unless the safe-area insets are honoured. `viewport-fit=cover` in
	 app.html is what makes these resolve to non-zero values. -->
<div
	class="mx-auto flex min-h-dvh max-w-2xl flex-col px-4 pb-[env(safe-area-inset-bottom)] {chrome
		? 'pt-[env(safe-area-inset-top)]'
		: ''}"
>
	{#if chrome}
		<header class="flex items-baseline justify-between py-5">
			<a href="{base}/" class="font-display text-xl font-bold tracking-tight">Deadload</a>
			<nav class="flex gap-4 text-sm text-zinc-400">
				<a href="{base}/catalog/" class="hover:text-zinc-100">Catalog</a>
				<a href="{base}/stats/" class="hover:text-zinc-100">Stats</a>
				<a href="{base}/settings/" class="hover:text-zinc-100">Settings</a>
			</nav>
		</header>
	{/if}
	<main class="flex-1 {chrome ? 'pb-16' : ''}">
		{@render children()}
	</main>
</div>
