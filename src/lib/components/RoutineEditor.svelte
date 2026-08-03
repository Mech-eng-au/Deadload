<script lang="ts">
	import { base } from '$app/paths';
	import CatalogPicker from './CatalogPicker.svelte';
	import ExerciseSheet from './ExerciseSheet.svelte';
	import SortableList from './SortableList.svelte';
	import { getExercise } from '$lib/catalog/index.js';
	import { isLoadable } from '$lib/catalog/equipment.js';
	import { muscleShort } from '$lib/catalog/muscles.js';
	import { t } from '$lib/i18n/locale.svelte.js';
	import { emptyBlock, newItem } from '$lib/db/routines.js';
	import { moveAcross, type Slot } from '$lib/reorder.js';
	import type { Block, Exercise, Routine, RoutineItem, Target } from '$lib/types.js';

	let {
		routine = $bindable(),
		onsave,
		saving = false
	}: { routine: Routine; onsave: () => void; saving?: boolean } = $props();

	let pickingForBlock = $state<string | null>(null);
	let sheetFor = $state<string | null>(null);
	let tagsText = $state(routine.tags.join(', '));

	const canSave = $derived(routine.name.trim().length > 0);

	function addExercise(exercise: Exercise) {
		const block = routine.blocks.find((b) => b.id === pickingForBlock);
		if (block) block.items.push(newItem(exercise));
		pickingForBlock = null;
	}

	/**
	 * Dragged here as well as on the routine screen (§12), so a routine can be
	 * put in order while it is being built — before it has a screen to view.
	 *
	 * **Across sections since 2026-08-03.** In the editor this replaces the one
	 * edit the drag could not do at all: moving an exercise from Warm-up into
	 * Main previously meant removing it and adding it again, which lost its sets,
	 * its target, its rest and its notes. That is not reordering, it is retyping.
	 *
	 * Nothing is written here — a drop changes the staged routine and Save is
	 * still what commits it, so Cancel discards a drag exactly as it discards
	 * every other edit on this screen.
	 */
	function onreorder(from: Slot, to: Slot) {
		const moved = moveAcross(
			routine.blocks.map((b) => b.items),
			from,
			to
		);
		routine.blocks.forEach((block, i) => (block.items = moved[i]));
	}

	function exerciseName(item: RoutineItem): string {
		return getExercise(item.exerciseId)?.name ?? item.exerciseId;
	}

	function setTargetKind(item: RoutineItem, kind: Target['kind']) {
		switch (kind) {
			case 'reps':
				item.target = { kind, reps: 10 };
				break;
			case 'reps_range':
				item.target = { kind, min: 8, max: 12 };
				break;
			case 'duration':
				item.target = { kind, seconds: 30 };
				break;
			case 'amrap':
				item.target = { kind };
				break;
		}
	}

	function syncTags() {
		routine.tags = tagsText
			.split(',')
			.map((t) => t.trim())
			.filter(Boolean);
	}

	const fieldClass =
		'w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-base placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none';
	const numberClass =
		'w-20 rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-2 text-center text-base focus:border-zinc-500 focus:outline-none';
</script>

