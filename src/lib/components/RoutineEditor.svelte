<script lang="ts">
	import { base } from '$app/paths';
	import CatalogPicker from './CatalogPicker.svelte';
	import { getExercise } from '$lib/catalog/index.js';
	import { emptyBlock, newItem } from '$lib/db/routines.js';
	import type { Exercise, Routine, RoutineItem, Target } from '$lib/types.js';

	let {
		routine = $bindable(),
		onsave,
		saving = false
	}: { routine: Routine; onsave: () => void; saving?: boolean } = $props();

	let pickingForBlock = $state<string | null>(null);
	let tagsText = $state(routine.tags.join(', '));

	const canSave = $derived(routine.name.trim().length > 0);

	function addExercise(exercise: Exercise) {
		const block = routine.blocks.find((b) => b.id === pickingForBlock);
		if (block) block.items.push(newItem(exercise));
		pickingForBlock = null;
	}

	function move(items: RoutineItem[], index: number, by: number) {
		const to = index + by;
		if (to < 0 || to >= items.length) return;
		[items[index], items[to]] = [items[to], items[index]];
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

<div class="flex flex-col gap-6 pb-32">
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

			<ul class="flex flex-col gap-2">
				{#each block.items as item, itemIndex (item.id)}
					{@const exercise = getExercise(item.exerciseId)}
					<li class="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
						<div class="flex items-start gap-3">
							{#if exercise}
								<img
									src="{base}{exercise.media[0].path}"
									alt=""
									class="h-14 w-18 shrink-0 rounded-lg bg-white object-cover"
								/>
							{/if}
							<div class="min-w-0 flex-1">
								<div class="truncate font-medium">{exercise?.name ?? item.exerciseId}</div>
								<div class="mt-0.5 text-xs text-zinc-500">{exercise?.category}</div>
							</div>
							<div class="flex shrink-0 gap-1">
								<button
									onclick={() => move(block.items, itemIndex, -1)}
									disabled={itemIndex === 0}
									aria-label="Move up"
									class="min-h-11 min-w-11 rounded-lg text-zinc-400 disabled:opacity-25"
								>
									↑
								</button>
								<button
									onclick={() => move(block.items, itemIndex, 1)}
									disabled={itemIndex === block.items.length - 1}
									aria-label="Move down"
									class="min-h-11 min-w-11 rounded-lg text-zinc-400 disabled:opacity-25"
								>
									↓
								</button>
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
						</div>

						<input
							bind:value={item.notes}
							placeholder="Notes (optional)"
							class="mt-2 w-full rounded-lg bg-zinc-950 px-3 py-2 text-sm placeholder:text-zinc-600 focus:outline-none"
						/>
					</li>
				{/each}
			</ul>

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

<!-- Primary action in the bottom third, reachable one-handed (§12). -->
<div
	class="fixed inset-x-0 bottom-0 border-t border-zinc-800 bg-zinc-950/95 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] backdrop-blur"
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
