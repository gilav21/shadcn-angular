import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { cn } from '../../components/lib/utils';
import {
  AccordionComponent,
  AccordionItemComponent,
  AccordionTriggerComponent,
  AccordionContentComponent,
} from '../../components/ui/accordion';

export interface FaqItem {
  question: string;
  answer: string;
}

@Component({
  selector: 'ui-faq-block',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AccordionComponent,
    AccordionItemComponent,
    AccordionTriggerComponent,
    AccordionContentComponent,
  ],
  templateUrl: './faq.component.html',
  host: { class: 'block' },
})
export class FaqBlockComponent {
  readonly class = input('');

  readonly heading = input('Frequently asked questions');
  readonly subheading = input(
    'Everything you need to know about the library. Can’t find an answer? Reach out to support.',
  );

  readonly items = input<FaqItem[]>([
    {
      question: 'How do I install a component?',
      answer:
        'Use the CLI to add any component directly to your project: run “npx shadcn-angular add button”. The command copies the source files into your codebase and wires up the required dependencies automatically.',
    },
    {
      question: 'Do I own the code, or is it a dependency?',
      answer:
        'You own it. Components are copied into your project rather than installed as a versioned package, so the source lives in your repository and you are free to read, edit, and adapt every line.',
    },
    {
      question: 'How does theming work?',
      answer:
        'Theming is driven by CSS variables and Tailwind design tokens such as background, foreground, and primary. Override the tokens in your global stylesheet to restyle every component at once, or extend individual components inline.',
    },
    {
      question: 'Which frameworks and versions are supported?',
      answer:
        'The library targets modern standalone Angular with signals and the latest control-flow syntax. It works with any Angular application configured for Tailwind CSS, including server-side rendering setups.',
    },
    {
      question: 'What license is the library released under?',
      answer:
        'Everything is open source under the MIT license. You may use the components in personal and commercial projects free of charge, with no attribution required.',
    },
  ]);

  readonly classes = computed(() =>
    cn('mx-auto max-w-3xl px-4 py-16 sm:py-24', this.class()),
  );
}
