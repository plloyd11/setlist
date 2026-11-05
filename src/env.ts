import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	PUBLIC_SUPABASE_URL: { public: true, static: true },
	PUBLIC_SUPABASE_PUBLISHABLE_KEY: { public: true, static: true },
	PUBLIC_TONE3000_CLIENT_ID: {
		public: true,
		static: true,
		// Optional: without it the rig just doesn't offer TONE3000
		schema: (value) => value || undefined,
		description:
			'TONE3000 publishable key (t3k_pub_…), from tone3000.com/settings. Lets the rig browse NAM captures and IRs.'
	}
});
