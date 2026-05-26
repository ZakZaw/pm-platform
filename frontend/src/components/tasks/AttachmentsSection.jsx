import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, File as FileIcon, Image as ImageIcon, Paperclip, Trash2, UploadCloud } from 'lucide-react';
import { Button, useToast } from '@/components/ui';
import { attachmentsApi } from '@/api/attachments.api';
import './AttachmentsSection.css';

const MAX_BYTES = 50 * 1024 * 1024;

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(contentType) {
  return typeof contentType === 'string' && contentType.startsWith('image/');
}

export function AttachmentsSection({ taskId }) {
  const toast = useToast();
  const fileInputRef = useRef(null);
  const [items, setItems] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);

  const reload = useCallback(async () => {
    try {
      const list = await attachmentsApi.list(taskId);
      setItems(list);
    } catch (err) {
      toast.show({
        tone: 'danger',
        message: err.response?.data?.detail ?? 'Could not load attachments.',
      });
    }
  }, [taskId, toast]);

  useEffect(() => {
    if (taskId) reload();
  }, [taskId, reload]);

  const uploadOne = useCallback(async (file) => {
    if (file.size > MAX_BYTES) {
      toast.show({ tone: 'danger', message: `${file.name} is over the 50 MB limit.` });
      return;
    }
    setUploading(true);
    try {
      const created = await attachmentsApi.upload(taskId, file);
      setItems((cur) => [created, ...cur]);
      toast.show({ tone: 'success', message: `${file.name} uploaded.` });
    } catch (err) {
      toast.show({
        tone: 'danger',
        message: err.response?.data?.detail ?? `Could not upload ${file.name}.`,
      });
    } finally {
      setUploading(false);
    }
  }, [taskId, toast]);

  function onFileInput(e) {
    const files = Array.from(e.target.files ?? []);
    for (const f of files) uploadOne(f);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files ?? []);
    for (const f of files) uploadOne(f);
  }

  async function remove(attachment) {
    try {
      await attachmentsApi.remove(attachment.id);
      setItems((cur) => cur.filter((a) => a.id !== attachment.id));
      toast.show({ tone: 'success', message: 'Attachment removed.' });
    } catch (err) {
      toast.show({
        tone: 'danger',
        message: err.response?.data?.detail ?? 'Could not remove attachment.',
      });
    }
  }

  return (
    <div className="attachments-section">
      <div className="eyebrow attachments-section__head">
        <Paperclip size={11} aria-hidden="true" /> Attachments
        {items.length > 0 && <span className="muted">{items.length}</span>}
      </div>

      <div
        className={`attachments-section__drop ${dragging ? 'is-active' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <UploadCloud size={18} aria-hidden="true" />
        <span>Drop files here or</span>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? 'Uploading…' : 'Browse'}
        </Button>
        <span className="muted attachments-section__hint">50 MB max</span>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          hidden
          onChange={onFileInput}
        />
      </div>

      {items.length > 0 && (
        <ul className="attachments-section__list">
          {items.map((a) => (
            <li key={a.id} className="attachments-section__row">
              <div className="attachments-section__thumb" aria-hidden="true">
                {isImage(a.contentType) ? (
                  <ImageIcon size={14} />
                ) : (
                  <FileIcon size={14} />
                )}
              </div>
              <div className="col fill" style={{ minWidth: 0 }}>
                <a
                  href={a.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="attachments-section__name truncate"
                  title={a.fileName}
                >
                  {a.fileName}
                </a>
                <span className="muted attachments-section__meta">
                  {formatSize(a.fileSize)}
                  {a.uploadedByName ? ` · ${a.uploadedByName}` : ''}
                </span>
              </div>
              <a
                href={a.url}
                download={a.fileName}
                target="_blank"
                rel="noreferrer noopener"
                className="btn btn-ghost btn-icon-sm"
                title="Download"
                aria-label="Download"
              >
                <Download size={12} aria-hidden="true" />
              </a>
              <button
                type="button"
                className="btn btn-ghost btn-icon-sm"
                onClick={() => remove(a)}
                title="Remove"
                aria-label="Remove"
              >
                <Trash2 size={12} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
