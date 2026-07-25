<script lang="ts">
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import { listSessions } from '$lib/db/sessions.js';
	import { summarize, type SessionSummary } from '$lib/stats/compute.js';
	import type { Session } from '$lib/types.js';

	let sessions = $state<Session[]>([]);
	let loaded = $state(false);

	const rows = $derived(summarize(sessions));

	onMount(async () => {
		sessions = await listSessions();
		loaded = true;
	});

	/** Group by month so a long history stays navigable. */
	const months = $derived(
		rows.reduce<{ label: string; rows: SessionSummary[] }[]>((acc, row) => {
			const label = new Date(row.startedAt).toLocaleDateString(undefined, {
				month: 'long',
				year: 'numeric'
			});
			const last = acc[acc.length - 1];
			if (last?.label === label) last.rows.push(row);
			else acc.push({ label, rows: [row] });
			return acc;
		}, [])
	);

	function when(iso: string): string {
		return new Date(iso).toLocaleDateString(undefined, {
			weekday: 'short',
			day: 'numeric',
			month: 'short'
		});
	}
</script>

<svelte:head>
	<title>History · Deadload</title>
</svelte:head>

<a href="{base}/stats/" class="text-sm text-zinc-400">← Statistics</a>
<h1 class="mt-2 mb-5 font-display text-3xl font-bold">History</h1>

{#if !loaded}
	<p class="text-zinc-500">Loading…</p>
{:else if rows.length === 0}
	<div class="rounded-2xl border border-dashed border-zinc-800 p-8 text-center">
		<p class="text-zinc-300">No sessions yet.</p>
		<p class="mt-1 text-sm text-zinc-500">Every set you log will be listed here.</p>
	</div>
{:else}
	<div class="flex flex-col gap-6 pb-12">
		{#each months as month (month.label)}
			<section>
				<h2 class="mb-2 text-sm font-semibold tracking-wide text-zinc-400 uppercase">
					{month.label}
				</h2>
				<ul class="flex flex-col gap-2">
					{#each month.rows as row (row.id)}
						<li>
							<a
								href="{base}/history/{row.id}/"
								class="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-3"
							>
								<span class="min-w-0">
									<span class="block truncate font-medium">{row.routineName}</span>
									<span class="mt-0.5 block text-xs text-zinc-500">
										{when(row.startedAt)}
										{#if row.minutes}· {row.minutes} min{/if}
										{#if !row.finished}· <span class="text-amber-300">unfinished</span>{/if}
									</span>
								</span>
								<span class="shrink-0 text-right">
									<span class="block font-display text-lg font-bold tabular-nums">{row.sets}</span>
									<span class="block text-[10px] text-zinc-500">sets</span>
								</span>
							</a>
						</li>
					{/each}
				</ul>
			</section>
		{/each}
	</div>
{/if}
