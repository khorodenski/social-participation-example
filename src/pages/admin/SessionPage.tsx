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
import {
  initialSelection,
  orderSelection,
  requiredSelectionCount,
  toggleSelection,
} from '../../state/results';
import { useSession } from '../../state/useSession';
import type { Group, Session, Stage } from '../../state/session';

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
  selectedIds: string[];
  onToggleGroup: (id: string) => void;
}

function StageView({ session, onGrouped, selectedIds, onToggleGroup }: StageViewProps) {
  switch (session.stage) {
    case 'draft':
      return <SetupStage session={session} />;
    case 'voting':
      return <VotingStage session={session} />;
    case 'grouping':
      return <GroupingStage session={session} onGrouped={onGrouped} />;
    case 'results':
      return (
        <ResultsStage groups={session.groups} selectedIds={selectedIds} onToggle={onToggleGroup} />
      );
    case 'expanding':
    case 'expanded':
      return <ExpansionStage />;
    case 'visualizing':
      return <VisualizeStage />;
    case 'gallery':
      return <GalleryStage />;
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
