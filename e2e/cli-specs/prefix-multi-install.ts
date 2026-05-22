import fs from 'node:fs';
import path from 'node:path';
import { assertContains, type CliSpec } from './_types.js';

/**
 * Cross of two features that interact: `init --prefix acme` followed by
 * a multi-component `add button dialog popover`. Every installed
 * component's selector must be rewritten — catches a class of bug where
 * the prefix transform applies per-file but a batch later in the chain
 * ends up reading cached default-prefix content.
 */
const spec: CliSpec = async ({ runCli, fixtureApp }) => {
    await runCli(['init', '--yes', '--prefix', 'acme']);
    await runCli(['add', 'button', 'dialog', 'popover', '--yes']);

    const checks = [
        { file: 'src/components/ui/button/button.component.ts',   name: 'button' },
        { file: 'src/components/ui/dialog/dialog.component.ts',   name: 'dialog' },
        { file: 'src/components/ui/popover/popover.component.ts', name: 'popover' },
    ];

    for (const { file, name } of checks) {
        const abs = path.join(fixtureApp, file);
        if (!fs.existsSync(abs)) {
            throw new Error(`Expected file missing after add: ${file}`);
        }
        const content = fs.readFileSync(abs, 'utf-8');

        assertContains(content, `selector: 'acme-${name}'`,
            `${file} should declare selector 'acme-${name}'`);

        if (content.includes(`selector: 'ui-${name}'`)) {
            throw new Error(
                `${file} still contains 'ui-${name}' — prefix rewrite leaked through`,
            );
        }
    }
};

export default spec;
