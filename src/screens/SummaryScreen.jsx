import { useI18n } from '../i18n.jsx'
import StatusBar from '../components/StatusBar.jsx'
import { InfoTip } from '../components/Tooltip.jsx'

// End-of-session summary: mastered questions, the hardest ones and the weakest topics.
export default function SummaryScreen({ summary, counts, onHome, onNewSession }) {
  const { t } = useI18n()
  return (
    <div className="space-y-4">
      <div className="card border border-base-300 bg-base-100 shadow-sm">
        <div className="card-body gap-4 p-4 sm:p-6">
          <h2 className="card-title">{t('summary.title')}</h2>
          <div className="stats stats-vertical w-full border border-base-300 sm:stats-horizontal">
            <div className="stat">
              <div className="stat-title">{t('summary.exercises')}</div>
              <div className="stat-value">{summary.exercises}</div>
            </div>
            <div className="stat">
              <div className="stat-title">{t('summary.mastered')}</div>
              <div className="stat-value text-success">{summary.mastered.length}</div>
            </div>
          </div>
          <StatusBar counts={counts} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryList title={t('summary.masteredList')} empty={t('summary.noneMastered')}>
          {summary.mastered.map((q) => (
            <li key={q.key}>
              <strong>{q.id}.</strong> {q.question}
            </li>
          ))}
        </SummaryList>
        <SummaryList title={t('summary.hardest')} info={t('info.hardest')} empty={t('summary.noneHard')}>
          {summary.hardest.map(({ question }) => (
            <li key={question.key}>
              <strong>{question.id}.</strong> {question.question}
            </li>
          ))}
        </SummaryList>
        <SummaryList title={t('summary.weakTopics')} info={t('info.weakTopics')} empty={t('summary.noneWeak')}>
          {summary.weakTopics.map((topic) => (
            <li key={topic.topic}>
              {topic.topic}{' '}
              <span className="opacity-60">{t('summary.missRate', { pct: Math.round(topic.rate * 100) })}</span>
            </li>
          ))}
        </SummaryList>
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" className="btn btn-ghost" onClick={onHome}>
          {t('nav.home')}
        </button>
        <button type="button" className="btn btn-primary" onClick={onNewSession}>
          {t('home.newSession')}
        </button>
      </div>
    </div>
  )
}

function SummaryList({ title, info, empty, children }) {
  const hasItems = Array.isArray(children) ? children.length > 0 : !!children
  return (
    <section className="card border border-base-300 bg-base-100">
      <div className="card-body p-4">
        <h3 className="font-semibold">
          {title} {info && <InfoTip text={info} />}
        </h3>
        {hasItems ? <ul className="space-y-2 text-sm">{children}</ul> : <p className="text-sm opacity-60">{empty}</p>}
      </div>
    </section>
  )
}
