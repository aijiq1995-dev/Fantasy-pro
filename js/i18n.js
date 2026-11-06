/* ترجمة الواجهة: العربية (RTL) والإنجليزية (LTR) */
const D = {
  ar: {
    home: 'الرئيسية', team: 'فريقي', players: 'اللاعبين', live: 'المباشر', more: 'المزيد', market: 'سوق الانتقالات',
    compare: 'مقارنة اللاعبين', defcon: 'المساهمات الدفاعية', news: 'مركز الأخبار', leagues: 'الدوريات', chips: 'الأوراق والاستراتيجية', stats: 'التحليلات', notifs: 'الإشعارات',
    achievements: 'الإنجازات', coach: 'المدرب الذكي', admin: 'لوحة الإدارة', settings: 'الإعدادات', search: 'المساعد الذكي', season: 'الجولات', lab: 'مختبر القرارات', prices: 'توقع الأسعار', captains: 'نسبة الكبتنة', g_main: 'الأساسي', g_players: 'اللاعبين والسوق', g_comp: 'المنافسة', g_more: 'المزيد',
    gw: 'الجولة', points: 'نقطة', pts: 'نقاط', total: 'المجموع', rank: 'الترتيب', overall: 'الترتيب العام', avg: 'المعدل', highest: 'الأعلى',
    deadline: 'الموعد النهائي', bank: 'البنك', value: 'القيمة', ft: 'انتقالات مجانية', price: 'السعر', form: 'الفورم', own: 'الملكية',
    gk: 'حارس', def: 'مدافع', mid: 'وسط', fwd: 'مهاجم', all: 'الكل', save: 'حفظ', cancel: 'إلغاء', close: 'إغلاق', back: 'رجوع',
    captain: 'كابتن', vice: 'نائب', bench: 'الدكة', xi: 'الأساسيين', formation: 'التشكيل', transfers: 'الانتقالات', fixtures: 'المباريات',
    days: 'يوم', hours: 'ساعة', mins: 'دقيقة', secs: 'ثانية', updated: 'آخر تحديث', refresh: 'تحديث', logout: 'تسجيل الخروج',
    watchlist: 'قائمة المراقبة', loading: 'جارِ التحميل…', noData: 'ما متوفرة بيانات', home_s: 'د', away_s: 'خ', minutes: 'دقائق',
    goals: 'أهداف', assists: 'صناعة', cs: 'شباك نظيفة', bonus: 'بونص', yc: 'صفراء', rc: 'حمراء', starts: 'مشاركات أساسي',
    sortBy: 'ترتيب حسب', filter: 'فلترة', club: 'النادي', position: 'المركز', maxPrice: 'السعر الأعلى', lang: 'اللغة',
  },
  en: {
    home: 'Home', team: 'My Team', players: 'Players', live: 'Live', more: 'More', market: 'Transfer Market',
    compare: 'Compare', defcon: 'DefCon', news: 'News', leagues: 'Leagues', chips: 'Chips & Strategy', stats: 'Analytics', notifs: 'Notifications',
    achievements: 'Achievements', coach: 'AI Coach', admin: 'Admin', settings: 'Settings', search: 'Smart assistant', season: 'Gameweeks', lab: 'Decision lab', prices: 'Price predictor', captains: 'Captaincy', g_main: 'Main', g_players: 'Players & market', g_comp: 'Competition', g_more: 'More',
    gw: 'GW', points: 'pts', pts: 'Points', total: 'Total', rank: 'Rank', overall: 'Overall rank', avg: 'Average', highest: 'Highest',
    deadline: 'Deadline', bank: 'Bank', value: 'Value', ft: 'Free transfers', price: 'Price', form: 'Form', own: 'Owned',
    gk: 'GK', def: 'DEF', mid: 'MID', fwd: 'FWD', all: 'All', save: 'Save', cancel: 'Cancel', close: 'Close', back: 'Back',
    captain: 'Captain', vice: 'Vice', bench: 'Bench', xi: 'Starting XI', formation: 'Formation', transfers: 'Transfers', fixtures: 'Fixtures',
    days: 'days', hours: 'hrs', mins: 'min', secs: 'sec', updated: 'Last updated', refresh: 'Refresh', logout: 'Log out',
    watchlist: 'Watchlist', loading: 'Loading…', noData: 'No data', home_s: 'H', away_s: 'A', minutes: 'Minutes',
    goals: 'Goals', assists: 'Assists', cs: 'Clean sheets', bonus: 'Bonus', yc: 'Yellow', rc: 'Red', starts: 'Starts',
    sortBy: 'Sort by', filter: 'Filter', club: 'Club', position: 'Position', maxPrice: 'Max price', lang: 'Language',
  },
};
let LANG = (() => { try { return localStorage.getItem('fp_lang') || 'ar'; } catch { return 'ar'; } })();
export const t = (k) => (D[LANG] && D[LANG][k]) || D.ar[k] || k;
export const lang = () => LANG;
/** نص بلغتين: tt('عربي','English') */
export const tt = (ar, en) => (LANG === 'en' ? en : ar);
export function setLang(l) {
  LANG = l === 'en' ? 'en' : 'ar';
  try { localStorage.setItem('fp_lang', LANG); } catch {}
  applyDir();
}
export function applyDir() { document.documentElement.lang = LANG; document.documentElement.dir = LANG === 'en' ? 'ltr' : 'rtl'; }
