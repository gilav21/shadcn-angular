import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { registry, type BreakingChange, type ComponentName } from '../registry/index.js';
import {
    printBindingCodemodReport,
    rewriteBreakingBindings,
    rewriteIdentifiers,
    rewriteTemplate,
    ruleOf,
    ruleTokens,
    rulesFor,
} from './binding-codemod.js';

const rename = (map: Record<string, string>): BreakingChange =>
    ({ kind: 'input', from: 'x', note: '', codemod: 'input-rename', rename: map });
const merge = (into: string, keys: Record<string, string>): BreakingChange =>
    ({ kind: 'input', from: 'x', note: '', codemod: 'input-merge', merge: { into, keys } });
const drop = (names: string[]): BreakingChange =>
    ({ kind: 'input', from: 'x', note: '', codemod: 'input-drop', drop: names });
const counter: BreakingChange = { kind: 'input', from: 'x', note: '', codemod: 'rte-counter' };
const rules = (...changes: BreakingChange[]) => changes.map((c) => ruleOf(c)).filter((r) => r !== null);

describe('rewriteTemplate — renames', () => {
    it('renames a property, event and banana binding and keeps the expression untouched', () => {
        const out = rewriteTemplate(
            `<ui-rich-text-editor [allowedResourceHosts]="hosts()" (remoteResource)="log($event)" [(a)]="b" />`,
            rules(rename({ allowedResourceHosts: 'allowedImageHosts', remoteResource: 'imageBlocked' })),
        );
        expect(out.content).toBe(
            `<ui-rich-text-editor [allowedImageHosts]="hosts()" (imageBlocked)="log($event)" [(a)]="b" />`,
        );
        expect(out.edits).toEqual([
            { line: 1, from: '[allowedResourceHosts]="hosts()"', to: '[allowedImageHosts]="hosts()"' },
            { line: 1, from: '(remoteResource)="log($event)"', to: '(imageBlocked)="log($event)"' },
        ]);
    });

    it('leaves a longer name that merely contains the token alone, and text outside tags', () => {
        const src = `<p>allowedResourceHosts</p><x [allowedResourceHostsExtra]="1" allowedResourceHosts="a.b" />`;
        const out = rewriteTemplate(src, rules(rename({ allowedResourceHosts: 'allowedImageHosts' })));
        expect(out.content).toBe(`<p>allowedResourceHosts</p><x [allowedResourceHostsExtra]="1" allowedImageHosts="a.b" />`);
    });

    it('preserves multi-line tags, indentation and single-quoted values', () => {
        const src = [
            '<ui-rich-text-view',
            "    [value]='doc'",
            "    [allowedResourceHosts]='hosts'",
            '    class="px-4">',
            '</ui-rich-text-view>',
        ].join('\n');
        const out = rewriteTemplate(src, rules(rename({ allowedResourceHosts: 'allowedImageHosts' })));
        expect(out.content).toBe(src.replace('[allowedResourceHosts]', '[allowedImageHosts]'));
        expect(out.edits[0].line).toBe(3);
    });

    it('is a no-op on a template with nothing to rewrite, byte for byte', () => {
        const src = `<div [x]="1 > 0" title='a "b"'>{{ a < b }}</div>\n<!-- <ui-rich-text-editor> -->`;
        expect(rewriteTemplate(src, rules(rename({ allowedResourceHosts: 'allowedImageHosts' }))).content).toBe(src);
    });
});

describe('rewriteTemplate — merges', () => {
    const history = merge('history', {
        historyLimit: 'limit', historyDebounceMs: 'debounceMs', recordExternalWrites: 'recordExternalWrites',
    });

    it('folds bound and static inputs into one object binding at the first input\'s position', () => {
        const out = rewriteTemplate(
            `<ui-rich-text-editor mode="html" [historyLimit]="200" placeholder="x" historyDebounceMs="500" [recordExternalWrites]="rec()" />`,
            rules(history),
        );
        expect(out.content).toBe(
            `<ui-rich-text-editor mode="html" [history]="{ limit: 200, debounceMs: 500, recordExternalWrites: rec() }" placeholder="x" />`,
        );
    });

    it('quotes a static string value and treats a bare attribute as true', () => {
        const out = rewriteTemplate(
            `<ui-rich-text-editor uiRteImages uiRteImagesSources="url" uiRteImagesAutoUpload />`,
            rules(merge('uiRteImagesUpload', { uiRteImagesSources: 'sources', uiRteImagesAutoUpload: 'auto' })),
        );
        expect(out.content).toBe(
            `<ui-rich-text-editor uiRteImages [uiRteImagesUpload]="{ sources: 'url', auto: true }" />`,
        );
    });

    it('wraps the old wrapper value into the new object', () => {
        const out = rewriteTemplate(
            `<div [uiRichTextResourcePolicy]="hosts"><ui-rich-text-view [value]="a" /></div>`,
            rules(merge('uiRichTextAllow', { uiRichTextResourcePolicy: 'imageHosts' })),
        );
        expect(out.content).toBe(`<div [uiRichTextAllow]="{ imageHosts: hosts }"><ui-rich-text-view [value]="a" /></div>`);
    });

    it('refuses to merge into an element that already binds the target, and says so', () => {
        const src = `<ui-rich-text-editor [history]="{ limit: 5 }" [historyLimit]="200" />`;
        const out = rewriteTemplate(src, rules(history));
        expect(out.content).toBe(src);
        expect(out.edits).toEqual([]);
        expect(out.manual).toHaveLength(1);
        expect(out.manual[0].to).toContain('already binds [history]');
    });
});

