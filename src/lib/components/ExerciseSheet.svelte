<script lang="ts">
	import { onMount } from 'svelte';
	import { getExercise } from '$lib/catalog/index.js';
	import { ownedEquipment } from '$lib/catalog/equipment.js';
	import { getSettings } from '$lib/db/settings.js';
	import ExerciseDetail from './ExerciseDetail.svelte';
	import type { Settings } from '$lib/types.js';

	/**
	 * "What is this exercise?", answered over the routine rather than away from it
	 * (§12, "Reading about an exercise from a routine").
	 *
	 * A sheet and not a link, for two reasons. From the routine editor a link would
	 * leave the screen, and leaving the editor discards unsaved work — the Cancel
	 * link says so. And from the routine view it would cost the scroll position in a
	 * twelve-exercise list, to answer a question asked in passing.
	 *
	 * It is the same content as the catalog page, from the same component.
	 */
	let { exerciseId, onclose }: { exerciseId: string; onclose: () => void } = $props();

	// The progression rungs move the sheet rather than the app (see ExerciseDetail),
	// so the sheet keeps its own idea of which exercise it is showing. Layered over
	// the prop rather than copied from it, so no effect is needed to stay in step.
	let picked = $state<string | undefined>(undefined);
	const showing = $derived(picked ?? exerciseId);
	const exercise = $derived(getExercise(showing));

	let settings = $state<Settings | null>(null);
	let scroller = $state<HTMLDivElement | null>(null);
	onMount(async () => {
		settings = await getSettings();
	});

	function show(id: string) {
		picked = id;
		scroller?.scrollTo({ top: 0 });
	}
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape') onclose();
	}}
/>

<div
	role="dialog"
	aria-modal="true"
	aria-label={exercise?.name ?? 'Exercise'}
	class="fixed inset-0 z-50 flex flex-col bg-zinc-950"
>
	<div
		class="flex items-start gap-3 border-b border-zinc-800 px-4 pt-[env(safe-area-inset-top)] pb-3"
	>
		<h2 class="min-w-0 flex-1 pt-3 font-display text-xl font-bold">
			{exercise?.name ?? showing}
		</h2>
		<button
			onclick={onclose}
			class="mt-1 min-h-14 min-w-14 shrink-0 rounded-xl text-sm text-zinc-400 hover:text-zinc-100"
		>
			Close
		</button>
	</div>

	<div bind:this={scroller} class="flex-1 overflow-y-auto px-4 py-4 pb-[env(safe-area-inset-bottom)]">
		{#if exercise}
			<ExerciseDetail {exercise} owned={ownedEquipment(settings)} embedded onexercise={show} />
		{:else}
			<p class="text-zinc-400">That exercise is not in the catalog.</p>
		{/if}
	</div>
</div>
