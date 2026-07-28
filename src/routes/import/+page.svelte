<script lang="ts">
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import CatalogPicker from '$lib/components/CatalogPicker.svelte';
	import { getExercise } from '$lib/catalog/index.js';
	import { describeItem } from '$lib/db/routines.js';
	import { ImportError, toRoutineItem, type ReviewItem, type ReviewModel } from '$lib/import/index.js';
	import { commitReview, itemCount, outstanding, reviewFromText } from '$lib/import/runner.svelte.js';
	import { LLM_PROMPT } from '$lib/import/prompt.js';
	import type { Exercise } from '$lib/types.js';

	let stage = $state<'input' | 'review'>('input');
	let pasted = $state('');
	let dragging = $state(false);
	let error = $state<{ message: string; detail?: string } | null>(null);
	let review = $state<ReviewModel | null>(null);
	let pickingFor = $state<ReviewItem | null>(null);
	let saving = $state(false);
	let copied = $state(false);

	async function copyPrompt() {
		try {
			await navigator.clipboard.writeText(LLM_PROMPT);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			// Clipboard blocked; the prompt is on screen to select by hand.
		}
	}

	const remaining = $derived(review ? outstanding(review) : 0);
	const keeping = $derived(review ? itemCount(review) : 0);

	async function load(text: string, filename?: string) {
		error = null;
		try {
			review = await reviewFromText(text, filename);
			stage = 'review';
		} catch (err) {
			if (err instanceof ImportError) error = { message: err.message, detail: err.detail };
			else error = { message: err instanceof Error ? err.message : String(err) };
		}
	}

	async function onFiles(files: FileList | null | undefined) {
		const file = files?.[0];
		if (!file) return;
		await load(await file.text(), file.name);
	}

	function choose(exercise: Exercise) {
		if (pickingFor) pickingFor.chosen = exercise.id;
		pickingFor = null;
	}

	function preview(item: ReviewItem): string {
		const exercise = item.chosen ? getExercise(item.chosen) : undefined;
		if (!exercise) return '';
		return describeItem(toRoutineItem(item.raw, exercise, 'preview', []));
	}

	async function save() {
		if (!review || remaining > 0) return;
		saving = true;
		try {
			const { routine } = await commitReview(review);
			await goto(`${base}/routines/${routine.id}/`, { replaceState: true });
		} finally {
			saving = false;
		}
	}

	function restart() {
		stage = 'input';
		review = null;
		pasted = '';
		error = null;
	}
</script>

<svelte:head>
	<title>Import a routine · Deadload</title>
</svelte:head>

<a href="{base}/" class="text-sm text-zinc-400">← Routines</a>
<h1 class="mt-2 mb-5 font-display text-2xl font-bold">Import a routine</h1>

