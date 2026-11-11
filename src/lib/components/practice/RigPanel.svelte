<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import Knob from '#lib/components/ui/Knob.svelte';
	import RigFilePicker from './RigFilePicker.svelte';
	import Tone3000Browse from './Tone3000Browse.svelte';
	import { microLabel, panel, secondaryButton } from './practiceStyles.js';
	import type { RigFile } from '#lib/utils/rigStore.js';
	import { licenseLabel, tone3000Enabled } from '#lib/utils/tone3000.js';
	import { tone3000 } from '#lib/utils/tone3000Browser.svelte.js';
	import {
		HIGH_CUT,
		INPUT_DB,
		LOW_CUT,
		rig,
		type IrSlot,
		type RigBuffer,
		type RigMode
	} from '#lib/utils/rig.svelte.js';
	import {
		formatBlend,
		formatDb,
		formatHighCut,
		formatLevel,
		formatLowCut,
		meterPercent,
		MODE_LABELS
	} from '#lib/utils/rigFormat.js';

	const MODES: RigMode[] = ['amp', 'nam'];

	onMount(() => {
		rig.init();
		rig.panels += 1;
		return () => {
			rig.panels -= 1;
		};
	});

	let clipping = $derived(rig.peakDb > -1);
	let nam = $derived(rig.settings.mode === 'nam');
	let model = $derived(rig.models.find((file) => file.id === rig.settings.modelId));
	let ir = $derived(rig.irs.find((file) => file.id === rig.setup.irId));
	let ir2 = $derived(rig.irs.find((file) => file.id === rig.setup.irId2));
	let blending = $derived(!!ir && !!ir2);

	const selectClass =
		'focus-live min-h-11 min-w-0 rounded-lg border border-surface-300 bg-surface-50 px-2 text-sm text-surface-900 dark:border-surface-600 dark:bg-surface-800 dark:text-surface-100';
	const hint = 'mt-1.5 text-xs text-surface-500 dark:text-surface-300';

	// The Rig page has room for everything this panel doesn't, and a way back here
	let rigHref = $derived(`/rig?from=${encodeURIComponent(page.url.pathname + page.url.search)}`);
</script>

