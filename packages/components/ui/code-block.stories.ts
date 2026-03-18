import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { CodeBlockComponent, CODE_BLOCK_THEMES } from './code-block.component';

const typescriptCode = `import { Component, input, computed } from '@angular/core';

@Component({
  selector: 'app-hello',
  template: '<h1>{{ greeting() }}</h1>',
})
export class HelloComponent {
  name = input<string>('World');
  greeting = computed(() => 'Hello, ' + this.name() + '!');
}`;

const pythonCode = `import numpy as np
from dataclasses import dataclass

@dataclass
class Point:
    x: float
    y: float

    def distance(self, other: "Point") -> float:
        return np.sqrt((self.x - other.x) ** 2 + (self.y - other.y) ** 2)

# Calculate distance between two points
p1 = Point(3.0, 4.0)
p2 = Point(0.0, 0.0)
print(f"Distance: {p1.distance(p2)}")`;

const jsonCode = `{
  "name": "shadcn-angular",
  "version": "1.0.0",
  "dependencies": {
    "@angular/core": "^18.0.0",
    "tailwindcss": "^3.4.0"
  },
  "scripts": {
    "start": "ng serve",
    "build": "ng build --prod"
  }
}`;

const meta: Meta<CodeBlockComponent> = {
    title: 'UI/CodeBlock',
    component: CodeBlockComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [CodeBlockComponent],
        }),
    ],
    argTypes: {
        language: {
            control: 'select',
            options: ['typescript', 'javascript', 'python', 'java', 'html', 'css', 'json', 'bash', 'csharp', 'yaml'],
        },
        code: { control: 'text' },
        theme: {
            control: 'select',
            options: ['default', 'dracula', 'github', 'monokai'],
            mapping: {
                default: null,
                dracula: CODE_BLOCK_THEMES['dracula'],
                github: CODE_BLOCK_THEMES['github'],
                monokai: CODE_BLOCK_THEMES['monokai'],
            },
        },
    },
    args: {
        language: 'typescript',
        code: typescriptCode,
        theme: null,
    },
};

export default meta;
type Story = StoryObj<CodeBlockComponent>;

export const Default: Story = {
    args: {
        code: typescriptCode,
        language: 'typescript',
    },
    render: (args) => ({
        props: args,
        template: `<ui-code-block [code]="code" [language]="language" [theme]="theme" />`,
    }),
};

export const Python: Story = {
    args: {
        code: pythonCode,
        language: 'python',
    },
    render: (args) => ({
        props: args,
        template: `<ui-code-block [code]="code" [language]="language" />`,
    }),
};

export const Json: Story = {
    args: {
        code: jsonCode,
        language: 'json',
    },
    render: (args) => ({
        props: args,
        template: `<ui-code-block [code]="code" [language]="language" />`,
    }),
};

export const DraculaTheme: Story = {
    args: {
        code: typescriptCode,
        language: 'typescript',
    },
    render: (args) => ({
        props: { ...args, theme: CODE_BLOCK_THEMES['dracula'] },
        template: `<ui-code-block [code]="code" [language]="language" [theme]="theme" />`,
    }),
};

export const GithubTheme: Story = {
    args: {
        code: typescriptCode,
        language: 'typescript',
    },
    render: (args) => ({
        props: { ...args, theme: CODE_BLOCK_THEMES['github'] },
        template: `<ui-code-block [code]="code" [language]="language" [theme]="theme" />`,
    }),
};

export const MonokaiTheme: Story = {
    args: {
        code: pythonCode,
        language: 'python',
    },
    render: (args) => ({
        props: { ...args, theme: CODE_BLOCK_THEMES['monokai'] },
        template: `<ui-code-block [code]="code" [language]="language" [theme]="theme" />`,
    }),
};
