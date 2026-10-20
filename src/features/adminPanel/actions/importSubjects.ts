/**
 * Applies an import plan to one student's subject list: every new subject in a single
 * insert (all or nothing), then — only if the admin chose to — the updates of matching
 * subjects. Nothing else is touched: no other student, no timetable lesson.
 */
import { createPresets, replacePresetDetails } from '../api/presetsApi';
import { AdminError, errorMessage } from '../domain/adminErrors';
import type { PlanItem } from '../domain/subjectImport/importPlan';

export interface ImportOutcome {
  created: number;
  updated: number;
  skipped: number;
}

/** The calls the import needs (injectable for tests). */
export interface ImportApi {
  createPresets: typeof createPresets;
  replacePresetDetails: typeof replacePresetDetails;
}

const DEFAULT_API: ImportApi = { createPresets, replacePresetDetails };

/** Raised when the new subjects were created but an approved update failed. */
export class PartialImportError extends AdminError {
  readonly outcome: ImportOutcome;
  constructor(outcome: ImportOutcome, subjectName: string, cause: unknown) {
    super(
      'partial_import',
      `נוספו ${outcome.created} מקצועות ועודכנו ${outcome.updated}, אבל עדכון „${subjectName}” נכשל: ${errorMessage(cause)} אפשר לנסות שוב — מקצועות שכבר נוספו ידולגו.`,
    );
    this.outcome = outcome;
  }
}

/** Imports the plan into `profileId`'s list; `updateConflicts` is the admin's explicit choice. */
export async function importSubjects(
  profileId: string,
  plan: readonly PlanItem[],
  updateConflicts: boolean,
  api: ImportApi = DEFAULT_API,
): Promise<ImportOutcome> {
  const toCreate = plan.filter((item) => item.kind === 'create');
  const toUpdate = updateConflicts ? plan.filter((item) => item.kind === 'conflict' && item.existing) : [];
  const outcome: ImportOutcome = { created: 0, updated: 0, skipped: plan.length - toCreate.length - toUpdate.length };

  await api.createPresets(
    profileId,
    toCreate.map((item) => item.subject.fields),
  );
  outcome.created = toCreate.length;

  for (const item of toUpdate) {
    const { name, teacher, room, color } = item.subject.fields;
    try {
      await api.replacePresetDetails(item.existing?.id ?? '', { name, teacher, room, color });
    } catch (cause) {
      throw new PartialImportError(outcome, name, cause);
    }
    outcome.updated += 1;
  }
  return outcome;
}

/** "5 מקצועות נוספו בהצלחה." (+ updates), for the confirmation toast. */
export function importSuccessMessage({ created, updated }: ImportOutcome): string {
  const parts = [];
  if (created > 0 || updated === 0) parts.push(created === 1 ? 'מקצוע אחד נוסף בהצלחה.' : `${created} מקצועות נוספו בהצלחה.`);
  if (updated > 0) parts.push(updated === 1 ? 'מקצוע אחד עודכן.' : `${updated} מקצועות עודכנו.`);
  return parts.join(' ');
}
