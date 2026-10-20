/**
 * Admin → user → מקצועות → "ייבוא מקצועות מטקסט": pasted subjects are created for that student
 * only, duplicates are skipped or updated on request, problems keep the text, and the
 * student can pick the new subjects in their own timetable editor.
 */
import { expect, test, type Page } from '@playwright/test';
import { adminClient, createStudent, createUserPreset, signInAdmin, signInStudent, sql, stackAvailable, uniqueDigits, unlockEditMode, dayTable } from './helpers';

test.skip(!stackAvailable, 'needs the local stack (npm run stack)');

/** Opens a student's subjects tab. */
async function openSubjects(page: Page, name: string): Promise<void> {
  await page.getByRole('navigation', { name: 'אזורי ניהול' }).getByRole('button', { name: 'משתמשים', exact: true }).click();
  await page.getByRole('searchbox', { name: 'חיפוש משתמשים' }).fill(name);
  await page.getByRole('button', { name: new RegExp(name) }).first().click();
  await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible();
  await page.getByRole('tab', { name: 'מקצועות' }).click();
}

/** The import dialog. */
const importDialog = (page: Page) => page.getByRole('dialog', { name: 'ייבוא מקצועות מטקסט' });

/** A student's presets as stored. */
async function presetsOf(profileId: string) {
  return sql<{ name: string; teacher: string; room: string; color: string; archived: boolean }>(
    'select name, teacher, room, color, archived_at is not null as archived from public.subject_presets where profile_id = $1 order by name',
    [profileId],
  );
}

/** A student's lessons as stored. */
async function lessonsOf(profileId: string) {
  return sql('select day, period_index, preset_id from public.lessons where profile_id = $1 order by day, period_index', [profileId]);
}

