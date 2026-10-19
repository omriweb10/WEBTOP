import { useMemo, useState } from 'react';
import { navigate } from '../../../app/router';
import { ScreenFrame } from '../../../components/layout/ScreenFrame';
import { Icon } from '../../../components/ui/Icon';
import { IconButton } from '../../../components/ui/IconButton';
import { ItemRow } from '../../../components/ui/ItemRow';
import { EmptyState, SectionCard } from '../../../components/ui/SectionCard';
import { useNoticesStore, useProfileStore, useSettingsStore, useTimetableStore } from '../../../store/dataStores';
import { formatDmy, formatIsoDmy, hebrewWeekdayName } from '../../../utils/dates';
import { formatHebrewDate } from '../../../utils/hebrewDate';
import { noticesInCategory } from '../../notices/domain/noticeOps';
import { dayIdForDate } from '../../timetable/domain/days';
import { formatPeriodLabel } from '../../timetable/domain/periods';
import { getDayRows } from '../../timetable/domain/timetableOps';
import { useTimetableViewStore } from '../../timetable/timetableViewStore';
import { greetingLine } from '../domain/greeting';
import { SHORTCUTS } from '../shortcuts';
import { GreetingIllustration } from './GreetingIllustration';
import { ShortcutsEditor } from './ShortcutsEditor';
import styles from './HomeScreen.module.css';

/** "ריכוז מידע": date line, greeting, notices summary, shortcuts, changes and today's lessons. */
export function HomeScreen() {
  const now = useMemo(() => new Date(), []);
  const profile = useProfileStore((state) => state.value);
  const notices = useNoticesStore((state) => state.value);
  const shortcuts = useSettingsStore((state) => state.value.shortcuts);
  const timetable = useTimetableStore((state) => state.value);
  const [editingShortcuts, setEditingShortcuts] = useState(false);

  const today = dayIdForDate(now);
  const lessons = today ? getDayRows(timetable, today).filter((row) => row.lesson) : [];
  const changes = noticesInCategory(notices, 'change');
  const general = noticesInCategory(notices, 'general');

  /** Opens the timetable on today's day. */
  const openToday = () => {
    if (today) useTimetableViewStore.getState().selectDay(today);
    navigate({ name: 'schedule', tab: 'timetable' });
  };

  return (
    <ScreenFrame
      title="ריכוז מידע"
      actions={
        <>
          <IconButton
            icon="notifications"
            label={`הודעות (${notices.length})`}
            badge={notices.length}
            onClick={() => navigate({ name: 'schedule', tab: 'changes' })}
          />
          <IconButton icon="mail" label="תיבת הודעות" onClick={() => navigate({ name: 'placeholder', id: 'messages' })} />
        </>
      }
    >
      <p className={styles.dateBar}>
        {hebrewWeekdayName(now)} | {formatDmy(now)} | {formatHebrewDate(now)}
      </p>
      <div className={styles.scroll}>
        <section className={styles.greeting} aria-label="ברכה">
          <p className={styles.greetingText}>{greetingLine(now.getHours(), profile.studentName)}</p>
          <div className={styles.illustration}>
            <GreetingIllustration />
          </div>
        </section>

        <SectionCard id="home-notices" title={`הודעות כלליות • ${general.length}`}>
          <button type="button" className={styles.link} onClick={() => navigate({ name: 'schedule', tab: 'changes' })}>
            לצפייה בהודעות &gt;
          </button>
        </SectionCard>

        <SectionCard
          id="home-shortcuts"
          title="קיצורי דרך"
          action={
            <button type="button" className={styles.editLink} onClick={() => setEditingShortcuts(true)}>
              עריכה
            </button>
          }
        >
          {shortcuts.length === 0 ? (
            <EmptyState text="לא נבחרו קיצורי דרך." />
          ) : (
            <div className={styles.tiles}>
              {shortcuts.map((id) => {
                const shortcut = SHORTCUTS[id];
                return (
                  <button key={id} type="button" className={styles.tile} onClick={() => navigate(shortcut.route)}>
                    <span className={styles.tileIcon} style={{ color: shortcut.tint }}>
                      <Icon name={shortcut.icon} size={40} />
                    </span>
                    <span className={styles.tileLabel}>{shortcut.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </SectionCard>

        <SectionCard id="home-changes" title="שינויי מערכת">
          {changes.length === 0 ? (
            <EmptyState text="לא נמצאו נתונים." />
          ) : (
            changes.slice(0, 3).map((n) => (
              <ItemRow key={n.id} title={n.title} meta={n.date ? formatIsoDmy(n.date) : undefined} body={n.body} />
            ))
          )}
        </SectionCard>

        <SectionCard id="home-lessons" title="השיעורים של היום">
          {lessons.length === 0 ? (
            <EmptyState text={today ? 'אין שיעורים היום.' : 'אין לימודים היום.'} />
          ) : (
            <ul className={styles.lessons}>
              {lessons.map(({ period, lesson }) =>
                lesson ? (
                  <li key={period.number} className={styles.lesson}>
                    <div>
                      <button type="button" className={styles.lessonSubject} onClick={openToday}>
                        {lesson.subject}
                      </button>
                      {lesson.teacher && <div className={styles.lessonTeacher}>{lesson.teacher}</div>}
                    </div>
                    <span className={styles.lessonTime}>{formatPeriodLabel(period)}</span>
                  </li>
                ) : null,
              )}
            </ul>
          )}
        </SectionCard>
      </div>
      {editingShortcuts && <ShortcutsEditor onClose={() => setEditingShortcuts(false)} />}
    </ScreenFrame>
  );
}
