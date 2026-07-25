<script lang="ts">
	import { base } from '$app/paths';
	import { catalog, categories } from '$lib/catalog/index.js';
	import type { Category, Exercise } from '$lib/types.js';

	let { onpick, onclose }: { onpick: (e: Exercise) => void; onclose: () => void } = $props();

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
			placeholder="Search {catalog.length} exercises…"
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
							{e.category} · {e.level}{e.unilateral ? ' · per side' : ''}
						</span>
					</span>
				</button>
			</li>
		{:else}
			<li class="py-8 text-center text-zinc-500">
				Nothing matches. Try a different name, or clear the category filter.
			</li>
		{/each}
	</ul>
</div>
