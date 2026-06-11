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
  autoScroll = input(false);
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

  scrollToBottom(): void {
    this.scrollArea?.scrollToBottom();
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}
