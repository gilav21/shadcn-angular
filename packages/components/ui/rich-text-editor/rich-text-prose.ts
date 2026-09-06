/**
 * The editor's content typography — headings, lists, links, code, images,
 * tables, task lists, collapsible blocks and rules.
 *
 * Shared verbatim by `<ui-rich-text-view>`, so a document renders identically
 * whether it is being authored or published. Editor *chrome* is deliberately
 * not here: the empty-state placeholder, the outline suppression, the image
 * and summary cursors, the table cell-selection tints and the disabled cursor
 * all belong to the editable alone and would be wrong on a read-only page.
 *
 * These are Tailwind arbitrary-variant utilities, not `@tailwindcss/typography`
 * — that plugin is not installed, and the `prose` classes that used to sit
 * alongside them were no-ops.
 */
export const RICH_TEXT_PROSE_CLASSES: readonly string[] = [
    '[&_h1]:text-3xl [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2',
    '[&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-2',
    '[&_h3]:text-xl [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1',
    '[&_ul]:list-disc [&_ul]:ps-6 [&_ul]:my-2',
    '[&_ol]:list-decimal [&_ol]:ps-6 [&_ol]:my-2',
    '[&_li]:my-1',
    '[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 [&_a]:cursor-pointer [&_a]:font-medium hover:[&_a]:text-primary/80',
    '[&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm [&_code]:font-mono',
    '[&_pre]:bg-muted [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:overflow-x-auto',
    '[&_pre_code]:bg-transparent [&_pre_code]:p-0',
    '[&_img]:inline [&_img]:max-w-full [&_img]:h-auto [&_img]:my-0 [&_img]:mx-0',
    '[&_table]:border-collapse [&_table]:w-full [&_table]:my-2',
    '[&_td]:border [&_td]:border-border [&_td]:p-2 [&_td]:min-w-[60px]',
    '[&_th]:border [&_th]:border-border [&_th]:p-2 [&_th]:bg-muted [&_th]:font-semibold [&_th]:text-left',
    '[&_ul_ul]:my-0 [&_ol_ol]:my-0 [&_ul_ol]:my-0 [&_ol_ul]:my-0',
    '[&_ul[data-task-list]]:list-none [&_ul[data-task-list]]:ps-0 [&_ul[data-task-list]]:my-2',
    '[&_li_ul[data-task-list]]:ps-6 [&_li_ul[data-task-list]]:my-0',
    '[&_li[data-task]]:flex [&_li[data-task]]:flex-wrap [&_li[data-task]]:items-start [&_li[data-task]]:gap-2 [&_li[data-task]]:my-1',
    '[&_li[data-task]>ul]:w-full',
    '[&_li[data-task]_input[type=checkbox]]:mt-1 [&_li[data-task]_input[type=checkbox]]:h-4 [&_li[data-task]_input[type=checkbox]]:w-4 [&_li[data-task]_input[type=checkbox]]:cursor-pointer [&_li[data-task]_input[type=checkbox]]:accent-primary',
    '[&_li[data-task]_input[type=checkbox]]:shrink-0',
    '[&_li[data-task][data-checked=true]]:line-through [&_li[data-task][data-checked=true]]:text-muted-foreground',
    '[&_details]:border [&_details]:border-border [&_details]:rounded-md [&_details]:my-2 [&_details]:overflow-hidden',
    '[&_summary]:bg-muted/40 [&_summary]:px-3 [&_summary]:py-2 [&_summary]:cursor-pointer [&_summary]:font-medium',
    '[&_details>:not(summary)]:px-3 [&_details>:not(summary)]:py-2',
    '[&_hr]:border-t [&_hr]:border-border [&_hr]:my-4',
    '[&_blockquote]:border-s-4 [&_blockquote]:border-border [&_blockquote]:ps-4 [&_blockquote]:py-1 [&_blockquote]:my-2 [&_blockquote]:text-muted-foreground [&_blockquote]:italic',
] as const;
