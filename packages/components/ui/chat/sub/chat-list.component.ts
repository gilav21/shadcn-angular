import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
  ViewChild,
  ElementRef,
  effect,
  AfterViewInit,
  OnDestroy,
} from '@angular/core';
import { cn } from '../../../lib/utils';
import { ScrollAreaComponent } from '../../scroll-area';

@Component({
  selector: 'ui-chat-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ScrollAreaComponent],
  host: {
    'class': 'flex flex-col flex-1 overflow-hidden'
  },
  template: `
    <ui-scroll-area [class]="classes()" [attr.data-slot]="'chat-list'">
      <div #content class="p-4 flex flex-col">
        <ng-content />
      </div>
    </ui-scroll-area>
  `,
})
export class ChatListComponent implements AfterViewInit, OnDestroy {
  /**
   * Keeps the list pinned to the newest message: a `MutationObserver` watches the
   * projected content and scrolls to the bottom on any change, including text
   * edits (so a streaming reply keeps following). It scrolls unconditionally, so
   * a user who has scrolled up will be yanked back down.
   */
  autoScroll = input(false);
  /** Extra classes merged onto the scroll viewport. The host is already a flex child that fills and clips, so overriding the height here is rarely needed. */
  class = input('');
  classes = computed(() => cn('h-full w-full', this.class()));

  @ViewChild(ScrollAreaComponent) scrollArea?: ScrollAreaComponent;
  @ViewChild('content') contentRef?: ElementRef<HTMLElement>;

  private observer?: MutationObserver;

  constructor() {
    effect(() => {
      this.updateObserver();
    });
  }

  ngAfterViewInit(): void {
    this.updateObserver();
  }

  private updateObserver(): void {
    this.observer?.disconnect();

    if (this.autoScroll() && this.contentRef?.nativeElement) {
      this.observer = new MutationObserver(() => {
        this.scrollToBottom();
      });

      this.observer.observe(this.contentRef.nativeElement, {
        childList: true,
        subtree: true,
        characterData: true
      });

      this.scrollToBottom();
    }
  }

  /** Jumps to the newest message. Called automatically while {@link autoScroll} is on, and available for a "jump to latest" button when it is off. */
  scrollToBottom(): void {
    this.scrollArea?.scrollToBottom();
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}
