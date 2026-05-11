import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  CODE_BLOCK_THEMES,
  CodeBlockComponent,
} from '../../../../../packages/components/ui';

@Component({
  selector: 'app-code-block-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CodeBlockComponent],
  template: `
    <section class="space-y-4">
      <h2 id="code-block" class="text-2xl font-semibold scroll-m-20">Code Block</h2>
      <p class="text-muted-foreground">Syntax highlighting with copy button.</p>
      <ui-code-block [code]="codeBlockSample" language="typescript" />

      <h3 class="mt-4 font-semibold">YAML</h3>
      <ui-code-block [code]="codeBlockYaml" language="yaml" />

      <h3 class="mt-4 font-semibold">C#</h3>
      <ui-code-block [code]="codeBlockCSharp" language="csharp" />

      <h3 class="mt-4 font-semibold">Java</h3>
      <ui-code-block [code]="codeBlockJava" language="java" />

      <h3 class="mt-4 font-semibold">HTML</h3>
      <ui-code-block [code]="codeBlockHtml" language="html" />

      <h3 class="mt-4 font-semibold">CSS</h3>
      <ui-code-block [code]="codeBlockCss" language="css" />

      <h3 class="mt-4 font-semibold">JSON</h3>
      <ui-code-block [code]="codeBlockJson" language="json" />

      <h3 class="mt-4 font-semibold">Bash</h3>
      <ui-code-block [code]="codeBlockBash" language="bash" />

      <h3 class="mt-4 font-semibold text-purple-400">Custom Theme (Dracula)</h3>
      <ui-code-block [code]="codeBlockSample" language="typescript" [theme]="draculaTheme" />

      <h3 class="mt-4 font-semibold text-blue-400">Custom Language (SQL)</h3>
      <ui-code-block [code]="codeBlockSql" language="sql" [customLanguages]="sqlPatterns" />

      <h3 class="mt-8 text-xl font-bold">Collapsible Scopes</h3>
      <p class="text-muted-foreground">
        Set <code>[collapseScope]="true"</code> to enable a fold gutter. Use
        <code>[defaultCollapsed]="N"</code> to start with everything at depth N or deeper folded.
      </p>

      <h4 class="mt-4 font-semibold">TypeScript &mdash; click ▾ to collapse a function</h4>
      <ui-code-block [code]="foldableTypescript" language="typescript" [collapseScope]="true" />

      <h4 class="mt-4 font-semibold">JSON &mdash; everything below the root collapsed by default</h4>
      <ui-code-block
        [code]="foldableJson"
        language="json"
        [collapseScope]="true"
        [defaultCollapsed]="1"
      />

      <h4 class="mt-4 font-semibold">YAML &mdash; indentation-based scopes</h4>
      <ui-code-block [code]="foldableYaml" language="yaml" [collapseScope]="true" />

      <h4 class="mt-4 font-semibold">HTML &mdash; tag-pair scopes</h4>
      <ui-code-block [code]="foldableHtml" language="html" [collapseScope]="true" />

      <h4 class="mt-4 font-semibold">Custom language &mdash; SQL with BEGIN/END scopes</h4>
      <ui-code-block
        [code]="foldableSql"
        language="sql"
        [collapseScope]="true"
        [customLanguages]="sqlWithScopes"
      />

      <h3 class="mt-8 text-xl font-bold">Theme Presets</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h4 class="font-semibold mb-2">VSCode Dark+</h4>
          <ui-code-block [code]="codeBlockSample" language="typescript" [theme]="themes['vscode']" />
        </div>
        <div>
          <h4 class="font-semibold mb-2">Dracula</h4>
          <ui-code-block [code]="codeBlockSample" language="typescript" [theme]="themes['dracula']" />
        </div>
        <div>
          <h4 class="font-semibold mb-2">GitHub Dark</h4>
          <ui-code-block [code]="codeBlockSample" language="typescript" [theme]="themes['github']" />
        </div>
        <div>
          <h4 class="font-semibold mb-2">Monokai</h4>
          <ui-code-block [code]="codeBlockSample" language="typescript" [theme]="themes['monokai']" />
        </div>
      </div>
    </section>
  `,
})
export class CodeBlockDemoComponent {
  readonly themes = CODE_BLOCK_THEMES;

