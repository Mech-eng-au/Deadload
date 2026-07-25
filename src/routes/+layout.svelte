<script lang="ts">
	import '../app.css';
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import { registerBackHandler } from '$lib/nav/back.js';

	let { children } = $props();

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
	class="mx-auto flex min-h-dvh max-w-2xl flex-col px-4 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
>
	<header class="flex items-baseline justify-between py-5">
		<a href="{base}/" class="font-display text-xl font-bold tracking-tight">Deadload</a>
		<nav class="flex gap-4 text-sm text-zinc-400">
			<a href="{base}/catalog/" class="hover:text-zinc-100">Catalog</a>
			<a href="{base}/stats/" class="hover:text-zinc-100">Stats</a>
			<a href="{base}/settings/" class="hover:text-zinc-100">Settings</a>
		</nav>
	</header>
	<main class="flex-1 pb-16">
		{@render children()}
	</main>
</div>
