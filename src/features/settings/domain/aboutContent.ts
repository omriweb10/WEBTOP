/**
 * The text of Settings → About: the one place that explains what the app is, how it
 * relates to the official WEBTOP system, and how sign-in and data storage work. The rest
 * of the interface stays free of such notes.
 */
import { APP_NAME } from '../../../config/branding';

export type AppMode = 'account' | 'local';

export interface AboutContent {
  /** What the app is. */
  intro: string;
  /** Its relation to the official WEBTOP system. */
  independence: string[];
  /** How sign-in, data and devices work in this build. */
  facts: string[];
}

const INSTALL_FACT = 'זו אפליקציית רשת (PWA) שמותקנת דרך „הוספה למסך הבית” — לא אפליקציה מה‑App Store.';

const FACTS: Record<AppMode, string[]> = {
  account: [
    'הכניסה היא בקוד גישה אישי שמנפיק מנהל האפליקציה. לעולם אל תזינו כאן סיסמה של WEBTOP או של מערכת בית־ספרית אחרת.',
    'מערכת השעות, ההודעות והאירועים נשמרים בשרת של האפליקציה ומוצגים רק לך. את רשימת המקצועות שלך מגדיר המנהל.',
    'כל קוד מחובר במכשיר אחד בכל רגע. החיבור נשמר — גם אחרי סגירה, הפעלה מחדש או חוסר פעילות — עד שתתנתקו או עד שהמנהל ינתק אותו.',
    'אם נתוני האתר יימחקו (למשל ניקוי נתוני Safari או הסרת האפליקציה ממסך הבית), יהיה צורך להתחבר מחדש; אם הקוד עדיין רשום כמחובר, המנהל יכול לנתק את החיבור הקודם.',
    INSTALL_FACT,
  ],
  local: [
    'אין התחברות ואין איסוף סיסמאות.',
    'מערכת השעות, ההודעות והאירועים נשמרים רק במכשיר הזה, באחסון של הדפדפן. מחיקת נתוני אתרים ב‑Safari או הסרת האפליקציה ממסך הבית עלולות למחוק אותם.',
    'לאפליקציה שנוספה למסך הבית יש אחסון נפרד מ‑Safari, ולכן גיבוי מייצאים ומייבאים מתוך האפליקציה עצמה (בכלי העריכה).',
    INSTALL_FACT,
  ],
};

/** About text for the build's mode (account = signed-in students, local = this device only). */
export function aboutContent(mode: AppMode): AboutContent {
  return {
    intro: `${APP_NAME} היא אפליקציה אישית ועצמאית להצגה ולעריכה של מערכת השעות, בעיצוב בהשראת WEBTOP.`,
    independence: [
      'זו אינה האפליקציה הרשמית של WEBTOP. היא אינה קשורה ל‑WEBTOP, ליצרנית שלה, למשרד החינוך או לבית ספר כלשהו, ואינה מייצגת אותם.',
      'שינויים שנעשים כאן אינם מסתנכרנים עם מערכת WEBTOP הרשמית, ושינויים במערכת הרשמית אינם מופיעים כאן.',
    ],
    facts: [...FACTS[mode]],
  };
}
