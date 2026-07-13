import type { TestRunnerConfig } from '@storybook/test-runner';
import type { Page } from 'playwright';
import { injectAxe, checkA11y, configureAxe } from 'axe-playwright';
import { getStoryContext } from '@storybook/test-runner';

/** Upper bound on the entrance-animation wait, so a perpetual story can't stall the suite. */
const ANIMATION_SETTLE_TIMEOUT_MS = 3000;

/**
 * Axe is OPT-IN: `npm run test-storybook` runs the stories and play functions only
 * (green, and safe as a pre-push gate), while `npm run test-storybook:a11y` sets
 * STORYBOOK_A11Y=1 and turns the assertions below on.
 *
 * The a11y run is GREEN and must stay green — the backlog it once tracked has been
 * paid off (see docs/a11y-backlog.md). The checks below are the full, unweakened
 * axe ruleset and must stay that way: fix the components, never the assertion.
 */
const a11yEnabled = process.env['STORYBOOK_A11Y'] === '1';

/**
 * Let entrance animations finish before axe looks at the page.
 *
 * Components that fade or slide in (BlurFade, StaggerChildren, the data table's
 * virtualised rows) spend their first few hundred milliseconds at a partial
 * opacity. Auditing mid-flight measures a transient frame — axe reports
 * `color-contrast` against a half-faded colour that no user ever reads at rest —
 * so the run was reporting animation timing, not accessibility.
 *
 * Only animations that actually end are awaited: indefinite ones (spinners, the
 * `pulse` on skeletons) never settle, and waiting on them would hang. The whole
 * wait is capped so a story that animates forever cannot stall the suite. This
 * changes *when* axe runs, never *what* it checks.
 */
async function settleAnimations(page: Page): Promise<void> {
    await page
        .evaluate(async (timeoutMs) => {
            const finite = document.getAnimations().filter((animation) => {
                const timing = animation.effect?.getComputedTiming();
                return timing !== undefined && timing.iterations !== Infinity;
            });
            const settled = Promise.all(
                finite.map((animation) => animation.finished.catch(() => undefined)),
            );
            const capped = new Promise((resolve) => setTimeout(resolve, timeoutMs));
            await Promise.race([settled, capped]);
        }, ANIMATION_SETTLE_TIMEOUT_MS)
        .catch(() => undefined);
}

const config: TestRunnerConfig = {
    async preVisit(page, context) {
        if (!a11yEnabled) return;
        await injectAxe(page);

        const storyContext = await getStoryContext(page, context);
        await configureAxe(page, {
            rules: storyContext.parameters?.a11y?.config?.rules,
        });
    },

    async postVisit(page, context) {
        if (!a11yEnabled) return;

        await settleAnimations(page);

        await checkA11y(page, '#storybook-root', {
            detailedReport: true,
            detailedReportOptions: {
                html: true,
            },
            axeOptions: (await getStoryContext(page, context)).parameters?.a11y?.options,
        });
    },
};

export default config;
