/* ترجمة أخبار الفانتازي الرسمية (حقل news) للعربي — قواعد ثابتة بدون ذكاء اصطناعي
   مشترك بين الواجهة والسيرفر (الإشعارات) */
const INJ = {
  hamstring: 'الفخذ الخلفية', knee: 'الركبة', ankle: 'الكاحل', groin: 'الفخذ الداخلية (العانة)', calf: 'بطة الساق', thigh: 'الفخذ', back: 'الظهر', foot: 'القدم',
  shoulder: 'الكتف', muscle: 'عضلية', achilles: 'وتر أخيل', hip: 'الورك', head: 'الرأس', toe: 'إصبع القدم', heel: 'الكعب', quad: 'الفخذ الأمامية', quadriceps: 'الفخذ الأمامية',
  adductor: 'العضلة المقرّبة', abdominal: 'البطن', rib: 'الضلع', wrist: 'الرسغ', hand: 'اليد', arm: 'الذراع', leg: 'الساق', shin: 'قصبة الساق', neck: 'الرقبة', facial: 'الوجه',
  elbow: 'الكوع', finger: 'الإصبع', chest: 'الصدر', lower: 'أسفل', upper: 'أعلى', 'cruciate ligament': 'الرباط الصليبي', ligament: 'الرباط', metatarsal: 'مشط القدم', pelvic: 'الحوض', eye: 'العين',
};
const MON = { Jan: 'يناير', Feb: 'فبراير', Mar: 'مارس', Apr: 'أبريل', May: 'مايو', Jun: 'يونيو', Jul: 'يوليو', Aug: 'أغسطس', Sep: 'سبتمبر', Oct: 'أكتوبر', Nov: 'نوفمبر', Dec: 'ديسمبر' };
const date = (s) => s.replace(/(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*/g, (_, d, m) => `${d} ${MON[m]}`);

function part(raw) {
  let s = raw.trim(); const l = s.toLowerCase();
  let m;
  if ((m = l.match(/^(\d{1,3})% chance of playing$/))) return `احتمال مشاركته ${m[1]}%`;
  if ((m = s.match(/^expected back (.+)$/i))) return `متوقع يرجع ${date(m[1])}`;
  if (/^unknown return date$/i.test(s)) return 'موعد رجوعه غير معروف';
  if ((m = s.match(/^suspended until (.+)$/i))) return `موقوف لحد ${date(m[1])}`;
  if ((m = s.match(/^suspended for (\d+) (?:match|game)e?s?$/i))) return `موقوف ${m[1]} مباريات`;
  if (/^suspended$/i.test(s)) return 'موقوف';
  if ((m = s.match(/^(?:has )?joined (.+?) on (?:a )?(?:season-long |permanent )?loan.*$/i))) return `انضم إلى ${m[1]} على سبيل الإعارة`;
  if ((m = s.match(/^(?:has )?joined (.+?)(?: on a permanent (?:deal|transfer))?\.?$/i))) return `انضم إلى ${m[1]}`;
  if ((m = s.match(/^(?:has been )?transferred to (.+)$/i))) return `انتقل إلى ${m[1]}`;
  if (/^left the club/i.test(s)) return 'غادر النادي';
  if (/^illness$/i.test(s)) return 'مريض';
  if (/^knock$/i.test(s)) return 'ضربة خفيفة';
  if (/^personal reasons$/i.test(s)) return 'ظروف شخصية';
  if (/^not included in .*squad/i.test(s)) return 'غير مسجّل بقائمة الفريق';
  if (/^lack of match fitness$/i.test(s)) return 'نقص الجاهزية البدنية';
  if (/^international duty$/i.test(s)) return 'مع المنتخب';
  if (/^on loan/i.test(s)) return 'معار';
  if ((m = l.match(/^(.+?) (injury|problem|issue|strain|knock|fracture)$/))) {
    const where = m[1].split(/\s+/).map((w) => INJ[w] || w).join(' ');
    const kind = { injury: 'إصابة', problem: 'مشكلة', issue: 'مشكلة', strain: 'شد', knock: 'ضربة', fracture: 'كسر' }[m[2]];
    return `${kind} ${INJ[m[1]] || where}`;
  }
  if (INJ[l]) return `إصابة ${INJ[l]}`;
  return null;
}
/** يرجّع الترجمة العربية أو null إذا ما انفهم */
export function newsAr(raw) {
  if (!raw) return '';
  const parts = raw.split(/\s+-\s+/).map(part);
  if (parts.some((p) => p === null)) { const ok = parts.filter(Boolean); return ok.length ? ok.join(' — ') : null; }
  return parts.join(' — ');
}
