/** Students in account mode: access-code sign-in, the one-device rule, persistence, editing. */
import { expect, test, type Browser, type Page } from '@playwright/test';
import { adminClient, createStudent, createUserPreset, dayTable, signInStudent, sql, stackAvailable, unlockEditMode } from './helpers';

test.skip(!stackAvailable, 'needs the local stack (npm run stack)');

/** A fresh browser profile = a separate device. */
async function device(browser: Browser): Promise<Page> {
  return (await browser.newContext()).newPage();
}

test('signs in with a code, shows only the student’s data and stays signed in across reloads', async ({ page }) => {
  const admin = await adminClient();
  const { code, profileId } = await createStudent({ display_name: 'מאיה כץ', class_name: "יא' 1" });
  const other = await createStudent({ display_name: 'מישהו אחר' });
  const math = await createUserPreset(profileId, { name: 'מתמטיקה' });
  await admin.rpc('admin_save_user_lessons', { p_profile_id: profileId, p_changes: [{ day: 'sun', period_index: 0, preset_id: math }] });
  await admin.from('notifications').insert([
    { profile_id: profileId, category: 'general', title: 'הודעה למאיה', body: '' },
    { profile_id: other.profileId, category: 'general', title: 'הודעה למישהו אחר', body: '' },
  ]);

  await signInStudent(page, ` ${code.toLowerCase()} `);
  // The app bar is the original one: menu, title, export and alerts at the far left — no picture.
  const appBar = page.getByRole('banner');
  await expect(appBar.getByRole('button')).toHaveCount(3);
  await expect(appBar.locator('img')).toHaveCount(0);
  await expect(appBar).not.toContainText('מכ');
  const barBox = await appBar.boundingBox();
  const alertsBox = await appBar.getByRole('button', { name: /התראות שינויים/ }).boundingBox();
  expect((alertsBox?.x ?? 999) - (barBox?.x ?? 0)).toBeLessThanOrEqual(20);
  // The student's name and picture stay in the side menu.
  await appBar.getByRole('button', { name: 'פתיחת תפריט' }).click();
  await expect(page.getByRole('dialog', { name: 'תפריט ראשי' })).toContainText('מאיה כץ');
  await page.keyboard.press('Escape');
  await page.getByRole('radio', { name: 'יום ראשון', exact: true }).click();
  await expect(dayTable(page)).toContainText('מתמטיקה');

  await page.goto('#/schedule/changes');
  await expect(page.getByText('הודעה למאיה')).toBeVisible();
  await expect(page.getByText('הודעה למישהו אחר')).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole('heading', { name: 'מ. שעות ושינויים' })).toBeVisible();
  await expect(page.getByLabel('קוד גישה')).toHaveCount(0);
});

test('a second device is rejected while the first is signed in, then admitted after logout', async ({ browser }) => {
  const { code } = await createStudent({ display_name: 'יואב' });
  const a = await device(browser);
  const b = await device(browser);
  await signInStudent(a, code);

  await b.goto('./');
  await b.getByLabel('קוד גישה').fill(code);
  await b.getByRole('button', { name: 'כניסה' }).click();
  await expect(b.getByRole('alert')).toContainText('כבר מחובר במכשיר אחר');
  // Device A is untouched.
  await a.reload();
  await expect(a.getByRole('heading', { name: 'מ. שעות ושינויים' })).toBeVisible();

  await a.goto('#/settings');
  await a.getByRole('button', { name: 'התנתקות' }).click();
  await a.getByRole('dialog', { name: 'התנתקות' }).getByRole('button', { name: 'התנתקות' }).click();
  await expect(a.getByText(/^התנתקת\./)).toBeVisible();

  await b.getByRole('button', { name: 'כניסה' }).click();
  await expect(b.getByRole('heading', { name: 'מ. שעות ושינויים' })).toBeVisible({ timeout: 15_000 });
});

test('exactly one of several simultaneous sign-ins succeeds', async ({ browser }) => {
  const { code } = await createStudent({ display_name: 'מקבילי' });
  const pages = await Promise.all(Array.from({ length: 4 }, () => device(browser)));
  for (const page of pages) {
    await page.goto('./');
    await page.getByLabel('קוד גישה').fill(code);
  }
  await Promise.all(pages.map((page) => page.getByRole('button', { name: 'כניסה' }).click()));
  const outcomes = await Promise.all(
    pages.map((page) =>
      Promise.race([
        page.getByRole('heading', { name: 'מ. שעות ושינויים' }).waitFor({ timeout: 20_000 }).then(() => 'in' as const),
        page.getByRole('alert').waitFor({ timeout: 20_000 }).then(() => 'rejected' as const),
      ]),
    ),
  );
  expect(outcomes.filter((o) => o === 'in')).toHaveLength(1);
  expect(outcomes.filter((o) => o === 'rejected')).toHaveLength(3);
});

