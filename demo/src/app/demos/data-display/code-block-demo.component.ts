import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import {
  CODE_BLOCK_THEMES,
  CodeBlockComponent,
} from '../../../../../packages/components/ui';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { CODE_BLOCK_DEMO_LOCALES } from './code-block-demo.locales';

@Component({
  selector: 'app-code-block-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CodeBlockComponent],
  template: `
    <section class="space-y-4">
      <h2 id="code-block" class="text-2xl font-semibold scroll-m-20">{{ t().heading }}</h2>
      <p class="text-muted-foreground">{{ t().description }}</p>
      <ui-code-block [code]="codeBlockSample" language="typescript" />

      <h3 class="mt-4 font-semibold">{{ t().labelYaml }}</h3>
      <ui-code-block [code]="codeBlockYaml" language="yaml" />

      <h3 class="mt-4 font-semibold">{{ t().labelCSharp }}</h3>
      <ui-code-block [code]="codeBlockCSharp" language="csharp" />

      <h3 class="mt-4 font-semibold">{{ t().labelJava }}</h3>
      <ui-code-block [code]="codeBlockJava" language="java" />

      <h3 class="mt-4 font-semibold">{{ t().labelHtml }}</h3>
      <ui-code-block [code]="codeBlockHtml" language="html" />

      <h3 class="mt-4 font-semibold">{{ t().labelXml }}</h3>
      <ui-code-block [code]="codeBlockXml" language="xml" />

      <h3 class="mt-4 font-semibold">{{ t().labelCss }}</h3>
      <ui-code-block [code]="codeBlockCss" language="css" />

      <h3 class="mt-4 font-semibold">{{ t().labelJson }}</h3>
      <ui-code-block [code]="codeBlockJson" language="json" />

      <h3 class="mt-4 font-semibold">{{ t().labelBash }}</h3>
      <ui-code-block [code]="codeBlockBash" language="bash" />

      <h3 class="mt-4 font-semibold text-purple-400">{{ t().labelCustomTheme }}</h3>
      <ui-code-block [code]="codeBlockSample" language="typescript" [theme]="draculaTheme" />

      <h3 class="mt-4 font-semibold text-blue-400">{{ t().labelCustomLanguage }}</h3>
      <ui-code-block [code]="codeBlockSql" language="sql" [customLanguages]="sqlPatterns" />

      <h3 class="mt-8 text-xl font-bold">{{ t().collapsibleHeading }}</h3>
      <p class="text-muted-foreground">{{ t().collapsibleDescription }}</p>

      <h4 class="mt-4 font-semibold">{{ t().labelTypescriptCollapse }}</h4>
      <ui-code-block [code]="foldableTypescript" language="typescript" [collapseScope]="true" />

      <h4 class="mt-4 font-semibold">{{ t().labelJsonCollapse }}</h4>
      <ui-code-block
        [code]="foldableJson"
        language="json"
        [collapseScope]="true"
        [defaultCollapsed]="1"
      />

      <h4 class="mt-4 font-semibold">{{ t().labelYamlCollapse }}</h4>
      <ui-code-block [code]="foldableYaml" language="yaml" [collapseScope]="true" />

      <h4 class="mt-4 font-semibold">{{ t().labelHtmlCollapse }}</h4>
      <ui-code-block [code]="foldableHtml" language="html" [collapseScope]="true" />

      <h4 class="mt-4 font-semibold">{{ t().labelXmlCollapse }}</h4>
      <ui-code-block [code]="codeBlockXml" language="xml" [collapseScope]="true" />

      <h4 class="mt-4 font-semibold">{{ t().labelSqlCollapse }}</h4>
      <ui-code-block
        [code]="foldableSql"
        language="sql"
        [collapseScope]="true"
        [customLanguages]="sqlWithScopes"
      />

      <h3 class="mt-8 text-xl font-bold">{{ t().lineNumbersHeading }}</h3>
      <p class="text-muted-foreground">{{ t().lineNumbersDescription }}</p>

      <h4 class="mt-4 font-semibold">{{ t().labelNumbersDefault }}</h4>
      <ui-code-block [code]="codeBlockSample" language="typescript" />

      <h4 class="mt-4 font-semibold">{{ t().labelNumbersWithCollapse }}</h4>
      <ui-code-block [code]="foldableTypescript" language="typescript" [collapseScope]="true" />

      <h4 class="mt-4 font-semibold">{{ t().labelNumbersOff }}</h4>
      <ui-code-block [code]="codeBlockSample" language="typescript" [lineNumbers]="false" />

      <h3 class="mt-8 text-xl font-bold">{{ t().themePresetsHeading }}</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h4 class="font-semibold mb-2">{{ t().labelThemeVscode }}</h4>
          <ui-code-block [code]="codeBlockSample" language="typescript" [theme]="themes['vscode']" />
        </div>
        <div>
          <h4 class="font-semibold mb-2">{{ t().labelThemeDracula }}</h4>
          <ui-code-block [code]="codeBlockSample" language="typescript" [theme]="themes['dracula']" />
        </div>
        <div>
          <h4 class="font-semibold mb-2">{{ t().labelThemeGithub }}</h4>
          <ui-code-block [code]="codeBlockSample" language="typescript" [theme]="themes['github']" />
        </div>
        <div>
          <h4 class="font-semibold mb-2">{{ t().labelThemeMonokai }}</h4>
          <ui-code-block [code]="codeBlockSample" language="typescript" [theme]="themes['monokai']" />
        </div>
      </div>
    </section>
  `,
})
export class CodeBlockDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(() => CODE_BLOCK_DEMO_LOCALES[this.localeId()] ?? CODE_BLOCK_DEMO_LOCALES['en']);

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

  readonly codeBlockXml = `<?xml version="1.0" encoding="UTF-8"?>
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
