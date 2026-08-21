import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
    BadgeComponent,
    ButtonComponent,
    CardComponent,
    CardContentComponent,
    CardHeaderComponent,
    CardTitleComponent,
    CheckboxComponent,
    CodeBlockComponent,
    IconComponent,
    InputComponent,
    LabelComponent,
    ProgressComponent,
    SwitchComponent,
} from '../../../../packages/components/ui';
// Not re-exported by the `ui` barrel — the flat directives are imported by path.
import { CopyToDirective } from '../../../../packages/components/ui/directives/copy-to.directive';
import { UI_LOCALE_ID } from '../../../../packages/components/lib/i18n';
import { DOCS_LOCALES } from './docs.locales';
import {
    BASE_COLORS,
    buildThemeCss,
    colorVars,
    DEFAULT_THEME_SETTINGS,
    DENSITY_LEVELS,
    equivalentCommands,
    MOTION_LABELS,
    MOTION_LEVELS,
    RADIUS_NAMES,
    resolveRadius,
    scalarVars,
    type ThemeSettings,
} from './theme-tokens';
import type { BaseColor, ThemeColor } from '../../../../packages/cli/src/templates/styles';
import { THEME_NAMES } from './theme-tokens';

/**
 * `/theme-playground` — a visual front end for the four theming commands that
 * previously had none (`change-theme`, `set-radius`, `set-density`,
 * `set-motion`).
 *
 * The preview applies the chosen tokens as inline custom properties on a
 * scoped container, so it never leaks into the rest of the demo app and needs
 * no global stylesheet surgery. The CSS shown underneath is byte-identical to
 * what the CLI would write — `theme-parity.spec.ts` runs the real commands and
 * compares — so pasting it can never fight a later CLI run.
 */
@Component({
    selector: 'app-theme-playground',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        BadgeComponent, ButtonComponent, CardComponent, CardContentComponent,
        CardHeaderComponent, CardTitleComponent, CheckboxComponent, CodeBlockComponent,
        CopyToDirective, FormsModule, IconComponent, InputComponent, LabelComponent,
        ProgressComponent,
        SwitchComponent,
    ],
    template: `
    <section class="space-y-6" data-slot="theme-playground">
      <header class="space-y-1">
        <h2 class="text-2xl font-semibold">{{ t().playgroundHeading }}</h2>
        <p class="text-muted-foreground">{{ t().playgroundDescription }}</p>
      </header>

      <div class="grid gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <form class="space-y-5" (submit)="$event.preventDefault()">
          <fieldset class="space-y-2">
            <legend class="text-sm font-semibold">{{ t().theme }}</legend>
            <div class="flex flex-wrap gap-2" role="group" [attr.aria-label]="t().theme">
              @for (name of themes; track name) {
                <ui-button
                  type="button"
                  size="sm"
                  [variant]="settings().theme === name ? 'default' : 'outline'"
                  [attr.aria-pressed]="settings().theme === name"
                  [attr.data-theme-option]="name"
                  (clicked)="setTheme(name)">
                  {{ name }}
                </ui-button>
              }
            </div>
          </fieldset>

          <fieldset class="space-y-2">
            <legend class="text-sm font-semibold">{{ t().baseColor }}</legend>
            <div class="flex flex-wrap gap-2" role="group" [attr.aria-label]="t().baseColor">
              @for (name of baseColors; track name) {
                <ui-button
                  type="button"
                  size="sm"
                  [variant]="settings().baseColor === name ? 'secondary' : 'ghost'"
                  [attr.aria-pressed]="settings().baseColor === name"
                  (clicked)="setBaseColor(name)">
                  {{ name }}
                </ui-button>
              }
            </div>
            <p class="text-xs text-muted-foreground">{{ t().baseColorHint }}</p>
          </fieldset>

          <fieldset class="space-y-2">
            <legend class="text-sm font-semibold">
              {{ t().density }} — {{ settings().density }}
            </legend>
            <div class="flex flex-wrap gap-2">
              @for (level of densityLevels; track level) {
                <ui-button
                  type="button"
                  size="sm"
                  [variant]="settings().density === level ? 'default' : 'outline'"
                  [attr.aria-pressed]="settings().density === level"
                  [attr.data-density-option]="level"
                  (clicked)="setDensityLevel(level)">
                  {{ level }}
                </ui-button>
              }
            </div>
          </fieldset>

          <fieldset class="space-y-2">
            <legend class="text-sm font-semibold">{{ t().radius }}</legend>
            <div class="flex flex-wrap gap-2" role="group" [attr.aria-label]="t().radius">
              @for (name of radiusNames; track name) {
                <ui-button
                  type="button"
                  size="sm"
                  [variant]="settings().radius === name ? 'default' : 'outline'"
                  [attr.aria-pressed]="settings().radius === name"
                  [attr.data-radius-option]="name"
                  (clicked)="setRadius(name)">
                  {{ name }}
                </ui-button>
              }
            </div>
            <ui-label for="playground-raw-radius">{{ t().customRadius }}</ui-label>
            <ui-input
              id="playground-raw-radius"
              [ngModel]="settings().radius"
              [ngModelOptions]="{ standalone: true }"
              (ngModelChange)="setRadius($event)"
              placeholder="0.5rem" />
            @if (!radiusValid()) {
              <p class="text-xs text-destructive" data-slot="radius-error">{{ t().radiusInvalid }}</p>
            }
          </fieldset>

          <fieldset class="space-y-2">
            <legend class="text-sm font-semibold">{{ t().motion }}</legend>
            <div class="flex flex-wrap gap-2" role="group" [attr.aria-label]="t().motion">
              @for (level of motionLevels; track level) {
                <ui-button
                  type="button"
                  size="sm"
                  [variant]="settings().motion === level ? 'default' : 'outline'"
                  [attr.aria-pressed]="settings().motion === level"
                  [attr.data-motion-option]="level"
                  (clicked)="setMotion(level)">
                  {{ motionLabel(level) }}
                </ui-button>
              }
            </div>
          </fieldset>

          <div class="flex flex-wrap items-center gap-2">
            <ui-switch
              id="playground-dark"
              [checked]="dark()"
              [ariaLabel]="t().darkPreview"
              (checkedChange)="dark.set($event)" />
            <ui-label for="playground-dark">{{ t().darkPreview }}</ui-label>
            <ui-button type="button" variant="ghost" size="sm" (clicked)="reset()">
              {{ t().reset }}
            </ui-button>
          </div>
        </form>

        <div class="space-y-6">
          <div
            class="space-y-4 rounded-lg border p-4"
            data-slot="theme-preview"
            [class.dark]="dark()"
            [style]="previewStyle()">
            <div class="flex flex-wrap items-center gap-2">
              <ui-button>Primary</ui-button>
              <ui-button variant="secondary">Secondary</ui-button>
              <ui-button variant="outline">Outline</ui-button>
              <ui-button variant="destructive">Destructive</ui-button>
              <ui-badge>Badge</ui-badge>
            </div>
            <ui-card>
              <ui-card-header>
                <ui-card-title>{{ t().preview }}</ui-card-title>
              </ui-card-header>
              <ui-card-content class="space-y-3">
                <ui-label for="playground-sample">{{ t().name }}</ui-label>
                <ui-input id="playground-sample" placeholder="Ada Lovelace" />
                <div class="flex flex-wrap items-center gap-3">
                  <ui-checkbox id="playground-check" [ariaLabel]="t().required" />
                  <ui-label for="playground-check">{{ t().required }}</ui-label>
                </div>
                <ui-progress [value]="62" />
              </ui-card-content>
            </ui-card>
          </div>

          <div class="space-y-2">
            <div class="flex flex-wrap items-center gap-2">
              <h3 class="text-sm font-semibold">{{ t().generatedCss }}</h3>
              <ui-button
                class="ms-auto"
                type="button"
                variant="outline"
                size="sm"
                data-slot="copy-css"
                [uiCopyTo]="css()"
                [ariaLabel]="t().copyCss">
                <ui-icon name="copy" size="sm" class="me-1" />
                {{ t().copyCss }}
              </ui-button>
            </div>
            <p class="text-xs text-muted-foreground">{{ t().cssHint }}</p>
            <ui-code-block [code]="css()" language="css" data-slot="generated-css" />
          </div>

          <div class="space-y-2">
            <h3 class="text-sm font-semibold">{{ t().equivalentCommands }}</h3>
            <ui-code-block [code]="commands()" language="bash" [lineNumbers]="false" />
          </div>
        </div>
      </div>
    </section>
  `,
})
export class ThemePlaygroundComponent {
    protected readonly themes = THEME_NAMES;
    protected readonly baseColors = BASE_COLORS;
    protected readonly densityLevels = DENSITY_LEVELS;
    protected readonly motionLevels = MOTION_LEVELS;
    protected readonly radiusNames = RADIUS_NAMES;

