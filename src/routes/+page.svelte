<script lang="ts">
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import { catalog, getExercise } from '$lib/catalog/index.js';
	import { countItems, listRoutines } from '$lib/db/routines.js';
	import { deleteSession, findUnfinishedSession } from '$lib/db/sessions.js';
	import type { Routine, Session } from '$lib/types.js';

	let routines = $state<Routine[]>([]);
	let unfinished = $state<Session | null>(null);
	let loaded = $state(false);

	onMount(async () => {
		routines = await listRoutines();
		unfinished = (await findUnfinishedSession()) ?? null;
		loaded = true;
	});

	/** The first few exercises of a routine, for the thumbnails on its card. */
	function firstFew(r: Routine, limit = 4) {
		const seen = new Set<string>();
		const found = [];
		for (const block of r.blocks) {
			for (const item of block.items) {
				if (seen.has(item.exerciseId)) continue;
				seen.add(item.exerciseId);
				const exercise = getExercise(item.exerciseId);
				if (exercise) found.push(exercise);
				if (found.length === limit) return found;
			}
		}
		return found;
	}

	async function discardUnfinished() {
		if (!unfinished) return;
		await deleteSession(unfinished.id);
		unfinished = null;
	}
</script>

<svelte:head>
	<title>Deadload</title>
</svelte:head>

<section class="flex flex-col gap-6 pt-2">
	<div class="flex items-baseline justify-between">
		<h1 class="font-display text-3xl font-bold">Routines</h1>
		<a
			href="{base}/routines/new/"
			class="min-h-12 rounded-xl bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-900"
		>
			New routine
		</a>
	</div>

	{#if unfinished}
		<!-- Crash-resume: an explicit prompt, never a silent restore (§7). -->
		<div class="rounded-2xl border border-zinc-700 bg-zinc-900 p-5">
			<p class="font-medium">Resume session?</p>
			<p class="mt-1 text-sm text-zinc-400">
				{unfinished.routineName} · {unfinished.entries.length} set{unfinished.entries.length === 1
					? ''
					: 's'} logged
			</p>
			<div class="mt-4 flex gap-3">
				<a
					href="{base}/session/{unfinished.id}/"
					class="min-h-14 flex-1 rounded-xl bg-zinc-100 py-4 text-center font-semibold text-zinc-900"
				>
					Resume
				</a>
				<button
					onclick={discardUnfinished}
					class="min-h-14 flex-1 rounded-xl border border-zinc-700 py-4 text-zinc-300"
				>
					Discard
				</button>
			</div>
		</div>
	{/if}

	{#if loaded && routines.length === 0}
		<div class="rounded-2xl border border-dashed border-zinc-800 p-8 text-center">
			<p class="text-zinc-300">No routines yet.</p>
			<p class="mt-1 text-sm text-zinc-500">
				Start from a built-in routine, build your own, or import one.
			</p>
			<a
				href="{base}/presets/"
				class="mt-5 inline-block min-h-12 rounded-xl bg-zinc-100 px-5 py-3 text-sm font-semibold text-zinc-900"
			>
				Browse built-in routines
			</a>
			<a
				href="{base}/routines/new/"
				class="mt-3 block text-sm text-zinc-400 underline"
			>
				Build a routine
			</a>
		</div>
	{:else}
		<ul class="flex flex-col gap-2">
			{#each routines as r (r.id)}
				<li>
					<a
						href="{base}/routines/{r.id}/"
						class="block rounded-xl border border-zinc-800 bg-zinc-900 p-4"
					>
						<div class="font-medium">{r.name}</div>
						<div class="mt-1 text-sm text-zinc-400">
							{countItems(r)} exercise{countItems(r) === 1 ? '' : 's'}
							{#if r.goal}<span class="text-zinc-500"> · {r.goal}</span>{/if}
						</div>
						<!-- What is actually in it. The catalog ships an image for every
							 exercise; showing four of them tells you more about a routine
							 than its name does. -->
						{#if firstFew(r).length}
							<div class="mt-3 flex gap-2">
								{#each firstFew(r) as ex (ex.id)}
									<img
										src="{base}{ex.media[0].path}"
										alt=""
										width={ex.media[0].width}
										height={ex.media[0].height}
										loading="lazy"
										class="h-12 w-16 rounded-md bg-white object-cover"
									/>
								{/each}
							</div>
						{/if}
					</a>
				</li>
			{/each}
		</ul>
	{/if}

	<div class="grid grid-cols-2 gap-3">
		<a
			href="{base}/presets/"
			class="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-sm transition-colors hover:border-zinc-600"
		>
			<div class="font-medium">Built-in routines</div>
			<div class="mt-1 text-xs text-zinc-400">Five to start from</div>
		</a>
		<a
			href="{base}/import/"
			class="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-sm transition-colors hover:border-zinc-600"
		>
			<div class="font-medium">Import</div>
			<div class="mt-1 text-xs text-zinc-400">From JSON or CSV</div>
		</a>
	</div>

	<a
		href="{base}/catalog/"
		class="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 transition-colors hover:border-zinc-600"
	>
		<div class="font-display text-3xl font-bold">{catalog.length}</div>
		<div class="mt-1 text-sm text-zinc-400">exercises in the catalog, every one with images</div>
	</a>
</section>
