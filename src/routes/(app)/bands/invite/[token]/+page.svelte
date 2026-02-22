<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';

	let { data, form } = $props();
</script>

<div class="flex min-h-[60vh] items-center justify-center p-6">
	<div class="w-full max-w-sm text-center">
		<!-- Band logo -->
		{#if data.invite.bandLogoUrl}
			<img
				src={data.invite.bandLogoUrl}
				alt="{data.invite.bandName} logo"
				class="mx-auto h-20 w-20 rounded-full object-cover shadow-md"
			/>
		{:else}
			<div
				class="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 shadow-md dark:bg-amber-900/30"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="36"
					height="36"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					class="text-amber-600 dark:text-amber-400"
				>
					<path
						d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
					/>
				</svg>
			</div>
		{/if}

		<!-- Band name -->
		<h1 class="mt-4 font-display text-2xl text-stone-900 dark:text-stone-100">
			{data.invite.bandName}
		</h1>

		{#if data.invite.alreadyMember}
			<!-- Already a member -->
			<p class="mt-3 text-stone-600 dark:text-stone-400">
				You're already a member of this band.
			</p>
			<a
				href="/bands/{data.invite.bandId}"
				class="mt-6 inline-block rounded-lg bg-amber-500 px-6 py-2.5 font-semibold text-white shadow-sm hover:bg-amber-600 focus:ring-2 focus:ring-amber-500/50 focus:ring-offset-2 focus:outline-none dark:focus:ring-offset-stone-900"
			>
				Go to Band
			</a>
		{:else}
			<!-- Invite to join -->
			<p class="mt-3 text-stone-600 dark:text-stone-400">
				You've been invited to join this band.
			</p>

			{#if form?.error}
				<div class="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
					{form.error}
				</div>
			{/if}

			<form method="POST" action="?/accept" use:enhance class="mt-6">
				<button
					type="submit"
					class="w-full rounded-lg bg-amber-500 px-6 py-2.5 font-semibold text-white shadow-sm hover:bg-amber-600 focus:ring-2 focus:ring-amber-500/50 focus:ring-offset-2 focus:outline-none dark:focus:ring-offset-stone-900"
				>
					Join Band
				</button>
			</form>
		{/if}
	</div>
</div>
