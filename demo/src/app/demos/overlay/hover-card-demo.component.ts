import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  AvatarComponent,
  AvatarFallbackComponent,
  AvatarImageComponent,
  ButtonComponent,
  HoverCardComponent,
  HoverCardContentComponent,
  HoverCardTriggerComponent,
} from '../../../../../packages/components/ui';

@Component({
  selector: 'app-hover-card-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AvatarComponent,
    AvatarFallbackComponent,
    AvatarImageComponent,
    ButtonComponent,
    HoverCardComponent,
    HoverCardContentComponent,
    HoverCardTriggerComponent,
  ],
  template: `
    <section class="space-y-4">
      <h2 id="hover-card" class="text-2xl font-semibold scroll-m-20">Hover Card</h2>
      <p class="text-muted-foreground">A card that appears when hovering over an element.</p>

      <ui-hover-card>
        <ui-hover-card-trigger>
          <ui-button variant="link">&#64;angular</ui-button>
        </ui-hover-card-trigger>
        <ui-hover-card-content>
          <div class="flex justify-between space-x-4">
            <ui-avatar>
              <ui-avatar-image src="https://github.com/angular.png" />
              <ui-avatar-fallback>NG</ui-avatar-fallback>
            </ui-avatar>
            <div class="space-y-1">
              <h4 class="text-sm font-semibold">&#64;angular</h4>
              <p class="text-sm">The modern web developer's platform.</p>
              <div class="flex items-center pt-2">
                <span class="text-xs text-muted-foreground"> Joined December 2016 </span>
              </div>
            </div>
          </div>
        </ui-hover-card-content>
      </ui-hover-card>
    </section>
  `,
})
export class HoverCardDemoComponent {}
