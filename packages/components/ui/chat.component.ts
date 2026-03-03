import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
  output,
  ViewChild,
  ElementRef,
  signal,
  effect,
  AfterContentInit,
  AfterViewInit,
  OnDestroy,
} from '@angular/core';
import { cn } from '../lib/utils';
import { ButtonComponent } from './button.component';
import { TextareaComponent } from './textarea.component';
import { ScrollAreaComponent } from './scroll-area.component';
import { AvatarComponent, AvatarFallbackComponent, AvatarImageComponent } from './avatar.component';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'ui-chat-message',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarComponent, AvatarFallbackComponent, AvatarImageComponent],
  template: `
    <div [class]="rootClasses()" [attr.data-slot]="'chat-message'">
      @if (showAvatar()) {
        <ui-avatar class="h-8 w-8 shrink-0">
          @if (avatarSrc(); as src) { <ui-avatar-image [src]="src" /> }
          <ui-avatar-fallback>{{ avatarFallback() }}</ui-avatar-fallback>
        </ui-avatar>
      }

      <div [class]="bubbleClasses()" [attr.data-slot]="'chat-bubble'">
        <span #projected [class]="hasProjectedContent() ? '' : 'hidden'">
          <ng-content />
        </span>
        @if (!hasProjectedContent() && content()) {
          <span>{{ content() }}</span>
        }
      </div>
    </div>
  `,
  host: { class: 'contents' },
})
export class ChatMessageComponent implements AfterContentInit {
  role = input<'user' | 'assistant' | 'system'>('user');
  content = input<string>();
  avatarSrc = input<string | undefined>(undefined);
  avatarFallback = input('?');
  class = input('');

  @ViewChild('projected', { static: true }) projectedRef?: ElementRef<HTMLElement>;

  private readonly _hasProjectedContent = signal(false);
  hasProjectedContent = this._hasProjectedContent.asReadonly();

  showAvatar = computed(() => this.role() !== 'system');

  ngAfterContentInit() {
    const el = this.projectedRef?.nativeElement;
    if (el) {
      const hasContent = Array.from(el.childNodes).some(
        node => node.nodeType === Node.ELEMENT_NODE ||
          (node.nodeType === Node.TEXT_NODE && !!node.textContent?.trim())
      );
      this._hasProjectedContent.set(hasContent);
    }
  }

  rootClasses = computed(() => cn(
    'flex w-full gap-3 mb-4',
    this.role() === 'user' && 'justify-end pl-8',
    this.role() === 'assistant' && 'justify-start pr-8',
    this.role() === 'system' && 'justify-center px-4 mb-2',
    this.class()
  ));

  bubbleClasses = computed(() => cn(
    'relative rounded-lg px-4 py-2 text-sm max-w-[80%]',
    this.role() === 'user' && 'bg-primary text-primary-foreground',
    this.role() === 'assistant' && 'bg-muted border',
    this.role() === 'system' && 'bg-transparent text-xs text-muted-foreground text-center italic',
  ));
}

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

  ngAfterViewInit() {
    this.updateObserver();
  }

  private updateObserver() {
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

  scrollToBottom() {
    this.scrollArea?.scrollToBottom();
  }

  ngOnDestroy() {
    this.observer?.disconnect();
  }
}

@Component({
  selector: 'ui-chat-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, TextareaComponent, FormsModule],
  host: { class: 'contents' },
  template: `
    <div [class]="classes()" [attr.data-slot]="'chat-input'">
      <ui-textarea
        [class]="textareaClasses()"
        [placeholder]="placeholder()"
        [(ngModel)]="inputValue"
        (keydown.enter)="onEnter($event)"
        [rows]="1"
      />
      <ui-button
        size="icon"
        [disabled]="!inputValue() || disabled()"
        (click)="onSubmit()"
        class="absolute right-2 bottom-2 h-8 w-8"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4">
            <path d="m5 12 7-7 7 7"/>
            <path d="M12 19V5"/>
        </svg>
      </ui-button>
    </div>
  `,
})
export class ChatInputComponent {
  class = input('');
  placeholder = input('Type a message...');
  disabled = input(false);

  send = output<string>();

  inputValue = signal('');

  classes = computed(() => cn('relative flex items-center', this.class()));
  textareaClasses = computed(() => cn('min-h-[44px] w-full resize-none bg-background pr-12 py-3 rounded-lg border focus-visible:ring-offset-0 focus-visible:ring-1'));

  onEnter(event: Event) {
    const kEvent = event as KeyboardEvent;
    if (!kEvent.shiftKey) {
      event.preventDefault();
      this.onSubmit();
    }
  }

  onSubmit() {
    if (this.inputValue().trim() && !this.disabled()) {
      this.send.emit(this.inputValue());
      this.inputValue.set('');
    }
  }
}
