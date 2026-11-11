<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import ConfirmDialog from '#lib/components/ui/ConfirmDialog.svelte';
	import Digits from '#lib/components/ui/Digits.svelte';
	import Knob from '#lib/components/ui/Knob.svelte';
	import RigFilePicker from '#lib/components/practice/RigFilePicker.svelte';
	import Tone3000Browse from '#lib/components/practice/Tone3000Browse.svelte';
	import {
		heroButton,
		microLabel,
		panel,
		panelFooter,
		sectionHeading
	} from '#lib/components/practice/practiceStyles.js';
	import RigFileList from '#lib/components/rig/RigFileList.svelte';
	import RigMeter from '#lib/components/rig/RigMeter.svelte';
	import RigPresets from '#lib/components/rig/RigPresets.svelte';
	import RigUnit from '#lib/components/rig/RigUnit.svelte';
	import {
		HIGH_CUT,
		INPUT_DB,
		LOW_CUT,
		rig,
		type IrSlot,
		type RigBuffer,
		type RigMode,
		type RigPreset
	} from '#lib/utils/rig.svelte.js';
	import {
		formatBlend,
		formatDb,
		formatHighCut,
		formatLevel,
		formatLowCut,
		formatSampleRate,
		MODE_LABELS
	} from '#lib/utils/rigFormat.js';
	import type { RigFile, RigFileKind } from '#lib/utils/rigStore.js';
	import { safeInternalPath } from '#lib/utils/safeRedirect.js';
	import { licenseLabel, tone3000Enabled } from '#lib/utils/tone3000.js';
	import { tone3000 } from '#lib/utils/tone3000Browser.svelte.js';

	/**
	 * The rig's own page: the same engine as the panel on the practice screens, with
	 * room to see the whole chain. The signal runs down the rack (input, amp, cab,
	 * output), each unit metered where it can go wrong. Beside it, saved rigs; under it,
	 * the library of models and IRs kept in this browser.
	 */

	const MODES: RigMode[] = ['amp', 'nam'];
	const WIRING: Record<RigMode, string> = {
		amp: "Your head into its load box, and the load box's line out into the interface. The cab IR does the speaker's job.",
		nam: "Your guitar straight into the interface. The amp model does the amp's job, and the cab IR the speaker's."
	};

	let confirmDialog: ConfirmDialog;

	onMount(() => {
		// The first rig screen of a visit syncs as it starts up. Coming back to this page
		// later checks the account again, for IRs added or removed on another device.
		const started = rig.ready;
		rig.init();
		if (started) void rig.sync();
		// This page is a panel as far as the app shell goes: no "Rig on" chip over it
		rig.panels += 1;
		return () => {
			rig.panels -= 1;
		};
	});

	// Opened from a practice screen, it knows the way back
	let backHref = $derived(safeInternalPath(page.url.searchParams.get('from'), ''));

	let nam = $derived(rig.settings.mode === 'nam');
	let model = $derived(rig.models.find((file) => file.id === rig.settings.modelId));
	let ir = $derived(rig.irs.find((file) => file.id === rig.setup.irId));
	let ir2 = $derived(rig.irs.find((file) => file.id === rig.setup.irId2));
	let blending = $derived(!!ir && !!ir2);

	// What the board's footer says: where things stand, in one sentence
	let status = $derived.by(() => {
		if (!rig.settings.deviceId) return 'Choose an input to get going.';
		if (rig.busy) return 'Starting up…';
		if (!rig.monitoring) {
			return nam && !model
				? 'Pick an amp model, then turn Monitor on.'
				: 'Ready. Turn Monitor on and play.';
		}
		if (nam && rig.modelLoading) return 'Live. Loading the model…';
		if (nam && !model) return "Live, with no amp model: that's your guitar dry.";
		if (!nam && !ir && !ir2) return 'Live, with no cab IR: a line out sounds harsh without one.';
		return 'Live.';
	});

	// Files dragged in from the desktop land in the library, wherever they're dropped
	let dropping = $state(false);
	let dragDepth = 0;

	function carriesFiles(e: DragEvent): boolean {
		return e.dataTransfer?.types.includes('Files') ?? false;
	}

	function handleDragEnter(e: DragEvent) {
		if (!carriesFiles(e)) return;
		dragDepth += 1;
		dropping = true;
	}

	function handleDragLeave(e: DragEvent) {
		if (!carriesFiles(e)) return;
		dragDepth = Math.max(0, dragDepth - 1);
		if (dragDepth === 0) dropping = false;
	}

	function handleDragOver(e: DragEvent) {
		// Without this the browser opens the file instead of handing it over
		if (carriesFiles(e)) e.preventDefault();
	}

	function handleDrop(e: DragEvent) {
		if (!carriesFiles(e)) return;
		e.preventDefault();
		dragDepth = 0;
		dropping = false;
		const files = [...(e.dataTransfer?.files ?? [])];
		if (files.length > 0) void rig.addFiles(files);
	}

	async function removeFile(kind: RigFileKind, file: RigFile) {
		const rigs = rig.presets.filter((preset) =>
			kind === 'models'
				? preset.modelId === file.id
				: preset.setup.irId === file.id || preset.setup.irId2 === file.id
		).length;
		const message = [
			rig.isSynced(file)
				? "It's deleted from your account, so it goes from your other devices too."
				: "It's deleted from this browser.",
			file.source ? 'You can get it again from TONE3000.' : 'To get it back, add the file again.',
			rigs === 0
				? ''
				: rigs === 1
					? 'One saved rig uses it, and will carry on without it.'
					: `${rigs} saved rigs use it, and will carry on without it.`
		]
			.filter(Boolean)
			.join(' ');
		if (!(await confirmDialog.confirm(`Remove ${file.name}?`, message, { confirmLabel: 'Remove' })))
			return;
		await (kind === 'models' ? rig.removeModel(file.id) : rig.removeIr(file.id));
	}

	async function removePreset(preset: RigPreset) {
		const ok = await confirmDialog.confirm(
			`Remove ${preset.name}?`,
			'The saved rig goes. Its amp model and IR stay in the library.',
			{ confirmLabel: 'Remove' }
		);
		if (ok) rig.removePreset(preset.id);
	}

	const selectClass =
		'focus-live min-h-11 min-w-0 rounded-lg border border-surface-300 bg-surface-50 px-2 text-sm text-surface-900 dark:border-surface-600 dark:bg-surface-800 dark:text-surface-100';
	const hint = 'text-xs text-surface-500 dark:text-surface-300';
	const pickerLabel = 'mb-1 text-xs font-medium text-surface-600 dark:text-surface-300';
	const muted = 'text-sm text-surface-600 dark:text-surface-300';
