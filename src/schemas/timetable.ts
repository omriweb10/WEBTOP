/**
 * Timetable schema: a fixed list of periods and, for each school day (Sunday–Thursday),
 * one cell per period. A cell is either a lesson or `null` — an empty period is a
 * first-class value, never a missing row.
 */
import { z } from 'zod';
import { HexColorSchema, IdSchema, TimeSchema, textSchema } from './primitives';

export const DAY_IDS = ['sun', 'mon', 'tue', 'wed', 'thu'] as const;
export const DayIdSchema = z.enum(DAY_IDS);
export type DayId = z.infer<typeof DayIdSchema>;

export const MAX_PERIODS = 13;

export const LessonSchema = z.object({
  id: IdSchema,
  /** Preset the lesson was created from; null for fully custom lessons. */
  presetId: IdSchema.nullable(),
  subject: textSchema(80, 1),
  teacher: textSchema(80),
  room: textSchema(80),
  color: HexColorSchema,
});
export type Lesson = z.infer<typeof LessonSchema>;

export const PeriodSchema = z.object({
  number: z.number().int().min(1).max(99),
  start: TimeSchema,
  end: TimeSchema,
});
export type Period = z.infer<typeof PeriodSchema>;

const DayColumnSchema = z.array(LessonSchema.nullable()).max(MAX_PERIODS);
export type DayColumn = z.infer<typeof DayColumnSchema>;

export const TimetableSchema = z
  .object({
    periods: z.array(PeriodSchema).min(1).max(MAX_PERIODS),
    days: z.object({
      sun: DayColumnSchema,
      mon: DayColumnSchema,
      tue: DayColumnSchema,
      wed: DayColumnSchema,
      thu: DayColumnSchema,
    }),
  })
  .superRefine((timetable, ctx) => {
    const seen = new Set<string>();
    for (const day of DAY_IDS) {
      const column = timetable.days[day];
      if (column.length !== timetable.periods.length) {
        ctx.addIssue({
          code: 'custom',
          path: ['days', day],
          message: `ליום ${day} יש ${column.length} שעות במקום ${timetable.periods.length}`,
        });
      }
      column.forEach((lesson, index) => {
        if (!lesson) return;
        if (seen.has(lesson.id)) {
          ctx.addIssue({
            code: 'custom',
            path: ['days', day, index, 'id'],
            message: `מזהה שיעור כפול: ${lesson.id}`,
          });
        }
        seen.add(lesson.id);
      });
    }
  });
export type Timetable = z.infer<typeof TimetableSchema>;
