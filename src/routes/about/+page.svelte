<script lang="ts">
	import { attributions, catalog } from '$lib/catalog/index.js';
	import { t } from '$lib/i18n/locale.svelte.js';
</script>

<svelte:head>
	<title>{t.about.title} · Deadload</title>
</svelte:head>

<section class="flex flex-col gap-6 pt-4">
	<div>
		<h1 class="font-display text-3xl font-bold">{t.about.title}</h1>
		<p class="mt-2 text-zinc-400">
			{t.about.blurb}
		</p>
	</div>

	<section>
		<h2 class="text-sm font-semibold tracking-wide text-zinc-400 uppercase">
			{t.about.sources}
		</h2>
		<ul class="mt-2 flex flex-col gap-3">
			{#each attributions as a (a.id)}
				<li class="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm">
					<div class="font-medium">{a.source}</div>
					<div class="mt-1 text-zinc-400">
						{t.about.license(a.license === 'PD' ? t.about.publicDomain : a.license)}
						{#if a.author}{t.about.by(a.author)}{/if}
					</div>
					{#if a.sourceUrl}
						<a href={a.sourceUrl} class="mt-1 inline-block text-zinc-400 underline hover:text-zinc-200">
							{a.sourceUrl}
						</a>
					{/if}
					<div class="mt-1 text-zinc-500">
						{#if a.covers}
							{a.covers}
						{:else}
							{t.about.exerciseCount(catalog.filter((e) => e.attributionId === a.id).length)}
						{/if}
					</div>
					{#if a.license.startsWith('CC-BY-SA')}
						<!-- Share-alike is a condition, not just a credit, so it is stated
							 rather than implied by the licence code. -->
						<div class="mt-1 text-xs text-zinc-600">
							{t.about.shareAlike}
						</div>
					{/if}
				</li>
			{/each}
		</ul>
	</section>

	<p class="text-xs text-zinc-500">
		{t.about.notMedicalAdvice}
	</p>
</section>