test('renews expired access tokens with a rotated refresh token instead of signing out', async ({ page }) => {
  const { code } = await createStudent({ display_name: 'רענון' });
  await signInStudent(page, code);
  const key = 'webtop-pwa:student-auth';
  const before = await page.evaluate((k) => {
    const session = JSON.parse(localStorage.getItem(k) ?? '{}');
    session.expires_at = Math.floor(Date.now() / 1000) - 60;
    localStorage.setItem(k, JSON.stringify(session));
    return session.refresh_token as string;
  }, key);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'מ. שעות ושינויים' })).toBeVisible({ timeout: 15_000 });
  const after = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? '{}').refresh_token as string, key);
  expect(after).not.toBe(before);
});

test('force-disconnect, code revocation and disabling all sign the device out', async ({ page }) => {
  const admin = await adminClient();
  const { code, profileId } = await createStudent({ display_name: 'ניתוקים' });

  await signInStudent(page, code);
  const [session] = await sql<{ id: string }>("select id from public.user_sessions where profile_id = $1 and status = 'active'", [profileId]);
  await admin.rpc('admin_disconnect_session', { p_session_id: session?.id });
  await page.reload();
  await expect(page.getByLabel('קוד גישה')).toBeVisible();
  await expect(page.getByText(/^החיבור הסתיים/)).toBeVisible();

  await signInStudent(page, code);
  const [codeRow] = await sql<{ id: string }>("select id from public.access_codes where profile_id = $1 and status = 'active'", [profileId]);
  await admin.rpc('admin_revoke_access_code', { p_code_id: codeRow?.id });
  await page.reload();
  await expect(page.getByLabel('קוד גישה')).toBeVisible();
  await page.getByLabel('קוד גישה').fill(code);
  await page.getByRole('button', { name: 'כניסה' }).click();
  await expect(page.getByRole('alert')).toContainText('הקוד שגוי');

  const fresh = await createStudent({ display_name: 'מושבת' });
  await signInStudent(page, fresh.code);
  await admin.rpc('admin_set_profile_status', { p_profile_id: fresh.profileId, p_status: 'disabled' });
  await page.reload();
  await page.getByLabel('קוד גישה').fill(fresh.code);
  await page.getByRole('button', { name: 'כניסה' }).click();
  await expect(page.getByRole('alert')).toContainText('הושבת');
});

test('seven taps open the personal editor with only the student’s own subjects; edits persist after logging out and in', async ({ page }) => {
  const { code, profileId } = await createStudent({ display_name: 'עורכת' });
  const other = await createStudent({ display_name: 'תלמיד אחר' });
  await createUserPreset(profileId, { name: 'כימיה', teacher: 'רחל', room: 'מעבדה 2', color: '#92be43' });
  await createUserPreset(profileId, { name: 'היסטוריה', teacher: 'דוד', room: '107', color: '#444cc1' });
  // Same name, different details, another student: must never appear here.
  await createUserPreset(other.profileId, { name: 'כימיה', teacher: 'מורה של אחר', room: '999' });
  await createUserPreset(other.profileId, { name: 'ספרות', teacher: 'מורה של אחר' });

  await signInStudent(page, code);
  await unlockEditMode(page);
  await page.getByRole('radio', { name: 'יום שלישי', exact: true }).click();
  await dayTable(page).getByRole('button').first().click();
  const editor = page.getByRole('dialog');
  // An empty period plus the student's two subjects; no editable teacher/room fields.
  await expect(editor.getByRole('radio')).toHaveCount(3);
  await expect(editor.getByRole('radio', { name: 'ספרות' })).toHaveCount(0);
  await expect(editor.getByLabel('מורה')).toHaveCount(0);
  await editor.getByRole('radio', { name: 'כימיה' }).click();
  // Picking the subject fills in its teacher and room.
  await expect(editor).toContainText('רחל');
  await expect(editor).toContainText('מעבדה 2');
  await expect(editor).not.toContainText('מורה של אחר');
  await editor.getByRole('button', { name: 'שמירה' }).click();
  await expect(dayTable(page)).toContainText('כימיה');
  await expect(dayTable(page)).toContainText('רחל');
  await expect
    .poll(async () => (await sql('select preset_id from public.lessons where profile_id = $1 and day = $2', [profileId, 'tue'])).length)
    .toBe(1);
  // Only the student's own timetable changed.
  expect(await sql('select 1 from public.lessons where profile_id = $1', [other.profileId])).toEqual([]);

  // Log out and back in with the same code: the edit is still there (it lives on the server).
  await page.goto('#/settings');
  await page.getByRole('button', { name: 'התנתקות' }).click();
  await page.getByRole('dialog', { name: 'התנתקות' }).getByRole('button', { name: 'התנתקות' }).click();
  await expect(page.getByText(/^התנתקת\./)).toBeVisible();
  await signInStudent(page, code);
  await page.getByRole('radio', { name: 'יום שלישי', exact: true }).click();
  await expect(dayTable(page)).toContainText('כימיה');
  await expect(dayTable(page)).toContainText('מעבדה 2');

  // The edit gesture is not an admin credential.
  await page.goto('#/admin');
  await expect(page.getByRole('heading', { name: 'כניסת מנהל' })).toBeVisible();
});

