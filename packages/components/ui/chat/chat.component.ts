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
  host: {
    class: 'contents',
    // `role` below is a domain input (who sent the message), not an ARIA role.
    // Written as `role="assistant"` it also lands on the DOM element, where it
    // is an invalid ARIA role (axe `aria-roles`). Keep the input, strip the attr.
    '[attr.role]': 'null',
  },
})
export class ChatMessageComponent implements AfterContentInit {
  /**
   * Who sent the message. Drives the whole layout: `'user'` aligns to the end
   * with a primary-coloured bubble and the avatar last, `'assistant'` aligns to
   * the start, `'system'` renders as centred italic meta text with no avatar.
   * This is a domain concept, not an ARIA role — the attribute is deliberately
   * stripped from the DOM.
   */
  role = input<'user' | 'assistant' | 'system'>('user');
  /** Message text for simple mode. Ignored once anything is projected into the bubble, which is how you render markdown, tool calls or attachments instead. */
  content = input<string>();
  /** Avatar image URL. When it fails to load — or is omitted — {@link avatarFallback} shows instead. Not rendered at all for `'system'` messages. */
  avatarSrc = input<string | undefined>(undefined);
  /** Initials shown when there is no usable {@link avatarSrc}. Keep it to one or two characters; the avatar is small. */
  avatarFallback = input('?');
  /** Extra classes merged onto the message row (the flex line holding avatar and bubble), not onto the bubble itself. */
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
