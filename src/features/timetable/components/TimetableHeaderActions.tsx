import { useState } from 'react';
import { IconButton } from '../../../components/ui/IconButton';
import { useSettingsStore } from '../../../store/dataStores';
import { toast } from '../../../store/uiStore';
import { TimetableExportSheet } from './TimetableExportSheet';

/**
 * App-bar icons on the timetable tab. The bell toggles local change alerts (dated
 * "שינויי מערכת" notices shown above the table); the file icon opens export options.
 */
export function TimetableHeaderActions() {
  const alertsOn = useSettingsStore((state) => state.value.changeAlerts);
  const updateSettings = useSettingsStore((state) => state.update);
  const [exportOpen, setExportOpen] = useState(false);

  /** Flips the alert preference and explains what it does. */
  const toggleAlerts = () => {
    updateSettings((settings) => ({ ...settings, changeAlerts: !settings.changeAlerts }));
    toast(alertsOn ? 'התראות שינויים כובו' : 'התראות שינויים הופעלו: שינויים עם תאריך יוצגו מעל המערכת');
  };

  return (
    <>
      <IconButton icon="fileSave" label="ייצוא מערכת השעות" onClick={() => setExportOpen(true)} />
      <IconButton
        icon={alertsOn ? 'notifications' : 'notificationsOff'}
        label={alertsOn ? 'כיבוי התראות שינויים' : 'הפעלת התראות שינויים'}
        aria-pressed={alertsOn}
        onClick={toggleAlerts}
      />
      <TimetableExportSheet open={exportOpen} onClose={() => setExportOpen(false)} />
    </>
  );
}
