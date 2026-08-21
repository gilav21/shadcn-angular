import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  ButtonComponent,
  ErrorPageActionsComponent,
  ErrorPageComponent,
  ErrorPageIllustrationComponent,
} from '../../../../../packages/components/ui';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { ERROR_PAGE_DEMO_LOCALES } from './error-page-demo.locales';

@Component({
  selector: 'app-error-page-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ErrorPageComponent,
    ErrorPageIllustrationComponent,
    ErrorPageActionsComponent,
    ButtonComponent,
  ],
  template: `
    <section class="space-y-4">
      <h2 id="error-page" class="text-2xl font-semibold scroll-m-20">{{ t().heading }}</h2>
      <p class="text-muted-foreground">{{ t().description }}</p>

      <h3 class="text-lg font-medium mt-8">{{ t().codesHeading }}</h3>
      <p class="text-muted-foreground text-sm mb-4">{{ t().codesDescription }}</p>
      <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ui-error-page code="404" class="rounded-lg border" />
        <ui-error-page code="403" class="rounded-lg border" />
        <ui-error-page code="500" class="rounded-lg border" />
      </div>

      <h3 class="text-lg font-medium mt-8">{{ t().fallbackHeading }}</h3>
      <p class="text-muted-foreground text-sm mb-4">{{ t().fallbackDescription }}</p>
      <ui-error-page code="418" class="rounded-lg border" />

      <h3 class="text-lg font-medium mt-8">{{ t().copyHeading }}</h3>
      <p class="text-muted-foreground text-sm mb-4">{{ t().copyDescription }}</p>
      <ui-error-page
        code="404"
        [title]="t().movedTitle"
        [description]="t().movedDescription"
        class="rounded-lg border"
      />

      <h3 class="text-lg font-medium mt-8">{{ t().illustrationHeading }}</h3>
      <p class="text-muted-foreground text-sm mb-4">{{ t().illustrationDescription }}</p>
      <ui-error-page code="404" class="rounded-lg border">
        <ui-error-page-illustration>
          <svg
            viewBox="0 0 120 80"
            class="h-32 w-auto text-muted-foreground/50"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <rect x="10" y="18" width="100" height="52" rx="6" />
            <path d="M10 32h100" />
            <circle cx="22" cy="25" r="2" />
            <circle cx="32" cy="25" r="2" />
            <path d="M46 46h28M52 58h16" />
          </svg>
        </ui-error-page-illustration>
      </ui-error-page>

      <h3 class="text-lg font-medium mt-8">{{ t().actionsHeading }}</h3>
      <p class="text-muted-foreground text-sm mb-4">{{ t().actionsDescription }}</p>
      <ui-error-page code="500" class="rounded-lg border">
        <ui-error-page-actions>
          <ui-button>{{ t().tryAgain }}</ui-button>
          <ui-button variant="outline">{{ t().statusPage }}</ui-button>
        </ui-error-page-actions>
      </ui-error-page>

      <h3 class="text-lg font-medium mt-8">{{ t().outputsHeading }}</h3>
      <p class="text-muted-foreground text-sm mb-4">{{ t().outputsDescription }}</p>
      <ui-error-page
        code="403"
        class="rounded-lg border"
        (goBack)="lastEvent.set('goBack')"
        (goHome)="lastEvent.set('goHome')"
      />
      <p class="text-sm" data-slot="demo-last-event">
        {{ t().lastEvent }}:
        <code class="font-mono">{{ lastEvent() || t().noEvent }}</code>
      </p>
    </section>
  `,
})
export class ErrorPageDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  readonly t = computed(
    () => ERROR_PAGE_DEMO_LOCALES[this.localeId()] ?? ERROR_PAGE_DEMO_LOCALES['en'],
  );

  readonly lastEvent = signal('');
}
