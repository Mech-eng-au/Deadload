<script lang="ts">
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { browser } from '$app/environment';
	import { catalog, categories } from '$lib/catalog/index.js';
	import { availableCatalog, equipmentLabel, ownedEquipment } from '$lib/catalog/equipment.js';
	import { muscleInfo, muscleLabel } from '$lib/catalog/muscles.js';
	import { getSettings } from '$lib/db/settings.js';
	import type { Category, Settings } from '$lib/types.js';

	let query = $state('');
	let activeCategory = $state<Category | 'all'>('all');
	let settings = $state<Settings | null>(null);

	onMount(async () => {
		settings = await getSettings();
	});

	// Arriving from the compendium (§4.6): ?muscle=quadriceps narrows to the
	// exercises that train it. A URL rather than another control on the screen —
	// the filter has one entry point and does not need a permanent chip row.
	//
	// Read only in the browser. The build is fully prerendered (§2), and reading
	// `searchParams` during prerender throws — correctly, since there is no query
	// string at build time. So the prerendered page is the unfiltered catalog and
	// the filter applies on hydration, which is also exactly what a client-side
	// navigation from the compendium does.
	const muscle = $derived(browser ? page.url.searchParams.get('muscle') : null);

	// One of the two screens a gate applies to (§5.1): this is the app offering
	// exercises, so it offers only what the user can do.
	const owned = $derived(ownedEquipment(settings));
	const available = $derived(availableCatalog(owned));
	const hidden = $derived(catalog.length - available.length);

	const filtered = $derived(
		available.filter((e) => {
			if (activeCategory !== 'all' && e.category !== activeCategory) return false;
			if (muscle && !e.primaryMuscles.includes(muscle)) return false;
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
		placeholder="Search {available.length} exercises…"
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

	{#if muscle}
		<div class="flex items-center justify-between rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3">
			<p class="min-w-0 text-sm">
				<span class="font-medium">{muscleLabel(muscle)}</span>
				<span class="text-zinc-500"> — {muscleInfo(muscle)?.short ?? ''}</span>
			</p>
			<a href="{base}/catalog/" data-sveltekit-replacestate class="shrink-0 text-xs text-zinc-400 underline">
				Clear
			</a>
		</div>
	{/if}

	<p class="text-xs text-zinc-500">
		{filtered.length} shown
		{#if hidden > 0}
			· <a href="{base}/settings/" data-sveltekit-replacestate class="underline">
				{hidden} need equipment you have not ticked
			</a>
		{/if}
	</p>

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
						<div class="mt-0.5 flex flex-wrap gap-2 text-xs text-zinc-400">
							<span>{e.category}</span>
							<span>·</span>
							<span>{e.level}</span>
							{#if e.unilateral}<span>·</span><span>per side</span>{/if}
							{#each e.equipment as id (id)}
								<span>·</span><span class="text-zinc-500">{equipmentLabel(id)}</span>
							{/each}
						</div>
					</div>
				</a>
			</li>
		{/each}
	</ul>

	<a href="{base}/muscles/" class="pb-4 text-center text-sm text-zinc-500 underline">
		What all these muscle names mean
	</a>

	{#if filtered.length === 0}
		<p class="py-8 text-center text-zinc-500">
			Nothing matches. Try a different name — or clear the category filter.
			{#if hidden > 0}
				<a href="{base}/settings/" data-sveltekit-replacestate class="underline">
					{hidden} more are hidden until you tick the equipment.
				</a>
			{/if}
		</p>
	{/if}
</div>
