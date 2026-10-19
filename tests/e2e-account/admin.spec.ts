/** The admin panel against the real backend: users, codes, pictures, subjects, templates, sessions. */
import { expect, test, type Page } from '@playwright/test';
import { loginStudent } from '../backend/helpers';
import { createStudent, createUserPreset, env, signInAdmin, solidPng, sql, stackAvailable, uniqueDigits } from './helpers';

test.skip(!stackAvailable, 'needs the local stack (npm run stack)');

/** Opens a student's page from the users list by name. */
async function openUser(page: Page, name: string): Promise<void> {
  await page.getByRole('navigation', { name: 'אזורי ניהול' }).getByRole('button', { name: 'משתמשים', exact: true }).click();
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

/** A user's subject cards (Users → user → מקצועות). */
function subjectCard(page: Page, name: string) {
  return page.getByRole('listitem').filter({ has: page.getByRole('heading', { name, exact: true, level: 3 }) });
}

/** Presets owned by a student, as stored. */
async function ownedPresets(profileId: string) {
  return sql<{ id: string; name: string; teacher: string; room: string; color: string }>(
    'select id, name, teacher, room, color from public.subject_presets where profile_id = $1 order by name, teacher',
    [profileId],
  );
}

test('each user has an independent subject list: add, copy from the library and from another user, edit, duplicate', async ({ page }) => {
  const tag = uniqueDigits(5);
  const a = await createStudent({ display_name: `משתמש א ${tag}` });
  const b = await createStudent({ display_name: `משתמש ב ${tag}` });
  await signInAdmin(page);

  // User A: a new subject with name, teacher, room and colour.
  await openUser(page, `משתמש א ${tag}`);
  await page.getByRole('tab', { name: 'מקצועות' }).click();
  await expect(page.getByText(/עדיין אין מקצועות/)).toBeVisible();
  await page.getByRole('button', { name: 'מקצוע חדש' }).click();
  const editor = page.getByRole('dialog', { name: /מקצוע חדש ל/ });
  await editor.getByLabel(/שם המקצוע/).fill('מתמטיקה');
  await editor.getByLabel('מורה').fill('דניאל');
  await editor.getByLabel('חדר').fill('101');
  await editor.getByRole('radio', { name: '#1498fd' }).click();
  await editor.getByRole('button', { name: 'שמירה' }).click();
  await expect(subjectCard(page, 'מתמטיקה')).toContainText('דניאל · חדר 101');

  // Several subjects at once from the library.
  await page.getByRole('button', { name: 'הוספה מהמאגר' }).click();
  const fromLibrary = page.getByRole('dialog', { name: /הוספת מקצועות ל/ });
  await expect(fromLibrary.getByRole('checkbox', { name: /^מתמטיקה/ })).not.toBeChecked();
  await expect(fromLibrary.getByText(/כבר קיים אצל/)).toBeVisible();
  await fromLibrary.getByRole('button', { name: 'ניקוי' }).click();
  await fromLibrary.getByRole('checkbox', { name: /^אנגלית/ }).check();
  await fromLibrary.getByRole('checkbox', { name: /^היסטוריה/ }).check();
  await fromLibrary.getByRole('button', { name: 'העתקה (2)' }).click();
  await expect(subjectCard(page, 'אנגלית')).toBeVisible();
  await expect(subjectCard(page, 'היסטוריה')).toBeVisible();
  expect((await ownedPresets(a.profileId)).map((p) => p.name)).toEqual(['אנגלית', 'היסטוריה', 'מתמטיקה']);

  // User B copies only "מתמטיקה" from A, then gives it another teacher and room.
  await openUser(page, `משתמש ב ${tag}`);
  await page.getByRole('tab', { name: 'מקצועות' }).click();
  await page.getByRole('button', { name: 'העתקה ממשתמש אחר' }).click();
  const fromUser = page.getByRole('dialog', { name: /הוספת מקצועות ל/ });
  await fromUser.getByLabel('העתקה מ־').selectOption({ label: `משתמש א ${tag} (י' 1)` });
  await expect(fromUser.getByRole('checkbox')).toHaveCount(3);
  await fromUser.getByRole('button', { name: 'ניקוי' }).click();
  await fromUser.getByRole('checkbox', { name: /^מתמטיקה/ }).check();
  await fromUser.getByRole('button', { name: 'העתקה (1)' }).click();
  await expect(subjectCard(page, 'מתמטיקה')).toContainText('דניאל · חדר 101');
  await expect(subjectCard(page, 'אנגלית')).toHaveCount(0);

  await subjectCard(page, 'מתמטיקה').getByRole('button', { name: 'עריכה' }).click();
  const edit = page.getByRole('dialog', { name: 'עריכת „מתמטיקה”' });
  await edit.getByLabel('מורה').fill('מיכאל');
  await edit.getByLabel('חדר').fill('302');
  await edit.getByRole('button', { name: 'שמירה' }).click();
  await expect(subjectCard(page, 'מתמטיקה')).toContainText('מיכאל · חדר 302');

  // Duplicate: same details, a new independent subject.
  await subjectCard(page, 'מתמטיקה').getByRole('button', { name: 'שכפול' }).click();
  const duplicate = page.getByRole('dialog', { name: 'שכפול „מתמטיקה”' });
  await expect(duplicate.getByLabel(/שם המקצוע/)).toHaveValue('מתמטיקה (עותק)');
  await duplicate.getByRole('button', { name: 'שמירה' }).click();
  await expect(subjectCard(page, 'מתמטיקה (עותק)')).toContainText('מיכאל · חדר 302');

  // A is unchanged by everything done to B.
  const ofA = await ownedPresets(a.profileId);
  const ofB = await ownedPresets(b.profileId);
  expect(ofA.find((p) => p.name === 'מתמטיקה')).toMatchObject({ teacher: 'דניאל', room: '101' });
  expect(ofB.map((p) => [p.name, p.teacher, p.room])).toEqual([
    ['מתמטיקה', 'מיכאל', '302'],
    ['מתמטיקה (עותק)', 'מיכאל', '302'],
  ]);
  expect(ofA.some((p) => ofB.some((q) => q.id === p.id))).toBe(false);
});

test('edits a student’s timetable with their own subjects and warns before removing a subject in use', async ({ page }) => {
  const name = `מערכת ${uniqueDigits(5)}`;
  const { profileId } = await createStudent({ display_name: name });
  const other = await createStudent({ display_name: `אחר ${uniqueDigits(5)}` });
  await createUserPreset(profileId, { name: 'פיזיקה', teacher: 'רונית', room: '12' });
  const chemistry = await createUserPreset(profileId, { name: 'כימיה', teacher: 'רחל', room: 'מעבדה 2', color: '#92be43' });
  await createUserPreset(other.profileId, { name: 'של משתמש אחר' });
  await signInAdmin(page);
  await openUser(page, name);

  // Only this student's subjects are offered in their timetable.
  await page.getByRole('tab', { name: 'מערכת שעות' }).click();
  await page.getByRole('button', { name: 'רביעי, שעה 2: ריקה. הוספת שיעור' }).click();
  const sheet = page.getByRole('dialog', { name: /רביעי · שעה 2/ });
  await expect(sheet.getByRole('radio')).toHaveCount(3);
  await expect(sheet.getByRole('radio', { name: 'של משתמש אחר' })).toHaveCount(0);
  await expect(sheet.getByRole('radio', { name: 'מתמטיקה' })).toHaveCount(0);
  await sheet.getByRole('radio', { name: 'פיזיקה' }).click();
  await sheet.getByRole('button', { name: 'החלה' }).click();
  await expect(page.getByText('יש שינויים שלא נשמרו')).toBeVisible();
  await page.getByRole('button', { name: 'שמירת שינויים' }).click();
  await expect(page.getByText('מערכת השעות של התלמיד/ה נשמרה')).toBeVisible();
  const lessons = await sql<{ day: string; period_index: number; name: string; owner: string }>(
    'select l.day, l.period_index, sp.name, sp.profile_id as owner from public.lessons l join public.subject_presets sp on sp.id = l.preset_id where l.profile_id = $1',
    [profileId],
  );
  expect(lessons).toEqual([{ day: 'wed', period_index: 1, name: 'פיזיקה', owner: profileId }]);

  // Editing a subject in use says where the change will appear.
  await page.getByRole('tab', { name: 'מקצועות' }).click();
  const physics = subjectCard(page, 'פיזיקה');
  await expect(physics).toContainText('משובץ בשיעור אחד');
  await physics.getByRole('button', { name: 'עריכה' }).click();
  await expect(page.getByRole('dialog')).toContainText(`משובץ בשיעור אחד במערכת של ${name}`);
  await page.getByRole('dialog').getByRole('button', { name: 'ביטול' }).click();

  // Removing it requires a choice for its lesson; replacing keeps the period filled.
  await physics.getByRole('button', { name: 'הסרה' }).click();
  const removal = page.getByRole('dialog', { name: 'הסרת „פיזיקה”' });
  await expect(removal.getByRole('alert')).toContainText('משובץ בשיעור אחד');
  await expect(removal.getByRole('button', { name: 'הסרה' })).toBeDisabled();
  await removal.getByRole('radio', { name: /להחליף אותם במקצוע אחר/ }).check();
  await expect(removal.getByRole('button', { name: 'הסרה' })).toBeDisabled();
  await removal.getByLabel('מקצוע חלופי').selectOption({ label: 'כימיה' });
  await removal.getByRole('button', { name: 'הסרה' }).click();
  await expect(page.getByText('„פיזיקה” הוסר והשיעורים שלו הוחלפו')).toBeVisible();
  await expect(physics).toHaveCount(0);
  expect(await sql('select day, period_index, preset_id from public.lessons where profile_id = $1', [profileId])).toEqual([
    { day: 'wed', period_index: 1, preset_id: chemistry },
  ]);

  // Hiding keeps the lesson and only removes the subject from the student's choices.
  await subjectCard(page, 'כימיה').getByRole('button', { name: 'הסרה' }).click();
  const hide = page.getByRole('dialog', { name: 'הסרת „כימיה”' });
  await hide.getByRole('radio', { name: /רק להסתיר מהבחירה/ }).check();
  await hide.getByRole('button', { name: 'הסתרה' }).click();
  await expect(subjectCard(page, 'כימיה')).toHaveCount(0);
  await page.getByRole('radio', { name: /מוסתרים/ }).click();
  await expect(subjectCard(page, 'כימיה')).toContainText('מוסתר מהבחירה');
  expect(await sql('select 1 from public.lessons where profile_id = $1', [profileId])).toHaveLength(1);
  // The other student was never touched.
  expect(await ownedPresets(other.profileId)).toHaveLength(1);
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
  // The template's subject became the student's own copy.
  expect(await ownedPresets(fresh.profileId)).toEqual([expect.objectContaining({ name: 'מתמטיקה' })]);
  expect(await ownedPresets(custom.profileId)).toEqual([]);
});

test('library presets can be created, edited and archived', async ({ page }) => {
  const name = `רובוטיקה ${uniqueDigits(4)}`;
  await signInAdmin(page);
  await page.getByRole('button', { name: 'מאגר' }).click();
  await expect(page.getByRole('heading', { name: 'מאגר מקצועות', level: 1 })).toBeVisible();
  await page.getByRole('button', { name: 'מקצוע חדש' }).click();
  const editor = page.getByRole('dialog', { name: 'מקצוע חדש במאגר' });
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
  // Library presets belong to no student.
  expect(await sql('select profile_id from public.subject_presets where name = $1', [name])).toEqual([{ profile_id: null }]);
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

test('the admin bar offers the theme choice and the whole panel follows it', async ({ page }) => {
  await signInAdmin(page);
  const css = (selector: string, property: string) =>
    page.locator(selector).first().evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), property);
  const choices = page.getByRole('radiogroup', { name: 'ערכת נושא' });
  await expect(choices.getByRole('radio', { name: 'ערכת נושא: כהה' })).toHaveAttribute('aria-checked', 'true');

  await choices.getByRole('radio', { name: 'ערכת נושא: בהיר' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(await css('nav[aria-label="אזורי ניהול"]', 'background-color')).toBe('rgb(255, 255, 255)');
  expect(await css('main input[type="search"]', 'background-color')).toBe('rgb(255, 255, 255)');
  expect(await css('main h1', 'color')).toBe('rgb(17, 20, 24)');

  // Remembered after a restart, and the forms and dialogs follow it too.
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: 'משתמש חדש' }).click();
  expect(await css('dialog[open] > div', 'background-color')).toBe('rgb(255, 255, 255)');
  await page.getByRole('dialog').getByRole('button', { name: 'ביטול' }).click();

  await choices.getByRole('radio', { name: 'ערכת נושא: כהה' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});
