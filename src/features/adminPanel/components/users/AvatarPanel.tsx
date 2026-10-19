import { useRef, useState, type ChangeEvent } from 'react';
import { Avatar } from '../../../../components/ui/Avatar';
import { Button } from '../../../../components/ui/Button';
import { confirm } from '../../../../components/ui/confirmStore';
import { toast } from '../../../../store/uiStore';
import { clearAvatar, replaceAvatar } from '../../api/avatarsApi';
import type { UserOverview } from '../../api/types';
import { errorMessage } from '../../domain/adminErrors';
import { ACCEPTED_AVATAR_TYPES, validateAvatarFile, type CropState } from '../../domain/avatarCrop';
import { exportAvatar, loadImageFile, type LoadedImage } from '../../domain/avatarImage';
import { useUsers } from '../../state/resources';
import { Panel } from '../shared/Page';
import { AvatarCropper } from './AvatarCropper';
import styles from './avatar.module.css';

/** Upload, crop, replace or remove a student's profile picture. */
export function AvatarPanel({ user, avatarUrl }: { user: UserOverview; avatarUrl?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<LoadedImage | null>(null);
  const [busy, setBusy] = useState(false);

  /** Closes the cropper and frees the decoded image. */
  const closeCropper = () => {
    if (image) URL.revokeObjectURL(image.url);
    setImage(null);
  };

  /** Validates and decodes the chosen file, then opens the cropper. */
  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const problem = validateAvatarFile(file);
    if (problem) {
      toast(problem, { tone: 'error' });
      return;
    }
    try {
      setImage(await loadImageFile(file));
    } catch {
      toast('לא ניתן לקרוא את התמונה. נסו קובץ אחר.', { tone: 'error' });
    }
  };

  /** Exports the crop, uploads it and replaces the old picture. */
  const save = async (crop: CropState, frame: number) => {
    if (!image) return;
    setBusy(true);
    try {
      const blob = await exportAvatar(image, crop, frame);
      await replaceAvatar(user.id, blob, user.avatar_path);
      toast('התמונה נשמרה', { tone: 'success' });
      closeCropper();
      void useUsers.getState().load(true);
    } catch (error) {
      toast(errorMessage(error), { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  /** Removes the picture after confirmation. */
  const remove = async () => {
    if (!user.avatar_path) return;
    const ok = await confirm({ title: 'הסרת תמונה', message: 'להסיר את תמונת הפרופיל?', confirmLabel: 'הסרה', tone: 'danger' });
    if (!ok) return;
    try {
      await clearAvatar(user.id, user.avatar_path);
      toast('התמונה הוסרה', { tone: 'success' });
      void useUsers.getState().load(true);
    } catch (error) {
      toast(errorMessage(error), { tone: 'error' });
    }
  };

  return (
    <Panel title="תמונת פרופיל" id="user-avatar">
      <div className={styles.current}>
        <figure className={styles.preview}>
          <Avatar name={user.display_name} src={avatarUrl} size={96} />
          <figcaption>עגולה</figcaption>
        </figure>
        <figure className={styles.preview}>
          <Avatar name={user.display_name} src={avatarUrl} size={96} shape="square" />
          <figcaption>מרובעת</figcaption>
        </figure>
      </div>
      <p className={styles.help}>JPG,‏ PNG או WebP. התמונה נחתכת לריבוע, מוקטנת ל‑512×512 ונשמרת באחסון פרטי. מוצגת בכותרת האפליקציה ובתפריט של התלמיד/ה.</p>
      <input ref={input} type="file" accept={ACCEPTED_AVATAR_TYPES.join(',')} hidden onChange={(event) => void onFile(event)} />
      <div className={styles.actions}>
        <Button icon="photoCamera" variant="primary" onClick={() => input.current?.click()}>
          {user.avatar_path ? 'החלפת תמונה' : 'העלאת תמונה'}
        </Button>
        {user.avatar_path && (
          <Button icon="delete" variant="danger" onClick={() => void remove()}>
            הסרת התמונה
          </Button>
        )}
      </div>
      {image && <AvatarCropper image={image} busy={busy} onSave={(crop, frame) => void save(crop, frame)} onCancel={closeCropper} />}
    </Panel>
  );
}
