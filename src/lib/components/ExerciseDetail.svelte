<script lang="ts">
	import { base } from '$app/paths';
	import { getAttribution, getExercise } from '$lib/catalog/index.js';
	import { ladderFor } from '$lib/catalog/ladders.js';
	import { equipmentLabel, missingEquipment } from '$lib/catalog/equipment.js';
	import { muscleInfo, muscleLabel } from '$lib/catalog/muscles.js';
	import BodyMap from './BodyMap.svelte';
	import type { Snippet } from 'svelte';
	import type { EquipmentId, Exercise } from '$lib/types.js';

	/**
	 * Everything the catalog knows about one exercise, below its name.
	 *
	 * Shared by the catalog page and the sheet that opens from a routine (§12), so
	 * the two cannot drift into disagreeing about the same exercise.
	 *
	 * `embedded` is what makes it safe inside the sheet: **no link may navigate**.
	 * The sheet opens over the routine editor, where leaving the screen discards
	 * unsaved work, so the links that would leave become plain text and the
	 * progression rungs switch the sheet's own exercise instead.
	 */
	let {
		exercise,
		owned,
		embedded = false,
		onexercise,
		heading
	}: {
		exercise: Exercise;
		owned: EquipmentId[];
		embedded?: boolean;
		/** The name, where the page wants it above the chips rather than in its own bar. */
		heading?: Snippet;
		/** Where a progression rung goes when embedded. Ignored otherwise. */
		onexercise?: (id: string) => void;
	} = $props();

	const missing = $derived(missingEquipment(exercise, owned));
	const ladder = $derived(ladderFor(exercise.id));
	const attribution = $derived(getAttribution(exercise.attributionId));
</script>

<div class="flex flex-col gap-6">
	<div>
		{@render heading?.()}
		<div class="mt-2 flex flex-wrap gap-2 text-xs">
			<span class="rounded-full bg-zinc-800 px-3 py-1">{exercise.category}</span>
			<span class="rounded-full bg-zinc-800 px-3 py-1">{exercise.level}</span>
			<span class="rounded-full bg-zinc-800 px-3 py-1">
				{exercise.defaultMetric === 'duration' ? 'timed' : 'reps'}
			</span>
			{#if exercise.unilateral}
				<span class="rounded-full bg-zinc-800 px-3 py-1">per side</span>
			{/if}
			{#each exercise.equipment as id (id)}
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
				{#if embedded}
					Settings.
				{:else}
					<a href="{base}/settings/" data-sveltekit-replacestate class="underline">Settings</a>.
				{/if}
				It stays here, and out of the catalog and the picker until you do.
			</p>
		{/if}
	</div>

	<div class="grid gap-3 sm:grid-cols-2">
		{#each exercise.media as m (m.path)}
			<figure>
				<img
					src="{base}{m.path}"
					alt="{exercise.name}{m.caption ? ` — ${m.caption}` : ''}"
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
			<BodyMap primary={exercise.primaryMuscles} secondary={exercise.secondaryMuscles} />
		</div>
		<dl class="mt-4 flex flex-col gap-2 text-sm">
			<div>
				<dt class="text-xs tracking-wide text-zinc-500 uppercase">Works</dt>
				<dd class="mt-0.5 text-zinc-100">
					<!-- The space before the dash is a non-breaking one on purpose: Svelte
						 trims leading whitespace inside an element, so a plain space here
						 renders as "Adductors— inner thigh". -->
					{#each exercise.primaryMuscles as m, i (m)}<span>{muscleLabel(m)}</span><span
							class="text-zinc-500">{` — ${muscleInfo(m)?.short ?? ''}`}</span
						>{#if i < exercise.primaryMuscles.length - 1}<span>{', '}</span>{/if}{/each}
				</dd>
			</div>
			{#if exercise.secondaryMuscles.length}
				<div>
					<dt class="text-xs tracking-wide text-zinc-500 uppercase">Assists</dt>
					<dd class="mt-0.5 text-zinc-400">
						{#each exercise.secondaryMuscles as m, i (m)}<span>{muscleLabel(m)}</span><span
								class="text-zinc-600">{` — ${muscleInfo(m)?.short ?? ''}`}</span
							>{#if i < exercise.secondaryMuscles.length - 1}<span>{', '}</span>{/if}{/each}
					</dd>
				</div>
			{/if}
		</dl>
		{#if !embedded}
			<a
				href="{base}/muscles/"
				data-sveltekit-replacestate
				class="mt-3 inline-block text-xs text-zinc-500 underline"
			>
				What all these muscles are →
			</a>
		{/if}
	</section>

	{#if exercise.instructions.length}
		<section>
			<h2 class="text-sm font-semibold tracking-wide text-zinc-400 uppercase">How to do it</h2>
			<ol class="mt-2 flex list-decimal flex-col gap-2 pl-5 text-zinc-200">
				{#each exercise.instructions as step, i (i)}
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
					{@const rung = 'flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left'}
					<li>
						{#if embedded}
							<button
								onclick={() => onexercise?.(id)}
								disabled={id === exercise.id}
								class="{rung} {id === exercise.id ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400'}"
							>
								<span class="font-display text-sm text-zinc-500">{i + 1}</span>
								{getExercise(id)?.name ?? id}
							</button>
						{:else}
							<a
								href="{base}/catalog/{id}/"
								data-sveltekit-replacestate
								class="{rung} {id === exercise.id ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400'}"
							>
								<span class="font-display text-sm text-zinc-500">{i + 1}</span>
								{getExercise(id)?.name ?? id}
							</a>
						{/if}
					</li>
				{/each}
			</ol>
		</section>
	{/if}

	{#if attribution}
		<p class="border-t border-zinc-800 pt-4 text-xs text-zinc-500">
			Source: {attribution.source} ({attribution.license})
			{#if attribution.sourceUrl && !embedded}
				· <a href={attribution.sourceUrl} class="underline hover:text-zinc-300">origin</a>
			{/if}
		</p>
	{/if}
</div>
