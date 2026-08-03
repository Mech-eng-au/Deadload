<script lang="ts">
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { getExercise } from '$lib/catalog/index.js';
	import {
		canReorder,
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
	import { moveAcross, type Slot } from '$lib/reorder.js';
	import { handleSide } from '$lib/handle-side.svelte.js';
	import { t } from '$lib/i18n/locale.svelte.js';
	import type { Block, Routine, RoutineItem, Settings } from '$lib/types.js';

	let routine = $state<Routine | null>(null);
	let loaded = $state(false);
	let settings = $state<Settings | null>(null);
	const owned = $derived(ownedEquipment(settings));
	let confirmingDelete = $state(false);
	let starting = $state(false);

	/**
	 * Whether the drag handles are showing (§12). They are 44 px plus a gap — 17%
	 * of a card at 360 px, and it was coming out of the exercise name — so on this
	 * screen they are behind a toggle rather than always on.
	 *
	 * A mode rather than the long press §12 rejected: what was wrong with a long
	 * press is that it is invisible until it has already done the wrong thing, and
	 * a mode is entered on purpose and reversible before anything moves.
	 *
	 * It confirms nothing. A drop still saves at once, exactly as it did when the
	 * handles were always visible — leaving the mode only stops showing them.
	 */
	let reordering = $state(false);

	function toggleReorder() {
		reordering = !reordering;
		if (!reordering) return;
		// The handle is the only way to reorder without a pointer (§12), so hiding
		// it puts the arrow keys behind an icon. Entering the mode hands focus to
		// the first one, which is where a keyboard user was going anyway.
		requestAnimationFrame(() => {
			document.querySelector<HTMLElement>('[data-dl-grip]')?.focus();
		});
	}

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
				? t.routine.printedShared(filename, size)
				: t.routine.printedLocal(filename, size);
		} catch (e) {
			printed = t.routine.printFailed(e instanceof Error ? e.message : String(e));
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
	 * inventing one for a gesture would be worse than the gesture: the drop *is*
	 * the decision, it is visible, and dragging the card back undoes it.
	 *
	 * **Across sections since 2026-08-03.** The old rule was "within one section
	 * only, exactly as far as the arrow buttons reached", and the reason was that
	 * the drag could not see more than one list — not a view about what the user
	 * should be allowed to do. Now that it can, restricting it to the editor
	 * would put the *more* awkward edit on the screen less suited to it: this one
	 * has the small cards, which is the whole argument for the drag being here.
	 */
	async function onreorder(from: Slot, to: Slot) {
		if (!routine) return;
		const order = shown.map((s) => s.blockIndex);
		const moved = moveAcross(
			order.map((b) => routine!.blocks[b].items),
			from,
			to
		);
		const next: Routine = {
			...routine,
			blocks: routine.blocks.map((b) => {
				const at = order.indexOf(routine!.blocks.indexOf(b));
				return at === -1 ? { ...b } : { ...b, items: moved[at] };
			})
		};
		routine = next; // moved under the finger, before the write settles
		routine = await putRoutine(next);
	}

	/**
	 * The sections this screen puts on the page, and where each came from.
	 *
	 * A block with neither a name nor an exercise in it is not rendered, exactly
	 * as before — but that means the list handed to the drag is not the routine's
	 * own list, so the mapping back has to be explicit. Passing a filtered array
	 * and assuming the indices still line up is the sort of thing that silently
	 * moves an exercise into the wrong section.
	 *
	 * A *named* empty section is shown, which it was not before. It has to be, or
	 * it cannot be dragged into — and a named section with nothing in it is
	 * something the user made on purpose.
	 */
	const shown = $derived(
		(routine?.blocks ?? [])
			.map((block, blockIndex) => ({ ...block, blockIndex }))
			.filter((block) => block.items.length > 0 || !!block.label)
	);
</script>

<svelte:head>
	<title>{routine?.name ?? t.routine.fallbackTitle} · Deadload</title>
</svelte:head>

<a href="{base}/" data-sveltekit-replacestate class="text-sm text-zinc-400">{t.common.backRoutines}</a>

{#if !loaded}
	<p class="mt-8 text-zinc-500">{t.common.loading}</p>
{:else if !routine}
	<p class="mt-8 text-zinc-300">{t.routine.gone}</p>
	<a href="{base}/" data-sveltekit-replacestate class="mt-4 inline-block text-sm text-zinc-400 underline">{t.common.backToRoutines}</a>
{:else}
	<article class="mt-2 flex flex-col gap-6 pb-12">
		<header>
			<h1 class="font-display text-3xl font-bold">{routine.name}</h1>
			<!-- Chips rather than a sentence: three facts read faster stacked than
				 strung together, and the estimate is information the app had all
				 along but never showed. -->
			<div class="mt-3 flex flex-wrap items-center gap-2 text-sm">
				<span class="rounded-full bg-zinc-800 px-3 py-1 tabular-nums">
					{t.routine.approxMinutes(Math.max(1, Math.round(estimateSeconds(routine) / 60)))}
				</span>
				<span class="rounded-full bg-zinc-800 px-3 py-1 tabular-nums">
					{t.units.exercises(countItems(routine))}
				</span>
				<span class="rounded-full bg-zinc-800 px-3 py-1 tabular-nums">
					{t.units.sets(totalSets(routine))}
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

		{#if canReorder(routine)}
			<!-- The grip glyph the handles use, so the button says what it reveals,
				 and on the edge `handleSide` points at, so it is where they will
				 appear. Hidden entirely below two exercises (§12): the handles would
				 all be disabled, and a mode whose controls are dead is worse than no
				 mode. Not a pencil — *Edit routine* is on this screen already. -->
			<div class="mt-4 mb-1 flex {handleSide() === 'left' ? 'justify-start' : 'justify-end'}">
				<button
					onclick={toggleReorder}
					aria-pressed={reordering}
					class="flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg px-3 text-sm {reordering
						? 'bg-zinc-800 text-zinc-100'
						: 'border border-zinc-800 text-zinc-500'}"
				>
					{#if reordering}
						{t.routine.reorderDone}
					{:else}
						<svg
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="1.75"
							aria-hidden="true"
							class="h-5 w-5"
						>
							<path d="M6 9h12M6 15h12" stroke-linecap="round" />
						</svg>
						<span class="sr-only">{t.routine.reorderExercises}</span>
					{/if}
				</button>
			</div>
		{/if}

		<SortableList
			sections={shown}
			{onreorder}
			describe={exerciseName}
			itemClass="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-3"
		>
			{#snippet section(block, _s, list)}
				{@const rounds = Math.max(1, ...block.items.map((i) => Math.max(1, i.sets)), 1)}
				<section class="mb-6">
					{#if block.label || block.mode === 'circuit'}
						<h2 class="mb-2 text-sm font-semibold tracking-wide text-zinc-400 uppercase">
							{block.label || t.routine.circuit}
							{#if block.mode === 'circuit'}
								<span class="ml-1 font-normal text-zinc-500 normal-case">
									{t.routine.circuitRounds(rounds, !!block.label)}
								</span>
							{/if}
						</h2>
					{/if}
					{@render list()}
				</section>
			{/snippet}

			{#snippet row(item, slot, grip)}
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
						<span class="mt-0.5 block text-sm text-zinc-400">{describeItem(item, t)}</span>
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
										{equipmentLabel(id, t)}
									</span>
								{/each}
							</span>
						{/if}
						{#if item.restSeconds > 0}
							<span class="block text-xs text-zinc-500">{t.units.restAfter(item.restSeconds)}</span>
						{/if}
						{#if item.notes}
							<span class="mt-1 block text-xs text-zinc-500">{item.notes}</span>
						{/if}
					</span>
				</button>
				<!-- Rendered last and as a direct child of the card's flex row, which
					 is what lets `handleSide` move it with `order` while the DOM order
					 stays the reading order. An `{#if}` emits no wrapper, so that holds. -->
				{#if reordering}{@render grip(slot)}{/if}
			{/snippet}
		</SortableList>

		<div class="flex flex-col gap-3 border-t border-zinc-800 pt-6">
			{#if countItems(routine) > 0}
				<button
					onclick={startSession}
					disabled={starting}
					class="min-h-16 rounded-xl bg-zinc-100 py-4 font-display text-xl font-bold text-zinc-900 disabled:bg-zinc-800 disabled:text-zinc-500"
				>
					{starting ? t.routine.starting : t.routine.startSession}
				</button>
			{/if}
			<a
				href="{base}/routines/{routine.id}/edit/"
				class="min-h-14 rounded-xl border border-zinc-700 py-4 text-center text-base font-medium"
			>
				{t.routine.edit}
			</a>
			<button
				onclick={print}
				disabled={printing || countItems(routine) === 0}
				class="min-h-14 rounded-xl border border-zinc-800 py-4 text-base text-zinc-300 disabled:opacity-50"
			>
				{printing ? t.routine.printing : t.routine.print}
			</button>
			<label class="-mt-1 flex min-h-11 items-center gap-2 text-xs text-zinc-500">
				<input
					type="checkbox"
					bind:checked={photos}
					class="h-4 w-4 rounded border-zinc-700 bg-zinc-950"
				/>
				<span>{t.routine.includePhotos}</span>
			</label>
			{#if printed}
				<p class="-mt-2 text-xs text-zinc-500">{printed}</p>
			{:else}
				<p class="-mt-2 text-xs text-zinc-600">
					{t.routine.printHint}
				</p>
			{/if}
			{#if confirmingDelete}
				<div class="flex gap-3">
					<button
						onclick={remove}
						class="min-h-14 flex-1 rounded-xl bg-red-900/70 py-4 text-base font-medium text-red-50"
					>
						{t.routine.deleteForGood}
					</button>
					<button
						onclick={() => (confirmingDelete = false)}
						class="min-h-14 flex-1 rounded-xl border border-zinc-700 py-4 text-base"
					>
						{t.routine.keepIt}
					</button>
				</div>
			{:else}
				<button
					onclick={() => (confirmingDelete = true)}
					class="min-h-14 rounded-xl border border-zinc-800 py-4 text-base text-zinc-400"
				>
					{t.routine.delete}
				</button>
			{/if}
		</div>
	</article>

	{#if sheetFor}
		<ExerciseSheet exerciseId={sheetFor} onclose={() => (sheetFor = null)} />
	{/if}
{/if}
