import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  ButtonComponent,
  ContextMenuAttachDirective,
  ContextMenuComponent,
  ContextMenuContentComponent,
  ContextMenuItemComponent,
  ContextMenuSeparatorComponent,
  IconComponent,
  type ContextMenuEvent,
} from '../../../../../packages/components/ui';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { CONTEXT_MENU_ATTACH_DEMO_LOCALES } from './context-menu-attach-demo.locales';

interface AttachDemoItem {
  readonly id: string;
  readonly label: string;
  readonly meta?: string;
  readonly src?: string;
}

interface TriggeredPayload {
  readonly label: string;
  readonly index: string;
  readonly x: number;
  readonly y: number;
}

const PHOTOS = [
  'https://picsum.photos/id/1015/400/300',
  'https://picsum.photos/id/1025/400/300',
  'https://picsum.photos/id/1039/400/300',
] as const;

const USAGE_SNIPPET = `<ui-context-menu #itemMenu>
  <ui-context-menu-content class="w-52">
    <ui-context-menu-item (click)="open(selected())">Open</ui-context-menu-item>
    <ui-context-menu-separator />
    <ui-context-menu-item variant="destructive" (click)="remove(selected())">
      Delete
    </ui-context-menu-item>
  </ui-context-menu-content>
</ui-context-menu>

@for (file of files(); track file.id) {
  <div
    [uiContextMenuAttach]="itemMenu"
    [contextMenuData]="file"
    (contextMenuTriggered)="onTriggered($event)"
    class="rounded-lg border p-4"
  >
    {{ file.label }}
    <!-- Touch fallback: the directive has no long-press, so expose the
         same menu behind a visible button. -->
    <ui-button variant="ghost" size="icon" (click)="openFor(itemMenu, file, $event)">
      <ui-icon name="more-vertical" size="sm" />
    </ui-button>
  </div>
}

// component.ts
onTriggered(event: ContextMenuEvent<FileItem>): void {
  this.selected.set(event.item);   // event.event is the MouseEvent
}

openFor(menu: ContextMenuComponent, file: FileItem, event: MouseEvent): void {
  this.selected.set(file);
  menu.show(event.clientX, event.clientY);
}`;

