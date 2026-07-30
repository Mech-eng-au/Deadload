<script lang="ts">
	import { base } from '$app/paths';
	import BodyMap from '$lib/components/BodyMap.svelte';
	import { muscleUsage } from '$lib/catalog/muscles.js';
	import { APPROXIMATED } from '$lib/catalog/body-map.js';

	/**
	 * The muscle compendium (docs/SPEC.md §4.6): seventeen words, each with where
	 * it is, what it does, and a way through to the exercises that train it.
	 *
	 * Ordered by how much of the catalog trains each one rather than
	 * alphabetically, so the muscles a bodyweight routine actually hits come first
	 * and `neck` is last, which is honest about what this catalog is for.
	 */
	let open = $state<string | null>(null);
</script>

<svelte:head>
	<title>Muscles · Deadload</title>
</svelte:head>

<a href="{base}/catalog/" data-sveltekit-replacestate class="text-sm text-zinc-400">← Catalog</a>
<h1 class="mt-2 font-display text-2xl font-bold">Muscles</h1>
<p class="mt-2 mb-5 text-sm text-zinc-400">
	The catalog names muscles the way an anatomy book does. Here is each one in plain English, and
	where to find it on yourself. Tap one to see it on the diagram.
</p>

<ul class="flex flex-col gap-2 pb-12">
	{#each muscleUsage as row (row.muscle.id)}
		{@const isOpen = open === row.muscle.id}
		<li class="rounded-2xl border border-zinc-800 bg-zinc-900">
			<button
				onclick={() => (open = isOpen ? null : row.muscle.id)}
				aria-expanded={isOpen}
				class="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left"
			>
				<span class="min-w-0 flex-1">
					<span class="block font-medium">{row.muscle.label}</span>
					<span class="mt-0.5 block text-sm text-zinc-400">{row.muscle.short}</span>
				</span>
				<span class="shrink-0 text-right text-xs text-zinc-500 tabular-nums">
					{row.primary} exercise{row.primary === 1 ? '' : 's'}
					{#if row.secondary}
						<span class="block text-zinc-600">+{row.secondary} assisting</span>
					{/if}
				</span>
			</button>

			{#if isOpen}
				<div class="border-t border-zinc-800 px-4 pt-4 pb-4">
					<!-- No legend: the row is already titled with the muscle, and only one
						 colour is in play. -->
					<BodyMap primary={[row.muscle.id]} size="small" legend={false} />
					{#if APPROXIMATED[row.muscle.id]}
						<!-- Say where the figure is imprecise rather than let it quietly
								 mislead: two of these share a region and one sits on a neighbour. -->
						<p class="mt-3 text-xs text-zinc-500">
							On the figure this {APPROXIMATED[row.muscle.id]}.
						</p>
					{/if}
					<p class="mt-4 text-sm text-zinc-200">{row.muscle.where}</p>
					<p class="mt-2 text-sm text-zinc-400">{row.muscle.does}</p>
					{#if row.primary > 0}
						<!-- Deliberately no count in the link. The counts above are over the
							 whole catalog, because the page explains words and the words do not
							 change when an equipment box is ticked — but browse only shows what
							 you own, so promising a number here would over-promise by however
							 many of them need equipment. -->
						<a
							href="{base}/catalog/?muscle={encodeURIComponent(row.muscle.id)}"
							class="mt-4 inline-block min-h-11 text-sm text-zinc-300 underline"
						>
							Show the exercises that train it →
						</a>
					{:else}
						<p class="mt-4 text-xs text-zinc-600">
							Nothing in this catalog trains it directly — it only ever assists.
						</p>
					{/if}
				</div>
			{/if}
		</li>
	{/each}
</ul>
