<script lang="ts">
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { page } from '$app/state';
	import { onMount, onDestroy } from 'svelte';
	import { getExercise } from '$lib/catalog/index.js';
	import { describeTarget, getRoutine, putRoutine } from '$lib/db/routines.js';
	import { getSettings } from '$lib/db/settings.js';
	import { ownedEquipment } from '$lib/catalog/equipment.js';
	import { applyOffer, declineOffer, offersFor, type Offer } from '$lib/progress/index.js';
	import { getSession, listSessions, putSession } from '$lib/db/sessions.js';
	import { variantName } from '$lib/catalog/ladders.js';
	import { formatSetList, formatWhen, pickLastPerformance } from '$lib/session/last-time.js';
	import { formatKg, isLoadable } from '$lib/catalog/equipment.js';
	import { SessionPlayer } from '$lib/session/player.svelte.js';
	import { applySwaps, describeStep, itemOf, prefillFor } from '$lib/session/steps.js';
	import { finishedTotals } from '$lib/stats/compute.js';
	import NumberWheel from '$lib/components/NumberWheel.svelte';
	import { pushBackGuard } from '$lib/nav/back.js';
	import { t } from '$lib/i18n/locale.svelte.js';
	import type { Routine, Session } from '$lib/types.js';

	/** Frames alternate this slowly when "playing" — fast enough to read as one
	 *  movement, slow enough to study. */
	const PLAY_INTERVAL_MS = 1400;

	let player = $state<SessionPlayer | null>(null);
	let loaded = $state(false);
	let missing = $state(false);

	// Log control state, reset for each step.
	let value = $state(0);
	let loadKg = $state<number | undefined>(undefined);
	let rpe = $state<number | undefined>(undefined);
	let showRpe = $state(false);
	let showCues = $state(false);
	let frame = $state(0);
	let playing = $state(false);
	let confirmLeave = $state(false);
	let lastTapAt = 0;

	let history = $state<Session[]>([]);

	const step = $derived(player?.step);
	const exercise = $derived(step ? getExercise(step.exerciseId) : undefined);
	const timed = $derived(step?.target.kind === 'duration');
	// Whether a load in kilograms is a real measurement here (§4.5).
	const loadable = $derived(!!exercise && isLoadable(exercise));

	// The rungs either side of the current exercise, when it is on a ladder (§4.1).
	const easier = $derived(player?.easier);
	const harder = $derived(player?.harder);

	// Swaps made during this session, as names, for the finished screen.
	const swapped = $derived(
		Object.entries(player?.session.swaps ?? {})
			.map(([itemId, to]) => ({
				from: itemOf(player!.routine, itemId)?.exerciseId,
				to
			}))
			.filter((s) => s.from && s.from !== s.to)
	);
	let keptSwaps = $state(false);

	// How far through the whole session, for the bar under the top row.
	const progress = $derived(
		player && player.steps.length
			? Math.min(1, player.stepIndex / player.steps.length)
			: 0
	);
	const totals = $derived(player ? finishedTotals(player.session) : null);

	const lastTime = $derived(
		step && player
			? pickLastPerformance(history, step.exerciseId, {
					excludeSessionId: player.session.id,
					side: step.side
				})
			: undefined
	);

	onMount(async () => {
		const session = await getSession(page.params.sessionId!);
		if (!session) {
			missing = true;
			loaded = true;
			return;
		}
		const routine: Routine | undefined = await getRoutine(session.routineId);
		if (!routine) {
			missing = true;
			loaded = true;
			return;
		}
		player = new SessionPlayer(routine, session);
		resetControl();
		loaded = true;
		// Not awaited before first paint: the workout must not wait on history.
		void listSessions().then((all) => (history = all));

		// A resumed session is already under way: restart the clocks and re-arm
		// audio, which did not survive the app being closed.
		if (player.phase === 'working' || player.phase === 'resting' || player.phase === 'preview') {
			await player.resumeFromStored();
		}
	});

	// The system back gesture should behave like the on-screen Leave, not close
	// the app. Registered here so it only applies while a session is open.
	onMount(() =>
		pushBackGuard(() => {
			if (!player || player.phase === 'finished') return false;
			if (confirmLeave) return false; // second press goes through
			confirmLeave = true;
			return true;
		})
	);

	// Alternate the two frames while "playing".
	$effect(() => {
		if (!playing || !exercise || exercise.media.length < 2) return;
		const id = setInterval(
			() => (frame = (frame + 1) % exercise.media.length),
			PLAY_INTERVAL_MS
		);
		return () => clearInterval(id);
	});

	onDestroy(() => {
		void player?.suspend();
	});

	/** Single tap swaps once; double tap starts or stops the alternation. */
	function onImageTap() {
		const now = Date.now();
		if (now - lastTapAt < 300) {
			playing = !playing;
			lastTapAt = 0;
			return;
		}
		lastTapAt = now;
		if (!playing && exercise) frame = (frame + 1) % exercise.media.length;
	}

	// New step: refresh the prefilled log value and collapse the extras.
	$effect(() => {
		if (player?.stepIndex !== undefined) {
			resetControl();
		}
	});

	function resetControl() {
		const target = player?.step?.target;
		value = target ? (prefillFor(target) ?? 0) : 0;
		loadKg = player?.prefillLoadKg();
		rpe = undefined;
		showRpe = false;
		showCues = false;
		frame = 0;
		playing = false;
	}

	async function start() {
		await player?.start();
		resetControl();
	}

	async function logSet() {
		if (!player || !step) return;
		// Only for an exercise whose equipment has a mass (§4.5). A load on anything
		// else would be a number nobody weighed.
		const load = loadable ? loadKg : undefined;
		const payload = timed
			? { seconds: value, rpe, loadKg: load }
			: { reps: value, rpe, loadKg: load };
		await player.log(payload);
	}

	/** Real dumbbell and kettlebell increments, not a continuous dial. */
	const LOAD_STEP_KG = 2.5;

	function nudgeLoad(delta: number) {
		const next = (loadKg ?? 0) + delta;
		loadKg = next <= 0 ? undefined : Number(next.toFixed(2));
	}

	async function endEarly() {
		if (!player) return;
		await player.finish();
	}

	async function leave() {
		if (!player) return;
		await player.suspend();
		await goto(`${base}/`, { replaceState: true });
	}

	/**
	 * §17's progression suggestions, computed once the session is finished.
	 *
	 * Here and nowhere else (§17.3): the finished screen is the calm moment §15
	 * asks for, it is where the app already asks whether to keep a ladder swap,
	 * and it is after the work rather than during it. Mid-session this would be a
	 * decision taken while out of breath.
	 */
	let offers = $state<Offer[]>([]);
	let settled = $state<Record<string, string>>({});
	/**
	 * The routine as this screen's own writes have left it. `player.routine` is a
	 * readonly snapshot taken when the session started, so every write on this
	 * screen has to build on the previous one — otherwise taking one suggestion
	 * and then declining a second silently undoes the first, and keeping a ladder
	 * swap undoes both.
	 */
	let edited = $state<Routine | null>(null);
	const routineNow = $derived(edited ?? player?.routine ?? null);

	$effect(() => {
		if (player?.phase !== 'finished' || offers.length) return;
		void (async () => {
			const [all, saved] = await Promise.all([listSessions(), getSettings()]);
			// `all` already contains this session: finish() wrote it before the
			// phase flipped, so today counts towards its own criterion.
			offers = offersFor(player!.routine, all, ownedEquipment(saved));
		})();
	});

	/** Take an offer up. Nothing is written until this runs, and it runs from a tap. */
	async function takeOffer(offer: Offer) {
		if (!routineNow) return;
		const updated = applyOffer(routineNow, offer, (id) => getExercise(id)?.unilateral ?? false);
		await putRoutine(updated);
		edited = updated;
		settled[offer.itemId] =
			offer.kind === 'next_rung'
				? t.session.progress.appliedRung(variantName(offer.to), describeTarget(offer.target, t))
				: offer.kind === 'add_rep'
					? t.session.progress.appliedTarget(
							variantName(offer.exerciseId),
							describeTarget(offer.target, t)
						)
					: t.session.progress.dismissed;
	}

	/** Turn one down, and remember it for a fortnight so the app stops asking. */
	async function dismissOffer(offer: Offer) {
		if (!routineNow) return;
		const updated = declineOffer(routineNow, offer.itemId);
		await putRoutine(updated);
		edited = updated;
		settled[offer.itemId] = t.session.progress.dismissed;
	}

	/** Fold this session's swaps into the routine, so next time starts here. */
	async function keepSwaps() {
		if (!player || !routineNow) return;
		// Built on `routineNow`, not on the player's snapshot, so keeping a swap
		// does not roll back a progression suggestion taken a moment earlier.
		const updated = applySwaps(
			routineNow,
			player.session.swaps ?? {},
			(id) => getExercise(id)?.unilateral ?? false
		);
		await putRoutine(updated);
		edited = updated;
		keptSwaps = true;
	}

	function mmss(seconds: number): string {
		const m = Math.floor(Math.abs(seconds) / 60);
		const s = Math.abs(seconds) % 60;
		return `${m}:${String(s).padStart(2, '0')}`;
	}
