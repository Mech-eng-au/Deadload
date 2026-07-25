<script lang="ts">
	import { base } from '$app/paths';
	import { catalog, categories } from '$lib/catalog/index.js';
	import type { Category } from '$lib/types.js';

	let query = $state('');
	let activeCategory = $state<Category | 'all'>('all');

	const filtered = $derived(
		catalog.filter((e) => {
			if (activeCategory !== 'all' && e.category !== activeCategory) return false;
			if (!query.trim()) return true;
			const q = query.trim().toLowerCase();
			return e.name.toLowerCase().includes(q) || e.aliases.some((a) => a.includes(q));
		})
	);
</script>

<svelte:head>
	<title>Catalog · Deadload</title>
</svelte:head>

<div class="flex flex-col gap-4">
	<input
		type="search"
		placeholder="Search {catalog.length} exercises…"
		bind:value={query}
		class="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-base placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none"
	/>

	<div class="flex flex-wrap gap-2">
		{#each ['all', ...categories] as c (c)}
			<button
				onclick={() => (activeCategory = c as Category | 'all')}
				class="min-h-10 rounded-full px-4 py-1.5 text-sm transition-colors {activeCategory === c
					? 'bg-zinc-100 font-medium text-zinc-900'
					: 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}"
			>
				{c}
			</button>
		{/each}
	</div>

	<p class="text-xs text-zinc-500">{filtered.length} shown</p>

	<ul class="flex flex-col gap-2">
		{#each filtered as e (e.id)}
			<li>
				<a
					href="{base}/catalog/{e.id}/"
					class="flex items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-900 p-3 transition-colors hover:border-zinc-600"
				>
					<img
						src="{base}{e.media[0].path}"
						alt={e.name}
						width={e.media[0].width}
						height={e.media[0].height}
						loading="lazy"
						class="h-16 w-20 shrink-0 rounded-lg bg-white object-cover"
					/>
					<div class="min-w-0">
						<div class="truncate font-medium">{e.name}</div>
						<div class="mt-0.5 flex gap-2 text-xs text-zinc-400">
							<span>{e.category}</span>
							<span>·</span>
							<span>{e.level}</span>
							{#if e.unilateral}<span>·</span><span>per side</span>{/if}
						</div>
					</div>
				</a>
			</li>
		{/each}
	</ul>

	{#if filtered.length === 0}
		<p class="py-8 text-center text-zinc-500">
			Nothing matches. Try a different name — or clear the category filter.
		</p>
	{/if}
</div>
