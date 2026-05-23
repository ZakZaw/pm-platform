import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Filter, Plus, RefreshCw } from 'lucide-react';
import { Button, Skeleton, useToast } from '@/components/ui';
import { projectsApi } from '@/api/projects.api';
import { salesApi } from '@/api/sales.api';
import { DealDetailDrawer } from '@/components/deals/DealDetailDrawer';
import { CreateDealModal } from '@/components/deals/CreateDealModal';
import { LostReasonModal } from '@/components/deals/LostReasonModal';
import './PipelinePage.css';

function fmtCurrency(value, currency) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || 'USD',
      maximumFractionDigits: 0,
    }).format(value ?? 0);
  } catch {
    return `${currency} ${value}`;
  }
}

function fmtMixed(stage) {
  const currencies = new Set(stage.deals.map((d) => d.currency));
  if (currencies.size <= 1) {
    return fmtCurrency(stage.totalValue, [...currencies][0] ?? 'USD');
  }
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 })
    .format(stage.totalValue ?? 0);
}

function stageBarColor(stage) {
  if (stage.isTerminalWon) return 'var(--success)';
  if (stage.isTerminalLost) return 'var(--danger)';
  return 'var(--accent)';
}

export function PipelinePage() {
  const { slug: orgSlug, projectSlug } = useParams();
  const toast = useToast();

  const [project, setProject] = useState(null);
  const [pipeline, setPipeline] = useState(null);
  const [optimistic, setOptimistic] = useState(null);
  const [activeDeal, setActiveDeal] = useState(null);
  const [openDealId, setOpenDealId] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [pendingLost, setPendingLost] = useState(null);
  const [error, setError] = useState(null);

  const refresh = useCallback(async (projectId) => {
    const data = await salesApi.getPipeline(projectId);
    setPipeline(data);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await projectsApi.getBySlug(orgSlug, projectSlug);
        if (cancelled) return;
        setProject(p);
        await refresh(p.id);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.detail ?? 'Could not load pipeline.');
      }
    })();
    return () => { cancelled = true; };
  }, [orgSlug, projectSlug, refresh]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const displayed = optimistic ?? pipeline;

  function findDeal(dealId) {
    if (!displayed) return null;
    for (const stage of displayed.stages) {
      const deal = stage.deals.find((d) => d.id === dealId);
      if (deal) return { deal, stage };
    }
    return null;
  }

  function handleDragStart(e) {
    const dealId = String(e.active.id).split(':')[1];
    const hit = findDeal(dealId);
    setActiveDeal(hit?.deal ?? null);
  }

  async function handleDragEnd(e) {
    setActiveDeal(null);
    const { active, over } = e;
    if (!over) return;
    const dealId = String(active.id).split(':')[1];
    const targetStageId = String(over.id).startsWith('stage:')
      ? String(over.id).slice(6)
      : null;
    if (!targetStageId) return;

    const hit = findDeal(dealId);
    if (!hit || hit.stage.id === targetStageId) return;

    const targetStage = displayed.stages.find((s) => s.id === targetStageId);
    if (!targetStage) return;

    if (targetStage.isTerminalLost) {
      setPendingLost({ deal: hit.deal, toStage: targetStage });
      return;
    }

    await applyStageChange(hit.deal, targetStage, null);
  }

  async function applyStageChange(deal, toStage, reason) {
    const next = {
      ...displayed,
      stages: displayed.stages.map((s) => {
        if (s.id === deal.stageId) {
          const newDeals = s.deals.filter((d) => d.id !== deal.id);
          return {
            ...s,
            deals: newDeals,
            dealCount: newDeals.length,
            totalValue: newDeals.reduce((acc, d) => acc + Number(d.value || 0), 0),
          };
        }
        if (s.id === toStage.id) {
          const moved = {
            ...deal,
            stageId: toStage.id,
            stageName: toStage.name,
            probability: toStage.defaultProbability,
          };
          const newDeals = [moved, ...s.deals];
          return {
            ...s,
            deals: newDeals,
            dealCount: newDeals.length,
            totalValue: newDeals.reduce((acc, d) => acc + Number(d.value || 0), 0),
          };
        }
        return s;
      }),
    };
    setOptimistic(next);

    try {
      await salesApi.changeDealStage(deal.id, { toStageId: toStage.id, reason });
      await refresh(project.id);
      setOptimistic(null);
    } catch (err) {
      setOptimistic(null);
      toast.show({
        tone: 'danger',
        title: 'Could not move deal',
        message: err.response?.data?.detail ?? 'Server rejected the change.',
      });
    }
  }

  if (error) {
    return (
      <div className="main-inner"><p className="muted">{error}</p></div>
    );
  }

  if (!project || !displayed) {
    return (
      <div className="main-inner pipeline-page">
        <div className="page-head">
          <div className="page-title-row">
            <h1 className="page-title">Pipeline</h1>
          </div>
        </div>
        <div className="pipeline">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="pipe-col">
              <Skeleton height={20} width="60%" />
              <div style={{ marginTop: 12 }}>
                <Skeleton height={64} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const totalOpenValue = displayed.stages
    .filter((s) => !s.isTerminalWon && !s.isTerminalLost)
    .reduce((acc, s) => acc + Number(s.totalValue || 0), 0);

  const totalOpenCount = displayed.stages
    .filter((s) => !s.isTerminalWon && !s.isTerminalLost)
    .reduce((acc, s) => acc + s.dealCount, 0);

  return (
    <div className="main-inner pipeline-page">
      <div className="page-head">
        <div className="page-title-row">
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Sales · Pipeline</div>
            <h1 className="page-title">Pipeline</h1>
            <div className="page-subtitle">
              {totalOpenCount} open deals · {fmtCurrency(totalOpenValue, 'USD')} in flight
            </div>
          </div>
          <div className="row gap-3">
            <Button variant="ghost" size="sm" disabled>
              <Filter size={13} aria-hidden="true" /> Filter
            </Button>
            <Button variant="ghost" size="sm" onClick={() => refresh(project.id).catch(() => {})}>
              <RefreshCw size={13} aria-hidden="true" /> Refresh
            </Button>
            <Button variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
              <Plus size={13} aria-hidden="true" /> New deal
            </Button>
          </div>
        </div>
      </div>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="pipeline">
          {displayed.stages.map((stage) => (
            <PipelineColumn key={stage.id} stage={stage} onOpenDeal={setOpenDealId} />
          ))}
        </div>
        <DragOverlay dropAnimation={null} zIndex={2000}>
          {activeDeal ? <DealCardView deal={activeDeal} isOverlay /> : null}
        </DragOverlay>
      </DndContext>

      {createOpen && (
        <CreateDealModal
          projectId={project.id}
          stages={displayed.stages}
          onClose={() => setCreateOpen(false)}
          onCreated={async () => {
            setCreateOpen(false);
            await refresh(project.id).catch(() => {});
          }}
        />
      )}

      {openDealId && (
        <DealDetailDrawer
          dealId={openDealId}
          stages={displayed.stages}
          onClose={() => setOpenDealId(null)}
          onChanged={() => refresh(project.id).catch(() => {})}
        />
      )}

      {pendingLost && (
        <LostReasonModal
          deal={pendingLost.deal}
          toStage={pendingLost.toStage}
          onCancel={() => setPendingLost(null)}
          onConfirm={async (reason) => {
            const { deal, toStage } = pendingLost;
            setPendingLost(null);
            await applyStageChange(deal, toStage, reason);
          }}
        />
      )}
    </div>
  );
}

function PipelineColumn({ stage, onOpenDeal }) {
  const { isOver, setNodeRef } = useDroppable({ id: `stage:${stage.id}` });
  return (
    <div
      ref={setNodeRef}
      className={['pipe-col', isOver ? 'is-over' : ''].filter(Boolean).join(' ')}
    >
      <div className="pipe-col-head">
        <div className="pipe-stage-bar" style={{ background: stageBarColor(stage) }} />
        <div className="pipe-col-title">
          <span className="pipe-col-name">{stage.name}</span>
          <span className="pipe-col-amount">{fmtMixed(stage)}</span>
        </div>
        <div className="pipe-col-sub">
          <span>{stage.dealCount} {stage.dealCount === 1 ? 'deal' : 'deals'}</span>
          {stage.defaultProbability != null && (
            <span className="mono">{stage.defaultProbability}%</span>
          )}
        </div>
      </div>
      <div className="pipe-col-body">
        {stage.deals.map((deal) => (
          <DealCardView key={deal.id} deal={deal} onOpen={onOpenDeal} />
        ))}
        {stage.deals.length === 0 && (
          <div className="pipe-col-empty">No deals</div>
        )}
      </div>
    </div>
  );
}

function DealCardView({ deal, onOpen, isOverlay = false }) {
  const draggable = useDraggable({
    id: `deal:${deal.id}`,
    disabled: isOverlay,
  });
  const { attributes, listeners, setNodeRef, transform, isDragging } = draggable;
  const style = isOverlay
    ? { boxShadow: 'var(--shadow-lg)' }
    : {
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0 : 1,
        pointerEvents: isDragging ? 'none' : undefined,
      };

  function handleClick() {
    if (isDragging) return;
    onOpen?.(deal.id);
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="deal-card"
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen?.(deal.id);
        }
      }}
    >
      <div className="deal-name truncate">{deal.name}</div>
      <div className="deal-company truncate">{deal.accountName}</div>
      <div className="deal-meta">
        <span className="deal-amt">{fmtCurrency(deal.value, deal.currency)}</span>
        <span className="mono" style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
          {deal.probability}%
        </span>
      </div>
    </div>
  );
}