</script>

<!-- Shared by the preview and the working screen: the same exercise, before and
	 during the set. One copy, so they cannot drift apart. -->
{#snippet topRow()}
	<!-- Sticky: the row keeps its own strip under the status bar instead of
		 sliding beneath it once the cues are open. -->
	<div
		class="sticky top-0 z-10 -mx-4 bg-zinc-950 px-4 pt-[max(env(safe-area-inset-top),0.5rem)] pb-2"
	>
		<div class="flex items-center justify-between">
			<button onclick={() => (confirmLeave = true)} class="text-sm text-zinc-400">{t.session.leave}</button>
			<span class="text-sm text-zinc-500 tabular-nums">
				{(player?.stepIndex ?? 0) + 1} / {player?.steps.length ?? 0}
			</span>
		</div>
		<!-- How far through the session, readable without counting. -->
		<div class="mt-2 h-1 w-full overflow-hidden rounded-full bg-zinc-800">
			<div class="h-full rounded-full bg-zinc-400" style="width: {progress * 100}%"></div>
		</div>
	</div>
{/snippet}

{#snippet photo()}
	{#if exercise}
	<!-- One frame large. Tap swaps, double tap plays: opt-in, per SPEC §7. The
		 height is capped so the countdown below it stays above the fold on a
		 short phone; the photo is still the widest thing on the screen. -->
	<div class="relative">
		<button
			onclick={onImageTap}
			class="block w-full"
			aria-label={t.exercise.swapPhoto}
		>
			<img
				src="{base}{exercise.media[frame].path}"
				alt={exercise.name}
				width={exercise.media[frame].width}
				height={exercise.media[frame].height}
				class="max-h-[30dvh] w-full rounded-2xl bg-white object-cover"
			/>
		</button>
		<!--
			The two overlays share **one row** rather than being pinned to opposite
			corners, which is what they used to be.

			Absolute bottom-left and bottom-right cannot both be right: the moment
			the two are wider than the photo they slide under each other, and the
			frame counter is the one that loses because it is drawn first. English
			already grazed it — `↑ Harder` touching `1/2 · double tap to play` at
			360 dp — and Danish, where the same hint is `dobbelttryk for at afspille`,
			overlapped it outright. Found in a screenshot, exactly as §3 says.

			As one flex row the two can never overlap: the ladder pills keep their
			width, and the counter, which is a hint rather than a control, is what
			gives way and truncates.

			Progression ladder (§4.1): one rung down or up the same movement, for the
			rest of this exercise. Over the photo because that height is already paid
			for — a row of its own would push the countdown back under the fold,
			which is the thing §7 just bought.
		-->
		<div class="pointer-events-none absolute inset-x-3 bottom-3 flex items-end gap-2">
			{#if easier || harder}
				<div class="pointer-events-auto flex shrink-0 gap-2">
					{#if easier}
						<button
							onclick={() => player?.swapTo(easier)}
							aria-label={t.session.easierTo(variantName(easier))}
							class="flex min-h-11 items-center rounded-full bg-zinc-950/80 px-3 text-xs whitespace-nowrap text-zinc-200"
						>
							{t.session.easier}
						</button>
					{/if}
					{#if harder}
						<button
							onclick={() => player?.swapTo(harder)}
							aria-label={t.session.harderTo(variantName(harder))}
							class="flex min-h-11 items-center rounded-full bg-zinc-950/80 px-3 text-xs whitespace-nowrap text-zinc-200"
						>
							{t.session.harder}
						</button>
					{/if}
				</div>
			{/if}
			{#if exercise.media.length > 1}
				<span
					class="ml-auto min-w-0 truncate rounded-full px-3 py-1 text-xs {playing
						? 'bg-zinc-100 font-medium text-zinc-900'
						: 'bg-zinc-950/80 text-zinc-200'}"
				>
					{playing ? t.exercise.playing : t.exercise.frameOf(frame + 1, exercise.media.length)}
				</span>
			{/if}
		</div>
	</div>
	{/if}
{/snippet}

{#snippet heading()}
	{#if step && exercise}
	<div>
		{#if step.blockLabel}
			<p class="text-xs tracking-wide text-zinc-500 uppercase">{step.blockLabel}</p>
		{/if}
		<h1 class="font-display text-2xl font-bold">{exercise.name}</h1>
		<p class="mt-1 font-display text-xl text-zinc-300">{describeStep(step, t)}</p>
		{#if lastTime}
			<!-- What you did for this exercise last time, side matched. The set
				 you are on now is emphasised. Loads read "12 × 10 kg, 11 × 10": the
				 unit once, and again only when the weight moved (§4.5). -->
			{@const formatted = formatSetList(lastTime.sets, t)}
			<p class="mt-2 text-sm text-zinc-500">
				{t.session.lastTime(formatWhen(lastTime.performedAt, t))}
				{#each lastTime.sets as entry, i (entry.setIndex + '-' + i)}<span
						class={entry.setIndex === step.setIndex ? 'font-semibold text-zinc-200' : ''}
						>{formatted[i]}</span
					>{#if i < lastTime.sets.length - 1}<span class="pr-1">,</span>{/if}{/each}
			</p>
		{/if}
	</div>
	{/if}
{/snippet}

<!--
	The item's note, rendered *after* the countdown rather than inside the heading.

	§7's amendment of 2026-07-29 put the countdown above the cues because the cues
	are read once and the countdown is glanced at throughout. A note is read once
	too, so it belongs on the same side of that line — and while it sat in the
	heading, a three-line note pushed the countdown behind the log sheet at
	360 × 808 and reproduced exactly the bug that amendment was written to fix. The
	baby presets (§9) have notes that long, which is how this surfaced.
-->
{#snippet notes()}
	{#if step?.notes}
		<p class="text-sm text-zinc-400">{step.notes}</p>
	{/if}
{/snippet}

<svelte:head>
	<title>{player?.session.routineName ?? t.session.fallbackTitle} · Deadload</title>
</svelte:head>

{#if !loaded}
	<p class="mt-8 text-zinc-500">{t.common.loading}</p>
{:else if missing || !player}
	<p class="mt-8 text-zinc-300">{t.session.gone}</p>
	<a href="{base}/" class="mt-4 inline-block text-sm text-zinc-400 underline">{t.common.backToRoutines}</a>
{:else if player.phase === 'ready'}
	<!-- The layout hands the player a bare screen (no header), so every phase
		 below pads itself clear of the status bar. -->
	<section
		class="flex min-h-[70dvh] flex-col justify-between pt-[max(env(safe-area-inset-top),1rem)]"
	>
		<div>
			<button onclick={leave} class="text-sm text-zinc-400">{t.session.leave}</button>
			<h1 class="mt-4 font-display text-3xl font-bold">{player.session.routineName}</h1>
			<p class="mt-2 text-zinc-400">
				{t.session.setsAcross(
					player.steps.length,
					player.routine.blocks.reduce((n, b) => n + b.items.length, 0)
				)}
			</p>
			<p class="mt-6 text-sm text-zinc-500">{t.session.stayAwake}</p>
		</div>
		<button
			onclick={start}
			class="mt-10 min-h-20 w-full rounded-2xl bg-zinc-100 py-6 font-display text-2xl font-bold text-zinc-900"
		>
			{t.session.start}
		</button>
	</section>
{:else if player.phase === 'finished'}
	<section class="flex flex-col gap-6 pt-[max(env(safe-area-inset-top),1rem)]">
		<div>
			<h1 class="font-display text-3xl font-bold">{t.session.finished}</h1>
			<p class="mt-2 text-zinc-400">{player.session.routineName}</p>
		</div>

		<!-- The numbers are the largest type in the app (§12), so the summary is
			 numbers rather than a sentence about them. -->
		{#if totals}
			<div class="grid grid-cols-3 rounded-2xl border border-zinc-800 bg-zinc-900 py-5">
				{#each [{ label: t.session.totals.sets, value: totals.sets }, { label: t.session.totals.exercises, value: totals.exercises }, { label: t.session.totals.minutes, value: totals.minutes }] as stat (stat.label)}
					<div class="border-zinc-800 text-center not-last:border-r">
						<div class="font-display text-4xl font-bold tabular-nums">{stat.value}</div>
						<div class="mt-1 text-xs tracking-wide text-zinc-500 uppercase">{stat.label}</div>
					</div>
				{/each}
			</div>
		{/if}
		{#if swapped.length}
			<!-- The swap was this session's; keeping it is a separate, deliberate
				 decision, made when nothing is urgent (§7). -->
			<div class="rounded-2xl border border-zinc-700 bg-zinc-900 p-5">
				<p class="font-medium">
					{swapped.length === 1 ? t.session.swappedOne : t.session.swappedMany(swapped.length)}
				</p>
				<ul class="mt-2 flex flex-col gap-1 text-sm text-zinc-400">
					{#each swapped as s (s.from)}
						<li>{variantName(s.from!)} → <span class="text-zinc-200">{variantName(s.to)}</span></li>
					{/each}
				</ul>
				{#if keptSwaps}
					<p class="mt-4 text-sm text-zinc-500">
						{t.session.keptIn(player.session.routineName)}
					</p>
				{:else}
					<button
						onclick={keepSwaps}
						class="mt-4 min-h-14 w-full rounded-xl border border-zinc-700 font-medium"
					>
						{t.session.keepIn(player.session.routineName)}
					</button>
					<p class="mt-2 text-xs text-zinc-500">
						{t.session.keepHint}
					</p>
				{/if}
			</div>
		{/if}

		{#if offers.length}
			<!-- §17's suggestions. At most two, never applied without a tap, and
				 worded within §17.5: what the app saw, not what it thinks your body
				 did. There is no "you have plateaued" and no estimated intensity here
				 because there is no evidence for either. -->
			<div class="rounded-2xl border border-zinc-700 bg-zinc-900 p-5">
				<p class="font-medium">{t.session.progress.title}</p>
				<ul class="mt-3 flex flex-col gap-4">
					{#each offers as offer (offer.itemId)}
						<li class="flex flex-col gap-2">
							<p class="text-sm text-zinc-400">
								{t.session.progress.clearedTwice(
									variantName(offer.exerciseId),
									describeTarget(offer.cleared, t)
								)}
							</p>
							{#if offer.kind === 'next_rung' && !settled[offer.itemId]}
								<!-- The pitch goes once the decision is made. `ladder_end` below
									 stays, because that one is a statement rather than a pitch. -->
								<p class="text-sm text-zinc-500">
									{t.session.progress.nextRungWhy(variantName(offer.to))}
								</p>
							{:else if offer.kind === 'ladder_end'}
								<p class="text-sm text-zinc-500">
									{t.session.progress.ladderEnd(variantName(offer.exerciseId))}
								</p>
							{/if}

							{#if settled[offer.itemId]}
								<p class="text-sm text-zinc-500">{settled[offer.itemId]}</p>
							{:else if offer.kind === 'ladder_end'}
								<!-- Nothing to apply, so the only button dismisses. It still takes
									 a tap: that is what stops the app writing to the routine on its
									 own just to remember it has spoken. -->
								<button
									onclick={() => dismissOffer(offer)}
									class="min-h-14 w-full rounded-xl border border-zinc-700 font-medium"
								>
									{t.session.progress.ok}
								</button>
							{:else}
								<button
									onclick={() => takeOffer(offer)}
									class="min-h-14 w-full rounded-xl border border-zinc-700 font-medium"
								>
									{offer.kind === 'next_rung'
										? t.session.progress.nextRung(variantName(offer.to))
										: t.session.progress.addRep(describeTarget(offer.target, t))}
								</button>
								<button
									onclick={() => dismissOffer(offer)}
									class="min-h-11 text-sm text-zinc-500"
								>
									{t.session.progress.notNow}
								</button>
							{/if}
						</li>
					{/each}
				</ul>
			</div>
		{/if}

		<textarea
			placeholder={t.session.notesPlaceholder}
			rows="3"
			onchange={(e) => player?.setNotes(e.currentTarget.value)}
			class="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
		></textarea>
		<a
			href="{base}/"
			class="min-h-14 rounded-xl bg-zinc-100 py-4 text-center font-semibold text-zinc-900"
		>
			{t.common.backToRoutines}
		</a>
	</section>
{:else if player.phase === 'preview' && step && exercise}
	<!-- Get ready (§7). No clock runs here: the set begins when the user says so,
		 which is what stops a timed hold starting while the phone is still saying
		 what the exercise is, or while they are still getting onto the floor. -->
	<section class="flex flex-col gap-4 pb-64">
		{@render topRow()}
		{@render photo()}
		{@render heading()}
		{@render notes()}

		{#if exercise.instructions.length}
			<details class="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
				<summary class="min-h-11 cursor-pointer text-sm text-zinc-300">{t.exercise.howToDoIt}</summary>
				<ol class="mt-2 flex list-decimal flex-col gap-2 pl-5 text-sm text-zinc-300">
					{#each exercise.instructions as line, i (i)}
						<li>{line}</li>
					{/each}
				</ol>
			</details>
		{/if}
	</section>

	<div
		class="fixed inset-x-0 bottom-0 border-t border-zinc-800 bg-zinc-950/95 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] backdrop-blur"
	>
		<div class="mx-auto flex max-w-2xl flex-col gap-3">
			<button
				onclick={() => player?.beginStep()}
				class="min-h-20 w-full rounded-2xl bg-zinc-100 py-5 font-display text-2xl font-bold text-zinc-900"
			>
				{timed ? t.session.startTimed(mmss(player.targetSeconds ?? 0)) : t.session.startSet}
			</button>
			{#if player.autoStartOn}
				<!-- Auto mode (§7). A screen about to act on its own has to say so, and
					 a ring says how long you have without being read. -->
				{#if player.autoStartPending && player.autoStartTotal > 0}
					{@const left = player.autoStartRemaining / player.autoStartTotal}
					<div class="flex items-center justify-center gap-2 text-xs text-zinc-500">
						<svg viewBox="0 0 36 36" class="h-5 w-5 -rotate-90" aria-hidden="true">
							<circle cx="18" cy="18" r="16" fill="none" stroke="currentColor" stroke-width="4" class="text-zinc-800" />
							<circle
								cx="18"
								cy="18"
								r="16"
								fill="none"
								stroke="currentColor"
								stroke-width="4"
								stroke-linecap="round"
								class="text-zinc-300"
								stroke-dasharray="100"
								stroke-dashoffset={100 - left * 100}
								pathLength="100"
							/>
						</svg>
						{t.session.startingOnItsOwn}
					</div>
				{:else}
					<p class="text-center text-xs text-zinc-500">{t.session.startsWhenReadingOver}</p>
				{/if}
			{/if}
			<div class="flex gap-2 text-xs leading-tight">
				<button
					onclick={() => player?.undo()}
					disabled={!player.canUndo}
					class="min-h-12 flex-1 rounded-lg border border-zinc-800 px-1 text-zinc-400 disabled:opacity-30"
				>
					{t.session.backASet}
				</button>
				<button
					onclick={() => player?.skip()}
					class="min-h-12 flex-1 rounded-lg border border-zinc-800 px-1 text-zinc-400"
				>
					{t.session.skipSet}
				</button>
				<button
					onclick={endEarly}
					class="min-h-12 flex-1 rounded-lg border border-zinc-800 px-1 text-zinc-400"
				>
					{t.session.end}
				</button>
			</div>
		</div>
	</div>
{:else if player.phase === 'resting'}
	<!-- Rest: the countdown is the largest thing on the screen (§12). -->
	<section
		class="flex min-h-[80dvh] flex-col items-center justify-center gap-8 pt-[env(safe-area-inset-top)]"
	>
		<p class="text-sm tracking-wide text-zinc-400 uppercase">{t.session.rest}</p>
		<p class="font-display text-8xl font-bold tabular-nums">{mmss(player.restRemaining)}</p>
		{#if step && exercise}
			<p class="text-center text-zinc-400">
				{t.session.next(exercise.name)}<br />
				<span class="text-sm text-zinc-500">{describeStep(step, t)}</span>
			</p>
		{/if}
		<div class="fixed inset-x-0 bottom-0 px-4 pb-[max(env(safe-area-inset-bottom),1rem)]">
			<div class="mx-auto flex max-w-2xl flex-col gap-3">
				<div class="flex gap-3">
					<button
						onclick={() => player?.adjustRest(-15)}
						class="min-h-16 flex-1 rounded-xl border border-zinc-700 text-lg"
					>
						{t.session.minusFifteen}
					</button>
					<button
						onclick={() => player?.adjustRest(15)}
						class="min-h-16 flex-1 rounded-xl border border-zinc-700 text-lg"
					>
						{t.session.plusFifteen}
					</button>
				</div>
				<button
					onclick={() => player?.endRest()}
					class="min-h-16 w-full rounded-xl bg-zinc-100 text-lg font-semibold text-zinc-900"
				>
					{t.session.skipRest}
				</button>
				<button
					onclick={() => player?.undo()}
					disabled={!player.canUndo}
					class="min-h-12 w-full rounded-lg border border-zinc-800 text-sm text-zinc-400 disabled:opacity-30"
				>
					{t.session.backASet}
				</button>
			</div>
		</div>
	</section>
{:else if step && exercise}
	<!-- The spacer has to clear the log sheet, RPE row open, or the cues below the
		 countdown end up under it with nothing left to scroll. -->
	<section class="flex flex-col gap-4 pb-96">
		{@render topRow()}

		{@render photo()}

		{@render heading()}

		{#if timed}
			<!-- Counts down to the target (§7), then keeps going as overtime so a
				 longer hold is still measured rather than clamped at zero. Above the
				 cues: the cues are read once, the countdown is glanced at constantly.
				 Tapping it pauses: the biggest thing on the screen is also the
				 easiest thing to hit when you are out of breath. -->
			{@const left = player.remaining ?? 0}
			<button onclick={() => player?.togglePause()} class="block w-full text-center">
				<p
					class="font-display text-7xl font-bold tabular-nums {player.paused
						? 'text-zinc-500'
						: left <= 0
							? 'text-zinc-100'
							: left <= 3
								? 'text-amber-300'
								: 'text-zinc-100'}"
				>
					{left < 0 ? `+${mmss(-left)}` : mmss(left)}
				</p>
				<p class="mt-1 text-xs {player.paused ? 'text-amber-300' : 'text-zinc-500'}">
					{player.paused
						? t.session.paused
						: left > 0
							? t.session.timeLeft
							: left === 0
								? t.session.timeUp
								: t.session.overTarget}
				</p>
			</button>
		{/if}

		{@render notes()}

		{#if exercise.instructions.length}
			<details bind:open={showCues} class="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
				<summary class="min-h-11 cursor-pointer text-sm text-zinc-300">{t.exercise.howToDoIt}</summary>
				<ol class="mt-2 flex list-decimal flex-col gap-2 pl-5 text-sm text-zinc-300">
					{#each exercise.instructions as line, i (i)}
						<li>{line}</li>
					{/each}
				</ol>
			</details>
		{/if}
	</section>

	<!-- Log control lives in the bottom third, one tap to accept the target. -->
	<div
		class="fixed inset-x-0 bottom-0 border-t border-zinc-800 bg-zinc-950/95 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] backdrop-blur"
	>
		<div class="mx-auto flex max-w-2xl flex-col gap-3">
			<div class="flex items-center gap-3">
				<button
					onclick={() => (value = Math.max(0, value - 1))}
					aria-label={t.session.oneFewer}
					class="min-h-16 min-w-16 shrink-0 rounded-xl border border-zinc-700 font-display text-2xl"
				>
					−
				</button>
				<div class="min-w-0 flex-1">
					<NumberWheel
						bind:value
						min={0}
						max={timed ? 300 : 60}
						label={timed ? t.session.seconds : t.session.reps}
					/>
				</div>
				<button
					onclick={() => (value += 1)}
					aria-label={t.session.oneMore}
					class="min-h-16 min-w-16 shrink-0 rounded-xl border border-zinc-700 font-display text-2xl"
				>
					+
				</button>
			</div>

			{#if loadable}
				<!-- Load in the same shape as the rep stepper, one row down (§4.5).
					 Steps of 2.5 kg because that is how dumbbells come, and the whole
					 row is absent for anything that is not held. -->
				<div class="flex items-center gap-3">
					<button
						onclick={() => nudgeLoad(-LOAD_STEP_KG)}
						disabled={loadKg === undefined}
						aria-label={t.session.lighter}
						class="min-h-14 min-w-14 shrink-0 rounded-xl border border-zinc-700 font-display text-xl disabled:opacity-30"
					>
						−
					</button>
					<div class="min-w-0 flex-1 text-center">
						<span class="font-display text-2xl tabular-nums">
							{loadKg === undefined ? t.session.noLoad : formatKg(loadKg, t)}
						</span>
					</div>
					<button
						onclick={() => nudgeLoad(LOAD_STEP_KG)}
						aria-label={t.session.heavier}
						class="min-h-14 min-w-14 shrink-0 rounded-xl border border-zinc-700 font-display text-xl"
					>
						+
					</button>
				</div>
			{/if}

			{#if showRpe}
				<div class="flex items-center gap-2">
					<span class="text-xs text-zinc-500">{t.session.rpe}</span>
					{#each [6, 7, 8, 9, 10] as n (n)}
						<button
							onclick={() => (rpe = rpe === n ? undefined : n)}
							class="min-h-11 flex-1 rounded-lg text-sm {rpe === n
								? 'bg-zinc-100 text-zinc-900'
								: 'border border-zinc-700 text-zinc-300'}"
						>
							{n}
						</button>
					{/each}
				</div>
			{/if}

			<button
				onclick={logSet}
				class="min-h-16 w-full rounded-xl bg-zinc-100 font-display text-xl font-bold text-zinc-900"
			>
				{t.session.logSet}
			</button>

			<!--
				Four labels across 360 dp, so the row sets its own type size rather than
				inheriting the body's: at `text-sm` even English wrapped "← Back a set"
				onto two lines, and Danish is longer again. `leading-tight` and a common
				minimum height mean a label that does wrap still leaves the four buttons
				the same size as each other.
			-->
			<div class="flex gap-2 text-xs leading-tight">
				<button
					onclick={() => player?.undo()}
					disabled={!player.canUndo}
					class="min-h-12 flex-1 rounded-lg border border-zinc-800 px-1 text-zinc-400 disabled:opacity-30"
				>
					{t.session.backASet}
				</button>
				<button
					onclick={() => (showRpe = !showRpe)}
					class="min-h-12 flex-1 rounded-lg border border-zinc-800 px-1 text-zinc-400"
				>
					{showRpe ? t.session.hideRpe : t.session.addRpe}
				</button>
				<button
					onclick={() => player?.skip()}
					class="min-h-12 flex-1 rounded-lg border border-zinc-800 px-1 text-zinc-400"
				>
					{t.session.skipSet}
				</button>
				<button
					onclick={endEarly}
					class="min-h-12 flex-1 rounded-lg border border-zinc-800 px-1 text-zinc-400"
				>
					{t.session.end}
				</button>
			</div>
		</div>
	</div>
{/if}

{#if confirmLeave}
	<div class="fixed inset-0 z-50 flex items-end bg-zinc-950/80 p-4">
		<div class="mx-auto w-full max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
			<p class="font-medium">{t.session.leaveQuestion}</p>
			<p class="mt-1 text-sm text-zinc-400">
				{t.session.leaveHint}
			</p>
			<div class="mt-4 flex gap-3">
				<button
					onclick={leave}
					class="min-h-14 flex-1 rounded-xl border border-zinc-700 font-medium"
				>
					{t.session.leaveConfirm}
				</button>
				<button
					onclick={() => (confirmLeave = false)}
					class="min-h-14 flex-1 rounded-xl bg-zinc-100 font-semibold text-zinc-900"
				>
					{t.session.keepGoing}
				</button>
			</div>
		</div>
	</div>
{/if}
