import { z } from 'zod';
import { allExpansionsReady } from './expansion';
import { STAGES, type Session, type Stage } from './session';

/**
 * Going backwards, two ways.
 *
 * **"Wstecz"** is one screen back and loses nothing: it is a plain stage
 * change, and every screen it lands on re-uses what is already stored. The
 * results screen keeps its prompts, the prompts screen keeps its pictures. It
 * exists so the lecturer can show the previous screen again, or regenerate
 * one picture from the visualize screen, without paying for anything twice.
 *
 * **"Cofnij do…"** is a checkpoint and does throw work away, on purpose: it
 * clears everything the target screen is about to produce, so the run from
 * there is a fresh one. It goes through the function, because the pictures
 * and the ideas are blobs of their own.
 */

export const RESET_TARGETS = ['draft', 'results', 'expanded', 'visualizing'] as const;
export const resetTargetSchema = z.enum(RESET_TARGETS);
export type ResetTarget = z.infer<typeof resetTargetSchema>;

/** Body of POST /api/sessions/:id/reset. Empty means the old full reset. */
export const resetRequestSchema = z.object({ to: resetTargetSchema.default('draft') });

const stageIndex = (stage: Stage) => STAGES.indexOf(stage);

/**
 * The stage "Wstecz" lands on, or null where there is no going back: setup is
 * the first screen, and grouping is a model call in flight.
 */
export function previousStage(stage: Stage): Stage | null {
  switch (stage) {
    case 'draft':
    case 'grouping':
      return null;
    case 'intro':
      return 'draft';
    case 'voting':
      return 'intro';
    case 'results':
      return 'voting';
    case 'expanding':
    case 'expanded':
      return 'results';
    case 'visualizing':
      return 'expanded';
    case 'gallery':
      return 'visualizing';
  }
}

/** The checkpoints strictly before the current stage, in stage order. */
export function availableTargets(stage: Stage): ResetTarget[] {
  const current = stageIndex(stage);
  return RESET_TARGETS.filter((target) => stageIndex(target) < current);
}

/**
 * The session document after a "Cofnij do…", without touching any blob. What
 * each target clears is exactly what the screens after it produce:
 *
 * | target        | keeps                         | clears                          |
 * | ------------- | ----------------------------- | ------------------------------- |
 * | `draft`       | title, intro, resources       | groups, selection, prompts, pictures (and the ideas, see `blobsToClear`) |
 * | `results`     | + groups, selection           | prompts, pictures               |
 * | `expanded`    | + prompts                     | pictures                        |
 * | `visualizing` | everything                    | nothing                         |
 *
 * `expanded` lands on `expanding` when a chosen group has no prompt, so the
 * prompts screen runs the missing ones instead of showing a gap.
 */
export function applyReset(session: Session, target: ResetTarget): Session {
  switch (target) {
    case 'draft':
      return {
        ...session,
        stage: 'draft',
        groups: [],
        selectedGroupIds: [],
        expansions: {},
        images: {},
      };
    case 'results':
      return { ...session, stage: 'results', expansions: {}, images: {} };
    case 'expanded': {
      const next = { ...session, images: {} };
      return { ...next, stage: allExpansionsReady(next) ? 'expanded' : 'expanding' };
    }
    case 'visualizing':
      return { ...session, stage: 'visualizing' };
  }
}

/** Which blob families the function has to delete for a target. */
export function blobsToClear(target: ResetTarget): { ideas: boolean; images: boolean } {
  return { ideas: target === 'draft', images: target !== 'visualizing' };
}
