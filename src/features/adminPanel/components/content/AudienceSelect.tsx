import { SelectField } from '../../../../components/ui/fields';
import type { UserOverview } from '../../api/types';

/** "Everyone" or one student. */
export function AudienceSelect({ users, value, onChange }: { users: readonly UserOverview[]; value: string | null; onChange: (value: string | null) => void }) {
  return (
    <SelectField
      label="למי זה מוצג"
      value={value ?? ''}
      options={[{ value: '', label: 'לכל המשתמשים' }, ...users.map((u) => ({ value: u.id, label: `${u.display_name}${u.class_name ? ` (${u.class_name})` : ''}` }))]}
      onValueChange={(next) => onChange(next || null)}
    />
  );
}