  readonly codeBlockCSharp = `using System;

namespace DemoApp {
    [Serializable]
    public class Person {
        public string Name { get; set; }

        public void SayHello() {
            Console.WriteLine("Hello from C#!");
        }
    }
}`;

  readonly codeBlockYaml = `name: CI
on: [push]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Run scripts
        run: echo "Hello world"
        env:
          DEBUG: true`;

  readonly codeBlockSample = `const greeting = 'Hello, World!';
console.log(greeting);`;

  readonly codeBlockJava = `public class HelloWorld {
    @Override
    public static void main(String[] args) {
        System.out.println("Hello, Java!");
    }
}`;

  readonly codeBlockHtml = `<div class="container">
    <!-- Main Header -->
    <h1 id="title">Welcome</h1>
    <p data-info="intro">This is a demo.</p>
</div>`;

  readonly codeBlockCss = `/* Main Container Style */
.container {
    background-color: #f0f0f0;
    margin: 20px;
    padding: 10px;
    border-radius: 8px;
}`;

  readonly codeBlockJson = `{
    "name": "shadcn-angular",
    "version": "1.0.0",
    "features": ["highlighting", "components"],
    "active": true
}`;

  readonly codeBlockBash = `# Install dependencies
npm install

# Build the project
ng build --prod`;

  readonly draculaTheme = {
    keyword: 'text-pink-500 font-bold',
    string: 'text-yellow-300',
    comment: 'text-purple-400',
    function: 'text-green-400',
    number: 'text-orange-300',
    decorator: 'text-green-300',
    tag: 'text-pink-500',
    attr: 'text-green-300 italic',
  };

  readonly sqlPatterns = {
    sql: [
      { type: 'keyword', regex: /\b(SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|JOIN|AND|OR|ON|AS|GROUP|BY|ORDER|LIMIT|create|table|int|varchar|primary|key)\b/i },
      { type: 'string', regex: /'(?:[^'\\]|\\.)*'/ },
      { type: 'number', regex: /\b\d+\b/ },
      { type: 'comment', regex: /--.*/ },
    ],
  };

  readonly codeBlockSql = `SELECT id, name, email
FROM users
WHERE status = 'active'
ORDER BY created_at DESC;`;

  readonly foldableTypescript = `function greet(name: string) {
  const message = "Hello, " + name;
  return message;
}

function farewell(name: string) {
  const message = "Goodbye, " + name;
  return message;
}`;

  readonly foldableJson = `{
  "name": "shadcn-angular",
  "scripts": {
    "build": "ng build",
    "test": "vitest"
  },
  "dependencies": {
    "@angular/core": "^20.0.0",
    "tailwindcss": "^3.4.0"
  }
}`;

  readonly foldableYaml = `services:
  api:
    image: node:20
    ports:
      - 3000:3000
  db:
    image: postgres:16
    environment:
      POSTGRES_PASSWORD: secret`;

  readonly foldableHtml = `<section class="card">
  <header>
    <h2>Title</h2>
  </header>
  <div class="body">
    <p>Body copy.</p>
  </div>
</section>`;

  readonly foldableSql = `CREATE PROCEDURE add_user(name TEXT)
BEGIN
  INSERT INTO users(name) VALUES (name);
  COMMIT;
END;`;

  readonly sqlWithScopes = {
    sql: {
      patterns: [
        { type: 'keyword', regex: /\b(SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|JOIN|AND|OR|ON|AS|GROUP|BY|ORDER|LIMIT|CREATE|PROCEDURE|BEGIN|END|VALUES|INTO|COMMIT|TEXT)\b/i },
        { type: 'string', regex: /'(?:[^'\\]|\\.)*'/ },
        { type: 'number', regex: /\b\d+\b/ },
        { type: 'comment', regex: /--.*/ },
      ],
      scopes: (lines: readonly string[]) => {
        const ranges: { startLine: number; endLine: number; depth: number }[] = [];
        let start = -1;
        for (let i = 0; i < lines.length; i++) {
          const trimmed = lines[i].trim();
          if (/^BEGIN\b/i.test(trimmed)) { start = i; }
          else if (/^END\b/i.test(trimmed) && start !== -1) {
            ranges.push({ startLine: start, endLine: i, depth: 0 });
            start = -1;
          }
        }
        return ranges;
      },
    },
  };
}
