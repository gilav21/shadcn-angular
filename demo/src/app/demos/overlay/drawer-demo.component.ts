import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  ButtonComponent,
  DrawerCloseComponent,
  DrawerComponent,
  DrawerContentComponent,
  DrawerDescriptionComponent,
  DrawerFooterComponent,
  DrawerHeaderComponent,
  DrawerTitleComponent,
  DrawerTriggerComponent,
} from '../../../../../packages/components/ui';

@Component({
  selector: 'app-drawer-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonComponent,
    DrawerCloseComponent,
    DrawerComponent,
    DrawerContentComponent,
    DrawerDescriptionComponent,
    DrawerFooterComponent,
    DrawerHeaderComponent,
    DrawerTitleComponent,
    DrawerTriggerComponent,
  ],
  template: `
    <section class="space-y-4">
      <h2 id="drawer" class="text-2xl font-semibold scroll-m-20">Drawer</h2>
      <p class="text-muted-foreground">A panel that slides in from the edge of the screen.</p>

      <div class="flex gap-2">
        <ui-drawer>
          <ui-drawer-trigger>
            <ui-button variant="outline">Open Bottom Drawer</ui-button>
          </ui-drawer-trigger>
          <ui-drawer-content>
            <ui-drawer-header>
              <ui-drawer-title>Edit Profile</ui-drawer-title>
              <ui-drawer-description>Make changes to your profile here.</ui-drawer-description>
            </ui-drawer-header>
            <div class="p-4">
              <p>Drawer content goes here...</p>
            </div>
            <ui-drawer-footer>
              <ui-button>Save changes</ui-button>
              <ui-drawer-close>
                <ui-button variant="outline">Cancel</ui-button>
              </ui-drawer-close>
            </ui-drawer-footer>
          </ui-drawer-content>
        </ui-drawer>
      </div>
    </section>
  `,
})
export class DrawerDemoComponent {}
