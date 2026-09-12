/**
 * Emptiness fixtures shared by the validators spec and the component spec's
 * T-18, so the two emptiness rules can never drift.
 *
 * It lives in its own file rather than in one of the specs: a spec is not
 * shipped to a consumer, so importing one from another spec is a portability
 * error the registry check refuses.
 */
export const EMPTINESS_FIXTURES: ReadonlyArray<readonly [string, boolean]> = [
    ['', true],
    ['<p><br></p>', true],
    ['<br>', true],
    ['<p>&nbsp;</p>', true],
    ['<p>​</p>', true],
    ['<ul data-task-list><li data-task><input type="checkbox"><span>&nbsp;</span></li></ul>', true],
    ['  \n', true],
    ['​', true],
    ['<p>a</p>', false],
    ['<p><img src="x.png"></p>', false],
    ['<hr>', false],
    ['<table><tr><td></td><td></td></tr></table>', false],
];

const TASK_ROWS =
    '<ul data-task-list>'
    + '<li data-task data-checked="true"><input type="checkbox"><span>first</span></li>'
    + '<li data-task data-checked="false"><input type="checkbox"><span>second</span></li>'
    + '</ul>';

const NESTED_TASK_ROWS =
    '<ul data-task-list>'
    + '<li data-task data-checked="false"><input type="checkbox"><span>parent</span>'
    + '<ul data-task-list><li data-task data-checked="false"><input type="checkbox"><span>child</span></li></ul>'
    + '</li>'
    + '</ul>';

/**
 * The DOM shapes every line rule has to answer for, shared by the line-model
 * spec and the component spec so neither can drift from the other.
 *
 * Each row is `[name, html]`. The name is what a failing case is called, so it
 * says which shape broke rather than which index.
 */
export const LINE_SHAPE_FIXTURES: ReadonlyArray<readonly [string, string]> = [
    ['a paragraph', '<p>one</p><p>two</p>'],
    ['headings and a div', '<h1>title</h1><div>body</div>'],
    ['plain list items', '<ul><li>one</li><li>two</li></ul>'],
    ['task rows', TASK_ROWS],
    ['a task row nested under a task row', NESTED_TASK_ROWS],
    ['a plain list nested under a task row', '<ul data-task-list><li data-task><input type="checkbox"><span>parent</span><ul><li>plain</li></ul></li></ul>'],
    ['a task row nested under a plain item', '<ul><li>plain<ul data-task-list><li data-task><input type="checkbox"><span>task</span></li></ul></li></ul>'],
    ['an item wrapping a paragraph', '<ul><li><p>wrapped</p></li></ul>'],
    ['a stray non-item child of a list', '<ul><li>one</li><span>stray</span><li>two</li></ul>'],
    ['an empty task row', '<ul data-task-list><li data-task><input type="checkbox"><span>\u00A0</span></li></ul>'],
    ['a task row holding only an image', '<ul data-task-list><li data-task><input type="checkbox"><span><img src="x.png"></span></li></ul>'],
    ['a task row starting with an image', '<ul data-task-list><li data-task><input type="checkbox"><span><img src="x.png">text</span></li></ul>'],
    ['a task row with inline formatting', '<ul data-task-list><li data-task><input type="checkbox"><span>read <b>the</b> docs</span></li></ul>'],
    ['a task row with a checkbox in its text', '<ul data-task-list><li data-task><input type="checkbox"><span>mid<input type="checkbox">end</span></li></ul>'],
    ['a line holding only a break', '<p><br></p>'],
    ['a line holding only an empty span', '<p><span></span></p>'],
    ['table cells', '<table><tbody><tr><td>a</td><td>b</td></tr></tbody></table>'],
    ['a cell holding two paragraphs', '<table><tbody><tr><td><p>a</p><p>b</p></td></tr></tbody></table>'],
    ['an empty table', '<table><tbody><tr><td><br></td></tr></tbody></table>'],
    ['quote lines', '<blockquote><p>quoted</p><p>lines</p></blockquote>'],
    ['a quote holding a list', '<blockquote><ul><li>quoted item</li></ul></blockquote>'],
    ['a code block', '<pre><code>one\ntwo</code></pre>'],
    ['a details block', '<details><summary>head</summary><p>body</p></details>'],
    ['a horizontal rule between lines', '<p>before</p><hr><p>after</p>'],
];
