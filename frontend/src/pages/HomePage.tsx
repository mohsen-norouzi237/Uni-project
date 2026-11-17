import { useTranslation } from 'react-i18next'

export default function HomePage() {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <h1 className="text-3xl font-bold text-slate-800 mb-4">
        {t('appName')}
      </h1>
      <p className="text-slate-600">
        {t('welcome')}
      </p>
    </div>
  )
}