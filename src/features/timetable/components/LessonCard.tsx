import type { Lesson } from '../../../schemas/timetable';
import { lessonCardStyle } from '../../../theme/lessonCardColors';
import { useResolvedTheme } from '../../../theme/useResolvedTheme';
import { cx } from '../../../utils/classNames';
import styles from './LessonCard.module.css';

interface LessonCardProps {
  lesson: Lesson;
  /** When provided the card becomes a button (edit mode only). */
  onActivate?: () => void;
  /** Accessible label for the button form, e.g. "עריכת שיעור 3". */
  actionLabel?: string;
  className?: string;
}

/** One lesson: bold subject, teacher and "חדר: …" lines, centred, with a coloured edge. */
export function LessonCard({ lesson, onActivate, actionLabel, className }: LessonCardProps) {
  const style = lessonCardStyle(lesson.color, useResolvedTheme());
  const content = (
    <>
      <span className={styles.subject}>{lesson.subject}</span>
      {lesson.teacher && <span className={styles.line}>{lesson.teacher}</span>}
      {lesson.room && <span className={styles.line}>חדר: {lesson.room}</span>}
    </>
  );

  if (onActivate) {
    return (
      <button
        type="button"
        className={cx(styles.card, styles.interactive, className)}
        style={style}
        onClick={onActivate}
        aria-label={actionLabel ? `${actionLabel}: ${lesson.subject}` : undefined}
      >
        {content}
      </button>
    );
  }
  return (
    <div className={cx(styles.card, className)} style={style}>
      {content}
    </div>
  );
}
