import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import ControlBar from '../../components/ControlBar';
import Spinner from '../../components/Spinner';
import ExpansionStage from '../../stages/ExpansionStage';
import GalleryStage from '../../stages/GalleryStage';
import GroupingStage from '../../stages/GroupingStage';
import ResultsStage from '../../stages/ResultsStage';
import SetupStage from '../../stages/SetupStage';
import VisualizeStage from '../../stages/VisualizeStage';
import VotingStage from '../../stages/VotingStage';
import { pl } from '../../i18n/pl';
import { allExpansionsReady } from '../../state/expansion';
import { allImagesReady } from '../../state/visualize';
import {
  initialSelection,
  orderSelection,
  requiredSelectionCount,
  toggleSelection,
} from '../../state/results';
import { useSession } from '../../state/useSession';
import type {
  Expansion,
  GeneratedImage,
  Group,
  Session,
  SessionPatch,
  Stage,
} from '../../state/session';

/**
 * The projected screen. Renders whichever stage the session is persisted in
 * (F-1.2), so a reload mid-lecture resumes exactly where it left off.
 */

const STAGE_LABELS: Record<Stage, string> = {
  draft: pl.stages.setup,
  voting: pl.stages.voting,
  grouping: pl.stages.grouping,
  results: pl.stages.results,
  expanding: pl.stages.expanding,
  expanded: pl.stages.expanded,
  visualizing: pl.stages.visualizing,
  gallery: pl.stages.gallery,
};

/** Stable empty arrays, so the selection memo does not rerun on every render. */
const NO_GROUPS: Group[] = [];
const NO_IDS: string[] = [];

interface StageViewProps {
  session: Session;
  onGrouped: (groups: Group[]) => Promise<void>;
  onExpanded: (expansions: Record<string, Expansion>) => Promise<void>;
  onRendered: (images: Record<string, GeneratedImage>) => Promise<void>;
  onSaveSetup: (patch: SessionPatch) => Promise<boolean>;
  onSetupDirty: (dirty: boolean) => void;
  busy: boolean;
  selectedIds: string[];
  onToggleGroup: (id: string) => void;
}

function StageView({
  session,
  onGrouped,
  onExpanded,
  onRendered,
  onSaveSetup,
  onSetupDirty,
  busy,
  selectedIds,
  onToggleGroup,
}: StageViewProps) {
  switch (session.stage) {
    case 'draft':
      return (
        <SetupStage
          session={session}
          onSave={onSaveSetup}
          onDirtyChange={onSetupDirty}
          busy={busy}
        />
      );
    case 'voting':
      return <VotingStage session={session} />;
    case 'grouping':
      return <GroupingStage session={session} onGrouped={onGrouped} />;
    case 'results':
      return (
        <ResultsStage
          sessionId={session.id}
          groups={session.groups}
          selectedIds={selectedIds}
          onToggle={onToggleGroup}
        />
      );
    case 'expanding':
    case 'expanded':
      return <ExpansionStage session={session} onExpanded={onExpanded} />;
    case 'visualizing':
      return <VisualizeStage session={session} onRendered={onRendered} />;
    case 'gallery':
      return <GalleryStage session={session} />;
  }
}

