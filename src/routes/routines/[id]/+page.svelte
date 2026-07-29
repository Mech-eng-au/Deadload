<script lang="ts">
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { getExercise } from '$lib/catalog/index.js';
	import { countItems, deleteRoutine, describeItem, getRoutine, uid } from '$lib/db/routines.js';
	import { estimateSeconds, totalSets } from '$lib/session/steps.js';
	import { putSession } from '$lib/db/sessions.js';
	import type { Routine } from '$lib/types.js';

	let routine = $state<Routine | null>(null);
	let loaded = $state(false);
	let confirmingDelete = $state(false);
	let starting = $state(false);

	async function startSession() {
		if (!routine) return;
		starting = true;
		try {
			const session = await putSession({
				id: uid(),
				routineId: routine.id,
				routineName: routine.name,
				startedAt: new Date().toISOString(),
				entries: []
			});
			await goto(`${base}/session/${session.id}/`);
		} finally {
			starting = false;
		}
	}

	onMount(async () => {
		routine = (await getRoutine(page.params.id!)) ?? null;
		loaded = true;
	});

	async function remove() {
		if (!routine) return;
		await deleteRoutine(routine.id);
		await goto(`${base}/`, { replaceState: true });
	}
</script>

<svelte:head>
	<title>{routine?.name ?? 'Routine'} · Deadload</title>
</svelte:head>

<a href="{base}/" class="text-sm text-zinc-400">← Routines</a>

{#if !loaded}
	<p class="mt-8 text-zinc-500">Loading…</p>
{:else if !routine}
	<p class="mt-8 text-zinc-300">That routine is no longer here.</p>
	<a href="{base}/" class="mt-4 inline-block text-sm text-zinc-400 underline">Back to routines</a>
{:else}
	<article class="mt-2 flex flex-col gap-6 pb-12">
		<header>
			<h1 class="font-display text-3xl font-bold">{routine.name}</h1>
			<!-- Chips rather than a sentence: three facts read faster stacked than
				 strung together, and the estimate is information the app had all
				 along but never showed. -->
			<div class="mt-3 flex flex-wrap items-center gap-2 text-sm">
				<span class="rounded-full bg-zinc-800 px-3 py-1 tabular-nums">
					~{Math.max(1, Math.round(estimateSeconds(routine) / 60))} min
				</span>
				<span class="rounded-full bg-zinc-800 px-3 py-1 tabular-nums">
					{countItems(routine)} exercise{countItems(routine) === 1 ? '' : 's'}
				</span>
				<span class="rounded-full bg-zinc-800 px-3 py-1 tabular-nums">
					{totalSets(routine)} set{totalSets(routine) === 1 ? '' : 's'}
				</span>
				{#if routine.goal}<span class="text-zinc-500">{routine.goal}</span>{/if}
			</div>
			{#if routine.description}
				<p class="mt-3 text-zinc-300">{routine.description}</p>
			{/if}
			{#if routine.tags.length}
				<div class="mt-3 flex flex-wrap gap-2">
					{#each routine.tags as tag (tag)}
						<span class="rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-300">{tag}</span>
					{/each}
				</div>
			{/if}
		</header>

		{#each routine.blocks as block (block.id)}
			{#if block.items.length}
				{@const rounds = Math.max(1, ...block.items.map((i) => Math.max(1, i.sets)))}
				<section>
					{#if block.label || block.mode === 'circuit'}
						<h2 class="mb-2 text-sm font-semibold tracking-wide text-zinc-400 uppercase">
							{block.label || 'Circuit'}
							{#if block.mode === 'circuit'}
								<span class="ml-1 font-normal text-zinc-500 normal-case">
									· {block.label ? 'circuit, ' : ''}{rounds} round{rounds === 1 ? '' : 's'}
								</span>
							{/if}
						</h2>
					{/if}
					<ul class="flex flex-col gap-2">
						{#each block.items as item (item.id)}
							{@const exercise = getExercise(item.exerciseId)}
							<li class="flex items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-900 p-3">
								{#if exercise}
									<img
										src="{base}{exercise.media[0].path}"
										alt=""
										width={exercise.media[0].width}
										height={exercise.media[0].height}
										loading="lazy"
										class="h-16 w-20 shrink-0 rounded-lg bg-white object-cover"
									/>
								{/if}
								<div class="min-w-0">
									<div class="truncate font-medium">{exercise?.name ?? item.exerciseId}</div>
									<div class="mt-0.5 text-sm text-zinc-400">{describeItem(item)}</div>
									{#if item.restSeconds > 0}
										<div class="text-xs text-zinc-500">{item.restSeconds} s rest</div>
									{/if}
									{#if item.notes}
										<div class="mt-1 text-xs text-zinc-500">{item.notes}</div>
									{/if}
								</div>
							</li>
						{/each}
					</ul>
				</section>
			{/if}
		{/each}

		<div class="flex flex-col gap-3 border-t border-zinc-800 pt-6">
			{#if countItems(routine) > 0}
				<button
					onclick={startSession}
					disabled={starting}
					class="min-h-16 rounded-xl bg-zinc-100 py-4 font-display text-xl font-bold text-zinc-900 disabled:bg-zinc-800 disabled:text-zinc-500"
				>
					{starting ? 'Starting…' : 'Start session'}
				</button>
			{/if}
			<a
				href="{base}/routines/{routine.id}/edit/"
				class="min-h-14 rounded-xl border border-zinc-700 py-4 text-center text-base font-medium"
			>
				Edit routine
			</a>
			{#if confirmingDelete}
				<div class="flex gap-3">
					<button
						onclick={remove}
						class="min-h-14 flex-1 rounded-xl bg-red-900/70 py-4 text-base font-medium text-red-50"
					>
						Delete for good
					</button>
					<button
						onclick={() => (confirmingDelete = false)}
						class="min-h-14 flex-1 rounded-xl border border-zinc-700 py-4 text-base"
					>
						Keep it
					</button>
				</div>
			{:else}
				<button
					onclick={() => (confirmingDelete = true)}
					class="min-h-14 rounded-xl border border-zinc-800 py-4 text-base text-zinc-400"
				>
					Delete routine
				</button>
			{/if}
		</div>
	</article>
{/if}
