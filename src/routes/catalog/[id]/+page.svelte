<script lang="ts">
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import { getExercise } from '$lib/catalog/index.js';
	import { ladderFor } from '$lib/catalog/ladders.js';
	import { equipmentLabel, missingEquipment, ownedEquipment } from '$lib/catalog/equipment.js';
	import { muscleInfo, muscleLabel } from '$lib/catalog/muscles.js';
	import BodyMap from '$lib/components/BodyMap.svelte';
	import { getSettings } from '$lib/db/settings.js';
	import type { Settings } from '$lib/types.js';

	let { data } = $props();
	const e = $derived(data.exercise);
	const ladder = $derived(ladderFor(e.id));

	let settings = $state<Settings | null>(null);
	onMount(async () => {
		settings = await getSettings();
	});

	// This screen is reachable from a routine, from history and from a ladder rung,
	// so it can be an exercise the user has not ticked the equipment for. It says
	// so rather than hiding — §5.1 gates what the app offers, never what it shows.
	const missing = $derived(missingEquipment(e, ownedEquipment(settings)));
</script>

<svelte:head>
	<title>{e.name} · Deadload</title>
</svelte:head>

<article class="flex flex-col gap-6">
	<div>
		<a href="{base}/catalog/" data-sveltekit-replacestate class="text-sm text-zinc-400 hover:text-zinc-100">← Catalog</a>
		<h1 class="mt-2 font-display text-3xl font-bold">{e.name}</h1>
		<div class="mt-2 flex flex-wrap gap-2 text-xs">
			<span class="rounded-full bg-zinc-800 px-3 py-1">{e.category}</span>
			<span class="rounded-full bg-zinc-800 px-3 py-1">{e.level}</span>
			<span class="rounded-full bg-zinc-800 px-3 py-1">
				{e.defaultMetric === 'duration' ? 'timed' : 'reps'}
			</span>
			{#if e.unilateral}
				<span class="rounded-full bg-zinc-800 px-3 py-1">per side</span>
			{/if}
			{#each e.equipment as id (id)}
				<span
					class="rounded-full px-3 py-1 {missing.includes(id)
						? 'bg-amber-950/60 text-amber-200'
						: 'bg-zinc-800'}"
				>
					{equipmentLabel(id)}
				</span>
			{/each}
		</div>
		{#if missing.length}
			<p class="mt-3 text-xs text-amber-200/80">
				Needs {missing.map(equipmentLabel).join(' and ').toLowerCase()}, which you have not ticked in
				<a href="{base}/settings/" data-sveltekit-replacestate class="underline">Settings</a>. It
				stays here, and out of the catalog and the picker until you do.
			</p>
		{/if}
	</div>

	<div class="grid gap-3 sm:grid-cols-2">
		{#each e.media as m (m.path)}
			<figure>
				<img
					src="{base}{m.path}"
					alt="{e.name}{m.caption ? ` — ${m.caption}` : ''}"
					width={m.width}
					height={m.height}
					class="w-full rounded-2xl bg-white"
				/>
				{#if m.caption}
					<figcaption class="mt-1 text-center text-xs text-zinc-500">{m.caption}</figcaption>
				{/if}
			</figure>
		{/each}
	</div>

	<!-- §4.6. The catalog names muscles the way an anatomy book does, so the
		 diagram says where they are and the brackets say it in words. -->
	<section>
		<h2 class="text-sm font-semibold tracking-wide text-zinc-400 uppercase">Muscles</h2>
		<div class="mt-3">
			<BodyMap primary={e.primaryMuscles} secondary={e.secondaryMuscles} />
		</div>
		<dl class="mt-4 flex flex-col gap-2 text-sm">
			<div>
				<dt class="text-xs tracking-wide text-zinc-500 uppercase">Works</dt>
				<dd class="mt-0.5 text-zinc-100">
					<!-- The space before the dash is a non-breaking one on purpose: Svelte
						 trims leading whitespace inside an element, so a plain space here
						 renders as "Adductors— inner thigh". -->
					{#each e.primaryMuscles as m, i (m)}<span>{muscleLabel(m)}</span><span
							class="text-zinc-500">{` — ${muscleInfo(m)?.short ?? ''}`}</span
						>{#if i < e.primaryMuscles.length - 1}<span>, </span>{/if}{/each}
				</dd>
			</div>
			{#if e.secondaryMuscles.length}
				<div>
					<dt class="text-xs tracking-wide text-zinc-500 uppercase">Assists</dt>
					<dd class="mt-0.5 text-zinc-400">
						{#each e.secondaryMuscles as m, i (m)}<span>{muscleLabel(m)}</span><span
								class="text-zinc-600">{` — ${muscleInfo(m)?.short ?? ''}`}</span
							>{#if i < e.secondaryMuscles.length - 1}<span>, </span>{/if}{/each}
					</dd>
				</div>
			{/if}
		</dl>
		<a
			href="{base}/muscles/"
			data-sveltekit-replacestate
			class="mt-3 inline-block text-xs text-zinc-500 underline"
		>
			What all these muscles are →
		</a>
	</section>

	{#if e.instructions.length}
		<section>
			<h2 class="text-sm font-semibold tracking-wide text-zinc-400 uppercase">How to do it</h2>
			<ol class="mt-2 flex list-decimal flex-col gap-2 pl-5 text-zinc-200">
				{#each e.instructions as step, i (i)}
					<li>{step}</li>
				{/each}
			</ol>
		</section>
	{/if}

	{#if ladder.length}
		<!-- The whole progression, easiest first, with where this one sits (§4.1). -->
		<section>
			<h2 class="text-sm font-semibold tracking-wide text-zinc-400 uppercase">Progression</h2>
			<ol class="mt-2 flex flex-col gap-1">
				{#each ladder as id, i (id)}
					<li>
						<a
							href="{base}/catalog/{id}/"
							data-sveltekit-replacestate
							class="flex min-h-11 items-center gap-3 rounded-lg px-3 {id === e.id
								? 'bg-zinc-800 text-zinc-100'
								: 'text-zinc-400'}"
						>
							<span class="font-display text-sm text-zinc-500">{i + 1}</span>
							{getExercise(id)?.name ?? id}
						</a>
					</li>
				{/each}
			</ol>
		</section>
	{/if}

	{#if data.attribution}
		<p class="border-t border-zinc-800 pt-4 text-xs text-zinc-500">
			Source: {data.attribution.source} ({data.attribution.license})
			{#if data.attribution.sourceUrl}
				· <a href={data.attribution.sourceUrl} class="underline hover:text-zinc-300">origin</a>
			{/if}
		</p>
	{/if}
</article>
