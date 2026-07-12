import type { TestRunnerConfig } from '@storybook/test-runner';
import { injectAxe, checkA11y, configureAxe } from 'axe-playwright';
import { getStoryContext } from '@storybook/test-runner';

/**
 * Axe is OPT-IN: `npm run test-storybook` runs the stories and play functions only
 * (green, and safe as a pre-push gate), while `npm run test-storybook:a11y` sets
 * STORYBOOK_A11Y=1 and turns the assertions below on.
 *
 * The a11y run is expected to FAIL right now — the library carries a real,
 * documented a11y backlog (see docs/a11y-backlog.md). The checks below are the
 * full, unweakened axe ruleset and must stay that way: fix the components, never
 * the assertion.
 */
const a11yEnabled = process.env['STORYBOOK_A11Y'] === '1';

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
