/**
 * The compodoc → `api-docs.json` reduction. Everything downstream (llms.txt,
 * the demo app's API tables) reads this extract, so a mistake here silently
 * corrupts every generated surface at once.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    extractApiDocs,
    inferType,
    normalizeDescription,
    serializeApiDocs,
    type ApiDocs,
    type RawClass,
    type RawDocumentation,
} from './gen-api-docs-lib.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const committed = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, 'packages/components/api-docs.json'), 'utf-8'),
) as ApiDocs;

function raw(over: Partial<RawClass> & { name: string; file: string }): RawClass {
    return { ...over };
}

describe('normalizeDescription', () => {
    it('collapses compodoc\'s multi-line JSDoc into one line', () => {
        expect(normalizeDescription('\nFirst line.\n  Second line.\n')).toBe('First line. Second line.');
    });

    it('returns an empty string for a missing description', () => {
        expect(normalizeDescription(undefined)).toBe('');
    });
});

describe('inferType', () => {
    it('keeps a declared type verbatim', () => {
        expect(inferType({ name: 'x', type: "'a' | 'b'" })).toBe("'a' | 'b'");
    });

    it('recovers the type of a signal input from its initializer', () => {
        expect(inferType({ name: 'class', defaultValue: "''" })).toBe('string');
        expect(inferType({ name: 'disabled', defaultValue: 'false' })).toBe('boolean');
        expect(inferType({ name: 'size', defaultValue: '12' })).toBe('number');
        expect(inferType({ name: 'size', defaultValue: '-1.5' })).toBe('number');
        expect(inferType({ name: 'items', defaultValue: '[]' })).toBe('unknown[]');
    });

    it('falls back to unknown when there is nothing to infer from', () => {
        expect(inferType({ name: 'x' })).toBe('unknown');
        expect(inferType({ name: 'x', type: '', defaultValue: 'someFn()' })).toBe('unknown');
    });
});

describe('extractApiDocs', () => {
    const docs: RawDocumentation = {
        components: [
            raw({
                name: 'BoxComponent',
                file: 'packages/components/ui/box/box.component.ts',
                selector: 'ui-box',
                rawdescription: '\nA box.\n',
                templateData: '<div><ng-content /></div>',
                inputsClass: [
                    { name: 'b', type: 'string', required: true, rawdescription: 'Second.' },
                    { name: 'a', type: 'number', defaultValue: '3', rawdescription: 'First.' },
                ],
                outputsClass: [{ name: 'closed', type: 'void' }],
            }),
            raw({ name: 'DemoComponent', file: 'demo/src/app/demo.component.ts' }),
        ],
        directives: [
            raw({
                name: 'FlashDirective',
                file: 'packages/components/ui/flash.directive.ts',
                selector: '[uiFlash]',
            }),
        ],
    };

    const extract = extractApiDocs(docs);

    it('keeps only library sources, dropping demo and app classes', () => {
        expect(extract.classes.map(c => c.name)).toEqual(['BoxComponent', 'FlashDirective']);
    });

    it('tags each class with its kind', () => {
        expect(extract.classes.map(c => c.kind)).toEqual(['component', 'directive']);
    });

    it('sorts inputs and outputs by name so the output is stable', () => {
        expect(extract.classes[0].inputs.map(i => i.name)).toEqual(['a', 'b']);
    });

    it('carries required, default and description through', () => {
        const [a, b] = extract.classes[0].inputs;
        expect(a).toEqual({ name: 'a', type: 'number', description: 'First.', default: '3' });
        expect(b).toEqual({ name: 'b', type: 'string', description: 'Second.', required: true });
    });

    it('omits an absent or literally-undefined default', () => {
        const [{ classes }] = [extractApiDocs({
            components: [raw({
                name: 'C', file: 'packages/components/ui/c/c.component.ts',
                inputsClass: [{ name: 'x', type: 'string', defaultValue: 'undefined' }],
            })],
        })];
        expect(classes[0].inputs[0]).not.toHaveProperty('default');
    });

    it('records a deprecation message', () => {
        const { classes } = extractApiDocs({
            components: [raw({
                name: 'C', file: 'packages/components/ui/c/c.component.ts',
                inputsClass: [
                    { name: 'x', type: 'string', deprecated: true, deprecationMessage: 'Use y.' },
                    { name: 'y', type: 'string', deprecated: true },
                ],
            })],
        });
        expect(classes[0].inputs[0].deprecated).toBe('Use y.');
        expect(classes[0].inputs[1].deprecated).toBe('deprecated');
    });

    it('detects content projection from the resolved template', () => {
        expect(extract.classes[0].projectsContent).toBe(true);
        expect(extract.classes[1].projectsContent).toBe(false);
    });

    it('breaks a same-file tie on class name', () => {
        const file = 'packages/components/ui/pair/pair.component.ts';
        const { classes } = extractApiDocs({
            components: [raw({ name: 'ZComponent', file }), raw({ name: 'AComponent', file })],
        });
        expect(classes.map(c => c.name)).toEqual(['AComponent', 'ZComponent']);
    });

    it('is deterministic', () => {
        expect(serializeApiDocs(extractApiDocs(docs))).toBe(serializeApiDocs(extract));
    });

    it('tolerates a documentation.json with neither key', () => {
        expect(extractApiDocs({}).classes).toEqual([]);
    });
});

describe('the committed extract', () => {
    it('is at the schema version the readers expect', () => {
        expect(committed.version).toBe(1);
    });

    it('covers the whole library, not a slice of it', () => {
        expect(committed.classes.length).toBeGreaterThan(300);
    });

    it('only contains library sources', () => {
        for (const cls of committed.classes) {
            expect(cls.file.startsWith('packages/components/ui/'), cls.file).toBe(true);
        }
    });

    it('has no leftover `unknown` types on inputs that declare a default', () => {
        const button = committed.classes.find(c => c.name === 'ButtonComponent');
        const classInput = button?.inputs.find(i => i.name === 'class');
        expect(classInput?.type).toBe('string');
    });

    it('is sorted by file then class name', () => {
        const keys = committed.classes.map(c => `${c.file}::${c.name}`);
        expect(keys).toEqual([...keys].sort((a, b) => a.localeCompare(b)));
    });
});