</script>

<svelte:head>
	<title>Rig · Setlist</title>
</svelte:head>

<svelte:window
	ondragenter={handleDragEnter}
	ondragleave={handleDragLeave}
	ondragover={handleDragOver}
	ondrop={handleDrop}
/>

<!-- Where a TONE3000 file came from stays with it, as their terms ask. Left out while
     that picker's TONE3000 card is open, since the card says the same. -->
{#snippet credit(file: RigFile | undefined, kind: 'nam' | 'ir', slot: IrSlot = 0)}
	{#if file?.source && !(tone3000.kind === kind && tone3000.slot === slot)}
		<p class="mt-1.5 {hint}">
			By {file.source.creator} · {licenseLabel(file.source.license)} ·
			<a
				href={file.source.toneUrl}
				target="_blank"
				rel="noopener noreferrer"
				title={file.source.toneTitle}
				class="focus-live rounded-sm font-medium text-surface-700 underline underline-offset-2 dark:text-surface-200"
				>On TONE3000</a
			>
		</p>
	{/if}
{/snippet}

<div class="page-frame">
	{#if backHref}
		<a
			href={backHref}
			class="focus-live mb-2 -ml-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-medium text-surface-500 hover:bg-surface-100 hover:text-surface-700 dark:text-surface-300 dark:hover:bg-surface-800 dark:hover:text-surface-100"
		>
			<svg
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<path d="m15 18-6-6 6-6" />
			</svg>
			Back to practice
		</a>
	{/if}
	<h1 class="font-display text-3xl text-surface-900 dark:text-surface-100">Rig</h1>
	<p class="mt-1 max-w-prose {muted}">
		Play your amp, or your guitar through a NAM amp model, into the same headphones as the track. It
		stays on as you move around the app.
	</p>

	<div
		class="mt-6 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start"
	>
		<section aria-label="Rig" data-tour="rig-board" class="{panel} @container min-w-0">
			{#if !rig.ready}
				<!-- Settings and devices load in the browser -->
				<div class="h-72"></div>
			{:else if !rig.supported}
				<div class="p-4 md:p-5">
					<p class="font-display text-xl text-surface-900 dark:text-surface-100">
						This browser can't take audio input
					</p>
					<p class="mt-1 max-w-prose {muted}">
						The rig needs a browser that can listen to an audio interface. Chrome on a Mac or PC is
						the one it's been played through.
					</p>
				</div>
			{:else if !rig.canList}
				<!-- First time here: the one thing to do, and what it leads to -->
				<div class="p-4 md:p-6">
					<p class="font-display text-2xl text-surface-900 dark:text-surface-100">
						Plug in and play
					</p>
					<p class="mt-2 max-w-prose {muted}">
						Your browser asks before a site can hear an input. Say yes, then pick your interface.
						What you play is only ever heard on this computer.
					</p>
					<button
						type="button"
						class="{heroButton} mt-5 disabled:opacity-60"
						disabled={rig.busy}
						onclick={() => rig.allowAccess()}
					>
						Choose an input
					</button>
					{#if rig.error}
						<p role="alert" class="mt-3 text-sm text-danger-700 dark:text-danger-300">
							{rig.error}
						</p>
					{/if}
					<dl
						class="mt-6 grid gap-x-8 gap-y-4 border-t border-surface-200 pt-5 sm:grid-cols-2 dark:border-surface-700"
					>
						{#each MODES as mode (mode)}
							<div>
								<dt
									class="font-display text-base font-semibold text-surface-900 dark:text-surface-100"
								>
									{MODE_LABELS[mode]}
								</dt>
								<dd class="mt-1 {muted}">{WIRING[mode]}</dd>
							</div>
						{/each}
					</dl>
				</div>
			{:else}
				<div class="flex flex-wrap items-start justify-between gap-x-8 gap-y-4 p-4 md:p-5">
					<div class="min-w-0 flex-1 basis-72">
						<p class={microLabel} id="rig-mode-label">What's plugged in</p>
						<!-- Each side keeps its own input, gains and IR, so a swap is one tap -->
						<div
							class="mt-1.5 grid max-w-sm grid-cols-2 gap-0.5 rounded-lg border border-surface-300 p-0.5 dark:border-surface-600"
							role="group"
							aria-labelledby="rig-mode-label"
						>
							{#each MODES as mode (mode)}
								<button
									type="button"
									aria-pressed={rig.settings.mode === mode}
									onclick={() => rig.setMode(mode)}
									class="focus-live min-h-11 rounded-md text-sm font-medium transition-colors duration-150 {rig
										.settings.mode === mode
										? 'bg-accent-500 text-white shadow-sm'
										: 'text-surface-600 hover:bg-surface-100 dark:text-surface-300 dark:hover:bg-surface-700'}"
								>
									{MODE_LABELS[mode]}
								</button>
							{/each}
						</div>
						<p class="mt-2.5 max-w-prose {muted}">{WIRING[rig.settings.mode]}</p>
					</div>

					<!-- The power switch: the lamp and the border light only while it's live -->
					<button
						type="button"
						onclick={() => rig.toggle()}
						aria-pressed={rig.monitoring}
						disabled={!rig.settings.deviceId || rig.busy}
						class="focus-live flex min-h-14 w-full items-center gap-3 rounded-lg border px-5 transition-colors duration-150 disabled:opacity-50 sm:w-56 {rig.monitoring
							? 'border-neon-600 text-surface-900 dark:border-neon-400 dark:text-surface-100'
							: 'border-accent-300 bg-accent-100 text-accent-800 hover:bg-accent-200 dark:border-accent-600 dark:bg-accent-800/50 dark:text-accent-200 dark:hover:bg-accent-800'}"
					>
						<span
							class="h-2.5 w-2.5 shrink-0 rounded-full {rig.monitoring
								? 'bg-neon-600 shadow-glow-neon dark:bg-neon-400'
								: 'bg-surface-400 dark:bg-surface-500'}"
							aria-hidden="true"
						></span>
						<span class="font-display text-lg font-bold">Monitor</span>
						<span class="ml-auto text-sm font-medium" aria-hidden="true">
							{rig.monitoring ? 'On' : 'Off'}
						</span>
					</button>
				</div>

				<h2 class="sr-only">Signal chain</h2>

				<RigUnit title="Input" note="From your interface">
					<div class="flex flex-wrap items-start gap-x-6 gap-y-4">
						<div class="min-w-0 flex-1 basis-64">
							<div class="flex items-center gap-2">
								<label class="sr-only" for="rig-input">Input</label>
								<select
									id="rig-input"
									class="{selectClass} flex-1"
									value={rig.settings.deviceId ?? ''}
									disabled={rig.busy}
									onchange={(e) => rig.selectDevice(e.currentTarget.value)}
								>
									{#if !rig.settings.deviceId}
										<option value="" disabled>Choose an input</option>
									{/if}
									{#each rig.devices as device (device.id)}
										<option value={device.id}>{device.label || 'Unnamed input'}</option>
									{/each}
								</select>
								{#if rig.channelCount > 1}
									<div class="flex shrink-0" role="group" aria-label="Input channel">
										{#each [0, 1] as channel (channel)}
											<button
												type="button"
												aria-pressed={rig.setup.channel === channel}
												aria-label="Input {channel + 1}"
												onclick={() => rig.setChannel(channel)}
												class="focus-live min-h-11 w-10 border text-sm font-medium transition-colors duration-150 first:rounded-l-lg last:-ml-px last:rounded-r-lg {rig
													.setup.channel === channel
													? 'relative border-accent-500 bg-accent-500 text-white'
													: 'border-surface-300 text-surface-700 hover:bg-surface-100 dark:border-surface-600 dark:text-surface-200 dark:hover:bg-surface-700'}"
											>
												{channel + 1}
											</button>
										{/each}
									</div>
								{/if}
							</div>
							<div class="mt-4" data-testid="rig-input-meter">
								<RigMeter
									db={rig.peakDb}
									live={rig.monitoring}
									lamp="Clip"
									lampOn={rig.peakDb > -1}
								/>
							</div>
							<p class="mt-2 {hint}">
								Set Input so your hardest playing stays clear of Clip. Peaks around -12 dB are
								plenty.
							</p>
						</div>
						<Knob
							value={rig.setup.inputDb}
							min={INPUT_DB.min}
							max={INPUT_DB.max}
							step={0.5}
							label="Input"
							format={formatDb}
							onchange={(v) => rig.setInputDb(v)}
						/>
					</div>
				</RigUnit>

				{#if nam}
					<RigUnit title="Amp" note="A NAM model">
						<div class="max-w-xl">
							<RigFilePicker
								id="rig-model"
								label="Amp model"
								noun="model"
								noneLabel="No amp model"
								addLabel="Add model"
								accept=".nam"
								files={rig.models}
								selected={rig.settings.modelId}
								disabled={rig.modelLoading}
								removable={false}
								onselect={(id) => rig.selectModel(id)}
								onadd={(file) => rig.addModel(file)}
							/>
							{@render credit(model, 'nam')}
							<div aria-live="polite">
								{#if rig.modelLoading}
									<p class="mt-1.5 {hint}">Loading the model…</p>
								{:else if rig.modelNote}
									<p class="mt-1.5 text-xs text-danger-700 dark:text-danger-300">
										{rig.modelNote}
									</p>
								{:else if rig.models.length === 0 && tone3000.kind !== 'nam'}
									<p class="mt-1.5 {hint}">
										{#if tone3000Enabled}
											Browse TONE3000 for an amp, or add a .nam file.
										{:else}
											Add a NAM model (.nam). Thousands are free on
											<a
												href="https://www.tone3000.com"
												target="_blank"
												rel="noopener noreferrer"
												class="focus-live rounded-sm font-medium text-accent-700 underline underline-offset-2 dark:text-accent-300"
												>TONE3000</a
											>.
										{/if}
									</p>
								{/if}
							</div>
							<Tone3000Browse kind="nam" />
						</div>
					</RigUnit>
				{/if}

				<RigUnit title="Cab" note="One IR, or two blended">
					<div class="flex flex-wrap items-start gap-x-6 gap-y-4">
						<div class="max-w-xl min-w-0 flex-1 basis-64">
							<p class={pickerLabel} aria-hidden="true">Cab IR</p>
							<RigFilePicker
								id="rig-ir"
								label="Cab IR"
								noun="IR"
								noneLabel="No IR"
								addLabel="Add IR"
								accept=".wav,audio/wav,audio/x-wav"
								files={rig.irs}
								selected={rig.setup.irId}
								removable={false}
								onselect={(id) => rig.selectIr(id)}
								onadd={(file) => rig.addIr(file)}
							/>
							{@render credit(ir, 'ir')}
							{#if rig.irs.length === 0 && tone3000.kind !== 'ir'}
								<p class="mt-1.5 {hint}">
									{nam
										? 'Add a cab IR (.wav) unless the model is a full rig with the cab in it.'
										: 'Add a cab IR (.wav) for the speaker sound.'}
								</p>
							{/if}
							<Tone3000Browse kind="ir" />

							<!-- A second IR runs beside the first, like a second mic on the cab -->
							<p class="{pickerLabel} mt-4" aria-hidden="true">Second IR</p>
							<RigFilePicker
								id="rig-ir-2"
								label="Second IR"
								noun="IR"
								noneLabel="No second IR"
								addLabel="Add IR"
								accept=".wav,audio/wav,audio/x-wav"
								files={rig.irs}
								selected={rig.setup.irId2}
								removable={false}
								onselect={(id) => rig.selectIr(id, 1)}
								onadd={(file) => rig.addIr(file, 1)}
							/>
							{@render credit(ir2, 'ir', 1)}
							<Tone3000Browse kind="ir" slot={1} />
							<p class="mt-2 {hint}" aria-live="polite">
								{#if blending}
									Blend reads first / second: {formatBlend(rig.setup.irBlend)} is {rig.setup
										.irBlend === 0.5
										? 'an even mix'
										: rig.setup.irBlend < 0.5
											? 'mostly the first'
											: 'mostly the second'}.
								{:else}
									Add a second IR to blend two mics, or two cabs.
								{/if}
							</p>
						</div>
						<div class="flex gap-3">
							<Knob
								value={rig.setup.irBlend}
								step={0.05}
								label="Blend"
								format={(v) => (blending ? formatBlend(v) : 'Off')}
								disabled={!blending}
								onchange={(v) => rig.setIrBlend(v)}
							/>
							<Knob
								value={rig.setup.lowCut}
								min={LOW_CUT.min}
								max={LOW_CUT.max}
								step={5}
								label="Lo cut"
								format={formatLowCut}
								onchange={(v) => rig.setLowCut(v)}
							/>
							<Knob
								value={rig.setup.highCut}
								min={HIGH_CUT.min}
								max={HIGH_CUT.max}
								step={250}
								label="Hi cut"
								format={formatHighCut}
								onchange={(v) => rig.setHighCut(v)}
							/>
						</div>
					</div>
				</RigUnit>

				<RigUnit title="Output" note="To your headphones">
					<div class="flex flex-wrap items-start gap-x-6 gap-y-4">
						<div class="min-w-0 flex-1 basis-64">
							<div data-testid="rig-output-meter">
								<RigMeter db={rig.outDb} live={rig.monitoring} lamp="Limit" lampOn={rig.limiting} />
							</div>
							<p class="mt-2 {hint}">
								The limiter is there for your ears, not your tone. If Limit lights often, turn Level
								down.
							</p>
						</div>
						<Knob
							value={rig.setup.level}
							step={0.01}
							label="Level"
							format={formatLevel}
							onchange={(v) => rig.setLevel(v)}
						/>
					</div>
				</RigUnit>

				{#if rig.error}
					<p
						role="alert"
						class="border-t border-surface-200 px-4 py-3 text-sm text-danger-700 md:px-5 dark:border-surface-700 dark:text-danger-300"
					>
						{rig.error}
					</p>
				{/if}

				<div
					class="{panelFooter} flex flex-wrap items-center justify-between gap-x-8 gap-y-3 rounded-b-xl px-4 py-3 md:px-5"
				>
					<p
						class="text-sm font-medium text-surface-800 dark:text-surface-100"
						aria-live="polite"
						data-testid="rig-status"
					>
						{status}
					</p>
					<div class="flex flex-wrap items-end gap-x-6 gap-y-3">
						<dl class="flex gap-6">
							<div title="What the browser reports. The real round trip is a little longer.">
								<dt class={microLabel}>Latency</dt>
								<dd class="mt-1 text-sm font-semibold text-surface-900 dark:text-surface-100">
									{#if rig.latencyMs !== null}
										<Digits value={String(Math.round(rig.latencyMs))} /> ms
									{:else}
										--
									{/if}
								</dd>
							</div>
							<div>
								<dt class={microLabel}>Rate</dt>
								<dd class="mt-1 text-sm font-semibold text-surface-900 dark:text-surface-100">
									{rig.sampleRate ? formatSampleRate(rig.sampleRate) : '--'}
								</dd>
							</div>
						</dl>
						<div>
							<label class="sr-only" for="rig-buffer">Buffer size</label>
							<select
								id="rig-buffer"
								class={selectClass}
								value={rig.settings.buffer}
								title="Smaller means less delay. Go bigger if you hear crackles."
								onchange={(e) => rig.setBuffer(e.currentTarget.value as RigBuffer)}
							>
								<option value="smallest">Smallest buffer</option>
								<option value="normal">Normal buffer</option>
							</select>
						</div>
					</div>
				</div>
			{/if}
		</section>

		<div class="min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1">
			<RigPresets onremove={removePreset} />
		</div>

		<section aria-labelledby="rig-library-heading" class="@container min-w-0">
			<h2 id="rig-library-heading" class={sectionHeading}>Library</h2>
			<p class="mt-1 max-w-prose {muted}">
				Cab IRs you upload are kept with your account, so they're on your other devices too. Amp
				models, and anything from TONE3000, stay in this browser.
			</p>
			<div class="mt-3 grid grid-cols-[minmax(0,1fr)] gap-6 @3xl:grid-cols-2 @3xl:items-start">
				<RigFileList kind="models" {dropping} onremove={(file) => removeFile('models', file)} />
				<RigFileList kind="irs" {dropping} onremove={(file) => removeFile('irs', file)} />
			</div>
		</section>
	</div>
</div>

<ConfirmDialog bind:this={confirmDialog} />
