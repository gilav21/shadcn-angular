import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { RichTextEditorAddonsDemoComponent } from './rich-text-editor-addons-demo.component';
import { provideUiLocale } from '../../../../../packages/components/lib/i18n';
import { RICH_TEXT_EDITOR_ADDONS_DEMO_LOCALES } from './rich-text-editor-addons-demo.locales';

/** The protected computed under test, reached the way the sibling demo specs do. */
type Harness = { installCommands: () => string; applyPreset: (p: string) => void; setAddon: (k: string, on: boolean) => void };

function createHarness(): { component: Harness; detect: () => void } {
    const fixture = TestBed.createComponent(RichTextEditorAddonsDemoComponent);
    fixture.detectChanges();
    return {
        component: fixture.componentInstance as unknown as Harness,
        detect: () => fixture.detectChanges(),
    };
}

describe('RichTextEditorAddonsDemoComponent installCommands', () => {
    describe('English (default)', () => {
        beforeEach(() => {
            TestBed.configureTestingModule({ imports: [RichTextEditorAddonsDemoComponent] });
        });

        it('emits a single --preset command when the toggles match a preset (T-33)', () => {
            const { component } = createHarness();

            component.applyPreset('writing');

            const commands = component.installCommands();
            expect(commands).toContain('add rich-text-editor --preset writing');
            // One command, not one `apply` line per addon.
            expect(commands).not.toContain('apply rich-text-editor/');
            expect(commands.split('\n').filter(l => l.includes('shadcn-angular'))).toHaveLength(1);
        });

        it('emits --preset media for the media kit (T-33)', () => {
            const { component } = createHarness();

            component.applyPreset('media');

            expect(component.installCommands()).toContain('add rich-text-editor --preset media');
        });

        it('emits --preset everything when every toggle is on (T-33)', () => {
            const { component } = createHarness();

            component.applyPreset('everything');

            expect(component.installCommands()).toContain('add rich-text-editor --preset everything');
        });

        it('emits --with for a selection that matches no preset (T-34)', () => {
            const { component } = createHarness();

            component.applyPreset('core');
            component.setAddon('links', true);
            component.setAddon('ai', true);

            const commands = component.installCommands();
            expect(commands).toContain('--with');
            expect(commands).toContain('rich-text-editor/links');
            expect(commands).toContain('rich-text-editor/ai');
            expect(commands).not.toContain('--preset');
        });

        it('does not claim a preset for a different selection of the same size (T-34)', () => {
            const { component } = createHarness();

            // Same cardinality as `writing` (4), entirely different addons —
            // a size-only match would wrongly emit `--preset writing`.
            component.applyPreset('core');
            for (const key of ['colors', 'typography', 'emoji', 'ai']) {
                component.setAddon(key, true);
            }

            const commands = component.installCommands();
            expect(commands).not.toContain('--preset');
            expect(commands).toContain('--with');
        });

        it('does not claim `media` for a 3-addon selection that is not media (T-34)', () => {
            const { component } = createHarness();

            component.applyPreset('core');
            for (const key of ['links', 'history', 'ai']) {
                component.setAddon(key, true);
            }

            expect(component.installCommands()).not.toContain('--preset');
        });

        it('emits --preset core when no addon is enabled (T-34)', () => {
            const { component } = createHarness();

            component.applyPreset('core');

            expect(component.installCommands()).toContain('add rich-text-editor --preset core');
        });

        it('prefixes the command with the English base note (T-34)', () => {
            const { component } = createHarness();

            component.applyPreset('writing');

            expect(component.installCommands())
                .toContain(RICH_TEXT_EDITOR_ADDONS_DEMO_LOCALES['en'].commandsBaseNote);
        });
    });

    describe('Hebrew locale', () => {
        beforeEach(() => {
            TestBed.configureTestingModule({
                imports: [RichTextEditorAddonsDemoComponent],
                providers: [provideUiLocale('he')],
            });
        });

        it('uses the he note but keeps the command itself LTR ASCII (T-35)', () => {
            const { component } = createHarness();

            component.applyPreset('writing');

            const commands = component.installCommands();
            expect(commands).toContain(RICH_TEXT_EDITOR_ADDONS_DEMO_LOCALES['he'].commandsBaseNote);
            // The command is not localised — it is typed into a shell verbatim.
            expect(commands).toContain('npx @gilav21/shadcn-angular add rich-text-editor --preset writing');
        });
    });
});
