<script lang="ts">
	import '../app.css';
	import { base } from '$app/paths';
	import { onMount } from 'svelte';

	let { children } = $props();

	onMount(async () => {
		if ('serviceWorker' in navigator) {
			const { registerSW } = await import('virtual:pwa-register');
			registerSW({ immediate: true });
		}
	});
</script>

<div class="mx-auto flex min-h-dvh max-w-2xl flex-col px-4">
	<header class="flex items-baseline justify-between py-5">
		<a href="{base}/" class="font-display text-xl font-bold tracking-tight">Deadload</a>
		<nav class="flex gap-5 text-sm text-zinc-400">
			<a href="{base}/catalog/" class="hover:text-zinc-100">Catalog</a>
			<a href="{base}/about/" class="hover:text-zinc-100">About</a>
		</nav>
	</header>
	<main class="flex-1 pb-16">
		{@render children()}
	</main>
</div>
