import {
    ChangeDetectionStrategy,
    Component,
    computed,
    inject,
    signal,
    viewChild,
} from '@angular/core';
import {
    FieldComponent,
    FieldDescriptionComponent,
    FieldLabelComponent,
    InputComponent,
    SignaturePadComponent,
} from '../../../../../packages/components/ui';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { SIGNATURE_PAD_DEMO_LOCALES } from './signature-pad-demo.locales';

type SignatureMode = 'draw' | 'type';

@Component({
    selector: 'app-signature-pad-demo',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        SignaturePadComponent,
        InputComponent,
        FieldComponent,
        FieldLabelComponent,
        FieldDescriptionComponent,
    ],
    template: `
        <section class="max-w-2xl space-y-8">
            <div>
                <h2 id="signature-pad" class="scroll-m-20 text-2xl font-semibold">
                    {{ t().heading }}
                </h2>
                <p class="text-muted-foreground mt-1">{{ t().description }}</p>
            </div>

            <div class="space-y-3">
                <h3 class="text-lg font-medium">{{ t().basicHeading }}</h3>
                <p class="text-muted-foreground text-sm">{{ t().basicDescription }}</p>
                <ui-signature-pad
                    #pad
                    [(value)]="signature"
                    [ariaLabel]="t().signatureLabel"
                    [clearLabel]="t().clearLabel"
                    [undoLabel]="t().undoLabel"
                />
                <p class="text-muted-foreground text-sm" data-testid="basic-state">
                    {{ signature() ? t().signedLabel : t().notSignedLabel }}
                </p>
            </div>

            <div class="space-y-3">
                <h3 class="text-lg font-medium">{{ t().penHeading }}</h3>
                <p class="text-muted-foreground text-sm">{{ t().penDescription }}</p>
                <ui-signature-pad
                    penColor="#1d4ed8"
                    [penWidth]="4"
                    [height]="140"
                    [ariaLabel]="t().signatureLabel"
                    [clearLabel]="t().clearLabel"
                    [undoLabel]="t().undoLabel"
                />
            </div>

            <!--
              §3.4: this control cannot be made accessible by labelling it, so
              the demo shows the alternative rather than claiming otherwise.
            -->
            <div class="space-y-3">
                <h3 class="text-lg font-medium">{{ t().a11yHeading }}</h3>
                <p class="text-muted-foreground text-sm">{{ t().a11yDescription }}</p>
                <p class="text-sm font-medium">{{ t().a11yWarning }}</p>

                <div class="flex flex-wrap gap-4" role="radiogroup" [attr.aria-label]="t().a11yHeading">
                    @for (option of modes; track option) {
                        <label class="flex items-center gap-2 text-sm">
                            <input
                                type="radio"
                                name="signature-mode"
                                class="size-4"
                                [value]="option"
                                [checked]="mode() === option"
                                [attr.data-testid]="'mode-' + option"
                                (change)="mode.set(option)"
                            />
                            {{ option === 'draw' ? t().drawOption : t().typeOption }}
                        </label>
                    }
                </div>

                @if (mode() === 'draw') {
                    <ui-signature-pad
                        [(value)]="consent"
                        [height]="140"
                        [ariaLabel]="t().signatureLabel"
                        [clearLabel]="t().clearLabel"
                        [undoLabel]="t().undoLabel"
                    />
                } @else {
                    <ui-field>
                        <ui-field-label for="typed-name">{{ t().nameLabel }}</ui-field-label>
                        <ui-input
                            id="typed-name"
                            [(value)]="typedName"
                            [placeholder]="t().namePlaceholder"
                            [ariaLabel]="t().nameLabel"
                        />
                        <ui-field-description>{{ t().a11yWarning }}</ui-field-description>
                    </ui-field>
                }
            </div>

            <div class="space-y-3">
                <h3 class="text-lg font-medium">{{ t().formatsHeading }}</h3>
                <p class="text-muted-foreground text-sm">{{ t().formatsDescription }}</p>
                <p class="text-muted-foreground text-sm" data-testid="svg-length">
                    SVG: {{ svgLength() }}
                </p>
            </div>
        </section>
    `,
})
export class SignaturePadDemoComponent {
    private readonly localeId = inject(UI_LOCALE_ID);
    protected readonly t = computed(
        () => SIGNATURE_PAD_DEMO_LOCALES[this.localeId()] ?? SIGNATURE_PAD_DEMO_LOCALES['en'],
    );

    protected readonly modes: readonly SignatureMode[] = ['draw', 'type'];
    protected readonly mode = signal<SignatureMode>('draw');

    protected readonly signature = signal<string | null>(null);
    protected readonly consent = signal<string | null>(null);
    protected readonly typedName = signal('');

    private readonly pad = viewChild.required<SignaturePadComponent>('pad');

    /** Shows that the SVG form exists without dumping a data URL on the page. */
    protected readonly svgLength = computed(() => {
        this.signature();
        return this.pad().toDataURL('svg')?.length ?? 0;
    });
}
