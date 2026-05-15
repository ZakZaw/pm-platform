import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { AIChip, Badge, Button, Card, useToast } from '@/components/ui';
import { storiesApi } from '@/api/stories.api';
import { tasksApi } from '@/api/tasks.api';
import { aiApi } from '@/api/ai.api';
import { TaskCard } from '@/components/tasks/TaskCard';
import { TaskForm } from '@/components/tasks/TaskForm';
import { TaskDetail } from '@/components/tasks/TaskDetail';
import './StoryDetailPage.css';

export function StoryDetailPage() {
  const { slug: orgSlug, projectSlug, storyId } = useParams();
  const toast = useToast();

  const [story, setStory] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [creating, setCreating] = useState(false);
  const [openTask, setOpenTask] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState(null);
  const [estimate, setEstimate] = useState(null);
  const [estimating, setEstimating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [s, ts] = await Promise.all([
          storiesApi.get(storyId),
          tasksApi.listForStory(storyId),
        ]);
        if (cancelled) return;
        setStory(s);
        setTasks(ts);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.detail ?? 'Could not load story.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storyId, refreshKey]);

  async function runEstimate() {
    setEstimating(true);
    try {
      const e = await aiApi.estimateStory(storyId);
      setEstimate(e);
    } catch (err) {
      toast.show({
        tone: 'danger',
        message: err.response?.data?.detail ?? 'Could not estimate.',
      });
    } finally {
      setEstimating(false);
    }
  }

  async function applyEstimate() {
    if (!estimate) return;
    try {
      const updated = await storiesApi.update(storyId, { storyPoints: estimate.points });
      setStory(updated);
      setEstimate(null);
      toast.show({ tone: 'success', message: `Saved ${estimate.points} pts.` });
    } catch (err) {
      toast.show({
        tone: 'danger',
        message: err.response?.data?.detail ?? 'Could not save estimate.',
      });
    }
  }

  if (error) return <p className="story-page__placeholder">{error}</p>;
  if (!story) return <p className="story-page__placeholder">Loading…</p>;

  return (
    <div className="story-page">
      <div className="story-page__crumbs">
        <Link to={`/${orgSlug}/projects/${projectSlug}`}>Project</Link>
        <span>·</span>
        <Link to={`/${orgSlug}/projects/${projectSlug}/epics`}>Epics</Link>
      </div>

      <header className="story-page__header">
        <h1 className="story-page__title">{story.title}</h1>
        <div className="story-page__meta">
          <Badge tone="neutral">{story.status}</Badge>
          <Badge tone="info">{story.priority}</Badge>
          {story.storyPoints != null && (
            <Badge tone="purple">{story.storyPoints} pts</Badge>
          )}
          <Button
            variant="ai"
            size="sm"
            onClick={runEstimate}
            disabled={estimating}
            title="Estimate story points with AI"
          >
            <Sparkles size={14} aria-hidden="true" />
            {estimating ? 'Estimating…' : 'Estimate with AI'}
          </Button>
        </div>
      </header>

      {estimate && (
        <Card variant="ai" className="story-page__estimate">
          <div className="story-page__estimate-head">
            <AIChip label="Suggestion" />
            <Badge tone="purple">{estimate.points} pts</Badge>
            <ConfidenceBar value={estimate.confidence} />
          </div>
          <p className="story-page__estimate-text">{estimate.reasoning}</p>
          {estimate.confidence < 0.5 && (
            <p className="story-page__estimate-warn">
              Confidence is low — consider a quick human sanity check before committing.
            </p>
          )}
          <div className="story-page__estimate-actions">
            <Button variant="ghost" size="sm" onClick={() => setEstimate(null)}>
              Dismiss
            </Button>
            <Button variant="ai" size="sm" onClick={applyEstimate}>
              Apply {estimate.points} pts
            </Button>
          </div>
        </Card>
      )}

      {story.description && (
        <Card className="story-page__desc">
          <p>{story.description}</p>
        </Card>
      )}

      {story.acceptanceCriteria?.length > 0 && (
        <Card title="Acceptance criteria" className="story-page__ac">
          <ul>
            {story.acceptanceCriteria.map((ac, i) => (
              <li key={i}>{ac}</li>
            ))}
          </ul>
        </Card>
      )}

      <section className="story-page__tasks">
        <header className="story-page__tasks-head">
          <h2 className="story-page__section-title">Tasks</h2>
          <Button size="sm" onClick={() => setCreating(true)}>New task</Button>
        </header>

        {creating && (
          <Card className="story-page__form">
            <TaskForm
              onSubmit={async (body) => {
                await tasksApi.create(story.id, body);
                toast.show({ tone: 'success', message: 'Task created.' });
                setCreating(false);
                setRefreshKey((k) => k + 1);
              }}
              onCancel={() => setCreating(false)}
              submitLabel="Create task"
            />
          </Card>
        )}

        {tasks.length === 0 ? (
          <p className="story-page__placeholder">No tasks yet.</p>
        ) : (
          <div className="story-page__task-grid">
            <div className="story-page__task-list">
              {tasks.map((t) => (
                <TaskCard key={t.id} task={t} onOpen={setOpenTask} />
              ))}
            </div>
            {openTask && (
              <TaskDetail
                task={openTask}
                projectId={story.projectId}
                onClose={() => setOpenTask(null)}
                onUpdated={(updated) => {
                  setTasks((cur) => cur.map((t) => (t.id === updated.id ? updated : t)));
                  setOpenTask(updated);
                }}
                onDeleted={(deleted) => {
                  setTasks((cur) => cur.filter((t) => t.id !== deleted.id));
                  setOpenTask(null);
                }}
              />
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function ConfidenceBar({ value }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  const tone = value >= 0.7 ? 'high' : value >= 0.5 ? 'mid' : 'low';
  return (
    <span
      className={`story-page__confidence is-${tone}`}
      title={`Confidence ${pct}%`}
      aria-label={`Confidence ${pct} percent`}
    >
      <span className="story-page__confidence-bar">
        <span className="story-page__confidence-fill" style={{ width: `${pct}%` }} />
      </span>
      {pct}%
    </span>
  );
}
