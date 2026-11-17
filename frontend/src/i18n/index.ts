import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

const resources = {
  fa: {
    translation: {
      appName: 'سامانه مدیریت دستیاران آموزشی (TAMS)',
      welcome: 'خوش آمدید. زیرساخت پروژه، روتینگ و پوسته اولیه با موفقیت راه‌اندازی شد.',
      notFoundTitle: 'صفحه مورد نظر یافت نشد!',
      notFoundDesc: 'آدرسی که وارد کرده‌اید وجود ندارد یا منتقل شده است.',
      backHome: 'بازگشت به صفحه اصلی',
    },
  },
}

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'fa',
    fallbackLng: 'fa',
    interpolation: {
      escapeValue: false,
    },
  })

export default i18n
