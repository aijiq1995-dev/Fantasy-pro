/* =========================================================
   إعدادات التطبيق — عدّل هذا الملف فقط
   ---------------------------------------------------------
   1) انسخ إعدادات Firebase من:
      Firebase Console ← Project settings ← Your apps ← Web app ← SDK setup and configuration
   2) فعّل طرق الدخول من: Authentication ← Sign-in method
   3) إذا تركت apiKey فارغاً يشتغل التطبيق بـ"وضع التجربة" بدون Firebase
========================================================= */
export const CONFIG = {
  appName: 'فانتازي برو',

  firebase: {
    apiKey: '',            // مثال: 'AIzaSy...'
    authDomain: '',        // مثال: 'fantasy-pro-123.firebaseapp.com'
    projectId: '',         // مثال: 'fantasy-pro-123'
    appId: '',             // مثال: '1:1234567890:web:abc123'
  },

  // طرق الدخول الظاهرة بشاشة الدخول (لازم تفعّلها أيضاً داخل Firebase)
  providers: {
    google: true,
    apple: true,      // يحتاج حساب Apple Developer
    facebook: true,   // يحتاج تطبيق على Meta for Developers
    x: true,          // يحتاج مفاتيح من X Developer Portal
  },

  // المدرب الذكي: يشتغل إذا ضفت ANTHROPIC_API_KEY بإعدادات Vercel
  aiCoach: true,
};
