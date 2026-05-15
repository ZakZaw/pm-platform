import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Badge, Button, Card, useToast } from '@/components/ui';
import { storiesApi } from '@/api/stories.api';
import { tasksApi } from '@/api/tasks.api';
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
        </div>
      </header>

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