test('the seven-tap gesture needs a connection to the server, and opens edit mode without any prompt', async ({ page }) => {
  const { code } = await createStudent({ display_name: 'ללא רשת' });
  await signInStudent(page, code);

  // Lose the server: the next check marks the app offline and edit mode stays closed.
  await page.route('http://127.0.0.1:54321/**', (route) => route.abort('internetdisconnected'));
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(page.getByText(/אין חיבור לשרת · מוצגים הנתונים/)).toBeVisible();
  const title = page.getByRole('heading', { name: 'מ. שעות ושינויים' });
  for (let i = 0; i < 7; i += 1) await title.click({ delay: 10 });
  await expect(page.getByText(/אפשר יהיה לערוך כשהחיבור יחזור/)).toBeVisible();
  await expect(page.getByRole('region', { name: 'מצב עריכה' })).toHaveCount(0);

  // Back online: seven taps open it immediately.
  await page.unroute('http://127.0.0.1:54321/**');
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(page.getByText(/אין חיבור לשרת · מוצגים הנתונים/)).toHaveCount(0);
  await unlockEditMode(page);
});

test('כרטיס תלמיד → מערכת שעות shows the student’s own name and timetable, and its edits reach the main view', async ({ page }) => {
  const admin = await adminClient();
  const { code, profileId } = await createStudent({ display_name: 'שירה כהן' });
  const other = await createStudent({ display_name: 'תלמיד אחר' });
  const math = await createUserPreset(profileId, { name: 'מתמטיקה', teacher: 'דניאל', room: '101', color: '#1498fd' });
  const chemistry = await createUserPreset(profileId, { name: 'כימיה', teacher: 'רחל', room: 'מעבדה 2', color: '#92be43' });
  const foreign = await createUserPreset(other.profileId, { name: 'ספרות', teacher: 'מורה של אחר', room: '999' });
  await admin.rpc('admin_save_user_lessons', { p_profile_id: profileId, p_changes: [{ day: 'tue', period_index: 1, preset_id: math }] });
  await admin.rpc('admin_save_user_lessons', { p_profile_id: other.profileId, p_changes: [{ day: 'tue', period_index: 0, preset_id: foreign }] });

  await signInStudent(page, code);
  await page.getByRole('button', { name: 'פתיחת תפריט' }).click();
  await page.getByRole('dialog', { name: 'תפריט ראשי' }).getByRole('button', { name: 'כרטיס תלמיד' }).click();
  await page.getByRole('navigation', { name: 'כרטיס תלמיד' }).getByRole('button', { name: 'מערכת שעות' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'מערכת שעות' })).toBeVisible();

  // Name and lessons from the student's own Supabase data; nothing of the other student.
  await expect(page.getByTestId('student-name')).toHaveText('שירה כהן');
  await page.getByRole('radio', { name: 'יום שלישי', exact: true }).click();
  const rows = dayTable(page).locator('tbody tr');
  await expect(rows.nth(0).locator('td')).toHaveText('שעה פנויה');
  await expect(rows.nth(1)).toContainText('מתמטיקה');
  await expect(rows.nth(1)).toContainText('דניאל');
  await expect(rows.nth(1)).toContainText('חדר: 101');
  expect(await rows.nth(1).locator('td > div').first().evaluate((el) => getComputedStyle(el).borderInlineStartColor)).toBe('rgb(20, 152, 253)');
  await expect(page.locator('body')).not.toContainText('ספרות');
  await expect(page.locator('body')).not.toContainText('מורה של אחר');

  // Seven taps on this title, then edit: saved to the account and shown on the main timetable.
  await unlockEditMode(page, 'מערכת שעות');
  await rows.nth(0).getByRole('button', { name: /הוספת שיעור/ }).click();
  const editor = page.getByRole('dialog');
  await expect(editor.getByRole('radio', { name: 'ספרות' })).toHaveCount(0);
  await editor.getByRole('radio', { name: 'כימיה' }).click();
  await editor.getByRole('button', { name: 'שמירה' }).click();
  await expect(rows.nth(0)).toContainText('כימיה');
  await expect
    .poll(async () => (await sql<{ preset_id: string }>('select preset_id from public.lessons where profile_id = $1 and day = $2 and period_index = 0', [profileId, 'tue']))[0]?.preset_id)
    .toBe(chemistry);

  await page.goto('#/schedule/timetable');
  await page.getByRole('radio', { name: 'יום שלישי', exact: true }).click();
  await expect(dayTable(page).locator('tbody tr').nth(0)).toContainText('כימיה');
  await expect(dayTable(page).locator('tbody tr').nth(1)).toContainText('מתמטיקה');
});
