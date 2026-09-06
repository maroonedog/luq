/** The ONE recursion budget every path type counts down, so a self-referential
 *  model yields a finite path union instead of TS2589. */
export type PathDepthBudget = 6;
export type PreviousDepth = [never, 0, 1, 2, 3, 4, 5, 6, 7, 8];
