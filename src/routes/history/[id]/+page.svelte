<script lang="ts">
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { getExercise } from '$lib/catalog/index.js';
	import { deleteSession, getSession } from '$lib/db/sessions.js';
	import type { Session, SetEntry } from '$lib/types.js';

	let session = $state<Session | null>(null);
	let loaded = $state(false);
	let confirmingDelete = $state(false);

	onMount(async () => {
		session = (await getSession(page.params.id!)) ?? null;
		loaded = true;
	});

	/** Consecutive entries for the same exercise read as one block of work. */
	const grouped = $derived(
		(session?.entries ?? []).reduce<{ exerciseId: string; entries: SetEntry[] }[]>((acc, entry) => {
			const last = acc[acc.length - 1];
			if (last?.exerciseId === entry.exerciseId) last.entries.push(entry);
			else acc.push({ exerciseId: entry.exerciseId, entries: [entry] });
			return acc;
		}, [])
	);

	const minutes = $derived(
		session?.endedAt
			? Math.max(1, Math.round((Date.parse(session.endedAt) - Date.parse(session.startedAt)) / 60000))
			: undefined
	);

	function describe(entry: SetEntry): string {
		if (entry.skipped) return 'skipped';
		const parts: string[] = [];
		if (entry.reps !== undefined) parts.push(`${entry.reps} reps`);
		if (entry.seconds !== undefined) parts.push(`${entry.seconds} s`);
		if (entry.side) parts.push(entry.side);
		if (entry.rpe !== undefined) parts.push(`RPE ${entry.rpe}`);
		return parts.join(' · ') || '—';
	}

	async function remove() {
		if (!session) return;
		await deleteSession(session.id);
		await goto(`${base}/history/`, { replaceState: true });
	}
</script>

<svelte:head>
	<title>{session?.routineName ?? 'Session'} · Deadload</title>
</svelte:head>

<a href="{base}/history/" class="text-sm text-zinc-400">← History</a>

{#if !loaded}
	<p class="mt-8 text-zinc-500">Loading…</p>
{:else if !session}
	<p class="mt-8 text-zinc-300">That session is no longer here.</p>
{:else}
	<article class="mt-2 flex flex-col gap-6 pb-12">
		<header>
			<h1 class="font-display text-2xl font-bold">{session.routineName}</h1>
			<p class="mt-1 text-sm text-zinc-400">
				{new Date(session.startedAt).toLocaleString(undefined, {
					weekday: 'long',
					day: 'numeric',
					month: 'long',
					hour: '2-digit',
					minute: '2-digit'
				})}
				{#if minutes}· {minutes} min{/if}
			</p>
			{#if !session.endedAt}
				<p class="mt-2 text-sm text-amber-300">This session was never finished.</p>
			{/if}
			{#if session.notes}
				<p class="mt-3 rounded-lg bg-zinc-900 p-3 text-sm text-zinc-300">{session.notes}</p>
			{/if}
		</header>

		{#each grouped as group, i (group.exerciseId + i)}
			{@const exercise = getExercise(group.exerciseId)}
			<section class="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
				<div class="flex items-center gap-3">
					{#if exercise}
						<img
							src="{base}{exercise.media[0].path}"
							alt=""
							loading="lazy"
							class="h-12 w-16 shrink-0 rounded bg-white object-cover"
						/>
					{/if}
					<h2 class="min-w-0 flex-1 truncate font-medium">
						{exercise?.name ?? group.exerciseId}
					</h2>
				</div>
				<ol class="mt-3 flex flex-col gap-1 text-sm">
					{#each group.entries as entry, n (n)}
						<li class="flex justify-between {entry.skipped ? 'text-zinc-600' : 'text-zinc-300'}">
							<span class="text-zinc-500">Set {entry.setIndex + 1}</span>
							<span class="tabular-nums">{describe(entry)}</span>
						</li>
					{/each}
				</ol>
			</section>
		{/each}

		{#if grouped.length === 0}
			<p class="text-zinc-500">Nothing was logged in this session.</p>
		{/if}

		<div class="border-t border-zinc-800 pt-6">
			{#if confirmingDelete}
				<div class="flex gap-3">
					<button
						onclick={remove}
						class="min-h-14 flex-1 rounded-xl bg-red-900/70 py-4 font-medium text-red-50"
					>
						Delete for good
					</button>
					<button
						onclick={() => (confirmingDelete = false)}
						class="min-h-14 flex-1 rounded-xl border border-zinc-700 py-4"
					>
						Keep it
					</button>
				</div>
			{:else}
				<button
					onclick={() => (confirmingDelete = true)}
					class="min-h-14 w-full rounded-xl border border-zinc-800 py-4 text-zinc-400"
				>
					Delete this session
				</button>
			{/if}
			<p class="mt-2 text-xs text-zinc-600">
				Deleting removes it from the statistics too.
			</p>
		</div>
	</article>
{/if}
