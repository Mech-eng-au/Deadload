<script lang="ts">
	import { base } from '$app/paths';
	import BodyMap from '$lib/components/BodyMap.svelte';
	import { muscleApproximation, muscleUsage } from '$lib/catalog/muscles.js';
	import { t } from '$lib/i18n/locale.svelte.js';

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
	<title>{t.muscles.title} · Deadload</title>
</svelte:head>

<a href="{base}/catalog/" data-sveltekit-replacestate class="text-sm text-zinc-400">{t.common.backCatalog}</a>
<h1 class="mt-2 font-display text-2xl font-bold">{t.muscles.title}</h1>
<p class="mt-2 mb-5 text-sm text-zinc-400">
	{t.muscles.intro}
</p>

<ul class="flex flex-col gap-2 pb-12">
	{#each muscleUsage as row (row.id)}
		{@const isOpen = open === row.id}
		{@const info = t.muscles.names[row.id]}
		<li class="rounded-2xl border border-zinc-800 bg-zinc-900">
			<button
				onclick={() => (open = isOpen ? null : row.id)}
				aria-expanded={isOpen}
				class="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left"
			>
				<span class="min-w-0 flex-1">
					<span class="block font-medium">{info.label}</span>
					<span class="mt-0.5 block text-sm text-zinc-400">{info.short}</span>
				</span>
				<span class="shrink-0 text-right text-xs text-zinc-500 tabular-nums">
					{t.muscles.trains(row.primary)}
					{#if row.secondary}
						<span class="block text-zinc-600">{t.muscles.assisting(row.secondary)}</span>
					{/if}
				</span>
			</button>

			{#if isOpen}
				<div class="border-t border-zinc-800 px-4 pt-4 pb-4">
					<!-- No legend: the row is already titled with the muscle, and only one
						 colour is in play. -->
					<BodyMap primary={[row.id]} size="small" legend={false} />
					{#each [muscleApproximation(row.id, t)] as approximation (row.id)}
						{#if approximation}
							<!-- Say where the figure is imprecise rather than let it quietly
									 mislead: two of these share a region and one sits on a neighbour. -->
							<p class="mt-3 text-xs text-zinc-500">{t.muscles.onTheFigure(approximation)}</p>
						{/if}
					{/each}
					<p class="mt-4 text-sm text-zinc-200">{info.where}</p>
					<p class="mt-2 text-sm text-zinc-400">{info.does}</p>
					{#if row.primary > 0}
						<!-- Deliberately no count in the link. The counts above are over the
							 whole catalog, because the page explains words and the words do not
							 change when an equipment box is ticked — but browse only shows what
							 you own, so promising a number here would over-promise by however
							 many of them need equipment. -->
						<a
							href="{base}/catalog/?muscle={encodeURIComponent(row.id)}"
							class="mt-4 inline-block min-h-11 text-sm text-zinc-300 underline"
						>
							{t.muscles.showExercises}
						</a>
					{:else}
						<p class="mt-4 text-xs text-zinc-600">
							{t.muscles.onlyAssists}
						</p>
					{/if}
				</div>
			{/if}
		</li>
	{/each}
</ul>
