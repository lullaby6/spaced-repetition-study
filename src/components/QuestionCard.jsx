import { useI18n } from '../i18n.jsx'
import { InfoTip } from './Tooltip.jsx'

// Exercise frame: question number, topic, stage label and the question itself.
export default function QuestionCard({ question, stage, badges = null, children }) {
  const { t } = useI18n()
  return (
    <article className="card border border-base-300 bg-base-100 shadow-sm">
      <div className="card-body gap-4 p-4 sm:p-6">
        <header className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold">{t('exercise.questionNumber', { id: question.id })}</span>
            <span className="opacity-40">·</span>
            <span className="opacity-70">{question.topic}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {stage && (
              <span className="badge badge-primary badge-soft">
                {t('stage.label', { stage, name: t(`stage.names.${stage}`) })}
              </span>
            )}
            {badges}
            {stage && <InfoTip text={t('info.stage')} />}
          </div>
          <h2 className="text-xl font-bold leading-snug text-balance sm:text-2xl">{question.question}</h2>
        </header>
        {children}
      </div>
    </article>
  )
}
