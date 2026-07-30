<script lang="ts">
	import { base } from '$app/paths';
	import CatalogPicker from './CatalogPicker.svelte';
	import ExerciseSheet from './ExerciseSheet.svelte';
	import SortableList from './SortableList.svelte';
	import { getExercise } from '$lib/catalog/index.js';
	import { isLoadable } from '$lib/catalog/equipment.js';
	import { muscleInfo } from '$lib/catalog/muscles.js';
	import { emptyBlock, newItem } from '$lib/db/routines.js';
	import { moveItem } from '$lib/reorder.js';
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
	 * Dragged here as well as on the routine screen (§12), so a routine can be put
	 * in order while it is being built — before it has a screen to view.
	 */
	function reorder(block: Block, from: number, to: number) {
		block.items = moveItem(block.items, from, to);
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
		<input bind:value={routine.name} placeholder="Routine name" class="{fieldClass} text-lg" />
		<input bind:value={routine.goal} placeholder="Goal, e.g. hip flexibility" class={fieldClass} />
		<textarea
			bind:value={routine.description}
			placeholder="Description (optional)"
			rows="2"
			class={fieldClass}
		></textarea>
		<input
			bind:value={tagsText}
			onblur={syncTags}
			placeholder="Tags, comma separated"
			class={fieldClass}
		/>
	</div>

	{#each routine.blocks as block, blockIndex (block.id)}
		<section class="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-3">
			<div class="mb-3 flex items-center gap-2">
				<input
					bind:value={block.label}
					placeholder="Section name, e.g. Warm-up"
					class="flex-1 rounded-lg bg-transparent px-1 py-2 font-medium focus:bg-zinc-900 focus:outline-none"
				/>
				{#if routine.blocks.length > 1}
					<button
						onclick={() => routine.blocks.splice(blockIndex, 1)}
						class="min-h-11 rounded-lg px-3 text-sm text-zinc-500 hover:text-red-400"
					>
						Remove
					</button>
				{/if}
			</div>

			{#if block.items.length > 1}
				<label class="mb-3 flex min-h-11 items-center gap-2 px-1">
					<input
						type="checkbox"
						checked={block.mode === 'circuit'}
						onchange={(e) => (block.mode = e.currentTarget.checked ? 'circuit' : undefined)}
						class="h-5 w-5 rounded border-zinc-700 bg-zinc-950"
					/>
					<span class="text-sm text-zinc-400">
						Circuit — one set of each exercise, then the next round
					</span>
				</label>
			{/if}

			<SortableList
				items={block.items}
				onreorder={(from, to) => reorder(block, from, to)}
				describe={exerciseName}
				itemClass="rounded-xl border border-zinc-800 bg-zinc-900 p-3"
			>
				{#snippet row(item, itemIndex, grip)}
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
											exercise.primaryMuscles.map((m) => muscleInfo(m)?.short ?? m).join(', ')
										: ''}
								</span>
							</span>
						</button>
						<div class="flex shrink-0 items-center gap-1">
							{@render grip(itemIndex)}
							<button
								onclick={() => block.items.splice(itemIndex, 1)}
								aria-label="Remove exercise"
								class="min-h-11 min-w-11 rounded-lg text-zinc-500 hover:text-red-400"
							>
								×
							</button>
						</div>
					</div>

					<div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-3 text-sm">
						<label class="flex items-center gap-2">
							<span class="text-zinc-400">Sets</span>
							<input type="number" min="1" bind:value={item.sets} class={numberClass} />
						</label>

						<label class="flex items-center gap-2">
							<span class="text-zinc-400">Target</span>
							<select
								value={item.target.kind}
								onchange={(e) => setTargetKind(item, e.currentTarget.value as Target['kind'])}
								class="rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-2 text-base focus:border-zinc-500 focus:outline-none"
							>
								<option value="reps">reps</option>
								<option value="reps_range">rep range</option>
								<option value="duration">seconds</option>
								<option value="amrap">as many as possible</option>
							</select>
						</label>

						{#if item.target.kind === 'reps'}
							<input type="number" min="1" bind:value={item.target.reps} class={numberClass} />
						{:else if item.target.kind === 'duration'}
							<input type="number" min="1" bind:value={item.target.seconds} class={numberClass} />
						{:else if item.target.kind === 'reps_range'}
							<span class="flex items-center gap-2">
								<input type="number" min="1" bind:value={item.target.min} class={numberClass} />
								<span class="text-zinc-500">to</span>
								<input type="number" min="1" bind:value={item.target.max} class={numberClass} />
							</span>
						{/if}

						<label class="flex items-center gap-2">
							<span class="text-zinc-400">Rest s</span>
							<input type="number" min="0" bind:value={item.restSeconds} class={numberClass} />
						</label>

						<label class="flex min-h-11 items-center gap-2">
							<input
								type="checkbox"
								bind:checked={item.perSide}
								class="h-5 w-5 rounded border-zinc-700 bg-zinc-950"
							/>
							<span class="text-zinc-400">Per side</span>
						</label>

						{#if exercise && isLoadable(exercise)}
							<!-- Only where the equipment has a mass (§4.5): the plan for the
								 weight, which the log can still differ from. -->
							<label class="flex items-center gap-2">
								<span class="text-zinc-400">Load kg</span>
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
						placeholder="Notes (optional)"
						class="mt-2 w-full rounded-lg bg-zinc-950 px-3 py-2 text-sm placeholder:text-zinc-600 focus:outline-none"
					/>
				{/snippet}
			</SortableList>

			<button
				onclick={() => (pickingForBlock = block.id)}
				class="mt-2 min-h-14 w-full rounded-xl border border-dashed border-zinc-700 py-3 text-sm text-zinc-300"
			>
				Add exercise
			</button>
		</section>
	{/each}

	<button
		onclick={() => routine.blocks.push(emptyBlock())}
		class="min-h-14 rounded-xl border border-zinc-800 py-3 text-sm text-zinc-400"
	>
		Add section
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
			{saving ? 'Saving…' : 'Save routine'}
		</button>
		{#if !canSave}
			<p class="pt-2 text-center text-xs text-zinc-500">Give the routine a name to save it.</p>
		{/if}
	</div>
</div>

{#if pickingForBlock}
	<CatalogPicker onpick={addExercise} onclose={() => (pickingForBlock = null)} />
{/if}

{#if sheetFor}
	<ExerciseSheet exerciseId={sheetFor} onclose={() => (sheetFor = null)} />
{/if}
