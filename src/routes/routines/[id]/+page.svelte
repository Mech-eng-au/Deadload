<script lang="ts">
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { getExercise } from '$lib/catalog/index.js';
	import {
		countItems,
		deleteRoutine,
		describeItem,
		getRoutine,
		putRoutine,
		uid
	} from '$lib/db/routines.js';
	import { estimateSeconds, totalSets } from '$lib/session/steps.js';
	import { putSession } from '$lib/db/sessions.js';
	import { exportRoutinePdf } from '$lib/db/export-file.js';
	import { equipmentLabel, missingEquipment, ownedEquipment } from '$lib/catalog/equipment.js';
	import { getSettings } from '$lib/db/settings.js';
	import ExerciseSheet from '$lib/components/ExerciseSheet.svelte';
	import SortableList from '$lib/components/SortableList.svelte';
	import { moveItem } from '$lib/reorder.js';
	import type { Block, Routine, RoutineItem, Settings } from '$lib/types.js';

	let routine = $state<Routine | null>(null);
	let loaded = $state(false);
	let settings = $state<Settings | null>(null);
	const owned = $derived(ownedEquipment(settings));
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
		settings = await getSettings();
		routine = (await getRoutine(page.params.id!)) ?? null;
		loaded = true;
	});

	async function remove() {
		if (!routine) return;
		await deleteRoutine(routine.id);
		await goto(`${base}/`, { replaceState: true });
	}

	// A routine on paper (§8). The label reports what happened, because on Android
	// the file goes to the share sheet and on a desktop browser it just downloads.
	let printing = $state(false);
	let printed = $state<string | null>(null);
	let photos = $state(true);

	async function print() {
		if (!routine) return;
		printing = true;
		try {
			const { filename, shared, bytes } = await exportRoutinePdf(routine, { photos });
			const size = `${Math.max(1, Math.round(bytes / 1024))} kB`;
			printed = shared
				? `Saved ${filename} (${size})`
				: `Written to app storage as ${filename} (${size})`;
		} catch (e) {
			printed = `Could not make the PDF: ${e instanceof Error ? e.message : String(e)}`;
		} finally {
			printing = false;
		}
	}

	/** Which exercise the sheet is showing, or null when it is closed (§12). */
	let sheetFor = $state<string | null>(null);

	function exerciseName(item: RoutineItem): string {
		return getExercise(item.exerciseId)?.name ?? item.exerciseId;
	}

	/**
	 * Dragging saves at once (§12). There is no Save button on this screen and
	 * inventing one for a gesture would be worse than the gesture: the drop *is* the
	 * decision, it is visible, and dragging the card back undoes it.
	 *
	 * Within one section only, exactly as far as the arrow buttons used to reach.
	 * Moving an exercise from Warm-up into Main is a different edit, and the editor
	 * is where it belongs.
	 */
	async function reorder(block: Block, from: number, to: number) {
		if (!routine) return;
		const next: Routine = {
			...routine,
			blocks: routine.blocks.map((b) =>
				b.id === block.id ? { ...b, items: moveItem(b.items, from, to) } : b
			)
		};
		routine = next; // moved under the finger, before the write settles
		routine = await putRoutine(next);
	}
</script>

<svelte:head>
	<title>{routine?.name ?? 'Routine'} · Deadload</title>
</svelte:head>

<a href="{base}/" data-sveltekit-replacestate class="text-sm text-zinc-400">← Routines</a>

{#if !loaded}
	<p class="mt-8 text-zinc-500">Loading…</p>
{:else if !routine}
	<p class="mt-8 text-zinc-300">That routine is no longer here.</p>
	<a href="{base}/" data-sveltekit-replacestate class="mt-4 inline-block text-sm text-zinc-400 underline">Back to routines</a>
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
					<SortableList
						items={block.items}
						onreorder={(from, to) => reorder(block, from, to)}
						describe={exerciseName}
						itemClass="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-3"
					>
						{#snippet row(item, _i, grip)}
							{@const exercise = getExercise(item.exerciseId)}
							<!-- The card opens the exercise, the handle moves it (§12). Two
								 gestures on one row, told apart by where the finger lands rather than
								 by how long it stays — a long press is invisible until it has already
								 gone wrong. -->
							<button
								onclick={() => (sheetFor = item.exerciseId)}
								class="flex min-w-0 flex-1 items-center gap-4 text-left"
							>
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
								<span class="min-w-0">
									<span class="block truncate font-medium">{exercise?.name ?? item.exerciseId}</span>
									<span class="mt-0.5 block text-sm text-zinc-400">{describeItem(item)}</span>
									<!-- A routine keeps every exercise in it (§5.1). Equipment the user has
										 not ticked earns a chip here, never a removal. -->
									{#if exercise?.equipment.length}
										<span class="mt-1 flex flex-wrap gap-1.5 text-xs">
											{#each exercise.equipment as id (id)}
												<span
													class="rounded-full px-2 py-0.5 {missingEquipment(exercise, owned).includes(id)
														? 'bg-amber-950/60 text-amber-200'
														: 'bg-zinc-800 text-zinc-400'}"
												>
													{equipmentLabel(id)}
												</span>
											{/each}
										</span>
									{/if}
									{#if item.restSeconds > 0}
										<span class="block text-xs text-zinc-500">{item.restSeconds} s rest</span>
									{/if}
									{#if item.notes}
										<span class="mt-1 block text-xs text-zinc-500">{item.notes}</span>
									{/if}
								</span>
							</button>
							{@render grip(_i)}
						{/snippet}
					</SortableList>
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
			<button
				onclick={print}
				disabled={printing || countItems(routine) === 0}
				class="min-h-14 rounded-xl border border-zinc-800 py-4 text-base text-zinc-300 disabled:opacity-50"
			>
				{printing ? 'Making the PDF…' : 'Save as printable PDF'}
			</button>
			<label class="-mt-1 flex min-h-11 items-center gap-2 text-xs text-zinc-500">
				<input
					type="checkbox"
					bind:checked={photos}
					class="h-4 w-4 rounded border-zinc-700 bg-zinc-950"
				/>
				<span>Include the photos — bigger file, but you can see the movement</span>
			</label>
			{#if printed}
				<p class="-mt-2 text-xs text-zinc-500">{printed}</p>
			{:else}
				<p class="-mt-2 text-xs text-zinc-600">
					A4, with a box to write the number in for every set.
				</p>
			{/if}
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

	{#if sheetFor}
		<ExerciseSheet exerciseId={sheetFor} onclose={() => (sheetFor = null)} />
	{/if}
{/if}
