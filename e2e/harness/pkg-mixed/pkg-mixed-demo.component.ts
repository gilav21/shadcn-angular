import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ButtonComponent } from '@/components/ui/button';
import { RichTextEditorComponent, RTE_FULL } from '@gilav21/shadcn-angular-rte';

/**
 * Mixed mode (UC-10): a CLI-COPIED `<ui-button>` and the COMPILED package's
 * editor on one page, in one app.
 *
 * This is the configuration a real adopter lands in — they already use the CLI
 * for most components and want the editor as a package — and it is the one that
 * could plausibly break. Both distributions define `ui-*` selectors and both
 * carry their own copies of shared services, so the risks are a selector
 * collision, a duplicate-symbol build failure, or a DI crash from two
 * independent `AddonSlotRegistry` graphs meeting in one injector tree.
 *
 * The button's counter is here so the assertion is behavioural: rendering both
 * elements proves they compile together, but only a working click proves the
 * copied component's own DI still functions with the package present.
 */
@Component({
    selector: 'app-pkg-mixed-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ButtonComponent, RichTextEditorComponent, RTE_FULL],
    template: `
        <main class="p-8 space-y-6">
            <section>
                <h2 class="mb-2 font-semibold">CLI-copied button</h2>
                <ui-button data-testid="copied-button" (click)="bump()">Clicked {{ count() }}</ui-button>
                <span data-testid="count">{{ count() }}</span>
            </section>

            <section>
                <h2 class="mb-2 font-semibold">Package editor</h2>
                <ui-rich-text-editor data-testid="editor" mode="html" uiRteFull />
            </section>
        </main>
    `,
})
export class PkgMixedDemoComponent {
    protected readonly count = signal(0);

    protected bump(): void {
        this.count.update((n) => n + 1);
    }
}