<div class="flex flex-col gap-6 pb-40">
	<div class="flex flex-col gap-3">
		<input bind:value={routine.name} placeholder={t.routine.namePlaceholder} class="{fieldClass} text-lg" />
		<input bind:value={routine.goal} placeholder={t.routine.goalPlaceholder} class={fieldClass} />
		<textarea
			bind:value={routine.description}
			placeholder={t.routine.descriptionPlaceholder}
			rows="2"
			class={fieldClass}
		></textarea>
		<input
			bind:value={tagsText}
			onblur={syncTags}
			placeholder={t.routine.tagsPlaceholder}
			class={fieldClass}
		/>
	</div>

	<SortableList
		sections={routine.blocks}
		{onreorder}
		describe={exerciseName}
		itemClass="rounded-xl border border-zinc-800 bg-zinc-900 p-3"
	>
		{#snippet section(block, blockIndex, list)}
			<section class="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-3">
				<div class="mb-3 flex items-center gap-2">
					<input
						bind:value={routine.blocks[blockIndex].label}
						placeholder={t.routine.sectionPlaceholder}
						class="flex-1 rounded-lg bg-transparent px-1 py-2 font-medium focus:bg-zinc-900 focus:outline-none"
					/>
					{#if routine.blocks.length > 1}
						<button
							onclick={() => routine.blocks.splice(blockIndex, 1)}
							class="min-h-11 rounded-lg px-3 text-sm text-zinc-500 hover:text-red-400"
						>
							{t.routine.removeSection}
						</button>
					{/if}
				</div>

				{#if block.items.length > 1}
					<label class="mb-3 flex min-h-11 items-center gap-2 px-1">
						<input
							type="checkbox"
							checked={block.mode === 'circuit'}
							onchange={(e) =>
								(routine.blocks[blockIndex].mode = e.currentTarget.checked ? 'circuit' : undefined)}
							class="h-5 w-5 rounded border-zinc-700 bg-zinc-950"
						/>
						<span class="text-sm text-zinc-400">{t.routine.circuitHint}</span>
					</label>
				{/if}

				{@render list()}

				<button
					onclick={() => (pickingForBlock = block.id)}
					class="mt-2 min-h-14 w-full rounded-xl border border-dashed border-zinc-700 py-3 text-sm text-zinc-300"
				>
					{t.routine.addExercise}
				</button>
			</section>
		{/snippet}

			{#snippet row(item, slot, grip)}
				{@const exercise = getExercise(item.exerciseId)}
				<div class="flex items-start gap-3">
					<!-- Opens over the editor rather than navigating to the catalog: leaving
						 this screen discards unsaved work (§12). -->
					<button
						onclick={() => (sheetFor = item.exerciseId)}
						class="flex min-w-0 flex-1 items-start gap-3 text-left"
					>
						{#if exercise}
							<img
								src="{base}{exercise.media[0].path}"
								alt=""
								class="h-14 w-18 shrink-0 rounded-lg bg-white object-cover"
							/>
						{/if}
						<span class="min-w-0 flex-1">
							<span class="block truncate font-medium">{exercise?.name ?? item.exerciseId}</span>
							<!-- Muscles in plain English while the routine is being built (§4.6). -->
							<span class="mt-0.5 block text-xs text-zinc-500">
								{exercise?.category}{exercise?.primaryMuscles.length
									? ' · ' +
										t.units.list(exercise.primaryMuscles.map((m) => muscleShort(m, t)))
									: ''}
							</span>
						</span>
					</button>
					{@render grip(slot)}
					<!-- Remove stays on the right whichever edge the handle takes (§12).
						 It used to share a wrapper with the handle, which would have
						 dragged it along to the left and put the destructive button under
						 the thumb that is there to reorder. `order-last` rather than a
						 later position in the markup, so tabbing still reaches the handle
						 before the button that deletes what it was about to move. -->
					<button
						onclick={() => routine.blocks[slot.section].items.splice(slot.index, 1)}
						aria-label={t.routine.removeExercise}
						class="order-last min-h-11 min-w-11 shrink-0 rounded-lg text-zinc-500 hover:text-red-400"
					>
						×
					</button>
				</div>

				<div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-3 text-sm">
					<label class="flex items-center gap-2">
						<span class="text-zinc-400">{t.routine.setsLabel}</span>
						<input type="number" min="1" bind:value={item.sets} class={numberClass} />
					</label>

					<label class="flex items-center gap-2">
						<span class="text-zinc-400">{t.routine.targetLabel}</span>
						<select
							value={item.target.kind}
							onchange={(e) => setTargetKind(item, e.currentTarget.value as Target['kind'])}
							class="rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-2 text-base focus:border-zinc-500 focus:outline-none"
						>
							<option value="reps">{t.routine.targetKinds.reps}</option>
							<option value="reps_range">{t.routine.targetKinds.reps_range}</option>
							<option value="duration">{t.routine.targetKinds.duration}</option>
							<option value="amrap">{t.routine.targetKinds.amrap}</option>
						</select>
					</label>

					{#if item.target.kind === 'reps'}
						<input type="number" min="1" bind:value={item.target.reps} class={numberClass} />
					{:else if item.target.kind === 'duration'}
						<input type="number" min="1" bind:value={item.target.seconds} class={numberClass} />
					{:else if item.target.kind === 'reps_range'}
						<span class="flex items-center gap-2">
							<input type="number" min="1" bind:value={item.target.min} class={numberClass} />
							<span class="text-zinc-500">{t.routine.rangeTo}</span>
							<input type="number" min="1" bind:value={item.target.max} class={numberClass} />
						</span>
					{/if}

					<label class="flex items-center gap-2">
						<span class="text-zinc-400">{t.routine.restLabelShort}</span>
						<input type="number" min="0" bind:value={item.restSeconds} class={numberClass} />
					</label>

					<label class="flex min-h-11 items-center gap-2">
						<input
							type="checkbox"
							bind:checked={item.perSide}
							class="h-5 w-5 rounded border-zinc-700 bg-zinc-950"
						/>
						<span class="text-zinc-400">{t.routine.perSideLabel}</span>
					</label>

					{#if exercise && isLoadable(exercise)}
						<!-- Only where the equipment has a mass (§4.5): the plan for the
							 weight, which the log can still differ from. -->
						<label class="flex items-center gap-2">
							<span class="text-zinc-400">{t.history.loadKg}</span>
							<input
								type="number"
								min="0"
								step="0.5"
								value={item.loadKg ?? ''}
								oninput={(e) => {
									const n = Number(e.currentTarget.value);
									item.loadKg = e.currentTarget.value === '' || n <= 0 ? undefined : n;
								}}
								placeholder="–"
								class={numberClass}
							/>
						</label>
					{/if}
				</div>

				<input
					bind:value={item.notes}
					placeholder={t.routine.notesPlaceholder}
					class="mt-2 w-full rounded-lg bg-zinc-950 px-3 py-2 text-sm placeholder:text-zinc-600 focus:outline-none"
				/>
			{/snippet}
	</SortableList>

	<button
		onclick={() => routine.blocks.push(emptyBlock())}
		class="min-h-14 rounded-xl border border-zinc-800 py-3 text-sm text-zinc-400"
	>
		{t.routine.addSection}
	</button>
</div>

<!-- Primary action in the bottom third, reachable one-handed (§12). Sits above the
	 tab bar rather than under it: see --dl-tabbar-height in app.css. -->
<div
	class="fixed inset-x-0 z-30 border-t border-zinc-800 bg-zinc-950/95 px-4 pt-3 pb-3 backdrop-blur"
	style="bottom: var(--dl-tabbar-height)"
>
	<div class="mx-auto max-w-2xl">
		<button
			onclick={onsave}
			disabled={!canSave || saving}
			class="min-h-14 w-full rounded-xl bg-zinc-100 py-4 text-base font-semibold text-zinc-900 disabled:bg-zinc-800 disabled:text-zinc-500"
		>
			{saving ? t.common.saving : t.routine.saveRoutine}
		</button>
		{#if !canSave}
			<p class="pt-2 text-center text-xs text-zinc-500">{t.routine.nameToSave}</p>
		{/if}
	</div>
</div>

{#if pickingForBlock}
	<CatalogPicker onpick={addExercise} onclose={() => (pickingForBlock = null)} />
{/if}

{#if sheetFor}
	<ExerciseSheet exerciseId={sheetFor} onclose={() => (sheetFor = null)} />
{/if}
