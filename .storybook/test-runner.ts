import type { TestRunnerConfig } from '@storybook/test-runner';
import { injectAxe, checkA11y, configureAxe } from 'axe-playwright';
import { getStoryContext } from '@storybook/test-runner';

/**
 * Set STORYBOOK_A11Y=0 to run the play functions only and skip the axe
 * assertions (useful while triaging a large a11y backlog). Axe runs by default.
 */
const a11yEnabled = process.env['STORYBOOK_A11Y'] !== '0';

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
