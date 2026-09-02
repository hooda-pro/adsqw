// public/cloudinary-client-config.js
// دي بيانات "رفع بدون توقيع" (Unsigned Upload) بتاعت Cloudinary — مش سرية،
// طبيعي إنها تكون ظاهرة في كود الفرونت إند (زي firebase-client-config.js
// بالظبط). الحماية الحقيقية موجودة في إعدادات الـ Upload Preset نفسه
// (الصيغ المسموحة، الحجم الأقصى) اللي بتظبطها من لوحة تحكم Cloudinary،
// مش في إخفاء القيم دي.

window.CLOUDINARY_CONFIG = {
  cloudName: 'vntoew1o',
  uploadPreset: 'malg_chat_media', // لازم تعمل Upload Preset بنفس الاسم ده (Unsigned) — شوف الجزء 8.6 في SETUP-GUIDE.md
};
