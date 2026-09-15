import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { resolvePreset, PresetError } from './presets.js';
import { registry, type ComponentDefinition } from '../registry/index.js';

const mutable = registry as unknown as Record<string, ComponentDefinition>;

describe('resolvePreset', () => {
    let snapshot: Record<string, ComponentDefinition>;

    beforeAll(() => {
        snapshot = structuredClone(mutable);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        for (const key of Object.keys(mutable)) delete mutable[key];
        Object.assign(mutable, structuredClone(snapshot));
    });

    it("returns the preset's addon keys for a declaring base (T-11)", () => {
        const resolution = resolvePreset(['rich-text-editor'], 'writing');

        expect(resolution.addons).toEqual([
            'rich-text-editor/slash-commands',
            'rich-text-editor/links',
            'rich-text-editor/history',
            'rich-text-editor/outline',
        ]);
        expect(resolution.declaredBy).toEqual(['rich-text-editor']);
    });

    it('returns an empty addon list for the `core` preset (T-11)', () => {
        const resolution = resolvePreset(['rich-text-editor'], 'core');

        expect(resolution.addons).toEqual([]);
        expect(resolution.declaredBy).toEqual(['rich-text-editor']);
    });

    it('throws PresetError listing the available names for an unknown preset (T-12)', () => {
        expect(() => resolvePreset(['rich-text-editor'], 'wrting')).toThrow(PresetError);
        expect(() => resolvePreset(['rich-text-editor'], 'wrting')).toThrow(
            'Unknown preset "wrting" for rich-text-editor. Available: core, writing, media, styling, everything',
        );
    });

    it('throws PresetError when the one requested base declares no presets (T-13)', () => {
        expect(() => resolvePreset(['button'], 'writing')).toThrow(
            'button declares no presets — see: npx @gilav21/shadcn-angular why button',
        );
    });

    it('throws PresetError naming every base when several declare no presets (T-13)', () => {
        expect(() => resolvePreset(['button', 'badge'], 'writing')).toThrow(
            'None of button, badge declare presets.',
        );
    });

    it('unions a preset across several declaring bases (T-14)', () => {
        mutable['fixture-base'] = {
            name: 'fixture-base',
            files: ['fixture-base/fixture-base.component.ts'],
            addons: ['fixture-base/alpha'],
            presets: { core: [], writing: ['fixture-base/alpha'] },
        } as ComponentDefinition;

        const resolution = resolvePreset(['rich-text-editor', 'fixture-base'], 'writing');

        expect(resolution.addons).toContain('rich-text-editor/links');
        expect(resolution.addons).toContain('fixture-base/alpha');
        expect(resolution.declaredBy).toEqual(['rich-text-editor', 'fixture-base']);
    });

    it('applies the preset where declared when another requested base lacks the name (T-14)', () => {
        // `data-table` declares presets but not `writing`; `rich-text-editor` does.
        const resolution = resolvePreset(['rich-text-editor', 'data-table'], 'writing');

        expect(resolution.addons).toContain('rich-text-editor/links');
        expect(resolution.declaredBy).toEqual(['rich-text-editor']);
    });

    it('throws when the name is missing on every declaring base (T-12)', () => {
        expect(() => resolvePreset(['data-table'], 'writing')).toThrow(PresetError);
        expect(() => resolvePreset(['data-table'], 'writing')).toThrow(
            'Unknown preset "writing" for data-table. Available: core, menus, reporting, everything',
        );
    });

    it('dedupes an addon that two declaring bases both name (T-14)', () => {
        mutable['fixture-base'] = {
            name: 'fixture-base',
            files: ['fixture-base/fixture-base.component.ts'],
            addons: ['rich-text-editor/links'],
            presets: { core: [], writing: ['rich-text-editor/links'] },
        } as ComponentDefinition;

        const resolution = resolvePreset(['rich-text-editor', 'fixture-base'], 'writing');

        const links = resolution.addons.filter(a => a === 'rich-text-editor/links');
        expect(links).toHaveLength(1);
    });
});
