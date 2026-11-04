<script lang="ts">
	interface MenuItem {
		label: string;
		action: () => void;
		danger?: boolean;
	}

	let {
		items = [],
		x = 0,
		y = 0,
		visible = $bindable(false),
		label = 'Options',
		onclose
	}: {
		items: MenuItem[];
		x: number;
		y: number;
		visible: boolean;
		label?: string;
		onclose?: () => void;
	} = $props();

	let menuEl: HTMLDivElement | undefined = $state();
	let opener: HTMLElement | null = null;

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

	function menuItems() {
		return Array.from(menuEl?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
	}

	// Take focus on open, so arrows and Esc work without tabbing past the whole page
	$effect(() => {
		if (!visible || !menuEl) return;
		opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		menuItems()[0]?.focus({ preventScroll: true });
	});

	function dismiss() {
		visible = false;
		onclose?.();
		opener?.focus();
		opener = null;
	}

	// Clicking away keeps focus wherever the click put it
	function handleOutsideClick() {
		if (visible) {
			visible = false;
			onclose?.();
			opener = null;
		}
	}

	function handleItemClick(item: MenuItem) {
		visible = false;
		// Before the action: a dialog it opens records this as where to return focus
		opener?.focus();
		opener = null;
		item.action();
		onclose?.();
	}

	function handleWindowKeydown(e: KeyboardEvent) {
		if (visible && e.key === 'Escape') {
			e.preventDefault();
			dismiss();
		}
	}

	function handleMenuKeydown(e: KeyboardEvent) {
		const list = menuItems();
		const i = list.indexOf(document.activeElement as HTMLElement);
		let next: HTMLElement | undefined;
		if (e.key === 'ArrowDown') next = list[(i + 1) % list.length];
		else if (e.key === 'ArrowUp') next = list[(i - 1 + list.length) % list.length];
		else if (e.key === 'Home') next = list[0];
		else if (e.key === 'End') next = list[list.length - 1];
		else if (e.key === 'Tab') {
			e.preventDefault();
			dismiss();
			return;
		} else return;
		e.preventDefault();
		next?.focus();
	}
</script>

<svelte:window onclick={handleOutsideClick} onkeydown={handleWindowKeydown} />

{#if visible}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div
		bind:this={menuEl}
		role="menu"
		tabindex="-1"
		aria-label={label}
		class="fixed z-70 min-w-[160px] rounded-lg border border-surface-200 bg-surface-50 py-1 shadow-lg dark:border-surface-700 dark:bg-surface-800"
		style="left: {adjustedX}px; top: {adjustedY}px;"
		onclick={(e) => e.stopPropagation()}
		oncontextmenu={(e) => e.preventDefault()}
		onkeydown={handleMenuKeydown}
	>
		{#each items as item}
			<button
				role="menuitem"
				tabindex="-1"
				class="block w-full px-4 py-2 text-left text-sm {item.danger
					? 'text-danger-600 hover:bg-danger-50 focus:bg-danger-50 dark:text-danger-300 dark:hover:bg-danger-900/20 dark:focus:bg-danger-900/20'
					: 'text-surface-700 hover:bg-surface-100 focus:bg-surface-100 dark:text-surface-300 dark:hover:bg-surface-700 dark:focus:bg-surface-700'}"
				onclick={() => handleItemClick(item)}
			>
				{item.label}
			</button>
		{/each}
	</div>
{/if}
