/** The admin panel against the real backend: users, codes, pictures, presets, templates, sessions. */
import { expect, test, type Page } from '@playwright/test';
import { loginStudent } from '../backend/helpers';
import { createStudent, env, signInAdmin, solidPng, sql, stackAvailable, uniqueDigits } from './helpers';

test.skip(!stackAvailable, 'needs the local stack (npm run stack)');

/** Opens a student's page from the users list by name. */
async function openUser(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name: 'משתמשים' }).click();
  await page.getByRole('searchbox', { name: 'חיפוש משתמשים' }).fill(name);
  await page.getByRole('button', { name: new RegExp(name) }).first().click();
  await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible();
}

test('rejects wrong passwords and accounts that are not admins', async ({ page }) => {
  await page.goto('#/admin');
  await page.getByLabel('אימייל').fill(env.admin.email);
  await page.getByLabel('סיסמה').fill('wrong-password');
  await page.getByRole('button', { name: 'כניסה' }).click();
  await expect(page.getByRole('alert')).toContainText('שגויים');

  const email = `user-${uniqueDigits(8)}@webtop.test`;
  const password = `Pw-${uniqueDigits(12)}-x`;
  const created = await fetch(`${env.apiUrl}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { apikey: env.serviceRoleKey, Authorization: `Bearer ${env.serviceRoleKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  expect(created.ok).toBe(true);
  await page.getByLabel('אימייל').fill(email);
  await page.getByLabel('סיסמה').fill(password);
  await page.getByRole('button', { name: 'כניסה' }).click();
  await expect(page.getByRole('alert')).toContainText('אינו מוגדר כמנהל');
});

test('creates a student, sets a picture and issues codes that are shown once', async ({ page }) => {
  const name = `תלמידה ${uniqueDigits(5)}`;
  await signInAdmin(page);
  await page.getByRole('button', { name: 'משתמש חדש' }).click();
  await page.getByLabel('שם תצוגה *').fill(name);
  await page.getByLabel('כיתה / שכבה').fill("י' 3");
  await page.getByLabel(/בית ספר/).fill('בית ספר לדוגמה');
  await page.getByRole('button', { name: 'יצירה' }).click();
  await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible();

  // Picture: upload, crop, save; it is stored privately and shown back.
  await page.getByRole('tab', { name: 'תמונה' }).click();
  await page.locator('input[type=file]').setInputFiles({ name: 'me.png', mimeType: 'image/png', buffer: solidPng(300, 200, [20, 150, 250]) });
  const cropper = page.getByRole('dialog', { name: 'עריכת תמונת פרופיל' });
  await expect(cropper.getByRole('slider', { name: 'הגדלה' })).toBeVisible();
  await cropper.getByRole('slider', { name: 'הגדלה' }).fill('1.5');
  await cropper.getByRole('button', { name: 'שמירת התמונה' }).click();
  await expect(page.getByText('התמונה נשמרה')).toBeVisible();
  await expect(page.locator('img[src*="/storage/v1/object/sign/avatars/"]').first()).toBeVisible();
  const [profile] = await sql<{ id: string; avatar_path: string }>('select id, avatar_path from public.profiles where display_name = $1', [name]);
  expect(profile?.avatar_path).toMatch(/\.(webp|jpg)$/);

  // A weak custom code needs an explicit opt-in.
  await page.getByRole('tab', { name: 'קוד גישה' }).click();
  await page.getByRole('button', { name: 'קוד מותאם אישית…' }).click();
  const digits = uniqueDigits(9);
  await page.getByLabel('קוד מותאם אישית').fill(digits);
  await expect(page.getByText('קוד שמורכב מספרות בלבד קל לניחוש')).toBeVisible();
  const saveCode = page.getByRole('button', { name: 'שמירת הקוד' });
  await expect(saveCode).toBeDisabled();
  await page.getByRole('checkbox', { name: /אני מבין/ }).check();
  await saveCode.click();
  await expect(page.getByTestId('issued-code')).toHaveText(`${digits.slice(0, 4)}-${digits.slice(4, 8)}-${digits.slice(8)}`);
  await page.getByRole('button', { name: 'סיימתי' }).click();
  await expect(page.getByText('…' + digits.slice(-2)).first()).toBeVisible();

  // Replacing it with a strong generated code asks first and shows the new one once.
  await page.getByRole('button', { name: 'החלפה בקוד חזק חדש' }).click();
  await page.getByRole('dialog', { name: 'החלפת קוד' }).getByRole('button', { name: 'החלפה' }).click();
  await expect(page.getByTestId('issued-code')).toHaveText(/^[2-9A-Z]{4}-[2-9A-Z]{4}-[2-9A-Z]{4}$/);
  const issued = (await page.getByTestId('issued-code').textContent()) ?? '';
  await page.getByRole('button', { name: 'סיימתי' }).click();
  await expect(page.getByTestId('issued-code')).toHaveCount(0);
  const rows = await sql<{ n: number }>("select count(*)::int as n from public.access_codes where profile_id = $1 and status = 'active'", [profile?.id]);
  expect(rows[0]?.n).toBe(1);
  expect((await loginStudent(issued)).status).toBe(200);
  expect((await loginStudent(digits)).status).toBe(401);
});

test('assigns subjects and edits a student’s own timetable', async ({ page }) => {
  const name = `מערכת ${uniqueDigits(5)}`;
  const { profileId } = await createStudent({ display_name: name });
  await signInAdmin(page);
  await openUser(page, name);

  await page.getByRole('tab', { name: 'מקצועות' }).click();
  await page.getByRole('checkbox', { name: /כימיה/ }).check();
  await page.getByRole('button', { name: 'שמירה', exact: true }).click();
  await expect(page.getByText(/רשימת המקצועות נשמרה/)).toBeVisible();
  const [link] = await sql('select 1 as ok from public.profile_presets pp join public.subject_presets sp on sp.id = pp.preset_id where pp.profile_id = $1 and sp.name = $2', [profileId, 'כימיה']);
  expect(link?.ok).toBe(1);

  await page.getByRole('tab', { name: 'מערכת שעות' }).click();
  await page.getByRole('button', { name: 'רביעי, שעה 2: ריקה. הוספת שיעור' }).click();
  const sheet = page.getByRole('dialog', { name: /רביעי · שעה 2/ });
  await sheet.getByRole('radio', { name: 'היסטוריה' }).click();
  await sheet.getByRole('button', { name: 'החלה' }).click();
  await expect(page.getByText('יש שינויים שלא נשמרו')).toBeVisible();
  await page.getByRole('button', { name: 'שמירת שינויים' }).click();
  await expect(page.getByText('מערכת השעות של התלמיד/ה נשמרה')).toBeVisible();
  const lessons = await sql<{ day: string; period_index: number }>('select day, period_index from public.lessons where profile_id = $1', [profileId]);
  expect(lessons).toEqual([{ day: 'wed', period_index: 1 }]);
});

test('builds a template and confirms before overwriting customised timetables', async ({ page }) => {
  const tag = uniqueDigits(5);
  const fresh = await createStudent({ display_name: `טרי ${tag}` });
  const custom = await createStudent({ display_name: `מותאם ${tag}` });
  await sql('update public.user_timetables set customized = true where profile_id = $1', [custom.profileId]);

  await signInAdmin(page);
  await page.getByRole('button', { name: 'תבניות' }).click();
  await page.getByRole('button', { name: 'תבנית חדשה' }).click();
  await page.getByLabel('שם התבנית').fill(`שכבה ${tag}`);
  await page.getByRole('button', { name: 'ראשון, שעה 1: ריקה. הוספת שיעור' }).click();
  await page.getByRole('dialog').getByRole('radio', { name: 'מתמטיקה' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'החלה' }).click();
  // Copy it to the next period from the cell sheet.
  await page.getByRole('button', { name: /ראשון, שעה 1: .*מתמטיקה/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'העתקה' }).click();
  await expect(page.getByRole('button', { name: /ראשון, שעה 2: .*מתמטיקה/ })).toBeVisible();
  await page.getByRole('button', { name: 'שמירת התבנית' }).click();
  await expect(page.getByRole('heading', { name: `שכבה ${tag}` })).toBeVisible();

  const card = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: `שכבה ${tag}` }) });
  await card.getByRole('button', { name: 'החלה על משתמשים' }).click();
  const dialog = page.getByRole('dialog', { name: `החלת „שכבה ${tag}”` });
  await dialog.getByRole('searchbox').fill(tag);
  await dialog.getByRole('button', { name: 'בחירת כל המוצגים' }).click();
  await dialog.getByRole('button', { name: 'המשך (2)' }).click();
  await expect(dialog.getByRole('alert')).toContainText(`מותאם ${tag}`);
  await dialog.getByRole('button', { name: /החלה רק על מי שלא שינה/ }).click();
  await expect(page.getByText(/התבנית הוחלה על 1 משתמשים; 1 עם מערכת מותאמת/)).toBeVisible();

  const count = async (id: string) => (await sql<{ n: number }>('select count(*)::int as n from public.lessons where profile_id = $1', [id]))[0]?.n;
  expect(await count(fresh.profileId)).toBe(2);
  expect(await count(custom.profileId)).toBe(0);
});

