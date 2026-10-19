/** Reusable schedule templates and assigning them to students. */
import type { Period } from '../../../schemas/timetable';
import { db, unwrap } from './adminClient';
import type { LessonRow, TemplateRow } from './types';

/** Templates with their lesson counts. */
export async function listTemplates(): Promise<TemplateRow[]> {
  const rows = await unwrap<Array<Omit<TemplateRow, 'lesson_count'> & { template_lessons: Array<{ count: number }> }>>(
    db().from('schedule_templates').select('id, name, periods, created_at, updated_at, template_lessons(count)').order('name'),
  );
  return rows.map(({ template_lessons, ...row }) => ({ ...row, lesson_count: template_lessons[0]?.count ?? 0 }));
}

/** The lessons of one template. */
export async function getTemplateLessons(templateId: string): Promise<LessonRow[]> {
  return unwrap<LessonRow[]>(db().from('template_lessons').select('day, period_index, preset_id').eq('template_id', templateId));
}

/** Creates (id null) or fully replaces a template; returns its id. */
export async function saveTemplate(id: string | null, name: string, periods: Period[], lessons: LessonRow[]): Promise<string> {
  return unwrap<string>(db().rpc('admin_save_template', { p_template_id: id, p_name: name, p_periods: periods, p_lessons: lessons }));
}

/** Copies a template under a new name; returns the copy's id. */
export async function duplicateTemplate(id: string, name: string): Promise<string> {
  return unwrap<string>(db().rpc('admin_duplicate_template', { p_template_id: id, p_name: name }));
}

/** Deletes a template (students' timetables made from it are not affected). */
export async function deleteTemplate(id: string): Promise<void> {
  await unwrap(db().from('schedule_templates').delete().eq('id', id));
}

/** Which of these students have customised their timetable. */
export async function previewAssignment(templateId: string, profileIds: readonly string[]): Promise<Array<{ id: string; display_name: string }>> {
  return unwrap(db().rpc('admin_template_assignment_preview', { p_template_id: templateId, p_profile_ids: profileIds }));
}

/** Copies the template into each student's timetable; customised ones only when `overwrite`. */
export async function assignTemplate(
  templateId: string,
  profileIds: readonly string[],
  overwrite: boolean,
): Promise<{ assigned: string[]; skipped_customized: string[] }> {
  return unwrap(db().rpc('admin_assign_template', { p_template_id: templateId, p_profile_ids: profileIds, p_overwrite_customized: overwrite }));
}
