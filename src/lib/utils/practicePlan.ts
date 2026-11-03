import { browser } from '$app/env';

/**
 * A run of practice steps you move through, like a warm-up routine or Today's session.
 * Kept in sessionStorage: it belongs to this sitting, and each step is an ordinary page.
 */
const STORAGE_KEY = 'practice:plan:v1';

export interface PlanStep {
	href: string;
	label: string;
}

export interface Plan {
	steps: PlanStep[];
	index: number;
}

/** A step's address without its ?from=, which is only about the Back link */
const pathOf = (href: string) => href.split('?')[0];

export function startPlan(steps: PlanStep[]) {
	if (!browser) return;
	try {
		sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ steps, index: 0 }));
	} catch {
		// Blocked storage: the first step still opens, without the Next bar
	}
}

export function clearPlan() {
	if (!browser) return;
	try {
		sessionStorage.removeItem(STORAGE_KEY);
	} catch {
		// Nothing to clear
	}
}

/** The current plan, if this page is one of its steps */
export function planFor(pathname: string): Plan | null {
	if (!browser) return null;
	try {
		const plan = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null') as Plan | null;
		if (!plan || !Array.isArray(plan.steps)) return null;
		const index = plan.steps.findIndex((step) => pathOf(step.href) === pathname);
		return index === -1 ? null : { steps: plan.steps, index };
	} catch {
		return null;
	}
}
