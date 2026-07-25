<script lang="ts">
	import { attributions, catalog } from '$lib/catalog/index.js';
</script>

<svelte:head>
	<title>About · Deadload</title>
</svelte:head>

<section class="flex flex-col gap-6 pt-4">
	<div>
		<h1 class="font-display text-3xl font-bold">About</h1>
		<p class="mt-2 text-zinc-400">
			Deadload is a local-first bodyweight training app. All data stays on this device. Named for
			the structural engineering term for a structure's own self-weight — in calisthenics the only
			load is you.
		</p>
	</div>

	<section>
		<h2 class="text-sm font-semibold tracking-wide text-zinc-400 uppercase">Exercise data</h2>
		<ul class="mt-2 flex flex-col gap-3">
			{#each attributions as a (a.id)}
				<li class="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm">
					<div class="font-medium">{a.source}</div>
					<div class="mt-1 text-zinc-400">
						License: {a.license === 'PD' ? 'Public domain' : a.license}
						{#if a.author}· by {a.author}{/if}
					</div>
					{#if a.sourceUrl}
						<a href={a.sourceUrl} class="mt-1 inline-block text-zinc-400 underline hover:text-zinc-200">
							{a.sourceUrl}
						</a>
					{/if}
					<div class="mt-1 text-zinc-500">
						{catalog.filter((e) => e.attributionId === a.id).length} exercises
					</div>
				</li>
			{/each}
		</ul>
	</section>

	<p class="text-xs text-zinc-500">
		Built-in routines, when they arrive, are general training content and not medical advice.
	</p>
</section>
