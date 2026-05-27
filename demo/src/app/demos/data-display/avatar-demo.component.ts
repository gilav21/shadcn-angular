import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import {
  AvatarComponent,
  AvatarFallbackComponent,
  AvatarImageComponent,
} from '../../../../../packages/components/ui';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { AVATAR_DEMO_LOCALES } from './avatar-demo.locales';

@Component({
  selector: 'app-avatar-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarComponent, AvatarImageComponent, AvatarFallbackComponent],
  template: `
    <section class="space-y-4">
      <h2 id="avatar" class="text-2xl font-semibold scroll-m-20">{{ t().heading }}</h2>
      <p class="text-muted-foreground">{{ t().description }}</p>

      <div class="flex gap-4">
        <ui-avatar>
          <ui-avatar-image src="https://github.com/shadcn.png" [alt]="t().user1Alt" />
          <ui-avatar-fallback>{{ t().user1Fallback }}</ui-avatar-fallback>
        </ui-avatar>
        <ui-avatar>
          <ui-avatar-fallback>{{ t().user2Fallback }}</ui-avatar-fallback>
        </ui-avatar>
        <ui-avatar>
          <ui-avatar-fallback>{{ t().user3Fallback }}</ui-avatar-fallback>
        </ui-avatar>
      </div>

      <h3 class="text-lg font-medium mt-8">{{ t().simpleHeading }}</h3>
      <p class="text-muted-foreground text-sm mb-4">{{ t().simpleDescription }}</p>
      <div class="flex gap-4">
        <ui-avatar src="https://github.com/shadcn.png" [alt]="'@' + t().user1Alt" [fallback]="t().user1Fallback" />
        <ui-avatar [fallback]="t().user3Fallback" />
        <ui-avatar src="broken-link.jpg" alt="Broken" fallback="!!" />
      </div>
    </section>
  `,
})
export class AvatarDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(() => AVATAR_DEMO_LOCALES[this.localeId()] ?? AVATAR_DEMO_LOCALES['en']);
}
