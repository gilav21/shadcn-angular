import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  AvatarComponent,
  AvatarFallbackComponent,
  AvatarImageComponent,
} from '../../../../../packages/components/ui';

@Component({
  selector: 'app-avatar-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarComponent, AvatarImageComponent, AvatarFallbackComponent],
  template: `
    <section class="space-y-4">
      <h2 id="avatar" class="text-2xl font-semibold scroll-m-20">Avatar</h2>
      <p class="text-muted-foreground">User avatar with image or fallback.</p>

      <div class="flex gap-4">
        <ui-avatar>
          <ui-avatar-image src="https://github.com/shadcn.png" alt="shadcn" />
          <ui-avatar-fallback>CN</ui-avatar-fallback>
        </ui-avatar>
        <ui-avatar>
          <ui-avatar-fallback>JD</ui-avatar-fallback>
        </ui-avatar>
        <ui-avatar>
          <ui-avatar-fallback>AB</ui-avatar-fallback>
        </ui-avatar>
      </div>

      <h3 class="text-lg font-medium mt-8">Simple Mode (Data-driven)</h3>
      <p class="text-muted-foreground text-sm mb-4">Using src, alt, and fallback inputs.</p>
      <div class="flex gap-4">
        <ui-avatar src="https://github.com/shadcn.png" alt="&#64;shadcn" fallback="CN" />
        <ui-avatar fallback="AB" />
        <ui-avatar src="broken-link.jpg" alt="Broken" fallback="!!" />
      </div>
    </section>
  `,
})
export class AvatarDemoComponent {}
