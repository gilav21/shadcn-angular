import { Meta, StoryObj } from '@storybook/angular';

const meta: Meta = {
    title: 'Introduction',
    parameters: {
        layout: 'padded',
        options: {
            showPanel: false,
        },
    },
};

export default meta;

export const CLIDocumentation: StoryObj = {
    name: 'CLI Documentation',
    render: () => ({
        template: `
      <div style="font-family: 'Inter', sans-serif; max-width: 800px; margin: 0 auto; color: #0f172a;">
        <h1 style="font-size: 2.5rem; font-weight: 700; margin-bottom: 1rem; letter-spacing: -0.025em;">CLI Documentation</h1>
        <p style="font-size: 1.125rem; line-height: 1.75rem; margin-bottom: 2rem; color: #475569;">
          We have 2 options: <strong>init</strong> and <strong>add</strong>.
        </p>
        
        <div style="margin-bottom: 2.5rem;">
            <h2 style="font-size: 1.5rem; font-weight: 600; margin-bottom: 1rem; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.5rem;">init</h2>
            <p style="margin-bottom: 1rem;">The <code>init</code> command installs the needed packages and makes the project ready for components.</p>
            <div style="background-color: #f1f5f9; padding: 1rem; rounded: 0.5rem; border-radius: 0.5rem; font-family: monospace; font-size: 0.875rem;">
                npx shadcn-angular@latest init
            </div>
        </div>

        <div style="margin-bottom: 2.5rem;">
            <h2 style="font-size: 1.5rem; font-weight: 600; margin-bottom: 1rem; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.5rem;">add</h2>
            <p style="margin-bottom: 1rem;">The <code>add</code> command actually adds the components to the app.</p>
            <div style="background-color: #f1f5f9; padding: 1rem; rounded: 0.5rem; border-radius: 0.5rem; font-family: monospace; font-size: 0.875rem;">
                npx shadcn-angular@latest add button
            </div>
        </div>
      </div>
    `,
    }),
};