{#if stage === 'input'}
	<div class="flex flex-col gap-5 pb-12">
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			ondragover={(e) => {
				e.preventDefault();
				dragging = true;
			}}
			ondragleave={() => (dragging = false)}
			ondrop={(e) => {
				e.preventDefault();
				dragging = false;
				onFiles(e.dataTransfer?.files);
			}}
			class="rounded-2xl border-2 border-dashed p-6 text-center transition-colors {dragging
				? 'border-zinc-400 bg-zinc-900'
				: 'border-zinc-800'}"
		>
			<p class="text-zinc-300">Drop a .json or .csv file here</p>
			<label
				class="mt-4 inline-block min-h-12 cursor-pointer rounded-xl bg-zinc-100 px-5 py-3 text-sm font-semibold text-zinc-900"
			>
				Choose a file
				<input
					type="file"
					accept=".json,.csv,application/json,text/csv"
					class="hidden"
					onchange={(e) => onFiles(e.currentTarget.files)}
				/>
			</label>
		</div>

		<div>
			<h2 class="mb-2 text-sm font-semibold tracking-wide text-zinc-400 uppercase">
				Or paste the text
			</h2>
			<textarea
				bind:value={pasted}
				rows="6"
				placeholder={'{ "name": "Morning mobility", "blocks": [ … ] }'}
				class="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-3 font-mono text-sm placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
			></textarea>
			<button
				onclick={() => load(pasted)}
				disabled={!pasted.trim()}
				class="mt-2 min-h-14 w-full rounded-xl bg-zinc-100 py-4 font-semibold text-zinc-900 disabled:bg-zinc-800 disabled:text-zinc-500"
			>
				Read it
			</button>
			<p class="mt-2 text-xs text-zinc-500">
				Markdown code fences around the JSON are fine, they get stripped.
			</p>
		</div>

		{#if error}
			<div class="rounded-xl border border-red-900 bg-red-950/40 p-4">
				<p class="font-medium text-red-200">{error.message}</p>
				{#if error.detail}
					<p class="mt-1 font-mono text-xs break-words text-red-300/80">{error.detail}</p>
				{/if}
			</div>
		{/if}

		<a
			href="{base}/presets/"
			class="rounded-xl border border-zinc-800 p-4 text-sm text-zinc-300 hover:border-zinc-600"
		>
			Or start from a built-in routine →
		</a>

		<!-- The prompt from SPEC §14, shipped in-app so a routine can be generated
			 without leaving the phone. -->
		<details class="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
			<summary class="cursor-pointer text-sm font-medium">Get a routine from an LLM</summary>
			<p class="mt-3 text-sm text-zinc-400">
				Copy the prompt below, attach the catalog file so it only uses exercises you have, and
				paste the answer back here.
			</p>
			<div class="mt-3 flex gap-2">
				<button
					onclick={copyPrompt}
					class="min-h-12 flex-1 rounded-xl bg-zinc-100 px-4 text-sm font-semibold text-zinc-900"
				>
					{copied ? 'Copied' : 'Copy prompt'}
				</button>
				<a
					href="{base}/catalog-for-llm.json"
					download="catalog-for-llm.json"
					class="flex min-h-12 flex-1 items-center justify-center rounded-xl border border-zinc-700 px-4 text-center text-sm"
				>
					Catalog file
				</a>
			</div>
			<pre
				class="mt-3 max-h-64 overflow-auto rounded-lg bg-zinc-950 p-3 font-mono text-xs whitespace-pre-wrap text-zinc-400">{LLM_PROMPT}</pre>
		</details>
	</div>
{:else if review}
	<div class="flex flex-col gap-5 pb-32">
		<input
			bind:value={review.name}
			class="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-lg focus:border-zinc-500 focus:outline-none"
		/>

		<p class="text-sm text-zinc-400">
			{keeping} exercise{keeping === 1 ? '' : 's'} ready.
			{#if remaining > 0}
				<span class="text-amber-300">{remaining} still need{remaining === 1 ? 's' : ''} a match.</span>
			{/if}
		</p>

		{#each review.notes as note, i (i)}
			<p class="rounded-lg bg-amber-950/40 px-3 py-2 text-xs text-amber-200">{note.message}</p>
		{/each}

		{#each review.blocks as block (block.key)}
			<section>
				{#if block.label || block.circuit}
					<h2 class="mb-2 text-sm font-semibold tracking-wide text-zinc-400 uppercase">
						{block.label || 'Circuit'}
						{#if block.circuit && block.label}
							<span class="ml-1 font-normal text-zinc-500 normal-case">· circuit</span>
						{/if}
					</h2>
				{/if}
				<ul class="flex flex-col gap-2">
					{#each block.items as item (item.key)}
						{@const exercise = item.chosen ? getExercise(item.chosen) : undefined}
						<li
							class="rounded-xl border bg-zinc-900 p-3 {item.dropped
								? 'border-zinc-800 opacity-40'
								: item.chosen
									? 'border-zinc-800'
									: 'border-amber-800/70'}"
						>
							<div class="flex items-start gap-3">
								{#if exercise}
									<img
										src="{base}{exercise.media[0].path}"
										alt=""
										class="h-14 w-18 shrink-0 rounded-lg bg-white object-cover"
									/>
								{/if}
								<div class="min-w-0 flex-1">
									{#if exercise}
										<div class="truncate font-medium">{exercise.name}</div>
										<div class="mt-0.5 text-sm text-zinc-400">{preview(item)}</div>
										{#if item.result.status !== 'resolved'}
											<div class="mt-0.5 text-xs text-zinc-500">matched from “{item.written}”</div>
										{/if}
									{:else}
										<div class="truncate font-medium text-amber-200">“{item.written}”</div>
										<div class="mt-0.5 text-xs text-zinc-400">
											{item.result.status === 'suggested'
												? 'Not an exact match. Pick one:'
												: 'Not in the catalog. Pick the closest, or drop it.'}
										</div>
									{/if}
								</div>
								{#if !item.dropped && item.chosen}
									<button
										onclick={() => (pickingFor = item)}
										class="min-h-11 shrink-0 rounded-lg px-3 text-xs text-zinc-400"
									>
										Change
									</button>
								{/if}
							</div>

							{#if !item.chosen && !item.dropped}
								<div class="mt-3 flex flex-col gap-2">
									{#each item.result.status === 'resolved' ? [] : item.result.candidates.slice(0, 3) as candidate (candidate.exerciseId)}
										{@const suggestion = getExercise(candidate.exerciseId)}
										{#if suggestion}
											<button
												onclick={() => (item.chosen = suggestion.id)}
												class="flex min-h-14 items-center gap-3 rounded-lg border border-zinc-700 p-2 text-left"
											>
												<img
													src="{base}{suggestion.media[0].path}"
													alt=""
													class="h-10 w-14 shrink-0 rounded bg-white object-cover"
												/>
												<span class="min-w-0 flex-1 truncate text-sm">{suggestion.name}</span>
												<span class="shrink-0 text-xs text-zinc-500">
													{Math.round(candidate.score * 100)}%
												</span>
											</button>
										{/if}
									{/each}
									<div class="flex gap-2">
										<button
											onclick={() => (pickingFor = item)}
											class="min-h-12 flex-1 rounded-lg border border-zinc-700 text-sm"
										>
											Search catalog
										</button>
										<button
											onclick={() => (item.dropped = true)}
											class="min-h-12 flex-1 rounded-lg border border-zinc-800 text-sm text-zinc-500"
										>
											Drop it
										</button>
									</div>
								</div>
							{:else if item.dropped}
								<button
									onclick={() => (item.dropped = false)}
									class="mt-2 min-h-11 text-xs text-zinc-400 underline"
								>
									Keep it after all
								</button>
							{:else if item.result.status !== 'resolved'}
								<label class="mt-2 flex min-h-11 items-center gap-2 text-xs text-zinc-400">
									<input
										type="checkbox"
										bind:checked={item.remember}
										class="h-4 w-4 rounded border-zinc-700 bg-zinc-950"
									/>
									Remember “{item.written}” means this
								</label>
							{/if}
						</li>
					{/each}
				</ul>
			</section>
		{/each}

		<button onclick={restart} class="min-h-12 text-sm text-zinc-500 underline">
			Start over with a different file
		</button>
	</div>

	<div
		class="fixed inset-x-0 bottom-0 border-t border-zinc-800 bg-zinc-950/95 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] backdrop-blur"
	>
		<div class="mx-auto max-w-2xl">
			<button
				onclick={save}
				disabled={remaining > 0 || keeping === 0 || saving}
				class="min-h-14 w-full rounded-xl bg-zinc-100 py-4 font-semibold text-zinc-900 disabled:bg-zinc-800 disabled:text-zinc-500"
			>
				{saving ? 'Saving…' : 'Save routine'}
			</button>
			{#if remaining > 0}
				<p class="pt-2 text-center text-xs text-zinc-500">
					Match or drop the {remaining} highlighted exercise{remaining === 1 ? '' : 's'} first.
				</p>
			{/if}
		</div>
	</div>
{/if}

{#if pickingFor}
	<CatalogPicker onpick={choose} onclose={() => (pickingFor = null)} />
{/if}
