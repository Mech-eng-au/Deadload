<script lang="ts">
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { page } from '$app/state';
	import { onMount, onDestroy } from 'svelte';
	import { getExercise } from '$lib/catalog/index.js';
	import { getRoutine } from '$lib/db/routines.js';
	import { getSession, listSessions, putSession } from '$lib/db/sessions.js';
	import { formatSet, formatWhen, pickLastPerformance } from '$lib/session/last-time.js';
	import { SessionPlayer } from '$lib/session/player.svelte.js';
	import { describeStep, prefillFor } from '$lib/session/steps.js';
	import NumberWheel from '$lib/components/NumberWheel.svelte';
	import { pushBackGuard } from '$lib/nav/back.js';
	import type { Routine, Session } from '$lib/types.js';

	/** Frames alternate this slowly when "playing" — fast enough to read as one
	 *  movement, slow enough to study. */
	const PLAY_INTERVAL_MS = 1400;

	let player = $state<SessionPlayer | null>(null);
	let loaded = $state(false);
	let missing = $state(false);

	// Log control state, reset for each step.
	let value = $state(0);
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
		if (player.phase === 'working' || player.phase === 'resting') {
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
		const payload = timed ? { seconds: value, rpe } : { reps: value, rpe };
		await player.log(payload);
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

	function mmss(seconds: number): string {
		const m = Math.floor(Math.abs(seconds) / 60);
		const s = Math.abs(seconds) % 60;
		return `${m}:${String(s).padStart(2, '0')}`;
	}
</script>

<svelte:head>
	<title>{player?.session.routineName ?? 'Session'} · Deadload</title>
</svelte:head>

{#if !loaded}
	<p class="mt-8 text-zinc-500">Loading…</p>
{:else if missing || !player}
	<p class="mt-8 text-zinc-300">That session is no longer here.</p>
	<a href="{base}/" class="mt-4 inline-block text-sm text-zinc-400 underline">Back to routines</a>
{:else if player.phase === 'ready'}
	<section class="flex min-h-[70dvh] flex-col justify-between">
		<div>
			<button onclick={leave} class="text-sm text-zinc-400">← Leave</button>
			<h1 class="mt-4 font-display text-3xl font-bold">{player.session.routineName}</h1>
			<p class="mt-2 text-zinc-400">
				{player.steps.length} sets across {player.routine.blocks.reduce(
					(n, b) => n + b.items.length,
					0
				)} exercises.
			</p>
			<p class="mt-6 text-sm text-zinc-500">
				The screen stays awake for the whole session, and the rest timer beeps. Press start with the
				volume up.
			</p>
		</div>
		<button
			onclick={start}
			class="mt-10 min-h-20 w-full rounded-2xl bg-zinc-100 py-6 font-display text-2xl font-bold text-zinc-900"
		>
			Start
		</button>
	</section>
{:else if player.phase === 'finished'}
	<section class="flex flex-col gap-6 pt-4">
		<div>
			<h1 class="font-display text-3xl font-bold">Done.</h1>
			<p class="mt-2 text-zinc-400">
				{player.done} set{player.done === 1 ? '' : 's'} logged for {player.session.routineName}.
			</p>
		</div>
		<textarea
			placeholder="Session notes (optional)"
			rows="3"
			onchange={(e) => player?.setNotes(e.currentTarget.value)}
			class="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
		></textarea>
		<a
			href="{base}/"
			class="min-h-14 rounded-xl bg-zinc-100 py-4 text-center font-semibold text-zinc-900"
		>
			Back to routines
		</a>
	</section>
{:else if player.phase === 'resting'}
	<!-- Rest: the countdown is the largest thing on the screen (§12). -->
	<section class="flex min-h-[80dvh] flex-col items-center justify-center gap-8">
		<p class="text-sm tracking-wide text-zinc-400 uppercase">Rest</p>
		<p class="font-display text-8xl font-bold tabular-nums">{mmss(player.restRemaining)}</p>
		{#if step && exercise}
			<p class="text-center text-zinc-400">
				Next: {exercise.name}<br />
				<span class="text-sm text-zinc-500">{describeStep(step)}</span>
			</p>
		{/if}
		<div class="fixed inset-x-0 bottom-0 px-4 pb-[max(env(safe-area-inset-bottom),1rem)]">
			<div class="mx-auto flex max-w-2xl flex-col gap-3">
				<div class="flex gap-3">
					<button
						onclick={() => player?.adjustRest(-15)}
						class="min-h-16 flex-1 rounded-xl border border-zinc-700 text-lg"
					>
						−15 s
					</button>
					<button
						onclick={() => player?.adjustRest(15)}
						class="min-h-16 flex-1 rounded-xl border border-zinc-700 text-lg"
					>
						+15 s
					</button>
				</div>
				<button
					onclick={() => player?.endRest()}
					class="min-h-16 w-full rounded-xl bg-zinc-100 text-lg font-semibold text-zinc-900"
				>
					Skip rest
				</button>
				<button
					onclick={() => player?.undo()}
					disabled={!player.canUndo}
					class="min-h-12 w-full rounded-lg border border-zinc-800 text-sm text-zinc-400 disabled:opacity-30"
				>
					← Back a set
				</button>
			</div>
		</div>
	</section>
{:else if step && exercise}
	<section class="flex flex-col gap-4 pb-64">
		<div class="flex items-center justify-between">
			<button onclick={() => (confirmLeave = true)} class="text-sm text-zinc-400">← Leave</button>
			<span class="text-sm text-zinc-500 tabular-nums">
				{player.stepIndex + 1} / {player.steps.length}
			</span>
		</div>

		<!-- One frame large. Tap swaps, double tap plays: opt-in, per SPEC §7. -->
		<button onclick={onImageTap} class="relative block w-full" aria-label="Swap photo, double tap to play">
			<img
				src="{base}{exercise.media[frame].path}"
				alt={exercise.name}
				width={exercise.media[frame].width}
				height={exercise.media[frame].height}
				class="w-full rounded-2xl bg-white"
			/>
			{#if exercise.media.length > 1}
				<span
					class="absolute right-3 bottom-3 rounded-full px-3 py-1 text-xs {playing
						? 'bg-zinc-100 font-medium text-zinc-900'
						: 'bg-zinc-950/80 text-zinc-200'}"
				>
					{playing ? 'playing · double tap to stop' : `${frame + 1}/${exercise.media.length} · double tap to play`}
				</span>
			{/if}
		</button>

		<div>
			{#if step.blockLabel}
				<p class="text-xs tracking-wide text-zinc-500 uppercase">{step.blockLabel}</p>
			{/if}
			<h1 class="font-display text-2xl font-bold">{exercise.name}</h1>
			<p class="mt-1 font-display text-xl text-zinc-300">{describeStep(step)}</p>
			{#if lastTime}
				<!-- What you did for this exercise last time, side matched. The set
					 you are on now is emphasised. -->
				<p class="mt-2 text-sm text-zinc-500">
					Last time, {formatWhen(lastTime.performedAt)}:
					{#each lastTime.sets as entry, i (entry.setIndex + '-' + i)}<span
							class={entry.setIndex === step.setIndex ? 'font-semibold text-zinc-200' : ''}
							>{formatSet(entry)}</span
						>{#if i < lastTime.sets.length - 1}<span class="pr-1">,</span>{/if}{/each}
				</p>
			{/if}
			{#if step.notes}
				<p class="mt-2 text-sm text-zinc-400">{step.notes}</p>
			{/if}
		</div>

		{#if exercise.instructions.length}
			<details bind:open={showCues} class="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
				<summary class="min-h-11 cursor-pointer text-sm text-zinc-300">How to do it</summary>
				<ol class="mt-2 flex list-decimal flex-col gap-2 pl-5 text-sm text-zinc-300">
					{#each exercise.instructions as line, i (i)}
						<li>{line}</li>
					{/each}
				</ol>
			</details>
		{/if}

		{#if timed}
			<!-- Counts down to the target (§7), then keeps going as overtime so a
				 longer hold is still measured rather than clamped at zero. -->
			{@const left = player.remaining ?? 0}
			<div class="text-center">
				<p
					class="font-display text-7xl font-bold tabular-nums {left <= 0
						? 'text-zinc-100'
						: left <= 3
							? 'text-amber-300'
							: 'text-zinc-100'}"
				>
					{left < 0 ? `+${mmss(-left)}` : mmss(left)}
				</p>
				<p class="mt-1 text-xs text-zinc-500">
					{left > 0 ? 'left' : left === 0 ? 'time — log the set' : 'over the target'}
				</p>
			</div>
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
					aria-label="One fewer"
					class="min-h-16 min-w-16 shrink-0 rounded-xl border border-zinc-700 font-display text-2xl"
				>
					−
				</button>
				<div class="min-w-0 flex-1">
					<NumberWheel bind:value min={0} max={timed ? 300 : 60} label={timed ? 'seconds' : 'reps'} />
				</div>
				<button
					onclick={() => (value += 1)}
					aria-label="One more"
					class="min-h-16 min-w-16 shrink-0 rounded-xl border border-zinc-700 font-display text-2xl"
				>
					+
				</button>
			</div>

			{#if showRpe}
				<div class="flex items-center gap-2">
					<span class="text-xs text-zinc-500">RPE</span>
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
				Log set
			</button>

			<div class="flex gap-3 text-sm">
				<button
					onclick={() => player?.undo()}
					disabled={!player.canUndo}
					class="min-h-12 flex-1 rounded-lg border border-zinc-800 text-zinc-400 disabled:opacity-30"
				>
					← Back a set
				</button>
				<button
					onclick={() => (showRpe = !showRpe)}
					class="min-h-12 flex-1 rounded-lg border border-zinc-800 text-zinc-400"
				>
					{showRpe ? 'Hide RPE' : 'Add RPE'}
				</button>
				<button
					onclick={() => player?.skip()}
					class="min-h-12 flex-1 rounded-lg border border-zinc-800 text-zinc-400"
				>
					Skip set
				</button>
				<button
					onclick={endEarly}
					class="min-h-12 flex-1 rounded-lg border border-zinc-800 text-zinc-400"
				>
					End
				</button>
			</div>
		</div>
	</div>
{/if}

{#if confirmLeave}
	<div class="fixed inset-0 z-50 flex items-end bg-zinc-950/80 p-4">
		<div class="mx-auto w-full max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
			<p class="font-medium">Leave this session?</p>
			<p class="mt-1 text-sm text-zinc-400">
				It stays unfinished, and the home screen will offer to pick it back up.
			</p>
			<div class="mt-4 flex gap-3">
				<button
					onclick={leave}
					class="min-h-14 flex-1 rounded-xl border border-zinc-700 font-medium"
				>
					Leave
				</button>
				<button
					onclick={() => (confirmLeave = false)}
					class="min-h-14 flex-1 rounded-xl bg-zinc-100 font-semibold text-zinc-900"
				>
					Keep going
				</button>
			</div>
		</div>
	</div>
{/if}
