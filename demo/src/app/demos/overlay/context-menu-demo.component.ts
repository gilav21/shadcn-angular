import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import {
  ContextMenuComponent,
  ContextMenuContentComponent,
  ContextMenuItemComponent,
  ContextMenuSeparatorComponent,
  ContextMenuShortcutComponent,
  ContextMenuSubComponent,
  ContextMenuSubContentComponent,
  ContextMenuSubTriggerComponent,
  ContextMenuTriggerComponent,
  ContextMenuTriggerDirective,
  IconComponent,
} from '../../../../../packages/components/ui';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { CONTEXT_MENU_DEMO_LOCALES } from './context-menu-demo.locales';

@Component({
  selector: 'app-context-menu-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ContextMenuComponent,
    ContextMenuContentComponent,
    ContextMenuItemComponent,
    ContextMenuSeparatorComponent,
    ContextMenuShortcutComponent,
    ContextMenuSubComponent,
    ContextMenuSubContentComponent,
    ContextMenuSubTriggerComponent,
    ContextMenuTriggerComponent,
    ContextMenuTriggerDirective,
    IconComponent,
  ],
  template: `
    <section class="space-y-4">
      <h2 id="context-menu" class="text-2xl font-semibold scroll-m-20">{{ t().title }}</h2>
      <p class="text-muted-foreground">{{ t().description }}</p>

      <ui-context-menu>
        <ui-context-menu-trigger>
          <div class="flex h-[150px] w-[300px] items-center justify-center rounded-md border border-dashed text-sm">
            {{ t().rightClickHint }}
          </div>
        </ui-context-menu-trigger>
        <ui-context-menu-content>
          <ui-context-menu-item>
            {{ t().backLabel }}
            <ui-context-menu-shortcut>&#8984;[</ui-context-menu-shortcut>
          </ui-context-menu-item>
          <ui-context-menu-item>
            {{ t().forwardLabel }}
            <ui-context-menu-shortcut>&#8984;]</ui-context-menu-shortcut>
          </ui-context-menu-item>
          <ui-context-menu-item>
            {{ t().reloadLabel }}
            <ui-context-menu-shortcut>&#8984;R</ui-context-menu-shortcut>
          </ui-context-menu-item>
          <ui-context-menu-separator />
          <ui-context-menu-item>
            {{ t().saveAsLabel }}
            <ui-context-menu-shortcut>&#8679;&#8984;S</ui-context-menu-shortcut>
          </ui-context-menu-item>
          <ui-context-menu-item>{{ t().printLabel }}</ui-context-menu-item>
        </ui-context-menu-content>
      </ui-context-menu>

      <ui-context-menu #contextMenu>
        <ui-context-menu-content class="w-56">
          <ui-context-menu-item>
            <ui-icon name="pencil" size="sm" class="ltr:mr-2 rtl:ml-2" />
            {{ t().editLabel }}
            <ui-context-menu-shortcut>&#8984;E</ui-context-menu-shortcut>
          </ui-context-menu-item>
          <ui-context-menu-item>
            <ui-icon name="copy" size="sm" class="ltr:mr-2 rtl:ml-2" />
            {{ t().copyLabel }}
            <ui-context-menu-shortcut>&#8984;C</ui-context-menu-shortcut>
          </ui-context-menu-item>
          <ui-context-menu-item>
            <ui-icon name="share-2" size="sm" class="ltr:mr-2 rtl:ml-2" />
            {{ t().shareLabel }}
          </ui-context-menu-item>
          <ui-context-menu-separator></ui-context-menu-separator>
          <ui-context-menu-item variant="destructive">
            <ui-icon name="trash" size="sm" class="ltr:mr-2 rtl:ml-2" />
            {{ t().deleteLabel }}
            <ui-context-menu-shortcut>&#8984;&#9003;</ui-context-menu-shortcut>
          </ui-context-menu-item>
        </ui-context-menu-content>
      </ui-context-menu>

      <div [uiContextMenuTrigger]="contextMenu"
        class="h-[300px] w-full flex items-center justify-center border-2 border-dashed rounded-lg bg-muted/50 text-muted-foreground">
        {{ t().rightClickAreaHint }}
      </div>

      <h3 class="text-sm font-medium">{{ t().disabledSubHeading }}</h3>
      <p class="text-xs text-muted-foreground">{{ t().disabledSubHint }}</p>
      <ui-context-menu>
        <ui-context-menu-trigger>
          <div class="flex h-[150px] w-full max-w-[300px] items-center justify-center rounded-md border border-dashed p-4 text-center text-sm">
            {{ t().disabledSubAreaHint }}
          </div>
        </ui-context-menu-trigger>
        <ui-context-menu-content class="w-56">
          <ui-context-menu-item>
            {{ t().editLabel }}
            <ui-context-menu-shortcut>&#8984;E</ui-context-menu-shortcut>
          </ui-context-menu-item>
          <ui-context-menu-item>
            {{ t().copyLabel }}
            <ui-context-menu-shortcut>&#8984;C</ui-context-menu-shortcut>
          </ui-context-menu-item>
          <ui-context-menu-sub>
            <ui-context-menu-sub-trigger disabled>{{ t().sendToLabel }}</ui-context-menu-sub-trigger>
            <ui-context-menu-sub-content>
              <ui-context-menu-item>{{ t().sendToPhoneLabel }}</ui-context-menu-item>
              <ui-context-menu-item>{{ t().sendToTabletLabel }}</ui-context-menu-item>
            </ui-context-menu-sub-content>
          </ui-context-menu-sub>
          <ui-context-menu-separator />
          <ui-context-menu-item variant="destructive">{{ t().deleteLabel }}</ui-context-menu-item>
        </ui-context-menu-content>
      </ui-context-menu>
    </section>
  `,
})
export class ContextMenuDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(
    () => CONTEXT_MENU_DEMO_LOCALES[this.localeId()] ?? CONTEXT_MENU_DEMO_LOCALES['en'],
  );
}
