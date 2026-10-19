import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { TextField } from '../../../components/ui/fields';
import { ProfileSchema, type Profile } from '../../../schemas/content';
import { useProfileStore } from '../../../store/dataStores';
import { toast } from '../../../store/uiStore';

/** Edits the local display name, sidebar subtitle and class/display name. */
export function ProfileForm() {
  const saved = useProfileStore((state) => state.value);
  // Re-mount the form when the stored profile changes (e.g. after an import or reset).
  return <ProfileFields key={JSON.stringify(saved)} saved={saved} />;
}

/** The form itself; its draft starts from the stored profile. */
function ProfileFields({ saved }: { saved: Profile }) {
  const setProfile = useProfileStore((state) => state.set);
  const [draft, setDraft] = useState<Profile>(saved);
  const [error, setError] = useState<string | undefined>();

  /** Validates and saves the profile. */
  const save = () => {
    const result = ProfileSchema.safeParse({
      studentName: draft.studentName.trim(),
      subtitle: draft.subtitle.trim(),
      className: draft.className.trim(),
    });
    if (!result.success) {
      setError('יש להזין שם כיתה / תצוגה');
      return;
    }
    setProfile(result.data);
    toast('הפרטים נשמרו', { tone: 'success' });
  };

  return (
    <div>
      <TextField
        label="שם לתצוגה"
        value={draft.studentName}
        onValueChange={(studentName) => setDraft({ ...draft, studentName })}
        hint="מוצג בתפריט ובברכה. נשמר רק במכשיר."
        maxLength={60}
      />
      <TextField label="שורת משנה בתפריט" value={draft.subtitle} onValueChange={(subtitle) => setDraft({ ...draft, subtitle })} maxLength={80} />
      <TextField
        label="שם כיתה (תצוגה)"
        value={draft.className}
        onValueChange={(className) => {
          setDraft({ ...draft, className });
          setError(undefined);
        }}
        error={error}
        maxLength={30}
      />
      <Button variant="primary" icon="check" onClick={save}>
        שמירת פרטים
      </Button>
    </div>
  );
}
