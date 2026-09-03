import { listIdeas } from './client';
import { ModelError, groupIdeas } from './google';
import { pl } from '../i18n/pl';
import { getApiKey } from '../state/settings';
import type { Group } from '../state/session';

/**
 * F-5.1 — everything between "voting closed" and "here are the groups".
 *
 * The key is read here, in the browser, and handed straight to the Google call
 * (F-3.2). It never travels through a Netlify Function: the ideas come back
 * from Blobs, the grouping happens against Google, and only the result is
 * persisted.
 */
export async function groupSessionIdeas(sessionId: string): Promise<Group[]> {
  const apiKey = getApiKey()?.trim();

  // Not retryable: no amount of pressing "Ponów" conjures a key. M2-2 adds the
  // dialog that puts one there.
  if (!apiKey) throw new ModelError(pl.settings.keyMissing, false);

  const ideas = await listIdeas(sessionId);
  if (ideas.length === 0) throw new ModelError(pl.model.noIdeas, false);

  return groupIdeas(apiKey, ideas);
}
