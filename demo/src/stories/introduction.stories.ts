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
      <div style="font-family: 'Inter', sans-serif; max-width: 800px; margin: 0 auto; color: #0f172a; line-height: 1.6;">
        <h1 style="font-size: 2.5rem; font-weight: 700; margin-bottom: 1.5rem; letter-spacing: -0.025em; border-bottom: 2px solid #e2e8f0; padding-bottom: 0.5rem;">CLI Documentation</h1>
        <p style="font-size: 1.125rem; margin-bottom: 2rem; color: #475569;">
          The <code>shadcn-angular</code> CLI is your primary tool for adding components and configuring your Angular application. It has two main commands: <strong>init</strong> and <strong>add</strong>.
        </p>
        
        <!-- INIT SECTION -->
        <div style="margin-bottom: 3.5rem;">
            <h2 style="font-size: 1.75rem; font-weight: 600; margin-bottom: 1.25rem; color: #1e293b; display: flex; align-items: center; gap: 0.5rem;">
                <span style="background: #0f172a; color: white; padding: 0.25rem 0.75rem; border-radius: 0.375rem; font-size: 1rem;">1</span>
                init
            </h2>
            <p style="margin-bottom: 1rem;">Use the <code>init</code> command to initialize your project, install dependencies, and configure aliases.</p>
            
            <div style="background-color: #1e293b; color: #f8fafc; padding: 1rem; border-radius: 0.5rem; font-family: 'JetBrains Mono', monospace; font-size: 0.875rem; margin-bottom: 1.5rem;">
                npx shadcn-angular@latest init
            </div>

            <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.75rem;">What it does</h3>
            <ul style="list-style-type: disc; padding-left: 1.5rem; margin-bottom: 1.5rem; color: #475569;">
                <li>Creates a <code>components.json</code> configuration file.</li>
                <li>Creates a <code>utils.ts</code> file for cn() helper.</li>
                <li>Updates your global CSS file with CSS variables for theming.</li>
                <li>Installs dependencies: <code>tailwindcss</code>, <code>postcss</code>, <code>lucide-angular</code>, <code>class-variance-authority</code>, etc.</li>
                <li>Configures aliases (e.g., <code>@/components</code>) in your project.</li>
            </ul>

            <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.75rem;">Configuration Prompts</h3>
            <p style="margin-bottom: 0.5rem;">You will be asked to configure:</p>
            <ul style="list-style-type: none; padding-left: 0; margin-bottom: 1.5rem; display: grid; gap: 0.5rem;">
                <li style="background: #f1f5f9; padding: 0.5rem 1rem; border-radius: 0.25rem;"><strong>Style:</strong> Default or New York</li>
                <li style="background: #f1f5f9; padding: 0.5rem 1rem; border-radius: 0.25rem;"><strong>Base Color:</strong> Slate, Gray, Zinc, Neutral, or Stone</li>
                <li style="background: #f1f5f9; padding: 0.5rem 1rem; border-radius: 0.25rem;"><strong>Paths:</strong> Global CSS, Components folder, Utils folder</li>
            </ul>

             <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.75rem;">Options</h3>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 1.5rem; font-size: 0.95rem;">
                <tr style="border-bottom: 1px solid #e2e8f0; text-align: left;">
                    <th style="padding: 0.5rem;">Flag</th>
                    <th style="padding: 0.5rem;">Description</th>
                </tr>
                <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 0.5rem;"><code style="background: #e2e8f0; padding: 0.1rem 0.3rem; border-radius: 0.25rem;">--yes</code>, <code style="background: #e2e8f0; padding: 0.1rem 0.3rem; border-radius: 0.25rem;">-y</code></td>
                    <td style="padding: 0.5rem;">Skip prompts and use defaults.</td>
                </tr>
                 <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 0.5rem;"><code style="background: #e2e8f0; padding: 0.1rem 0.3rem; border-radius: 0.25rem;">--defaults</code>, <code style="background: #e2e8f0; padding: 0.1rem 0.3rem; border-radius: 0.25rem;">-d</code></td>
                    <td style="padding: 0.5rem;">Use default configuration values.</td>
                </tr>
            </table>
        </div>

        <!-- ADD SECTION -->
        <div style="margin-bottom: 4rem;">
            <h2 style="font-size: 1.75rem; font-weight: 600; margin-bottom: 1.25rem; color: #1e293b; display: flex; align-items: center; gap: 0.5rem;">
                <span style="background: #0f172a; color: white; padding: 0.25rem 0.75rem; border-radius: 0.375rem; font-size: 1rem;">2</span>
                add
            </h2>
            <p style="margin-bottom: 1rem;">Use the <code>add</code> command to install components into your project.</p>
            
            <div style="background-color: #1e293b; color: #f8fafc; padding: 1rem; border-radius: 0.5rem; font-family: 'JetBrains Mono', monospace; font-size: 0.875rem; margin-bottom: 1.5rem;">
                npx shadcn-angular@latest add [component]
            </div>

            <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.75rem;">Examples</h3>
             <div style="display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1.5rem;">
                <code style="background: #f1f5f9; padding: 0.75rem; border-radius: 0.25rem; border-left: 4px solid #0f172a;">npx shadcn-angular@latest add button</code>
                <code style="background: #f1f5f9; padding: 0.75rem; border-radius: 0.25rem; border-left: 4px solid #0f172a;">npx shadcn-angular@latest add button input card</code>
            </div>

             <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.75rem;">Features</h3>
            <ul style="list-style-type: disc; padding-left: 1.5rem; margin-bottom: 1.5rem; color: #475569;">
                <li><strong>Dependency Resolution:</strong> Automatically installs necessary dependencies (e.g., adding <code>accordion</code> also adds the necessary animations).</li>
                <li><strong>Alias Transformation:</strong> Rewrites imports (e.g., <code>../lib/utils</code>) to match your project's configuration (<code>@/lib/utils</code>).</li>
                <li><strong>Multiselect:</strong> If run without arguments, presents a list of all available components to choose from.</li>
            </ul>

            <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.75rem;">Options</h3>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 1.5rem; font-size: 0.95rem;">
                <tr style="border-bottom: 1px solid #e2e8f0; text-align: left;">
                    <th style="padding: 0.5rem;">Flag</th>
                    <th style="padding: 0.5rem;">Description</th>
                </tr>
                <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 0.5rem;"><code style="background: #e2e8f0; padding: 0.1rem 0.3rem; border-radius: 0.25rem;">--yes</code>, <code style="background: #e2e8f0; padding: 0.1rem 0.3rem; border-radius: 0.25rem;">-y</code></td>
                    <td style="padding: 0.5rem;">Skip confirmation prompts.</td>
                </tr>
                 <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 0.5rem;"><code style="background: #e2e8f0; padding: 0.1rem 0.3rem; border-radius: 0.25rem;">--overwrite</code></td>
                    <td style="padding: 0.5rem;">Overwrite existing files without asking.</td>
                </tr>
                <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 0.5rem;"><code style="background: #e2e8f0; padding: 0.1rem 0.3rem; border-radius: 0.25rem;">--all</code>, <code style="background: #e2e8f0; padding: 0.1rem 0.3rem; border-radius: 0.25rem;">-a</code></td>
                    <td style="padding: 0.5rem;">Install ALL available components.</td>
                </tr>
                 <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 0.5rem;"><code style="background: #e2e8f0; padding: 0.1rem 0.3rem; border-radius: 0.25rem;">--path</code></td>
                    <td style="padding: 0.5rem;">Specify a custom installation directory for components.</td>
                </tr>
            </table>

            <div style="background-color: #fef2f2; border: 1px solid #fecaca; padding: 1rem; border-radius: 0.5rem; color: #991b1b;">
                <strong>Error Handling:</strong> If a component is invalid or your <code>components.json</code> is missing, the CLI will exit with a helpful error message guiding you to run <code>init</code> or check the component name.
            </div>
        </div>
      </div>
    `,
    }),
};
