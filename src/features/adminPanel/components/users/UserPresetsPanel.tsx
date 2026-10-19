import { useEffect, useState } from 'react';
import { Button } from '../../../../components/ui/Button';
import { toast } from '../../../../store/uiStore';
import { listUserPresetIds, setUserPresets } from '../../api/presetsApi';
import { errorMessage } from '../../domain/adminErrors';
import { usePresets } from '../../state/resources';
import { Panel } from '../shared/Page';
import { ErrorView, LoadingView } from '../shared/StatusViews';
import styles from './users.module.css';

/** Which subjects the student may place in their own timetable. */
export function UserPresetsPanel({ profileId }: { profileId: string }) {
  const { data: presets, status, error, load } = usePresets();
  const [assigned, setAssigned] = useState<Set<string> | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void load();
    let active = true;
    listUserPresetIds(profileId)
      .then((ids) => active && setAssigned(new Set(ids)))
      .catch((failure: unknown) => active && setLoadError(errorMessage(failure)));
    return () => {
      active = false;
    };
  }, [profileId, load]);

  if (status === 'error' && error) return <ErrorView message={error} onRetry={() => void load(true)} />;
  if (loadError) return <ErrorView message={loadError} />;
  if (!presets || !assigned) return <LoadingView />;

  const visible = presets.filter((p) => !p.archived_at || assigned.has(p.id));

  /** Flips one preset. */
  const toggle = (id: string) =>
    setAssigned((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  /** Saves the selection. */
  const save = async () => {
    setBusy(true);
    try {
      await setUserPresets(profileId, [...assigned]);
      toast('רשימת המקצועות נשמרה. התלמיד/ה יראו אותה בפתיחה הבאה של האפליקציה.', { tone: 'success' });
    } catch (failure) {
      toast(errorMessage(failure), { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title="מקצועות זמינים" id="user-presets">
      <p className={styles.note}>
        התלמיד/ה יכולים לשבץ במערכת האישית רק מקצועות שמסומנים כאן. מורה, חדר וצבע נקבעים במקצוע עצמו ואינם ניתנים לשינוי על ידם.
        הסרת מקצוע אינה מוחקת שיעורים שכבר שובצו.
      </p>
      <ul className={styles.checkList}>
        {visible.map((preset) => (
          <li key={preset.id}>
            <label className={styles.check}>
              <input type="checkbox" checked={assigned.has(preset.id)} onChange={() => toggle(preset.id)} />
              <span className={styles.swatch} style={{ backgroundColor: preset.color }} aria-hidden="true" />
              <span className={styles.checkText}>
                <span className={styles.checkName}>
                  {preset.name}
                  {preset.archived_at && ' (בארכיון)'}
                </span>
                <span className={styles.checkMeta}>{[preset.teacher, preset.room && `חדר ${preset.room}`].filter(Boolean).join(' · ') || '—'}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <div className={styles.actions}>
        <Button variant="primary" disabled={busy} onClick={() => void save()}>
          {busy ? 'שומר…' : 'שמירה'}
        </Button>
        <Button onClick={() => setAssigned(new Set(visible.filter((p) => !p.archived_at).map((p) => p.id)))}>סימון הכול</Button>
        <Button onClick={() => setAssigned(new Set())}>ניקוי</Button>
      </div>
    </Panel>
  );
}