@Component({
  selector: 'app-context-menu-attach-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonComponent,
    ContextMenuAttachDirective,
    ContextMenuComponent,
    ContextMenuContentComponent,
    ContextMenuItemComponent,
    ContextMenuSeparatorComponent,
    IconComponent,
  ],
  template: `
    <div class="space-y-10">
      <section class="space-y-4">
        <h2 id="context-menu-attach" class="text-2xl font-semibold scroll-m-20">{{ t().heading }}</h2>
        <p class="text-muted-foreground">{{ t().description }}</p>
        <div class="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 sm:p-4">
          <ui-icon name="smartphone" size="sm" class="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <p class="text-sm text-amber-800 dark:text-amber-200">{{ t().touchNote }}</p>
        </div>
      </section>

      <ui-context-menu #itemMenu>
        <ui-context-menu-content class="w-52 max-w-[calc(100vw-2rem)]">
          <ui-context-menu-item (click)="runAction(t().menuOpen)">
            <ui-icon name="external-link" size="sm" class="ltr:mr-2 rtl:ml-2" />
            {{ t().menuOpen }}
          </ui-context-menu-item>
          <ui-context-menu-item (click)="runAction(t().menuRename)">
            <ui-icon name="pencil" size="sm" class="ltr:mr-2 rtl:ml-2" />
            {{ t().menuRename }}
          </ui-context-menu-item>
          <ui-context-menu-item (click)="runAction(t().menuDuplicate)">
            <ui-icon name="copy" size="sm" class="ltr:mr-2 rtl:ml-2" />
            {{ t().menuDuplicate }}
          </ui-context-menu-item>
          <ui-context-menu-separator />
          <ui-context-menu-item variant="destructive" (click)="runAction(t().menuDelete)">
            <ui-icon name="trash" size="sm" class="ltr:mr-2 rtl:ml-2" />
            {{ t().menuDelete }}
          </ui-context-menu-item>
        </ui-context-menu-content>
      </ui-context-menu>

      <section class="space-y-4">
        <h3 class="text-lg font-semibold">{{ t().cardsHeading }}</h3>
        <p class="text-sm text-muted-foreground">{{ t().cardsDesc }}</p>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          @for (card of cards(); track card.id) {
            <div
              [uiContextMenuAttach]="itemMenu"
              [contextMenuData]="card"
              (contextMenuTriggered)="onTriggered($event)"
              class="flex items-start justify-between gap-2 rounded-xl border bg-card p-4 shadow-sm select-none"
            >
              <div class="min-w-0">
                <p class="truncate font-medium">{{ card.label }}</p>
                <p class="mt-1 text-xs text-muted-foreground">{{ t().rightClickHint }}</p>
              </div>
              <ui-button
                variant="ghost"
                size="icon"
                [attr.aria-label]="t().moreActions"
                (click)="openFor(itemMenu, card, $event)"
              >
                <ui-icon name="more-vertical" size="sm" />
              </ui-button>
            </div>
          }
        </div>
      </section>

      <section class="space-y-4">
        <h3 class="text-lg font-semibold">{{ t().galleryHeading }}</h3>
        <p class="text-sm text-muted-foreground">{{ t().galleryDesc }}</p>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
          @for (photo of photos(); track photo.id) {
            <div class="relative overflow-hidden rounded-xl border">
              <img
                [src]="photo.src"
                [alt]="photo.label"
                [uiContextMenuAttach]="itemMenu"
                [contextMenuData]="photo"
                (contextMenuTriggered)="onTriggered($event)"
                class="h-40 w-full object-cover sm:h-44"
              />
              <ui-button
                variant="secondary"
                size="icon"
                class="absolute top-2 ltr:right-2 rtl:left-2"
                [attr.aria-label]="t().moreActions"
                (click)="openFor(itemMenu, photo, $event)"
              >
                <ui-icon name="more-vertical" size="sm" />
              </ui-button>
            </div>
          }
        </div>
      </section>

      <section class="space-y-4">
        <h3 class="text-lg font-semibold">{{ t().listHeading }}</h3>
        <p class="text-sm text-muted-foreground">{{ t().listDesc }}</p>
        <ul class="divide-y rounded-xl border">
          @for (row of rows(); track row.id) {
            <li
              [uiContextMenuAttach]="itemMenu"
              [contextMenuData]="row"
              (contextMenuTriggered)="onTriggered($event)"
              class="flex flex-wrap items-center justify-between gap-2 p-3 sm:p-4 select-none"
            >
              <div class="min-w-0">
                <p class="truncate font-medium">{{ row.label }}</p>
                <p class="truncate text-xs text-muted-foreground">{{ row.meta }}</p>
              </div>
              <ui-button
                variant="ghost"
                size="icon"
                [attr.aria-label]="t().moreActions"
                (click)="openFor(itemMenu, row, $event)"
              >
                <ui-icon name="more-vertical" size="sm" />
              </ui-button>
            </li>
          }
        </ul>
      </section>

      <section class="space-y-4">
        <h3 class="text-lg font-semibold">{{ t().disabledHeading }}</h3>
        <p class="text-sm text-muted-foreground">{{ t().disabledDesc }}</p>
        <div
          [uiContextMenuAttach]="itemMenu"
          [contextMenuData]="disabledItem"
          [disabled]="true"
          (contextMenuTriggered)="onTriggered($event)"
          class="flex min-h-[100px] items-center justify-center rounded-lg border-2 border-dashed bg-muted/50 p-4 text-center text-sm text-muted-foreground sm:min-h-[120px]"
        >
          {{ t().disabledLabel }}
        </div>
      </section>

      <section class="space-y-4">
        <h3 class="text-lg font-semibold">{{ t().payloadHeading }}</h3>
        <p class="text-sm text-muted-foreground">{{ t().payloadDesc }}</p>
        <div class="rounded-xl border bg-muted/40 p-4 text-sm">
          @if (payload(); as p) {
            <dl class="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div class="flex gap-2">
                <dt class="text-muted-foreground">{{ t().itemLabel }}:</dt>
                <dd class="font-medium truncate">{{ p.label }}</dd>
              </div>
              <div class="flex gap-2">
                <dt class="text-muted-foreground">{{ t().indexLabel }}:</dt>
                <dd class="font-medium">{{ p.index }}</dd>
              </div>
              <div class="flex gap-2">
                <dt class="text-muted-foreground">{{ t().positionLabel }}:</dt>
                <dd class="font-medium">{{ p.x }} × {{ p.y }}</dd>
              </div>
              <div class="flex gap-2">
                <dt class="text-muted-foreground">{{ t().actionLabel }}:</dt>
                <dd class="font-medium">{{ action() || '—' }}</dd>
              </div>
            </dl>
          } @else {
            <p class="text-muted-foreground">{{ t().noEventYet }}</p>
          }
        </div>
      </section>

      <section class="space-y-4">
        <h3 class="text-lg font-semibold">{{ t().codeHeading }}</h3>
        <p class="text-sm text-muted-foreground">{{ t().codeDesc }}</p>
        <pre
          class="overflow-x-auto rounded-xl border bg-muted/40 p-4 text-xs leading-relaxed"
        ><code>{{ usageSnippet }}</code></pre>
      </section>
    </div>
  `,
})
export class ContextMenuAttachDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(
    () => CONTEXT_MENU_ATTACH_DEMO_LOCALES[this.localeId()] ?? CONTEXT_MENU_ATTACH_DEMO_LOCALES['en'],
  );

  protected readonly usageSnippet = USAGE_SNIPPET;

  protected readonly photos = computed<AttachDemoItem[]>(() =>
    PHOTOS.map((src, index) => ({
      id: `photo-${index}`,
      label: `${this.t().photoAlt} ${index + 1}`,
      src,
    })),
  );

  protected readonly cards = computed<AttachDemoItem[]>(() => [
    { id: 'card-1', label: this.t().card1Title },
    { id: 'card-2', label: this.t().card2Title },
    { id: 'card-3', label: this.t().card3Title },
  ]);

  protected readonly rows = computed<AttachDemoItem[]>(() => [
    { id: 'row-1', label: this.t().row1Name, meta: this.t().row1Role },
    { id: 'row-2', label: this.t().row2Name, meta: this.t().row2Role },
    { id: 'row-3', label: this.t().row3Name, meta: this.t().row3Role },
  ]);

  protected readonly disabledItem: AttachDemoItem = { id: 'disabled', label: 'disabled' };

  protected readonly payload = signal<TriggeredPayload | null>(null);
  protected readonly action = signal('');

  protected onTriggered(event: ContextMenuEvent<AttachDemoItem>): void {
    this.setPayload(event.item, event.event, event.index);
  }

  protected openFor(menu: ContextMenuComponent, item: AttachDemoItem, event: MouseEvent): void {
    this.setPayload(item, event, undefined);
    menu.show(event.clientX, event.clientY);
  }

  protected runAction(label: string): void {
    this.action.set(label);
  }

  private setPayload(item: AttachDemoItem, event: MouseEvent, index: number | undefined): void {
    this.payload.set({
      label: item.label,
      index: index === undefined ? '—' : String(index),
      x: Math.round(event.clientX),
      y: Math.round(event.clientY),
    });
  }
}
