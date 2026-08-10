import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
  inject,
} from '@angular/core';
import { cn } from '../../../lib/utils';
import { TABS } from '../tabs.component';

@Component({
  selector: 'ui-tabs-content',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (isActive()) {
      <div
        role="tabpanel"
        [attr.id]="panelId()"
        [attr.aria-labelledby]="triggerId()"
        [attr.tabindex]="0"
        [class]="classes()"
        [attr.data-slot]="'tabs-content'"
      >
        <ng-content />
      </div>
    }
  `,
  host: { '[class]': '"contents"' },
})
export class TabsContentComponent {
  /**
   * Value tying this panel to the `<ui-tabs-trigger>` with the same value. Required; the panel
   * shows only while it matches the parent tabs' active value, and stays hidden forever if no
   * trigger uses it.
   */
  value = input.required<string>();
  /**
   * Extra classes merged onto the panel, after the base `mt-2` spacing and focus ring. The panel
   * is destroyed while inactive, so its content re-initialises on every switch back — persist
   * state outside it, and don't rely on enter animations from a mounted-but-hidden state.
   */
  class = input('');

  private readonly tabs = inject(TABS, { optional: true });

  isActive = computed(() => this.tabs?.activeTab() === this.value());
  triggerId = computed(() => this.tabs?.getTriggerId(this.value()) ?? '');
  panelId = computed(() => this.tabs?.getPanelId(this.value()) ?? '');

  classes = computed(() =>
    cn(
      'mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      this.class()
    )
  );
}