    readonly settings = signal<ThemeSettings>(DEFAULT_THEME_SETTINGS);
    readonly dark = signal(false);

    private readonly localeId = inject(UI_LOCALE_ID);
    readonly t = computed(() => DOCS_LOCALES[this.localeId()] ?? DOCS_LOCALES['en']);

    /** False when the typed radius is one `set-radius` would reject. */
    readonly radiusValid = computed(() => resolveRadius(this.settings().radius) !== null);

    /** The copy-paste block — identical to what the four CLI commands write. */
    readonly css = computed(() => buildThemeCss(this.settings()));

    readonly commands = computed(() => equivalentCommands(this.settings()).join('\n'));

    /**
     * Tokens applied as inline custom properties on the preview container only.
     * Scoping them here (rather than to `document.documentElement`) keeps the
     * surrounding demo app on its own theme while the preview changes.
     */
    readonly previewStyle = computed(() => {
        const settings = this.settings();
        const vars = {
            ...colorVars(settings, this.dark() ? 'dark' : 'light'),
            ...scalarVars(settings),
        };
        return Object.entries(vars).map(([name, value]) => `${name}:${value}`).join(';');
    });

    protected setTheme(theme: ThemeColor): void {
        this.settings.update(current => ({ ...current, theme }));
    }

    protected setBaseColor(baseColor: BaseColor): void {
        this.settings.update(current => ({ ...current, baseColor }));
    }

    protected setRadius(radius: string): void {
        this.settings.update(current => ({ ...current, radius }));
    }

    protected setMotion(motion: number): void {
        this.settings.update(current => ({ ...current, motion }));
    }

    protected setDensityLevel(density: number): void {
        this.settings.update(current => ({ ...current, density }));
    }

    protected motionLabel(level: number): string {
        return MOTION_LABELS[level] ?? String(level);
    }

    protected reset(): void {
        this.settings.set(DEFAULT_THEME_SETTINGS);
        this.dark.set(false);
    }
}
