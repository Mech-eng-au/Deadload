<script lang="ts">
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import { catalog, categories } from '$lib/catalog/index.js';
	import { availableCatalog, equipmentLabel, ownedEquipment } from '$lib/catalog/equipment.js';
	import { muscleInfo } from '$lib/catalog/muscles.js';
	import { getSettings } from '$lib/db/settings.js';
	import type { Category, Exercise, Settings } from '$lib/types.js';

	let { onpick, onclose }: { onpick: (e: Exercise) => void; onclose: () => void } = $props();

	let query = $state('');
	let activeCategory = $state<Category | 'all'>('all');
	let settings = $state<Settings | null>(null);

	onMount(async () => {
		settings = await getSettings();
	});

	// The other screen a gate applies to (§5.1). Adding an exercise to a routine is
	// the app offering one, so it offers only what the user can do.
	const owned = $derived(ownedEquipment(settings));
	const available = $derived(availableCatalog(owned));
	const hidden = $derived(catalog.length - available.length);

	const filtered = $derived(
		available.filter((e) => {
			if (activeCategory !== 'all' && e.category !== activeCategory) return false;
			if (!query.trim()) return true;
			const q = query.trim().toLowerCase();
			return e.name.toLowerCase().includes(q) || e.aliases.some((a) => a.includes(q));
		})
	);
</script>

<div
	role="dialog"
	aria-modal="true"
	aria-label="Add an exercise"
	class="fixed inset-0 z-50 flex flex-col bg-zinc-950"
>
	<div
		class="flex flex-col gap-3 border-b border-zinc-800 px-4 pt-[env(safe-area-inset-top)] pb-3"
	>
		<div class="flex items-center justify-between pt-3">
			<h2 class="font-display text-lg font-bold">Add an exercise</h2>
			<button
				onclick={onclose}
				class="min-h-14 min-w-14 rounded-xl text-sm text-zinc-400 hover:text-zinc-100"
			>
				Cancel
			</button>
		</div>

		<!-- svelte-ignore a11y_autofocus -->
		<input
			type="search"
			placeholder="Search {available.length} exercises…"
			bind:value={query}
			autofocus
			class="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-base placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none"
		/>

		<div class="flex flex-wrap gap-2">
			{#each ['all', ...categories] as c (c)}
				<button
					onclick={() => (activeCategory = c as Category | 'all')}
					class="min-h-10 rounded-full px-4 py-1.5 text-sm {activeCategory === c
						? 'bg-zinc-100 font-medium text-zinc-900'
						: 'bg-zinc-800 text-zinc-300'}"
				>
					{c}
				</button>
			{/each}
		</div>
	</div>

	<ul class="flex-1 overflow-y-auto px-4 py-3 pb-[env(safe-area-inset-bottom)]">
		{#each filtered as e (e.id)}
			<li>
				<button
					onclick={() => onpick(e)}
					class="mb-2 flex w-full items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-left"
				>
					<img
						src="{base}{e.media[0].path}"
						alt=""
						width={e.media[0].width}
						height={e.media[0].height}
						loading="lazy"
						class="h-14 w-18 shrink-0 rounded-lg bg-white object-cover"
					/>
					<span class="min-w-0">
						<span class="block truncate font-medium">{e.name}</span>
						<span class="mt-0.5 block text-xs text-zinc-400">
							{e.category} · {e.level}{e.unilateral ? ' · per side' : ''}{e.equipment.length
								? ' · ' + e.equipment.map(equipmentLabel).join(', ')
								: ''}
						</span>
						<!-- Plain English while a routine is being built (§4.6), which is where
							 the decision "is this the exercise I want" is actually made. -->
						<span class="mt-0.5 block truncate text-xs text-zinc-500">
							{e.primaryMuscles.map((m) => muscleInfo(m)?.short ?? m).join(', ')}
						</span>
					</span>
				</button>
			</li>
		{:else}
			<li class="py-8 text-center text-zinc-500">
				Nothing matches. Try a different name, or clear the category filter.
			</li>
		{/each}
		{#if hidden > 0 && filtered.length > 0}
			<li class="px-1 py-4 text-center text-xs text-zinc-600">
				{hidden} exercise{hidden === 1 ? '' : 's'} need equipment you have not ticked in Settings.
			</li>
		{/if}
	</ul>
</div>
