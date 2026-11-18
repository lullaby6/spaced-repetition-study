import { useI18n } from '../i18n.jsx'

export const CONTACT_EMAIL = 'lullaby6.t@gmail.com'

// What the app is, how to use it and who to contact.
export default function HelpScreen({ onShowAiPrompt, onStart }) {
  const { t } = useI18n()

  return (
    <div className="space-y-4">
      <Section title={t('help.title')}>
        <p>{t('help.intro')}</p>
      </Section>

      <Section title={t('help.startTitle')}>
        <ol className="list-inside list-decimal space-y-2">
          <li>
            {t('help.start1')}{' '}
            <button type="button" className="link link-primary" onClick={onShowAiPrompt}>
              {t('home.aiPrompt')}
            </button>
          </li>
          <li>{t('help.start2')}</li>
          <li>{t('help.start3')}</li>
          <li>{t('help.start4')}</li>
        </ol>
        <div>
          <button type="button" className="btn btn-primary btn-sm" onClick={onStart}>
            {t('help.goHome')}
          </button>
        </div>
      </Section>

      <Section title={t('help.stagesTitle')}>
        <p>{t('help.stagesIntro')}</p>
        <ol className="space-y-2">
          {[1, 2, 3, 4].map((n) => (
            <li key={n} className="flex gap-3">
              <span className="badge badge-primary badge-soft shrink-0">{n}</span>
              <span>
                <strong>{t(`stage.names.${n}`)}:</strong> {t(`help.stage${n}`)}
              </span>
            </li>
          ))}
        </ol>
        <p>{t('help.queue')}</p>
      </Section>

      <Section title={t('help.examTitle')}>
        <p>{t('help.exam')}</p>
      </Section>

      <Section title={t('listen.title')}>
        <p>{t('help.listen')}</p>
        <ul className="list-inside list-disc space-y-1">
          <li>{t('help.listenControls')}</li>
          <li>{t('help.listenOptions')}</li>
          <li>{t('help.listenSaved')}</li>
        </ul>
      </Section>

      <Section title={t('help.manageTitle')}>
        <ul className="list-inside list-disc space-y-1">
          <li>{t('help.manageBanks')}</li>
          <li>{t('help.manageEdit')}</li>
          <li>{t('help.manageProgress')}</li>
          <li>{t('help.manageData')}</li>
          <li>{t('help.manageTrash')}</li>
        </ul>
      </Section>

      <Section title={t('help.shortcutsTitle')}>
        <ul className="list-inside list-disc space-y-1">
          <li>
            <kbd className="kbd kbd-sm">Enter</kbd> {t('help.keyEnter')}
          </li>
          <li>
            <kbd className="kbd kbd-sm">Ctrl+Enter</kbd> {t('help.keyCtrlEnter')}
          </li>
          <li>
            <kbd className="kbd kbd-sm">1</kbd>–<kbd className="kbd kbd-sm">4</kbd> {t('help.keyDigits')}
          </li>
          <li>
            <kbd className="kbd kbd-sm">Alt+P</kbd> / <kbd className="kbd kbd-sm">Alt+R</kbd> / <kbd className="kbd kbd-sm">Alt+O</kbd> {t('help.keyAlt')}
          </li>
        </ul>
      </Section>

      <Section title={t('help.contactTitle')}>
        <p>
          {t('help.contact')}{' '}
          <a className="link link-primary font-medium" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
        </p>
      </Section>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <section className="card border border-base-300 bg-base-100 shadow-sm">
      <div className="card-body gap-3 p-4 sm:p-6">
        <h2 className="card-title">{title}</h2>
        {children}
      </div>
    </section>
  )
}
