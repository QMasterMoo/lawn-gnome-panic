// STUB: title screen. Replaced in epic 2.
/** Shows the title over the running world; resolves 'continue' or 'new' when the player picks. */
export function showTitle(_root: HTMLElement, _hasSave: boolean): Promise<'continue' | 'new'> {
  return Promise.resolve('new');
}
