import type { CSSProperties } from 'react';
import type { Lesson } from '../../../schemas/timetable';
import { CARD_TINT_RATIO, SURFACE_COLOR } from '../../../styles/tokens';
import { cx } from '../../../utils/classNames';
import { mixHex } from '../../../utils/color';
import styles from './LessonCard.module.css';

interface LessonCardProps {
  lesson: Lesson;
  /** When provided the card becomes a button (edit mode only). */
  onActivate?: () => void;
  /** Accessible label for the button form, e.g. "עריכת שיעור 3". */
  actionLabel?: string;
  className?: string;
}

/** Card colours: accent edge plus the accent mixed into the table surface. */
export function lessonCardStyle(color: string): CSSProperties {
  return {
    '--lesson-accent': color,
    backgroundColor: mixHex(color, SURFACE_COLOR, CARD_TINT_RATIO),
  } as CSSProperties;
}

/** One lesson: bold subject, teacher and "חדר: …" lines, centred, with a coloured edge. */
export function LessonCard({ lesson, onActivate, actionLabel, className }: LessonCardProps) {
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
        style={lessonCardStyle(lesson.color)}
        onClick={onActivate}
        aria-label={actionLabel ? `${actionLabel}: ${lesson.subject}` : undefined}
      >
        {content}
      </button>
    );
  }
  return (
    <div className={cx(styles.card, className)} style={lessonCardStyle(lesson.color)}>
      {content}
    </div>
  );
}