<!-- Where a TONE3000 file came from stays with it, as their terms ask. Left out while
     that picker's TONE3000 card is open, since the card says the same. -->
{#snippet credit(file: RigFile | undefined, kind: 'nam' | 'ir', slot: IrSlot = 0)}
	{#if file?.source && !(tone3000.kind === kind && tone3000.slot === slot)}
		<p class={hint}>
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

<section aria-label="Rig" class="{panel} px-4 py-3.5">
	<div class="flex items-center justify-between gap-2">
		<h2 class={microLabel}>Rig</h2>
		<div class="flex items-center gap-3">
			{#if rig.monitoring && rig.latencyMs !== null}
				<span
					class="text-xs text-surface-500 dark:text-surface-300"
					title="What the browser reports. The real round trip is a little longer."
				>
					{Math.round(rig.latencyMs)} ms
				</span>
			{/if}
			<a
				href={rigHref}
				class="focus-live hit-44 rounded-sm text-xs font-medium text-accent-700 underline underline-offset-2 dark:text-accent-300"
			>
				Open rig
			</a>
		</div>
	</div>

	{#if !rig.ready}
		<!-- Settings and devices load in the browser -->
		<div class="h-11"></div>
	{:else if !rig.supported}
		<p class="mt-2 text-sm text-surface-600 dark:text-surface-300">
			This browser can't take audio input.
		</p>
	{:else if !rig.canList}
		<p class="mt-2 text-sm text-surface-600 dark:text-surface-300">
			Play your amp, or your guitar through a NAM amp model, into the same headphones as the track.
		</p>
		<button
			type="button"
			class="{secondaryButton} mt-3 w-full"
			disabled={rig.busy}
			onclick={() => rig.allowAccess()}
		>
			Choose an input
		</button>
	{:else}
		{#if rig.presets.length > 0}
			<!-- Sounds saved on the Rig page: one pick sets the mode and everything in it -->
			<label class="sr-only" for="rig-preset">Saved rig</label>
			<select
				id="rig-preset"
				class="{selectClass} mt-2.5 w-full"
				value={rig.activePresetId ?? ''}
				onchange={(e) => rig.applyPreset(e.currentTarget.value)}
			>
				{#if !rig.activePresetId}
					<option value="" disabled>Saved rigs</option>
				{/if}
				{#each rig.presets as preset (preset.id)}
					<option value={preset.id}>{preset.name}</option>
				{/each}
			</select>
		{/if}

		<!-- Each side keeps its own input, gains and IR, so a swap is one tap -->
		<div
			class="mt-2.5 grid grid-cols-2 gap-0.5 rounded-lg border border-surface-300 p-0.5 dark:border-surface-600"
			role="group"
			aria-label="What's plugged in"
		>
			{#each MODES as mode (mode)}
				<button
					type="button"
					aria-pressed={rig.settings.mode === mode}
					onclick={() => rig.setMode(mode)}
					class="focus-live min-h-10 rounded-md text-sm font-medium transition-colors duration-150 {rig
						.settings.mode === mode
						? 'bg-accent-500 text-white shadow-sm'
						: 'text-surface-600 hover:bg-surface-100 dark:text-surface-300 dark:hover:bg-surface-700'}"
				>
					{MODE_LABELS[mode]}
				</button>
			{/each}
		</div>

		<div class="mt-3 flex items-center gap-2">
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
							class="focus-live min-h-11 w-9 border text-sm font-medium transition-colors duration-150 first:rounded-l-lg last:-ml-px last:rounded-r-lg {rig
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

		<!-- Input level, lit only while the rig is live -->
		<div
			class="mt-3 h-1.5 overflow-hidden rounded-sm bg-surface-200 dark:bg-surface-700"
			aria-hidden="true"
			data-testid="rig-meter"
		>
			<div
				class="h-full {clipping ? 'bg-danger-500' : 'bg-neon-600 dark:bg-neon-400'}"
				style="width: {meterPercent(rig.peakDb)}%"
			></div>
		</div>

		<!-- A fifth knob, the blend, joins the row once two IRs are in -->
		<div class="mt-4 grid justify-items-center {blending ? 'grid-cols-5' : 'grid-cols-4 gap-1'}">
			<Knob
				value={rig.setup.inputDb}
				min={INPUT_DB.min}
				max={INPUT_DB.max}
				step={0.5}
				label="Input"
				format={formatDb}
				onchange={(v) => rig.setInputDb(v)}
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
			<Knob
				value={rig.setup.level}
				step={0.01}
				label="Level"
				format={formatLevel}
				onchange={(v) => rig.setLevel(v)}
			/>
			{#if blending}
				<Knob
					value={rig.setup.irBlend}
					step={0.05}
					label="Blend"
					format={formatBlend}
					onchange={(v) => rig.setIrBlend(v)}
				/>
			{/if}
		</div>

		{#if nam}
			<div class="mt-4">
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
					onselect={(id) => rig.selectModel(id)}
					onadd={(file) => rig.addModel(file)}
					onremove={(id) => rig.removeModel(id)}
				/>
				{@render credit(model, 'nam')}
				<div aria-live="polite">
					{#if rig.modelLoading}
						<p class={hint}>Loading the model…</p>
					{:else if rig.modelNote}
						<p class="mt-1.5 text-xs text-danger-700 dark:text-danger-300">{rig.modelNote}</p>
					{:else if rig.models.length === 0 && tone3000.kind !== 'nam'}
						<p class={hint}>
							{#if tone3000Enabled}
								Plug your guitar straight into the interface, then browse TONE3000 for an amp, or
								add a .nam file.
							{:else}
								Plug your guitar straight into the interface and add a NAM model (.nam). Thousands
								are free on
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
		{/if}

		<div class={nam ? 'mt-2' : 'mt-4'}>
			<RigFilePicker
				id="rig-ir"
				label="Cab IR"
				noun="IR"
				noneLabel="No IR"
				addLabel="Add IR"
				accept=".wav,audio/wav,audio/x-wav"
				files={rig.irs}
				selected={rig.setup.irId}
				onselect={(id) => rig.selectIr(id)}
				onadd={(file) => rig.addIr(file)}
				onremove={(id) => rig.removeIr(id)}
			/>
			{@render credit(ir, 'ir')}
			{#if rig.irs.length === 0 && tone3000.kind !== 'ir'}
				<p class={hint}>
					{nam
						? 'Add a cab IR (.wav) unless the model is a full rig with the cab in it.'
						: 'Add a cab IR (.wav) for the speaker sound.'}
				</p>
			{/if}
			<Tone3000Browse kind="ir" />
			{#if rig.setup.irId2}
				<!-- A second IR is set up on the Rig page. Here it can be swapped or dropped. -->
				<div class="mt-2">
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
				</div>
			{/if}
		</div>

		<div class="mt-3 flex items-center gap-2">
			<button
				type="button"
				onclick={() => rig.toggle()}
				aria-pressed={rig.monitoring}
				disabled={!rig.settings.deviceId || rig.busy}
				class="focus-live flex min-h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-lg border px-3 font-semibold transition-colors duration-150 disabled:opacity-50 {rig.monitoring
					? 'border-neon-600 text-surface-900 dark:border-neon-400 dark:text-surface-100'
					: 'border-accent-300 bg-accent-100 text-accent-800 hover:bg-accent-200 dark:border-accent-600 dark:bg-accent-800/50 dark:text-accent-200 dark:hover:bg-accent-800'}"
			>
				<span
					class="h-2 w-2 rounded-full {rig.monitoring
						? 'bg-neon-600 shadow-glow-neon dark:bg-neon-400'
						: 'bg-surface-400 dark:bg-surface-500'}"
					aria-hidden="true"
				></span>
				Monitor
			</button>
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
	{/if}

	{#if rig.error}
		<p role="alert" class="mt-2 text-sm text-danger-700 dark:text-danger-300">{rig.error}</p>
	{/if}
</section>
