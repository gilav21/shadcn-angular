import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import {
  ButtonComponent,
  IconComponent,
  SpeedDialComponent,
  SpeedDialContextTriggerDirective,
  SpeedDialItemComponent,
  SpeedDialMenuComponent,
  SpeedDialTriggerComponent,
  TooltipDirective,
} from '../../../../../packages/components/ui';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { SPEED_DIAL_DEMO_LOCALES } from './speed-dial-demo.locales';

@Component({
  selector: 'app-speed-dial-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonComponent,
    IconComponent,
    SpeedDialComponent,
    SpeedDialContextTriggerDirective,
    SpeedDialItemComponent,
    SpeedDialMenuComponent,
    SpeedDialTriggerComponent,
    TooltipDirective,
  ],
  template: `
    <section class="space-y-4">
      <h2 id="speed-dial" class="text-2xl font-semibold scroll-m-20">{{ t().title }}</h2>
      <p class="text-muted-foreground">{{ t().description }}</p>

      <div class="relative h-64 border rounded-lg p-4 overflow-auto">
        <!-- Linear Up -->
        <ui-speed-dial type="linear" direction="up" class="absolute top-25 left-1/8">
          <ui-speed-dial-trigger>
            <ui-button size="icon" class="rounded-full h-12 w-12 shadow-lg">
              <ui-icon name="plus" size="md" />
            </ui-button>
          </ui-speed-dial-trigger>
          <ui-speed-dial-menu>
            <ui-speed-dial-item>
              <ui-button size="icon" variant="secondary" class="rounded-full" [uiTooltip]="t().editTooltip" tooltipSide="right">
                <ui-icon name="pencil" size="sm" />
              </ui-button>
            </ui-speed-dial-item>
            <ui-speed-dial-item>
              <ui-button size="icon" variant="secondary" class="rounded-full" [uiTooltip]="t().deleteTooltip"
                tooltipSide="right">
                <ui-icon name="trash" size="sm" />
              </ui-button>
            </ui-speed-dial-item>
            <ui-speed-dial-item>
              <ui-button size="icon" variant="secondary" class="rounded-full" [uiTooltip]="t().shareTooltip" tooltipSide="right">
                <ui-icon name="share-2" size="sm" />
              </ui-button>
            </ui-speed-dial-item>
          </ui-speed-dial-menu>
        </ui-speed-dial>

        <!-- Linear Right -->
        <ui-speed-dial type="linear" direction="right" class="absolute top-25 left-2/8">
          <ui-speed-dial-trigger>
            <ui-button size="icon" variant="secondary" class="rounded-full h-10 w-10">
              <ui-icon name="plus" size="sm" />
            </ui-button>
          </ui-speed-dial-trigger>
          <ui-speed-dial-menu>
            <ui-speed-dial-item>
              <ui-button size="icon" variant="outline" class="rounded-full">
                <ui-icon name="pencil" size="sm" />
              </ui-button>
            </ui-speed-dial-item>
            <ui-speed-dial-item>
              <ui-button size="icon" variant="outline" class="rounded-full">
                <ui-icon name="trash" size="sm" />
              </ui-button>
            </ui-speed-dial-item>
          </ui-speed-dial-menu>
        </ui-speed-dial>

        <!-- Circle layout -->
        <ui-speed-dial type="circle" [radius]="60" class="absolute top-25 left-4/8">
          <ui-speed-dial-trigger>
            <ui-button size="icon" variant="destructive" class="rounded-full h-12 w-12 shadow-lg">
              <ui-icon name="plus" size="md" />
            </ui-button>
          </ui-speed-dial-trigger>
          <ui-speed-dial-menu>
            <ui-speed-dial-item>
              <ui-button size="icon-sm" variant="outline" class="rounded-full">
                <ui-icon name="pencil" size="xs" />
              </ui-button>
            </ui-speed-dial-item>
            <ui-speed-dial-item>
              <ui-button size="icon-sm" variant="outline" class="rounded-full">
                <ui-icon name="trash" size="xs" />
              </ui-button>
            </ui-speed-dial-item>
            <ui-speed-dial-item>
              <ui-button size="icon-sm" variant="outline" class="rounded-full">
                <ui-icon name="pencil" size="xs" />
              </ui-button>
            </ui-speed-dial-item>
            <ui-speed-dial-item>
              <ui-button size="icon-sm" variant="outline" class="rounded-full">
                <ui-icon name="share-2" size="xs" />
              </ui-button>
            </ui-speed-dial-item>
            <ui-speed-dial-item>
              <ui-button size="icon-sm" variant="outline" class="rounded-full">
                <ui-icon name="upload" size="xs" />
              </ui-button>
            </ui-speed-dial-item>
          </ui-speed-dial-menu>
        </ui-speed-dial>

        <!-- Semi-circle Up -->
        <ui-speed-dial type="semi-circle" direction="up" [radius]="50" class="absolute top-25 left-6/8">
          <ui-speed-dial-trigger>
            <ui-button size="icon"
              class="rounded-full h-11 w-11 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white border-0">
              <ui-icon name="plus" size="md" />
            </ui-button>
          </ui-speed-dial-trigger>
          <ui-speed-dial-menu>
            <ui-speed-dial-item>
              <ui-button size="icon-sm" variant="secondary" class="rounded-full">
                <ui-icon name="pencil" size="xs" />
              </ui-button>
            </ui-speed-dial-item>
            <ui-speed-dial-item>
              <ui-button size="icon-sm" variant="secondary" class="rounded-full">
                <ui-icon name="trash" size="xs" />
              </ui-button>
            </ui-speed-dial-item>
            <ui-speed-dial-item>
              <ui-button size="icon-sm" variant="secondary" class="rounded-full">
                <ui-icon name="share-2" size="xs" />
              </ui-button>
            </ui-speed-dial-item>
            <ui-speed-dial-item>
              <ui-button size="icon-sm" variant="secondary" class="rounded-full">
                <ui-icon name="upload" size="xs" />
              </ui-button>
            </ui-speed-dial-item>
            <ui-speed-dial-item>
              <ui-button size="icon-sm" variant="secondary" class="rounded-full">
                <ui-icon name="pencil" size="xs" />
              </ui-button>
            </ui-speed-dial-item>
          </ui-speed-dial-menu>
        </ui-speed-dial>

        <!-- quarter-circle up-right -->
        <ui-speed-dial type="quarter-circle" direction="up-right" [radius]="80" class="absolute bottom-0 left-0">
          <ui-speed-dial-trigger>
            <ui-button size="icon"
              class="rounded-full h-11 w-11 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white border-0">
              <ui-icon name="plus" size="md" />
            </ui-button>
          </ui-speed-dial-trigger>
          <ui-speed-dial-menu>
            <ui-speed-dial-item>
              <ui-button size="icon-sm" variant="secondary" class="rounded-full">
                <ui-icon name="pencil" size="xs" />
              </ui-button>
            </ui-speed-dial-item>
            <ui-speed-dial-item>
              <ui-button size="icon-sm" variant="secondary" class="rounded-full">
                <ui-icon name="trash" size="xs" />
              </ui-button>
            </ui-speed-dial-item>
            <ui-speed-dial-item>
              <ui-button size="icon-sm" variant="secondary" class="rounded-full">
                <ui-icon name="upload" size="xs" />
              </ui-button>
            </ui-speed-dial-item>
          </ui-speed-dial-menu>
        </ui-speed-dial>
      </div>

      <h3 class="text-lg font-medium mt-6">{{ t().contextMenuHeading }}</h3>
      <ui-speed-dial type="circle" [transitionDelay]="500" direction="down-right" [radius]="40"
        #speedDialContextMenu>
        <ui-speed-dial-menu>
          <ui-speed-dial-item>
            <ui-button size="icon-sm" variant="secondary" class="rounded-full" [uiTooltip]="t().copyTooltip">
              <ui-icon name="copy" size="xs" />
            </ui-button>
          </ui-speed-dial-item>
          <ui-speed-dial-item>
            <ui-button size="icon-sm" variant="secondary" class="rounded-full" [uiTooltip]="t().cutTooltip">
              <ui-icon name="scissors" size="xs" />
            </ui-button>
          </ui-speed-dial-item>
          <ui-speed-dial-item>
            <ui-button size="icon-sm" variant="secondary" class="rounded-full" [uiTooltip]="t().pasteTooltip">
              <ui-icon name="clipboard" size="xs" />
            </ui-button>
          </ui-speed-dial-item>
          <ui-speed-dial-item>
            <ui-button size="icon-sm" variant="secondary" class="rounded-full" [uiTooltip]="t().selectAllTooltip">
              <ui-icon name="align-justify" size="xs" />
            </ui-button>
          </ui-speed-dial-item>
          <ui-speed-dial-item>
            <ui-button size="icon-sm" variant="secondary" class="rounded-full" [uiTooltip]="t().undoTooltip">
              <ui-icon name="undo" size="xs" />
            </ui-button>
          </ui-speed-dial-item>
        </ui-speed-dial-menu>
      </ui-speed-dial>

      <div [uiSpeedDialContextTrigger]="speedDialContextMenu"
        class="h-32 border-2 border-dashed border-muted rounded-lg flex items-center justify-center text-muted-foreground hover:border-primary/50 transition-colors cursor-context-menu">
        {{ t().rightClickHint }}
      </div>
    </section>
  `,
})
export class SpeedDialDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(
    () => SPEED_DIAL_DEMO_LOCALES[this.localeId()] ?? SPEED_DIAL_DEMO_LOCALES['en'],
  );
}