describe('rewriteTemplate — counter and drop', () => {
    it('turns two literal booleans into the matching counter value', () => {
        const out = rewriteTemplate(
            `<ui-rich-text-editor [showCount]="true" [showWordCount]="true" /><ui-rich-text-editor [showWordCount]="true" /><ui-rich-text-editor [showCount]="false" />`,
            rules(counter),
        );
        expect(out.content).toBe(
            `<ui-rich-text-editor counter="both" /><ui-rich-text-editor counter="words" /><ui-rich-text-editor />`,
        );
    });

    it('turns bound booleans into an expression that yields the same counter', () => {
        const out = rewriteTemplate(`<ui-rich-text-editor [showCount]="c()" [showWordCount]="w" />`, rules(counter));
        expect(out.content).toBe(
            `<ui-rich-text-editor [counter]="(c()) && (w) ? 'both' : (c()) ? 'characters' : (w) ? 'words' : undefined" />`,
        );
    });

    it('drops a removed input and records the removal', () => {
        const out = rewriteTemplate(
            `<ui-rich-text-view [value]="a" [inheritResourcePolicy]="true" />`,
            rules(drop(['inheritResourcePolicy'])),
        );
        expect(out.content).toBe(`<ui-rich-text-view [value]="a" />`);
        expect(out.edits).toEqual([{ line: 1, from: '[inheritResourcePolicy]="true"', to: '(removed)' }]);
    });
});

describe('rewriteIdentifiers', () => {
    it('renames an exported identifier at word boundaries only', () => {
        const src = `import { RichTextResourcePolicyDirective } from '@/components/ui/rich-text-editor';\nconst x = RichTextResourcePolicyDirectiveX;`;
        const out = rewriteIdentifiers(src, rules({
            kind: 'type', from: 'x', note: '', codemod: 'identifier-rename',
            rename: { RichTextResourcePolicyDirective: 'RichTextAllowDirective' },
        }));
        expect(out.content).toBe(`import { RichTextAllowDirective } from '@/components/ui/rich-text-editor';\nconst x = RichTextResourcePolicyDirectiveX;`);
        expect(out.edits).toEqual([{ line: 1, from: 'RichTextResourcePolicyDirective', to: 'RichTextAllowDirective' }]);
    });
});

describe('the registry declares the RTE rename rules', () => {
    it('gives the editor, the view and the images addon rewritable rules', () => {
        expect(rulesFor(['rich-text-editor'] as ComponentName[]).length).toBeGreaterThanOrEqual(6);
        expect(rulesFor(['rich-text-view'] as ComponentName[]).length).toBeGreaterThanOrEqual(3);
        expect(rulesFor(['rich-text-editor/images'] as ComponentName[]).length).toBeGreaterThanOrEqual(2);
    });

    it('every rule the registry declares names at least one scannable token, except identifier renames', () => {
        for (const name of Object.keys(registry) as ComponentName[]) {
            for (const change of registry[name].breaking ?? []) {
                if (!ruleOf(change) || change.codemod === 'identifier-rename') continue;
                expect(ruleTokens(change), `${name}: ${change.from}`).not.toHaveLength(0);
            }
        }
    });

    it('rewrites a consumer page that uses the whole old surface, end to end', () => {
        const src = [
            '<div [uiRichTextResourcePolicy]="hosts">',
            '  <ui-rich-text-editor mode="html" [allowedResourceHosts]="hosts" [inheritResourcePolicy]="true"',
            '    [showCount]="true" [showWordCount]="true" [historyLimit]="50" (remoteResource)="seen($event)"',
            '    uiRteImages [uiRteImagesUploader]="up" [uiRteImagesAutoUpload]="true" [uiRteImagesMaxWidth]="480" />',
            '</div>',
        ].join('\n');
        const all = rulesFor(['rich-text-editor', 'rich-text-view', 'rich-text-editor/images'] as ComponentName[]);
        const out = rewriteTemplate(src, all);
        expect(out.content).toBe([
            '<div [uiRichTextAllow]="{ imageHosts: hosts }">',
            '  <ui-rich-text-editor mode="html" [allowedImageHosts]="hosts"',
            '    counter="both" [history]="{ limit: 50 }" (imageBlocked)="seen($event)"',
            '    uiRteImages [uiRteImagesUpload]="{ uploader: up, auto: true }" [uiRteImagesLayout]="{ maxWidth: 480 }" />',
            '</div>',
        ].join('\n'));
        expect(out.manual).toEqual([]);
    });
});

