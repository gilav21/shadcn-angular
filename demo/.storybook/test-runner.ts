import type { TestRunnerConfig } from '@storybook/test-runner';
import { injectAxe, checkA11y, configureAxe } from 'axe-playwright';
import { getStoryContext } from '@storybook/test-runner';

const config: TestRunnerConfig = {
    async preVisit(page, context) {
        // Inject axe before story renders
        await injectAxe(page);

        // Apply @storybook/addon-a11y parameters if you use them
        const storyContext = await getStoryContext(page, context);
        await configureAxe(page, {
            rules: storyContext.parameters?.a11y?.config?.rules,
        });
    },

    async postVisit(page, context) {
        // Run axe on the Storybook root and generate detailed HTML report
        await checkA11y(page, '#storybook-root', {
            detailedReport: true,
            detailedReportOptions: {
                html: true,
            },
            // Pass addon a11y options if defined
            axeOptions: (await getStoryContext(page, context)).parameters?.a11y?.options,
        });
    },
};

export default config;
