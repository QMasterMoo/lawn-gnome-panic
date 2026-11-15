// Content pack ch8-finale: STUB. Its content issue fills it in.
import type { Condition, ContentPack } from '../../config';

export const PACK: ContentPack = { id: 'ch8-finale' };

/** Epilogue cards shown after the Mower falls (ui/epilogue.ts): each line shows when its `when` holds. */
export const EPILOGUE: readonly { when?: Condition; text: string }[] = [];
