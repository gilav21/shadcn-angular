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
