<script lang="ts">
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import { catalog } from '$lib/catalog/index.js';
	import { countItems, listRoutines } from '$lib/db/routines.js';
	import type { Routine } from '$lib/types.js';

	let routines = $state<Routine[]>([]);
	let loaded = $state(false);

	onMount(async () => {
		routines = await listRoutines();
		loaded = true;
	});
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

	{#if loaded && routines.length === 0}
		<div class="rounded-2xl border border-dashed border-zinc-800 p-8 text-center">
			<p class="text-zinc-300">No routines yet.</p>
			<p class="mt-1 text-sm text-zinc-500">
				Build one from the catalog, or browse the {catalog.length} exercises first.
			</p>
			<a
				href="{base}/routines/new/"
				class="mt-5 inline-block min-h-12 rounded-xl bg-zinc-100 px-5 py-3 text-sm font-semibold text-zinc-900"
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
					</a>
				</li>
			{/each}
		</ul>
	{/if}

	<a
		href="{base}/catalog/"
		class="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 transition-colors hover:border-zinc-600"
	>
		<div class="font-display text-3xl font-bold">{catalog.length}</div>
		<div class="mt-1 text-sm text-zinc-400">exercises in the catalog, every one with images</div>
	</a>
</section>
