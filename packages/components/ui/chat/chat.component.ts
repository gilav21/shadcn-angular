import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
  ViewChild,
  ElementRef,
  signal,
  AfterContentInit,
} from '@angular/core';
import { cn } from '../../lib/utils';
import { AvatarComponent, AvatarFallbackComponent, AvatarImageComponent } from '../avatar';

@Component({
  selector: 'ui-chat-message',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarComponent, AvatarFallbackComponent, AvatarImageComponent],
  templateUrl: './chat.component.html',
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

  ngAfterContentInit(): void {
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
    this.role() === 'user' && 'justify-end ps-8 [&>ui-avatar]:order-last',
    this.role() === 'assistant' && 'justify-start pe-8',
    this.role() === 'system' && 'justify-center px-4 mb-2',
    this.class()
  ));

  bubbleClasses = computed(() => cn(
    'relative rounded-lg px-4 py-2 text-sm max-w-[85%] sm:max-w-[75%] md:max-w-[65%]',
    this.role() === 'user' && 'bg-primary text-primary-foreground',
    this.role() === 'assistant' && 'bg-muted border',
    this.role() === 'system' && 'bg-transparent text-xs text-muted-foreground text-center italic',
  ));
}
