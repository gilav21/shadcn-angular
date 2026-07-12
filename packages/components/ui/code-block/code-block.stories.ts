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

const xmlCode = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Maven project descriptor -->
<!DOCTYPE project>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.example</groupId>
  <artifactId>demo</artifactId>
  <version>1.0.0</version>
  <description>A sample project &amp; build descriptor.</description>
  <dependencies>
    <dependency>
      <groupId>org.junit.jupiter</groupId>
      <artifactId>junit-jupiter</artifactId>
      <version>5.10.0</version>
      <scope>test</scope>
    </dependency>
  </dependencies>
</project>`;

/**
 * The `theme` argType uses Storybook's `mapping` so the Controls panel can
 * offer named theme presets (a select) while the component itself only
 * accepts a resolved `CodeBlockTheme | null`. The story-level arg therefore
 * stores the mapping *key* (a string); Storybook resolves it to the actual
 * theme object before `render` receives it.
 */
type CodeBlockStoryProps = Omit<CodeBlockComponent, 'theme'> & { theme: string };

const meta: Meta<CodeBlockStoryProps> = {
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
            options: ['typescript', 'javascript', 'python', 'java', 'html', 'xml', 'css', 'json', 'bash', 'csharp', 'yaml'],
            description: 'Language used to tokenize and syntax-highlight `code`. Falls back to `typescript` for unknown keys.',
        },
        code: { control: 'text', description: 'Source code to render.' },
        theme: {
            control: 'select',
            options: ['default', 'dracula', 'github', 'monokai'],
            mapping: {
                default: null,
                dracula: CODE_BLOCK_THEMES['dracula'],
                github: CODE_BLOCK_THEMES['github'],
                monokai: CODE_BLOCK_THEMES['monokai'],
            },
            description: 'Token-type-to-class theme map. `default` uses the built-in colors.',
        },
        customLanguages: { control: 'object', description: 'Extra/override language definitions keyed by language id (token patterns + optional scope detector for folding).' },
        collapseScope: { control: 'boolean', description: 'Enables scope folding (chevrons on foldable lines).' },
        defaultCollapsed: { control: { type: 'number', min: 0, max: 5, step: 1 }, description: 'Scope depth at or above which folds start collapsed. Unset = nothing pre-collapsed.' },
        lineNumbers: { control: 'boolean', description: 'Shows the line-number gutter.' },
        class: { control: 'text', description: 'Extra classes merged onto the host container.' },
    },
    args: {
        language: 'typescript',
        code: typescriptCode,
        theme: 'default',
        customLanguages: null,
        collapseScope: false,
        defaultCollapsed: undefined,
        lineNumbers: true,
        class: '',
    },
};

export default meta;
type Story = StoryObj<CodeBlockStoryProps>;

const PLAYGROUND_TEMPLATE = `
    <ui-code-block
        [code]="code" [language]="language" [theme]="theme"
        [customLanguages]="customLanguages" [collapseScope]="collapseScope"
        [defaultCollapsed]="defaultCollapsed" [lineNumbers]="lineNumbers"
        [class]="class">
    </ui-code-block>`;

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = {
    render: (args) => ({
        props: args,
        template: PLAYGROUND_TEMPLATE,
    }),
};

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

export const Xml: Story = {
    args: {
        code: xmlCode,
        language: 'xml',
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

const foldableTypescript = `function greet(name: string) {
  const message = "Hello, " + name;
  return message;
}

function farewell(name: string) {
  const message = "Goodbye, " + name;
  return message;
}`;

const foldableYaml = `services:
  api:
    image: node:20
    ports:
      - 3000:3000
  db:
    image: postgres:16
    environment:
      POSTGRES_PASSWORD: secret`;

const foldableHtml = `<section class="card">
  <header>
    <h2>Title</h2>
  </header>
  <div class="body">
    <p>Body copy.</p>
  </div>
</section>`;

const sqlScopes = (lines: readonly string[]) => {
    const ranges: { startLine: number; endLine: number; depth: number }[] = [];
    let start = -1;
    for (let i = 0; i < lines.length; i++) {
        if (/^BEGIN\b/i.test(lines[i].trim())) { start = i; }
        else if (/^END\b/i.test(lines[i].trim()) && start !== -1) {
            ranges.push({ startLine: start, endLine: i, depth: 0 });
            start = -1;
        }
    }
    return ranges;
};

const sqlCode = `CREATE PROCEDURE add_user(name TEXT)
BEGIN
  INSERT INTO users(name) VALUES (name);
  COMMIT;
END;`;

const sqlPatterns = {
    sql: {
        patterns: [
            { type: 'keyword', regex: /\b(SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|JOIN|AND|OR|ON)\b/i },
            { type: 'keyword', regex: /\b(AS|GROUP|BY|ORDER|LIMIT|CREATE|PROCEDURE|BEGIN|END|VALUES|INTO|COMMIT|TEXT)\b/i },
            { type: 'string', regex: /'(?:[^'\\]|\\.)*'/ },
            { type: 'number', regex: /\b\d+\b/ },
            { type: 'comment', regex: /--.*/ },
        ],
        scopes: sqlScopes,
    },
};

export const Foldable: Story = {
    args: {
        code: foldableTypescript,
        language: 'typescript',
        collapseScope: true,
    },
    render: (args) => ({
        props: args,
        template: `<ui-code-block [code]="code" [language]="language" [collapseScope]="collapseScope" />`,
    }),
};

export const FoldableJSON: Story = {
    args: {
        code: jsonCode,
        language: 'json',
        collapseScope: true,
    },
    render: (args) => ({
        props: args,
        template: `<ui-code-block [code]="code" [language]="language" [collapseScope]="collapseScope" />`,
    }),
};

export const FoldableYAML: Story = {
    args: {
        code: foldableYaml,
        language: 'yaml',
        collapseScope: true,
    },
    render: (args) => ({
        props: args,
        template: `<ui-code-block [code]="code" [language]="language" [collapseScope]="collapseScope" />`,
    }),
};

export const FoldableHTML: Story = {
    args: {
        code: foldableHtml,
        language: 'html',
        collapseScope: true,
    },
    render: (args) => ({
        props: args,
        template: `<ui-code-block [code]="code" [language]="language" [collapseScope]="collapseScope" />`,
    }),
};

export const FoldableXML: Story = {
    args: {
        code: xmlCode,
        language: 'xml',
        collapseScope: true,
    },
    render: (args) => ({
        props: args,
        template: `<ui-code-block [code]="code" [language]="language" [collapseScope]="collapseScope" />`,
    }),
};

export const InitialCollapseDepth: Story = {
    args: {
        code: jsonCode,
        language: 'json',
        collapseScope: true,
        defaultCollapsed: 1,
    },
    render: (args) => ({
        props: args,
        template: `<ui-code-block [code]="code" [language]="language" [collapseScope]="collapseScope" [defaultCollapsed]="defaultCollapsed" />`,
    }),
};

export const FoldableCustom: Story = {
    args: {
        code: sqlCode,
        language: 'sql',
        collapseScope: true,
    },
    render: (args) => ({
        props: { ...args, customLanguages: sqlPatterns },
        template: `<ui-code-block [code]="code" [language]="language" [collapseScope]="collapseScope" [customLanguages]="customLanguages" />`,
    }),
};

export const NoLineNumbers: Story = {
    args: {
        code: typescriptCode,
        language: 'typescript',
        lineNumbers: false,
    },
    render: (args) => ({
        props: args,
        template: `<ui-code-block [code]="code" [language]="language" [lineNumbers]="lineNumbers" />`,
    }),
};
