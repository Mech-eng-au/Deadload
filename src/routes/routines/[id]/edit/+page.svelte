<script lang="ts">
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import RoutineEditor from '$lib/components/RoutineEditor.svelte';
	import { getRoutine, putRoutine } from '$lib/db/routines.js';
	import type { Routine } from '$lib/types.js';

	let routine = $state<Routine | null>(null);
	let loaded = $state(false);
	let saving = $state(false);

	onMount(async () => {
		routine = (await getRoutine(page.params.id!)) ?? null;
		loaded = true;
	});

	async function save() {
		if (!routine) return;
		saving = true;
		try {
			await putRoutine({ ...routine, name: routine.name.trim() });
			await goto(`${base}/routines/${routine.id}/`, { replaceState: true });
		} finally {
			saving = false;
		}
	}
</script>

<svelte:head>
	<title>Edit {routine?.name ?? 'routine'} · Deadload</title>
</svelte:head>

{#if !loaded}
	<p class="mt-8 text-zinc-500">Loading…</p>
{:else if !routine}
	<p class="mt-8 text-zinc-300">That routine is no longer here.</p>
	<a href="{base}/" class="mt-4 inline-block text-sm text-zinc-400 underline">Back to routines</a>
{:else}
	<a href="{base}/routines/{routine.id}/" data-sveltekit-replacestate class="text-sm text-zinc-400">← Cancel</a>
	<h1 class="mt-2 mb-5 font-display text-2xl font-bold">Edit routine</h1>
	<RoutineEditor bind:routine={routine as Routine} onsave={save} {saving} />
{/if}
