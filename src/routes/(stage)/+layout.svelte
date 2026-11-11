<script lang="ts">
	import { beforeNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import StageScene from '#lib/components/landing/StageScene.svelte';

	let { children } = $props();

	/**
	 * The homepage and the auth pages share one stage. It lives here so that it survives
	 * the navigation between them: the scene keeps running and only the camera moves.
	 */
	const shot = $derived(page.url.pathname.startsWith('/auth') ? 'auth' : 'home');

	// Set once a link has been followed. A page reached that way holds its content back
	// until the camera lands; a page loaded fresh shows it straight away.
	let travelled = $state(false);
	beforeNavigate(({ willUnload }) => {
		if (!willUnload) travelled = true;
	});
</script>

<!-- The stage is dark whatever the theme, so everything over it takes the dark palette -->
<div class="dark relative min-h-svh bg-surface-950 scheme-dark" class:travelled>
	<StageScene {shot} />
	{@render children()}
</div>
