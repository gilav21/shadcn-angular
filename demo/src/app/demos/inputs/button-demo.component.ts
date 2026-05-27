import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { ButtonComponent, IconComponent } from '../../../../../packages/components/ui';
import { BUTTON_DEMO_LOCALES } from './button-demo.locales';

@Component({
  selector: 'app-buttons-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, IconComponent],
  template: `
    <section class="space-y-4">
      <h2 id="buttons" class="text-2xl font-semibold scroll-m-20">{{ t().title }}</h2>
      <p class="text-muted-foreground">{{ t().description }}</p>

      <div class="flex flex-wrap gap-4">
        <ui-button>{{ t().labelDefault }}</ui-button>
        <ui-button variant="secondary">{{ t().labelSecondary }}</ui-button>
        <ui-button variant="outline">{{ t().labelOutline }}</ui-button>
        <ui-button variant="ghost">{{ t().labelGhost }}</ui-button>
        <ui-button variant="link">{{ t().labelLink }}</ui-button>
        <ui-button variant="destructive">{{ t().labelDestructive }}</ui-button>
      </div>

      <div class="flex flex-wrap gap-4 items-center">
        <ui-button size="sm">{{ t().labelSmall }}</ui-button>
        <ui-button>{{ t().labelDefault }}</ui-button>
        <ui-button size="lg">{{ t().labelLarge }}</ui-button>
        <ui-button size="icon">
          <ui-icon name="plus" size="sm" />
        </ui-button>
      </div>

      <ui-button [disabled]="true">{{ t().labelDisabled }}</ui-button>

      <div class="flex flex-wrap gap-4 items-center mt-4">
        <ui-button [ripple]="true">{{ t().labelDefaultRipple }}</ui-button>
        <ui-button variant="secondary" [ripple]="true">{{ t().labelSecondaryRipple }}</ui-button>
        <ui-button variant="outline" [ripple]="true">{{ t().labelOutlineRipple }}</ui-button>
        <ui-button variant="ghost" [ripple]="true">{{ t().labelGhostRipple }}</ui-button>
        <ui-button variant="link" [ripple]="true">{{ t().labelLinkRipple }}</ui-button>
        <ui-button variant="destructive" [ripple]="true">{{ t().labelDestructiveRipple }}</ui-button>
      </div>

      <div class="flex flex-wrap gap-4 items-center mt-4">
        <ui-button [ripple]="true" rippleColor="rgba(255, 0, 0, 0.5)">{{ t().labelCustomRedRipple }}</ui-button>
        <ui-button variant="secondary" [ripple]="true" rippleColor="rgba(0, 255, 0, 0.5)">{{ t().labelCustomGreenRipple }}</ui-button>
        <ui-button variant="outline" [ripple]="true" rippleColor="rgba(0, 0, 255, 0.5)">{{ t().labelCustomBlueRipple }}</ui-button>
        <ui-button variant="ghost" [ripple]="true" rippleColor="rgba(255, 255, 0, 0.5)">{{ t().labelCustomYellowRipple }}</ui-button>
        <ui-button variant="link" [ripple]="true" rippleColor="rgba(255, 0, 255, 0.5)">{{ t().labelCustomMagentaRipple }}</ui-button>
        <ui-button variant="destructive" [ripple]="true" rippleColor="rgba(0, 255, 255, 0.5)">{{ t().labelCustomCyanRipple }}</ui-button>
      </div>
    </section>
  `,
})
export class ButtonDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(
    () => BUTTON_DEMO_LOCALES[this.localeId()] ?? BUTTON_DEMO_LOCALES['en'],
  );
}
