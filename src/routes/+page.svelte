<script lang="ts">
	import { base } from '$app/paths';
	import { catalog, countByCategory, categories } from '$lib/catalog/index.js';
</script>

<svelte:head>
	<title>Deadload</title>
</svelte:head>

<section class="flex flex-col gap-8 pt-8">
	<div>
		<h1 class="font-display text-4xl font-bold">Deadload</h1>
		<p class="mt-2 text-zinc-400">
			Local-first bodyweight training. The only load is you.
		</p>
	</div>

	<a
		href="{base}/catalog/"
		class="block rounded-2xl border border-zinc-800 bg-zinc-900 p-6 transition-colors hover:border-zinc-600"
	>
		<div class="font-display text-5xl font-bold">{catalog.length}</div>
		<div class="mt-1 text-zinc-400">exercises in the catalog, every one with images</div>
		<div class="mt-4 flex flex-wrap gap-2">
			{#each categories as c (c)}
				<span class="rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-300">
					{c} · {countByCategory[c] ?? 0}
				</span>
			{/each}
		</div>
	</a>

	<p class="text-sm text-zinc-500">
		M0 build: catalog browsing only. Routines, sessions, and import arrive in later milestones.
	</p>
</section>