export default function SessionPage() {
  const { id } = useParams<{ id: string }>();
  const { session, loading, error, busy, update, reset } = useSession(id);

  const groups = session?.groups ?? NO_GROUPS;
  const savedSelection = session?.selectedGroupIds ?? NO_IDS;

  // F-6.3 — null means "nothing chosen by hand yet", so the podium's own
  // pre-selection stands. Kept here rather than in ResultsStage because "Dalej"
  // is a control-bar action and needs to read it.
  const [picked, setPicked] = useState<string[] | null>(null);

  // F-1.1/F-2.1 — the setup screen edits a draft, and "Rozpocznij głosowanie"
  // is in the control bar rather than on that screen. Without this, typing a
  // title and pressing start would begin voting on the old one, and the only
  // way back to `draft` is a reset.
  const [setupDirty, setSetupDirty] = useState(false);

  // Re-grouping replaces every group, and an id from the previous run means
  // nothing against the new ones. `initialSelection` filters stale ids too, but
  // dropping the hand-made choice here is what makes "Grupuj ponownie" feel
  // like a fresh start rather than a half-remembered one.
  const signature = groups.map((group) => `${group.id}:${group.ideaIds.length}`).join('|');
  useEffect(() => {
    setPicked(null);
  }, [signature]);

  const selectedIds = useMemo(
    () => picked ?? initialSelection(groups, savedSelection),
    [picked, groups, savedSelection],
  );

  const onToggleGroup = useCallback(
    (groupId: string) => setPicked((current) => toggleSelection(current ?? selectedIds, groupId)),
    [selectedIds],
  );

  // F-5.4 — grouping is persisted in one write with the stage change, so a
  // reload during the hand-off never lands on results with no groups.
  const onGrouped = useCallback(
    async (newGroups: Group[]) => {
      await update({ groups: newGroups, selectedGroupIds: [], stage: 'results' });
    },
    [update],
  );

  /**
   * F-7.2/F-7.5 — merges a batch of prompts into what is already stored and
   * moves to `expanded` once every chosen group has one.
   *
   * Merging rather than replacing is what lets a retry write one prompt without
   * dropping the two that already succeeded: a PATCH replaces `expansions`
   * wholesale.
   */
  const onExpanded = useCallback(
    async (arrived: Record<string, Expansion>) => {
      if (!session) return;

      const expansions = { ...session.expansions, ...arrived };

      // Only ever advance from the expansion screens. A "Rozwiń ponownie" that
      // lands after the lecturer has already moved on would otherwise drag the
      // projector back from `visualizing` to `expanded`.
      const onExpansionScreen = session.stage === 'expanding' || session.stage === 'expanded';
      const complete = onExpansionScreen && allExpansionsReady({ ...session, expansions });

      await update(complete ? { expansions, stage: 'expanded' } : { expansions });
    },
    [session, update],
  );

  /**
   * F-8.4/F-9.1 — merges a batch of pictures into what is already stored and
   * moves to `gallery` once every chosen group has one.
   *
   * Only ever advances from `visualizing`, so a slow "Generuj ponownie" landing
   * after the lecturer has moved on cannot drag the projector back a screen.
   */
  const onRendered = useCallback(
    async (arrived: Record<string, GeneratedImage>) => {
      if (!session) return;

      const images = { ...session.images, ...arrived };
      const complete = session.stage === 'visualizing' && allImagesReady({ ...session, images });

      await update(complete ? { images, stage: 'gallery' } : { images });
    },
    [session, update],
  );

  // Every hook above this line, unconditionally: the early returns below would
  // otherwise change the hook order between renders.
  if (loading && !session) {
    return (
      <main className="page page--stage">
        <Spinner />
      </main>
    );
  }

  if (!session) {
    return (
      <main className="page page--stage">
        <h1 className="stage-title">{error ?? pl.errors.notFound}</h1>
      </main>
    );
  }

  // The stage machine from the plan. Later milestones add the transitions out
  // of expanded and visualizing; the ones here are M1's and M3's.
  const actions = [];

  if (session.stage === 'draft') {
    actions.push({
      key: 'start',
      label: pl.voting.startVoting,
      primary: true,
      disabled: setupDirty,
      onSelect: () => void update({ stage: 'voting' }),
    });
  }

  if (session.stage === 'voting') {
    actions.push({
      key: 'close',
      label: pl.voting.closeVoting,
      primary: true,
      // F-4.5 — closing is confirmed; GroupingStage takes it from there.
      confirm: true,
      onSelect: () => void update({ stage: 'grouping' }),
    });
  }

  if (session.stage === 'results') {
    const required = requiredSelectionCount(groups);

    // F-6.4 — exactly the required number, or the button stays dead. The
    // selection is written in podium order alongside the stage change, so
    // expansion never opens on a stage with nothing chosen.
    actions.push({
      key: 'next',
      label: pl.common.next,
      primary: true,
      disabled: required === 0 || selectedIds.length !== required,
      onSelect: () =>
        void update({
          selectedGroupIds: orderSelection(groups, selectedIds),
          stage: 'expanding',
        }),
    });

    // F-5.4 — rehearsal control: re-running overwrites the previous groups.
    actions.push({
      key: 'regroup',
      label: pl.results.groupAgain,
      confirm: true,
      onSelect: () => void update({ stage: 'grouping' }),
    });
  }

  // F-7.5 — "Wizualizuj" appears only once every chosen group has a prompt,
  // which is exactly when the stage becomes `expanded`.
  if (session.stage === 'expanded' && allExpansionsReady(session)) {
    actions.push({
      key: 'visualize',
      label: pl.common.visualize,
      primary: true,
      onSelect: () => void update({ stage: 'visualizing' }),
    });
  }

  // F-9.1 — the gallery opens only once all three pictures exist. It is not
  // offered again once open: a permanently disabled button is clutter on the
  // last screen the room looks at.
  if (session.stage === 'visualizing' && allImagesReady(session)) {
    actions.push({
      key: 'gallery',
      label: pl.common.showGallery,
      primary: true,
      onSelect: () => void update({ stage: 'gallery' }),
    });
  }

  if (session.stage !== 'draft') {
    actions.push({
      key: 'reset',
      label: pl.admin.reset,
      danger: true,
      confirm: true,
      onSelect: () => void reset(),
    });
  }

  return (
    <main className="page page--session">
      <StageView
        session={session}
        onGrouped={onGrouped}
        onExpanded={onExpanded}
        onRendered={onRendered}
        onSaveSetup={update}
        onSetupDirty={setSetupDirty}
        busy={busy}
        selectedIds={selectedIds}
        onToggleGroup={onToggleGroup}
      />
      <ControlBar
        stageLabel={STAGE_LABELS[session.stage]}
        actions={actions}
        busy={busy}
        error={error}
      />
    </main>
  );
}