test('imports pasted subjects for the selected student only, after the text is corrected', async ({ page }) => {
  const tag = uniqueDigits(5);
  const a = await createStudent({ display_name: `יבוא א ${tag}`, class_name: "י' 3" });
  const b = await createStudent({ display_name: `יבוא ב ${tag}` });
  const admin = await adminClient();
  const mathA = await createUserPreset(a.profileId, { name: 'מתמטיקה', teacher: 'ישראל כהן', room: '201', color: '#1498fd' });
  const mathB = await createUserPreset(b.profileId, { name: 'מתמטיקה', teacher: 'מיכאל', room: '302', color: '#1498fd' });
  await admin.rpc('admin_save_user_lessons', { p_profile_id: a.profileId, p_changes: [{ day: 'sun', period_index: 0, preset_id: mathA }] });
  await admin.rpc('admin_save_user_lessons', { p_profile_id: b.profileId, p_changes: [{ day: 'mon', period_index: 2, preset_id: mathB }] });
  const lessonsA = await lessonsOf(a.profileId);
  const presetsB = await presetsOf(b.profileId);
  const lessonsB = await lessonsOf(b.profileId);

  await signInAdmin(page);
  await openSubjects(page, `יבוא א ${tag}`);
  await page.getByRole('button', { name: 'ייבוא מקצועות מטקסט' }).click();
  const dialog = importDialog(page);
  await expect(dialog).toContainText(`המקצועות יתווספו רק ליבוא א ${tag} (י' 3)`);
  const editor = dialog.getByLabel('טקסט המקצועות');
  const create = dialog.getByRole('button', { name: 'צור מקצועות' });

  // A missing field and an unknown colour: listed per subject, nothing can be imported.
  const broken = [
    'מקצוע : מתמטיקה\nשם מורה : ישראל כהן\nחדר : 201\nצבע : #1498FD',
    'מקצוע:אנגלית\nשם מורה:דנה לוי\nצבע:#999A9D',
    'מקצוע  :  היסטוריה\nשם  מורה :  משה לוי\nחדר : 203\nצבע : זהב',
  ].join('\n\n');
  await editor.fill(broken);
  await expect(dialog.getByRole('status', { name: 'סיכום הייבוא' })).toContainText('1 מתוך 3 מקצועות תקינים');
  await expect(dialog).toContainText('מקצוע 2 · אנגלית: חסר השדה „חדר”.');
  await expect(dialog).toContainText('מקצוע 3 · היסטוריה: הצבע „זהב” אינו מוכר.');
  await expect(create).toBeDisabled();

  // Correct the text in place (nothing was lost) and add two subjects with Hebrew colour names.
  await editor.fill(
    `${broken.replace('צבע:#999A9D', 'חדר : 104\nצבע:#999A9D').replace('צבע : זהב', 'צבע : סגול')}\n\n\nמקצוע : כימיה\nשם מורה : רחל\nחדר : מעבדה 2\nצבע : ירוק\n\nמקצוע : ספורט\nשם מורה : דן\nחדר :\nצבע : טורקיז`,
  );
  const summary = dialog.getByRole('status', { name: 'סיכום הייבוא' });
  await expect(summary).toContainText('זוהו 5 מקצועות');
  await expect(summary).toContainText('ייווצרו 4');
  await expect(summary).toContainText('ידולגו 1');
  await expect(dialog).toContainText(`מקצוע אחד כבר קיים אצל יבוא א ${tag} עם אותם פרטים וידולגו.`);
  await create.click();
  await expect(page.getByText('4 מקצועות נוספו בהצלחה.')).toBeVisible();
  await expect(dialog).toHaveCount(0);
  for (const name of ['אנגלית', 'היסטוריה', 'כימיה', 'ספורט']) {
    await expect(page.getByRole('listitem').filter({ has: page.getByRole('heading', { name, exact: true, level: 3 }) })).toBeVisible();
  }

  // Stored for A only, colours normalised; A's lessons, B's subjects and lessons untouched.
  expect(await presetsOf(a.profileId)).toEqual([
    { name: 'אנגלית', teacher: 'דנה לוי', room: '104', color: '#999a9d', archived: false },
    { name: 'היסטוריה', teacher: 'משה לוי', room: '203', color: '#8e44ad', archived: false },
    { name: 'כימיה', teacher: 'רחל', room: 'מעבדה 2', color: '#259e3b', archived: false },
    { name: 'מתמטיקה', teacher: 'ישראל כהן', room: '201', color: '#1498fd', archived: false },
    { name: 'ספורט', teacher: 'דן', room: '', color: '#04b9d4', archived: false },
  ]);
  expect(await lessonsOf(a.profileId)).toEqual(lessonsA);
  expect(await presetsOf(b.profileId)).toEqual(presetsB);
  expect(await lessonsOf(b.profileId)).toEqual(lessonsB);
});

test('existing subjects are skipped unless the admin explicitly chooses to update them', async ({ page }) => {
  const tag = uniqueDigits(5);
  const a = await createStudent({ display_name: `כפילויות ${tag}` });
  await createUserPreset(a.profileId, { name: 'אנגלית', teacher: 'מורה ישנה', room: '104', color: '#999a9d' });
  const hidden = await createUserPreset(a.profileId, { name: 'לשון', teacher: 'כהן', room: '207', color: '#f4490c' });
  await sql('update public.subject_presets set archived_at = now() where id = $1', [hidden]);
  const text = 'מקצוע : אנגלית\nשם מורה : דנה לוי\nחדר : 104\nצבע : אפור\n\nמקצוע : לשון\nשם מורה : כהן\nחדר : 207\nצבע : #F4490C';

  await signInAdmin(page);
  await openSubjects(page, `כפילויות ${tag}`);
  await page.getByRole('button', { name: 'ייבוא מקצועות מטקסט' }).click();
  const dialog = importDialog(page);
  await dialog.getByLabel('טקסט המקצועות').fill(text);
  const summary = dialog.getByRole('status', { name: 'סיכום הייבוא' });
  await expect(summary).toContainText('ידולגו 2');
  await expect(dialog).toContainText('2 מקצועות כבר קיימים אצל');
  await expect(dialog).toContainText('אנגלית — מורה: מורה ישנה ← דנה לוי');
  await expect(dialog).toContainText('לשון — מצב: מוסתר ← זמין לבחירה');
  // Nothing new to create while skipping: the button stays off and nothing changes.
  await expect(dialog.getByRole('button', { name: 'צור מקצועות' })).toBeDisabled();

  await dialog.getByRole('radio', { name: /לעדכן אותם לפי הטקסט/ }).check();
  await expect(summary).toContainText('יעודכנו 2');
  await dialog.getByRole('button', { name: 'צור מקצועות' }).click();
  await expect(page.getByText('2 מקצועות עודכנו.')).toBeVisible();
  expect(await presetsOf(a.profileId)).toEqual([
    { name: 'אנגלית', teacher: 'דנה לוי', room: '104', color: '#999a9d', archived: false },
    { name: 'לשון', teacher: 'כהן', room: '207', color: '#f4490c', archived: false },
  ]);
});

