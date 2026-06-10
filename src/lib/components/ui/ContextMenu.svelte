<script lang="ts">
	interface MenuItem {
		label: string;
		action: () => void;
	}

	let {
		items = [],
		x = 0,
		y = 0,
		visible = $bindable(false),
		onclose
	}: {
		items: MenuItem[];
		x: number;
		y: number;
		visible: boolean;
		onclose?: () => void;
	} = $props();

	let menuEl: HTMLDivElement | undefined = $state();

	// Adjust position if menu would go off-screen
	let adjustedX = $derived.by(() => {
		if (!menuEl) return x;
		const menuWidth = menuEl.offsetWidth || 160;
		const maxX = window.innerWidth - menuWidth - 8;
		return Math.min(x, maxX);
	});

	let adjustedY = $derived.by(() => {
		if (!menuEl) return y;
		const menuHeight = menuEl.offsetHeight || 100;
		const maxY = window.innerHeight - menuHeight - 8;
		return Math.min(y, maxY);
	});

	function handleOutsideClick() {
		if (visible) {
			visible = false;
			onclose?.();
		}
	}

	function handleItemClick(item: MenuItem) {
		item.action();
		visible = false;
		onclose?.();
	}
</script>

<svelte:window onclick={handleOutsideClick} />

{#if visible}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div
		bind:this={menuEl}
		class="fixed z-[60] min-w-[160px] rounded-lg border border-surface-200 bg-surface-50 py-1 shadow-lg dark:border-surface-700 dark:bg-surface-800"
		style="left: {adjustedX}px; top: {adjustedY}px;"
		onclick={(e) => e.stopPropagation()}
		oncontextmenu={(e) => e.preventDefault()}
	>
		{#each items as item}
			<button
				class="w-full px-4 py-2 text-left text-sm text-surface-700 hover:bg-surface-100 dark:text-surface-300 dark:hover:bg-surface-700"
				onclick={() => handleItemClick(item)}
			>
				{item.label}
			</button>
		{/each}
	</div>
{/if}