test('presets can be created, edited and archived', async ({ page }) => {
  const name = `רובוטיקה ${uniqueDigits(4)}`;
  await signInAdmin(page);
  await page.getByRole('button', { name: 'מקצועות' }).click();
  await page.getByRole('button', { name: 'מקצוע חדש' }).click();
  const editor = page.getByRole('dialog', { name: 'מקצוע חדש' });
  await editor.getByLabel(/שם המקצוע/).fill(name);
  await editor.getByLabel('מורה').fill('מורה לרובוטיקה');
  await editor.getByLabel('חדר').fill('111');
  await editor.getByRole('radio', { name: '#259e3b' }).click();
  await editor.getByRole('button', { name: 'שמירה' }).click();
  const card = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name }) });
  await expect(card).toContainText('חדר 111');

  await card.getByRole('button', { name: 'עריכה' }).click();
  await page.getByRole('dialog').getByLabel('חדר').fill('112');
  await page.getByRole('dialog').getByRole('button', { name: 'שמירה' }).click();
  await expect(card).toContainText('חדר 112');

  await card.getByRole('button', { name: 'ארכיון' }).click();
  await expect(page.getByRole('heading', { name })).toHaveCount(0);
  await page.getByRole('radio', { name: /בארכיון/ }).click();
  await expect(page.getByRole('heading', { name })).toBeVisible();
});

test('sessions dashboard shows the live session and force-disconnects it', async ({ page }) => {
  const name = `מחובר ${uniqueDigits(5)}`;
  const { code, profileId } = await createStudent({ display_name: name });
  const login = await loginStudent(code);
  await login.client.rpc('touch_my_session');

  await signInAdmin(page);
  await page.getByRole('button', { name: 'חיבורים' }).click();
  const card = page.getByRole('article').filter({ hasText: name });
  await expect(card).toContainText('פעיל כעת');
  await expect(card).toContainText('ללא — עד ניתוק');
  await card.getByRole('button', { name: 'ניתוק בכוח' }).click();
  await page.getByRole('dialog', { name: 'ניתוק בכוח' }).getByRole('button', { name: 'ניתוק' }).click();
  await expect(page.getByText('החיבור נותק')).toBeVisible();
  await expect(card).toHaveCount(0);
  const [session] = await sql<{ status: string; end_reason: string }>('select status, end_reason from public.user_sessions where profile_id = $1', [profileId]);
  expect(session).toEqual({ status: 'ended', end_reason: 'admin_disconnect' });
  expect((await login.client.rpc('get_my_bundle')).error?.code).toBe('42501');
});
