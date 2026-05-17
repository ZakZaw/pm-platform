import { useEffect, useMemo, useRef, useState } from 'react';
import { Avatar, Button, Card, Chip, Input, Select } from '@/components/ui';
import { usersApi } from '@/api/users.api';
import { useAuthStore } from '@/store/authStore';
import './ProfilePage.css';

const TZ_FALLBACK = ['UTC', 'Europe/London', 'Europe/Paris', 'America/New_York', 'America/Los_Angeles', 'Asia/Tokyo', 'Asia/Singapore'];
const MAX_TAGS = 20;
const MAX_TAG_LENGTH = 30;
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

function browserTimezones() {
  try {
    return Intl.supportedValuesOf('timeZone');
  } catch {
    return TZ_FALLBACK;
  }
}

export function ProfilePage() {
  const updateAuthUser = useAuthStore((s) => s.setUserFromProfile);

  const [profile, setProfile] = useState(null);
  const [fullName, setFullName] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [capacity, setCapacity] = useState(40);

  const [loadError, setLoadError] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarError, setAvatarError] = useState(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef(null);

  const timezones = useMemo(() => browserTimezones(), []);
  const tzOptions = useMemo(
    () => timezones.map((tz) => ({ value: tz, label: tz })),
    [timezones],
  );

  useEffect(() => {
    let cancelled = false;
    usersApi
      .me()
      .then((p) => {
        if (cancelled) return;
        setProfile(p);
        setFullName(p.fullName);
        setTimezone(p.timezone);
        setTags(p.skillTags ?? []);
        setCapacity(p.capacityHoursPerWeek);
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(err.response?.data?.detail ?? 'Could not load profile.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Revoke object URL when the preview changes / unmounts.
  useEffect(() => {
    if (!avatarPreview) return undefined;
    return () => URL.revokeObjectURL(avatarPreview);
  }, [avatarPreview]);

  const addTagFromInput = () => {
    const raw = tagInput.trim().toLowerCase();
    if (!raw) return;
    if (raw.length > MAX_TAG_LENGTH) {
      setSaveError(`Skill tags must be ${MAX_TAG_LENGTH} characters or fewer.`);
      return;
    }
    if (tags.includes(raw)) {
      setTagInput('');
      return;
    }
    if (tags.length >= MAX_TAGS) {
      setSaveError(`You can have at most ${MAX_TAGS} skill tags.`);
      return;
    }
    setTags([...tags, raw]);
    setTagInput('');
    setSaveError(null);
  };

  const onTagKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTagFromInput();
    } else if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
      setTags(tags.slice(0, -1));
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setSaveError(null);
    setSaveSuccess(false);
    setSubmitting(true);
    try {
      const updated = await usersApi.updateProfile({
        fullName,
        timezone,
        skillTags: tags,
        capacityHoursPerWeek: capacity,
      });
      setProfile(updated);
      updateAuthUser?.({ id: updated.id, email: updated.email, fullName: updated.fullName, avatarUrl: updated.avatarUrl });
      setSaveSuccess(true);
    } catch (err) {
      setSaveError(err.response?.data?.detail ?? 'Could not save profile.');
    } finally {
      setSubmitting(false);
    }
  };

  const onResetAvatar = async () => {
    setAvatarError(null);
    setAvatarPreview(null);
    setAvatarUploading(true);
    try {
      const updated = await usersApi.deleteAvatar();
      setProfile(updated);
      updateAuthUser?.({ id: updated.id, email: updated.email, fullName: updated.fullName, avatarUrl: updated.avatarUrl });
    } catch (err) {
      setAvatarError(err.response?.data?.detail ?? 'Could not reset avatar.');
    } finally {
      setAvatarUploading(false);
    }
  };

  const onPickAvatar = async (e) => {
    setAvatarError(null);
    const file = e.target.files?.[0] ?? null;
    e.target.value = '';
    if (!file) return;
    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      setAvatarError('Avatar must be a PNG, JPEG, or WebP image.');
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setAvatarError('Avatar file must be 2 MB or less.');
      return;
    }

    setAvatarPreview(URL.createObjectURL(file));
    setAvatarUploading(true);
    try {
      const updated = await usersApi.uploadAvatar(file);
      setProfile(updated);
      updateAuthUser?.({ id: updated.id, email: updated.email, fullName: updated.fullName, avatarUrl: updated.avatarUrl });
    } catch (err) {
      setAvatarError(err.response?.data?.detail ?? 'Could not upload avatar.');
      setAvatarPreview(null);
    } finally {
      setAvatarUploading(false);
    }
  };

  if (loadError) return <p className="profile__placeholder">{loadError}</p>;
  if (!profile) return <p className="profile__placeholder">Loading…</p>;

  const displayAvatar = avatarPreview ?? profile.avatarUrl ?? null;

  return (
    <div className="profile">
      <h1 className="profile__title">Profile</h1>

      <Card title="Identity" className="profile__card">
        <div className="profile__avatar-row">
          <Avatar src={displayAvatar} name={fullName || profile.email} size="xl" />
          <div>
            <div className="profile__avatar-actions">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarUploading}
              >
                {avatarUploading ? 'Working…' : displayAvatar ? 'Replace avatar' : 'Upload avatar'}
              </Button>
              {displayAvatar && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onResetAvatar}
                  disabled={avatarUploading}
                >
                  Reset to default
                </Button>
              )}
            </div>
            <p className="profile__hint">PNG, JPEG, or WebP. Max 2 MB.</p>
            <input
              ref={fileInputRef}
              className="profile__file-input"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={onPickAvatar}
            />
            {avatarError && <p className="profile__error">{avatarError}</p>}
          </div>
        </div>
      </Card>

      <Card title="Details" className="profile__card">
        <form className="profile__form" onSubmit={onSubmit}>
          <Input
            label="Full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            minLength={2}
            maxLength={120}
          />

          <Select
            label="Timezone"
            options={tzOptions}
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            help="Used to display dates in your local time. Stored as IANA timezone id."
          />

          <Input
            label="Capacity (hours per week)"
            type="number"
            min={0}
            max={168}
            value={capacity}
            onChange={(e) => setCapacity(Number(e.target.value))}
            help="Used by AI assignment to estimate your bandwidth."
          />

          <div>
            <label className="input-label" htmlFor="profile-skill-input">Skill tags</label>
            <div className="profile__chips">
              {tags.map((t) => (
                <Chip key={t} onRemove={() => setTags(tags.filter((x) => x !== t))}>
                  {t}
                </Chip>
              ))}
              <input
                id="profile-skill-input"
                className="profile__tag-input"
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={onTagKeyDown}
                onBlur={addTagFromInput}
                placeholder={tags.length === 0 ? 'react, postgres, kubernetes…' : ''}
                maxLength={MAX_TAG_LENGTH}
              />
            </div>
            <p className="input-help">
              Press Enter or comma to add. Up to {MAX_TAGS} tags, {MAX_TAG_LENGTH} chars each.
            </p>
          </div>

          {saveError && <p className="profile__error">{saveError}</p>}
          {saveSuccess && <p className="profile__success">Profile saved.</p>}

          <Button type="submit" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save changes'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