describe('rewriteBreakingBindings', () => {
    let root = '';
    let logged: string[] = [];

    beforeEach(async () => {
        root = await fs.mkdtemp(path.join(os.tmpdir(), 'binding-codemod-'));
        logged = [];
        vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
            logged.push(args.map(String).join(' '));
        });
    });

    afterEach(async () => {
        vi.restoreAllMocks();
        await fs.remove(root);
    });

    async function externalComponent(name: string, template: string, extraTs = ''): Promise<void> {
        await fs.writeFile(path.join(root, `${name}.component.ts`), [
            `import { Component } from '@angular/core';`,
            extraTs,
            `@Component({ selector: 'app-${name}', templateUrl: './${name}.component.html' })`,
            `export class ${name}Component {}`,
        ].join('\n'));
        await fs.writeFile(path.join(root, `${name}.component.html`), template);
    }

    it('reports without writing, then writes the external template and the import rename', async () => {
        await externalComponent('page',
            `<ui-rich-text-view [value]="doc" [allowedResourceHosts]="['cdn.acme.com']" />`,
            `import { RichTextResourcePolicyDirective } from '@/components/ui/rich-text-editor';`);
        const components = ['rich-text-editor', 'rich-text-view'] as ComponentName[];

        const preview = await rewriteBreakingBindings(components, root, [], { write: false });
        expect(preview.edits.map((e) => e.to)).toEqual([
            `[allowedImageHosts]="['cdn.acme.com']"`, 'RichTextAllowDirective',
        ]);
        expect(preview.filesWritten).toBe(0);
        expect(await fs.readFile(path.join(root, 'page.component.html'), 'utf-8')).toContain('[allowedResourceHosts]');

        const applied = await rewriteBreakingBindings(components, root, [], { write: true });
        expect(applied.filesWritten).toBe(2);
        expect(await fs.readFile(path.join(root, 'page.component.html'), 'utf-8'))
            .toBe(`<ui-rich-text-view [value]="doc" [allowedImageHosts]="['cdn.acme.com']" />`);
        expect(await fs.readFile(path.join(root, 'page.component.ts'), 'utf-8')).toContain('RichTextAllowDirective');
        expect(await fs.readFile(path.join(root, 'page.component.ts'), 'utf-8')).not.toContain('ResourcePolicy');

        // Running again finds nothing left to do.
        expect((await rewriteBreakingBindings(components, root, [], { write: true })).edits).toEqual([]);
    });

    it('rewrites an inline template inside the .ts file itself', async () => {
        await fs.writeFile(path.join(root, 'inline.component.ts'), [
            `import { Component } from '@angular/core';`,
            '@Component({',
            `  selector: 'app-inline',`,
            '  template: `<ui-rich-text-editor [showCount]="true" (remoteResource)="log($event)" />`,',
            '})',
            'export class InlineComponent {}',
        ].join('\n'));
        const report = await rewriteBreakingBindings(['rich-text-editor'] as ComponentName[], root, [], { write: true });
        expect(report.filesWritten).toBe(1);
        const ts = await fs.readFile(path.join(root, 'inline.component.ts'), 'utf-8');
        expect(ts).toContain('<ui-rich-text-editor counter="characters" (imageBlocked)="log($event)" />');
    });

    it('prints the hint without --fix, the rewrites with it, and the dry-run wording', () => {
        const report = {
            edits: [{ file: path.join(root, 'a.html'), line: 3, from: '[x]="1"', to: '[y]="1"' }],
            manual: [{ file: path.join(root, 'b.html'), line: 9, from: '[z]="2"', to: 'already binds [q]; merge by hand' }],
            filesWritten: 0,
        };
        printBindingCodemodReport(report, root, { fix: false, dryRun: false });
        expect(logged.join('\n')).toContain('update --fix');

        logged = [];
        printBindingCodemodReport(report, root, { fix: true, dryRun: true });
        expect(logged.join('\n')).toContain('[Dry Run] Would rewrite 1 binding(s)');
        expect(logged.join('\n')).toContain('a.html:3');
        expect(logged.join('\n')).toContain('Needs a hand: b.html:9');

        logged = [];
        printBindingCodemodReport(report, root, { fix: true, dryRun: false });
        expect(logged.join('\n')).toContain('Rewrote 1 binding(s)');
    });
});
