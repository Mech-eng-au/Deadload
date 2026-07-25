<script lang="ts">
	import { base } from '$app/paths';

	let { data } = $props();
	const e = $derived(data.exercise);
</script>

<svelte:head>
	<title>{e.name} · Deadload</title>
</svelte:head>

<article class="flex flex-col gap-6">
	<div>
		<a href="{base}/catalog/" class="text-sm text-zinc-400 hover:text-zinc-100">← Catalog</a>
		<h1 class="mt-2 font-display text-3xl font-bold">{e.name}</h1>
		<div class="mt-2 flex flex-wrap gap-2 text-xs">
			<span class="rounded-full bg-zinc-800 px-3 py-1">{e.category}</span>
			<span class="rounded-full bg-zinc-800 px-3 py-1">{e.level}</span>
			<span class="rounded-full bg-zinc-800 px-3 py-1">
				{e.defaultMetric === 'duration' ? 'timed' : 'reps'}
			</span>
			{#if e.unilateral}
				<span class="rounded-full bg-zinc-800 px-3 py-1">per side</span>
			{/if}
		</div>
	</div>

	<div class="grid gap-3 sm:grid-cols-2">
		{#each e.media as m (m.path)}
			<figure>
				<img
					src="{base}{m.path}"
					alt="{e.name}{m.caption ? ` — ${m.caption}` : ''}"
					width={m.width}
					height={m.height}
					class="w-full rounded-2xl bg-white"
				/>
				{#if m.caption}
					<figcaption class="mt-1 text-center text-xs text-zinc-500">{m.caption}</figcaption>
				{/if}
			</figure>
		{/each}
	</div>

	<section>
		<h2 class="text-sm font-semibold tracking-wide text-zinc-400 uppercase">Muscles</h2>
		<p class="mt-1 text-zinc-200">
			{e.primaryMuscles.join(', ')}
			{#if e.secondaryMuscles.length}
				<span class="text-zinc-500"> · also {e.secondaryMuscles.join(', ')}</span>
			{/if}
		</p>
	</section>

	{#if e.instructions.length}
		<section>
			<h2 class="text-sm font-semibold tracking-wide text-zinc-400 uppercase">How to do it</h2>
			<ol class="mt-2 flex list-decimal flex-col gap-2 pl-5 text-zinc-200">
				{#each e.instructions as step, i (i)}
					<li>{step}</li>
				{/each}
			</ol>
		</section>
	{/if}

	{#if data.attribution}
		<p class="border-t border-zinc-800 pt-4 text-xs text-zinc-500">
			Source: {data.attribution.source} ({data.attribution.license})
			{#if data.attribution.sourceUrl}
				· <a href={data.attribution.sourceUrl} class="underline hover:text-zinc-300">origin</a>
			{/if}
		</p>
	{/if}
</article>
