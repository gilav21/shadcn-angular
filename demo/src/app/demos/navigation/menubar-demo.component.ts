import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import {
  MenubarComponent,
  MenubarContentComponent,
  MenubarItemComponent,
  MenubarMenuComponent,
  MenubarSeparatorComponent,
  MenubarShortcutComponent,
  MenubarSubComponent,
  MenubarSubContentComponent,
  MenubarSubTriggerComponent,
  MenubarTriggerComponent,
} from '../../../../../packages/components/ui';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { MENUBAR_DEMO_LOCALES } from './menubar-demo.locales';

@Component({
  selector: 'app-menubar-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MenubarComponent,
    MenubarMenuComponent,
    MenubarTriggerComponent,
    MenubarContentComponent,
    MenubarItemComponent,
    MenubarSeparatorComponent,
    MenubarShortcutComponent,
    MenubarSubComponent,
    MenubarSubTriggerComponent,
    MenubarSubContentComponent,
  ],
  template: `
    <section class="space-y-4">
      <h2 id="menubar" class="text-2xl font-semibold scroll-m-20">{{ t().heading }}</h2>
      <p class="text-muted-foreground">{{ t().description }}</p>

      <ui-menubar>
        <ui-menubar-menu>
          <ui-menubar-trigger>{{ t().menuFile }}</ui-menubar-trigger>
          <ui-menubar-content>
            <ui-menubar-item>{{ t().fileNewTab }} <ui-menubar-shortcut>⌘T</ui-menubar-shortcut></ui-menubar-item>
            <ui-menubar-item>{{ t().fileNewWindow }} <ui-menubar-shortcut>⌘N</ui-menubar-shortcut></ui-menubar-item>
            <ui-menubar-item disabled>{{ t().fileNewIncognito }}</ui-menubar-item>
            <ui-menubar-separator />
            <ui-menubar-sub>
              <ui-menubar-sub-trigger>{{ t().fileShare }}</ui-menubar-sub-trigger>
              <ui-menubar-sub-content>
                <ui-menubar-sub>
                  <ui-menubar-sub-trigger>{{ t().fileShareEmail }}</ui-menubar-sub-trigger>
                  <ui-menubar-sub-content>
                    <ui-menubar-item>{{ t().fileShareEmailPersonal }}</ui-menubar-item>
                    <ui-menubar-item>{{ t().fileShareEmailWork }}</ui-menubar-item>
                  </ui-menubar-sub-content>
                </ui-menubar-sub>
                <ui-menubar-item>{{ t().fileShareMessages }}</ui-menubar-item>
                <ui-menubar-item>{{ t().fileShareNotes }}</ui-menubar-item>
              </ui-menubar-sub-content>
            </ui-menubar-sub>
            <ui-menubar-separator />
            <ui-menubar-item>{{ t().filePrint }} <ui-menubar-shortcut>⌘P</ui-menubar-shortcut></ui-menubar-item>
          </ui-menubar-content>
        </ui-menubar-menu>
        <ui-menubar-menu>
          <ui-menubar-trigger>{{ t().menuEdit }}</ui-menubar-trigger>
          <ui-menubar-content>
            <ui-menubar-item>{{ t().editUndo }} <ui-menubar-shortcut>⌘Z</ui-menubar-shortcut></ui-menubar-item>
            <ui-menubar-item>{{ t().editRedo }} <ui-menubar-shortcut>⇧⌘Z</ui-menubar-shortcut></ui-menubar-item>
            <ui-menubar-separator />
            <ui-menubar-item>{{ t().editCut }} <ui-menubar-shortcut>⌘X</ui-menubar-shortcut></ui-menubar-item>
            <ui-menubar-item>{{ t().editCopy }} <ui-menubar-shortcut>⌘C</ui-menubar-shortcut></ui-menubar-item>
            <ui-menubar-item>{{ t().editPaste }} <ui-menubar-shortcut>⌘V</ui-menubar-shortcut></ui-menubar-item>
            <ui-menubar-separator />
            <ui-menubar-item>{{ t().editSelectAll }} <ui-menubar-shortcut>⌘A</ui-menubar-shortcut></ui-menubar-item>
          </ui-menubar-content>
        </ui-menubar-menu>
        <ui-menubar-menu>
          <ui-menubar-trigger>{{ t().menuView }}</ui-menubar-trigger>
          <ui-menubar-content>
            <ui-menubar-item [inset]="true">{{ t().viewReload }} <ui-menubar-shortcut>⌘R</ui-menubar-shortcut></ui-menubar-item>
            <ui-menubar-item [inset]="true" [disabled]="true">{{ t().viewForceReload }}
              <ui-menubar-shortcut>⇧⌘R</ui-menubar-shortcut></ui-menubar-item>
            <ui-menubar-separator />
            <ui-menubar-item [inset]="true">{{ t().viewToggleFullscreen }}</ui-menubar-item>
            <ui-menubar-separator />
            <ui-menubar-item [inset]="true">{{ t().viewHideSidebar }}</ui-menubar-item>
          </ui-menubar-content>
        </ui-menubar-menu>
        <ui-menubar-menu>
          <ui-menubar-trigger>{{ t().menuProfiles }}</ui-menubar-trigger>
          <ui-menubar-content>
            <ui-menubar-item [inset]="true">{{ t().profile1 }}</ui-menubar-item>
            <ui-menubar-item [inset]="true">{{ t().profile2 }}</ui-menubar-item>
            <ui-menubar-item [inset]="true">{{ t().profile3 }}</ui-menubar-item>
            <ui-menubar-separator />
            <ui-menubar-item [inset]="true">{{ t().profileEdit }}</ui-menubar-item>
            <ui-menubar-separator />
            <ui-menubar-item [inset]="true">{{ t().profileAdd }}</ui-menubar-item>
          </ui-menubar-content>
        </ui-menubar-menu>
      </ui-menubar>

      <div class="space-y-2">
        <h3 class="text-sm font-medium">{{ t().secondBarHeading }}</h3>
        <p class="text-xs text-muted-foreground">{{ t().disabledSubHint }}</p>
        <p class="text-xs text-muted-foreground">{{ t().firstItemDisabledHint }}</p>
        <p class="text-xs text-muted-foreground">{{ t().wrapAroundHint }}</p>
        <ui-menubar>
          <ui-menubar-menu>
            <ui-menubar-trigger>{{ t().menuExport }}</ui-menubar-trigger>
            <ui-menubar-content>
              <ui-menubar-item>{{ t().exportPdf }}</ui-menubar-item>
              <ui-menubar-item>{{ t().exportImage }}</ui-menubar-item>
              <ui-menubar-separator />
              <ui-menubar-sub>
                <ui-menubar-sub-trigger disabled>{{ t().exportCloud }}</ui-menubar-sub-trigger>
                <ui-menubar-sub-content>
                  <ui-menubar-item>{{ t().exportCloudDrive }}</ui-menubar-item>
                  <ui-menubar-item>{{ t().exportCloudDropbox }}</ui-menubar-item>
                </ui-menubar-sub-content>
              </ui-menubar-sub>
            </ui-menubar-content>
          </ui-menubar-menu>
          <ui-menubar-menu>
            <ui-menubar-trigger>{{ t().menuHistory }}</ui-menubar-trigger>
            <ui-menubar-content>
              <ui-menubar-item disabled>{{ t().historyRestore }}</ui-menubar-item>
              <ui-menubar-item>{{ t().historyRecent }}</ui-menubar-item>
              <ui-menubar-separator />
              <ui-menubar-item>{{ t().historyClear }}</ui-menubar-item>
            </ui-menubar-content>
          </ui-menubar-menu>
        </ui-menubar>
      </div>
    </section>
  `,
})
export class MenubarDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(() => MENUBAR_DEMO_LOCALES[this.localeId()] ?? MENUBAR_DEMO_LOCALES['en']);
}
