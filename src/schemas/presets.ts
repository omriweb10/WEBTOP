/**
 * Subject presets: reusable bundles of subject text, teacher, room and accent colour.
 * Picking a preset in the lesson editor fills all four fields in one action.
 */
import { z } from 'zod';
import { HexColorSchema, IdSchema, textSchema } from './primitives';

export const PresetSchema = z.object({
  id: IdSchema,
  /** Short label shown in the preset picker (e.g. "אנגלית"). */
  name: textSchema(40, 1),
  /** Text shown on the lesson card (e.g. "אנגלית 5 (רמה: 5 יח``ל)"). */
  subject: textSchema(80, 1),
  teacher: textSchema(80),
  room: textSchema(80),
  color: HexColorSchema,
});
export type Preset = z.infer<typeof PresetSchema>;

export const MAX_PRESETS = 100;

export const PresetListSchema = z
  .array(PresetSchema)
  .max(MAX_PRESETS)
  .superRefine((presets, ctx) => {
    const ids = new Set<string>();
    presets.forEach((preset, index) => {
      if (ids.has(preset.id)) {
        ctx.addIssue({ code: 'custom', path: [index, 'id'], message: `מזהה תבנית כפול: ${preset.id}` });
      }
      ids.add(preset.id);
    });
  });