test('the student picks imported subjects in their own timetable editor, details filled in', async ({ page, browser }) => {
  const tag = uniqueDigits(5);
  const { code, profileId } = await createStudent({ display_name: `תלמידה ${tag}` });
  await signInAdmin(page);
  await openSubjects(page, `תלמידה ${tag}`);
  await page.getByRole('button', { name: 'ייבוא מקצועות מטקסט' }).click();
  await importDialog(page).getByLabel('טקסט המקצועות').fill('מקצוע : פיזיקה\nשם מורה : אבי כהן\nחדר : 12\nצבע : כתום');
  await importDialog(page).getByRole('button', { name: 'צור מקצועות' }).click();
  await expect(page.getByText('מקצוע אחד נוסף בהצלחה.')).toBeVisible();
  expect(await lessonsOf(profileId)).toEqual([]);

  const student = await (await browser.newContext()).newPage();
  await signInStudent(student, code);
  await unlockEditMode(student);
  await dayTable(student).getByRole('button').first().click();
  const editor = student.getByRole('dialog');
  await editor.getByRole('radio', { name: 'פיזיקה' }).click();
  await expect(editor).toContainText('אבי כהן');
  await expect(editor).toContainText('חדר: 12');
  await editor.getByRole('button', { name: 'שמירה' }).click();
  await expect(dayTable(student)).toContainText('פיזיקה');
  await expect.poll(async () => (await lessonsOf(profileId)).length).toBe(1);
});

test('the notepad editor follows the light and dark themes with readable text', async ({ page }) => {
  const tag = uniqueDigits(5);
  await createStudent({ display_name: `עיצוב ${tag}` });
  await signInAdmin(page);
  await openSubjects(page, `עיצוב ${tag}`);
  const colours = async () =>
    importDialog(page)
      .getByLabel('טקסט המקצועות')
      .evaluate((el) => {
        /** Relative luminance of an rgb() colour (WCAG). */
        const lum = (css: string) => {
          const [r, g, b] = (css.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map((v) => {
            const c = Number(v) / 255;
            return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
          });
          return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
        };
        const text = getComputedStyle(el).color;
        const paper = getComputedStyle(el.parentElement as Element).backgroundColor;
        const [hi, lo] = [lum(text), lum(paper)].sort((x, y) => y - x);
        return { text, paper, contrast: ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05) };
      });
  const results = [];
  for (const theme of ['בהיר', 'כהה'] as const) {
    await page.getByRole('radio', { name: `ערכת נושא: ${theme}` }).click();
    await page.getByRole('button', { name: 'ייבוא מקצועות מטקסט' }).click();
    results.push(await colours());
    await importDialog(page).getByRole('button', { name: 'ביטול' }).click();
  }
  expect(results[0]?.paper).not.toBe(results[1]?.paper);
  for (const result of results) expect(result.contrast).toBeGreaterThanOrEqual(7);
});
