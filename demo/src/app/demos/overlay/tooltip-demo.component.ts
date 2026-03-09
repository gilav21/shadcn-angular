import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  ButtonComponent,
  TooltipComponent,
  TooltipContentComponent,
  TooltipDirective,
  TooltipTriggerComponent,
} from '../../../../../packages/components/ui';

@Component({
  selector: 'app-tooltip-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonComponent,
    TooltipComponent,
    TooltipContentComponent,
    TooltipDirective,
    TooltipTriggerComponent,
  ],
  template: `
    <section class="space-y-4">
      <h2 id="tooltip" class="text-2xl font-semibold scroll-m-20">Tooltip</h2>
      <p class="text-muted-foreground">Hover hints for elements.</p>

      <div class="flex gap-4 items-center">
        <ui-button uiTooltip="This is a tooltip!" tooltipSide="top">Hover me (Directive)</ui-button>
        <ui-button uiTooltip="Bottom tooltip" tooltipSide="bottom" variant="secondary">Hover me (Bottom)</ui-button>

        <ui-tooltip>
          <ui-tooltip-trigger>
            <ui-button variant="outline">Hover me (Component)</ui-button>
          </ui-tooltip-trigger>
          <ui-tooltip-content>
            <p>Add to library</p>
          </ui-tooltip-content>
        </ui-tooltip>
      </div>
    </section>
  `,
})
export class TooltipDemoComponent {}
