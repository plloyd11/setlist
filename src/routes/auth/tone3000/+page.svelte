<script lang="ts">
	import { onMount } from 'svelte';
	import { readCallback, T3K_CHANNEL, T3K_MESSAGE } from '#lib/utils/tone3000.js';

	/**
	 * TONE3000 sends its window back here after a pick. This hands the answer to the
	 * practice screen that opened the window, then closes. The code is worthless
	 * without the verifier, which never left that screen.
	 */
	let relayed = $state(false);

	onMount(() => {
		const callback = readCallback(new URL(location.href));
		if (!callback) return;
		const message = { type: T3K_MESSAGE, ...callback };
		// Only to this origin. The channel is for when signing in cut the window loose.
		if (window.opener) {
			window.opener.postMessage(message, location.origin);
		} else {
			const channel = new BroadcastChannel(T3K_CHANNEL);
			channel.postMessage(message);
			channel.close();
		}
		relayed = true;
		window.close();
	});
</script>

<svelte:head>
	<title>TONE3000 · Setlist</title>
</svelte:head>

<main
	class="grid min-h-dvh place-items-center bg-surface-50 px-6 text-center text-surface-700 dark:bg-surface-900 dark:text-surface-200"
>
	<p class="text-sm">
		{relayed ? 'Back to Setlist. You can close this window.' : 'Nothing to pick up here.'}
	</p>
</main>
