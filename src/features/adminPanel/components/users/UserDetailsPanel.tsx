import { navigate } from '../../../../app/router';
import { Button } from '../../../../components/ui/Button';
import { confirm } from '../../../../components/ui/confirmStore';
import { toast } from '../../../../store/uiStore';
import { removeAvatarFile } from '../../api/avatarsApi';
import type { UserOverview } from '../../api/types';
import { deleteUser, setUserStatus, updateUser } from '../../api/usersApi';
import { errorMessage } from '../../domain/adminErrors';
import { formatDateTime } from '../../domain/formatters';
import { reloadPeopleViews, useUsers } from '../../state/resources';
import { Panel } from '../shared/Page';
import { UserForm } from './UserForm';
import styles from './users.module.css';

/** Personal details, account status and deletion. */
export function UserDetailsPanel({ user }: { user: UserOverview }) {
  /** Enables or disables the account after confirmation. */
  const toggleStatus = async () => {
    const disabling = user.status === 'active';
    const ok = await confirm({
      title: disabling ? 'השבתת חשבון' : 'הפעלת חשבון',
      message: disabling
        ? `להשבית את החשבון של ${user.display_name}? החיבור הנוכחי שלו ינותק מיד, ולא יהיה אפשר להתחבר עד שהחשבון יופעל מחדש.`
        : `להפעיל מחדש את החשבון של ${user.display_name}? הוא יוכל להתחבר עם הקוד הפעיל שלו.`,
      confirmLabel: disabling ? 'השבתה' : 'הפעלה',
      tone: disabling ? 'danger' : 'default',
    });
    if (!ok) return;
    try {
      await setUserStatus(user.id, disabling ? 'disabled' : 'active');
      toast(disabling ? 'החשבון הושבת והחיבור נותק' : 'החשבון הופעל', { tone: 'success' });
      reloadPeopleViews();
    } catch (error) {
      toast(errorMessage(error), { tone: 'error' });
    }
  };

  /** Deletes the student, their codes, sessions, timetable and picture. */
  const remove = async () => {
    const ok = await confirm({
      title: 'מחיקת משתמש',
      message: `למחוק לצמיתות את ${user.display_name}? יימחקו גם קודי הגישה, החיבורים, מערכת השעות והתמונה. אי אפשר לבטל את הפעולה.`,
      confirmLabel: 'מחיקה לצמיתות',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      const avatar = await deleteUser(user.id);
      if (avatar) await removeAvatarFile(avatar);
      toast('המשתמש נמחק', { tone: 'success' });
      reloadPeopleViews();
      navigate({ name: 'admin', section: 'users' }, { replace: true });
    } catch (error) {
      toast(errorMessage(error), { tone: 'error' });
    }
  };

  return (
    <>
      <Panel title="פרטים אישיים" id="user-details">
        <UserForm
          key={user.updated_at}
          initial={{ display_name: user.display_name, class_name: user.class_name, school_name: user.school_name, bio: user.bio }}
          submitLabel="שמירת פרטים"
          onSubmit={async (fields) => {
            try {
              await updateUser(user.id, fields);
              toast('הפרטים נשמרו', { tone: 'success' });
              void useUsers.getState().load(true);
              return null;
            } catch (error) {
              return errorMessage(error);
            }
          }}
        />
      </Panel>
      <Panel title="מצב החשבון" id="user-status">
        <dl className={styles.facts}>
          <dt>מצב</dt>
          <dd>{user.status === 'active' ? 'פעיל' : 'מושבת'}</dd>
          <dt>נוצר</dt>
          <dd>{formatDateTime(user.created_at)}</dd>
          <dt>עודכן</dt>
          <dd>{formatDateTime(user.updated_at)}</dd>
        </dl>
        <div className={styles.actions}>
          <Button icon={user.status === 'active' ? 'block' : 'checkCircle'} variant={user.status === 'active' ? 'danger' : 'primary'} onClick={() => void toggleStatus()}>
            {user.status === 'active' ? 'השבתת החשבון' : 'הפעלת החשבון'}
          </Button>
          <Button icon="delete" variant="danger" onClick={() => void remove()}>
            מחיקת המשתמש
          </Button>
        </div>
      </Panel>
    </>
  );
}
