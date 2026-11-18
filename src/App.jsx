import { useCallback, useEffect, useMemo, useState } from 'react'
import { useI18n } from './i18n.jsx'
import { assignKeys, isQuestionActive, readBankFile } from './lib/bank.js'
import { countStatuses, lastStudiedKey, recordResult, removeFromSession, resetQuestion, skipCurrent, backToSkipped, startSession, summarizeSession } from './lib/queue.js'
import { buildBackup, createBank, DEFAULT_SETTINGS, downloadJson, downloadText, isValidBackup, libraryFromBackup, loadState, saveState } from './lib/storage.js'
import { parseCloze, serializeBank } from './lib/parser.js'
import EditorScreen from './screens/EditorScreen.jsx'
import HelpScreen from './screens/HelpScreen.jsx'
import { shuffle } from './lib/text.js'
import { buildChoice, DEFAULT_EXAM_SIZE, resolveExamSize } from './lib/exam.js'
import ConfirmModal from './components/ConfirmModal.jsx'
import AiPromptModal from './components/AiPromptModal.jsx'
import RenameModal from './components/RenameModal.jsx'
import Tooltip from './components/Tooltip.jsx'
import LanguageMenu from './components/LanguageMenu.jsx'
import HomeScreen from './screens/HomeScreen.jsx'
import SetupScreen from './screens/SetupScreen.jsx'
import StudyScreen from './screens/StudyScreen.jsx'
import SummaryScreen from './screens/SummaryScreen.jsx'
import ProgressScreen from './screens/ProgressScreen.jsx'
import DataScreen from './screens/DataScreen.jsx'
import ExamScreen, { ExamSummaryScreen } from './screens/ExamScreen.jsx'

const NO_QUESTIONS = []
const NO_PROGRESS = {}
const NO_TOPICS = []
// Full class names so Tailwind can find them when scanning the source.
const TOAST_CLASSES = { success: 'alert-success', error: 'alert-error', info: 'alert-info' }

export default function App() {
  const { t } = useI18n()
  const [library, setLibrary] = useState(loadState)
  const [view, setView] = useState('home')
  const [setupPurpose, setSetupPurpose] = useState('study')
  const [summary, setSummary] = useState(null)
  const [exam, setExam] = useState(null)
  const [modal, setModal] = useState(null) // { kind, payload }
  const [toast, setToast] = useState(null)

  useEffect(() => {
    if (!saveState(library)) setToast({ type: 'error', text: t('toast.saveFailed') })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [library])

  useEffect(() => {
    if (!toast) return undefined
    const id = setTimeout(() => setToast(null), 4500)
    return () => clearTimeout(id)
  }, [toast])

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [view])

  // Everything below works on the active bank.
  const active = library.banks.find((b) => b.id === library.activeId) || null
  const bank = active?.questions ?? NO_QUESTIONS
  const progress = active?.progress ?? NO_PROGRESS
  const settings = active?.settings ?? DEFAULT_SETTINGS
  const session = active?.session ?? null

  const updateActive = useCallback(
    (update) =>
      setLibrary((lib) => ({
        ...lib,
        banks: lib.banks.map((b) => (b.id === lib.activeId ? { ...b, ...update(b) } : b)),
      })),
    [],
  )

  const disabledTopics = active?.disabledTopics ?? NO_TOPICS
  // Deactivated questions (or topics) stay in the bank but are left out of sessions, reviews and exams.
  const activeQuestions = useMemo(() => bank.filter((q) => isQuestionActive(q, disabledTopics)), [bank, disabledTopics])
  const bankByKey = useMemo(() => new Map(bank.map((q) => [q.key, q])), [bank])
  const topics = useMemo(() => [...new Set(bank.map((q) => q.topic))], [bank])
  const studyTopics = useMemo(() => [...new Set(activeQuestions.map((q) => q.topic))], [activeQuestions])
  const topicCounts = useMemo(() => {
    const map = new Map()
    for (const q of activeQuestions) map.set(q.topic, (map.get(q.topic) || 0) + 1)
    return map
  }, [activeQuestions])
  const counts = useMemo(() => countStatuses(activeQuestions, progress), [activeQuestions, progress])
  const dueReviews = useMemo(() => {
    const now = new Date()
    return activeQuestions.filter((q) => {
      const p = progress[q.key]
      return p?.status === 'mastered' && (!p.nextReview || new Date(p.nextReview) <= now)
    }).length
  }, [activeQuestions, progress])

  const notify = (type, text) => setToast({ type, text })

  // ---- Study session ----
  const beginSession = (nextSettings, mode) => {
    const r = startSession(activeQuestions, progress, nextSettings, mode)
    if (!r.session.queue.length) {
      notify('info', mode === 'review' ? t('toast.nothingToReview') : t('toast.nothingToStudy'))
      updateActive(() => ({ settings: nextSettings }))
      setView('home')
      return
    }
    updateActive(() => ({ settings: nextSettings, progress: r.progress, session: r.session }))
    setView('study')
  }

  const finishSession = (finished) => {
    setSummary(summarizeSession(finished, bank))
    updateActive(() => ({ session: null }))
    setView('summary')
  }

  const handleResult = ({ result, response }) => {
    const r = recordResult(session, progress, result, response)
    if (!r.session.queue.length) {
      updateActive(() => ({ progress: r.progress }))
      finishSession(r.session)
      return
    }
    updateActive(() => ({ progress: r.progress, session: r.session }))
  }

  // ---- Progress of single questions ----
  const resetOne = (key) => {
    const r = resetQuestion(session, progress, key)
    updateActive(() => ({ progress: r.progress, session: r.session }))
    notify('success', t('toast.questionReset', { id: bankByKey.get(key)?.id ?? key }))
  }

  // ---- Editing questions ----
  // `fields` uses the editor shape: { topic, question, answer, keyPoints[], clozeRaw, hints[] }.
  const saveQuestion = (key, fields) => {
    const content = {
      topic: fields.topic.trim(),
      question: fields.question.trim(),
      answer: fields.answer.trim(),
      keyPoints: fields.keyPoints,
      cloze: parseCloze(fields.clozeRaw.trim()),
      hints: fields.hints,
    }
    // New questions take the next free number.
    const id = key ? bankByKey.get(key)?.id : Math.max(0, ...bank.map((q) => Number(q.id) || 0)) + 1
    updateActive((b) => {
      if (key) return { questions: b.questions.map((q) => (q.key === key ? { ...q, ...content } : q)) }
      const [created] = assignKeys([{ id, ...content }], new Set(b.questions.map((q) => q.key)))
      return { questions: [...b.questions, created] }
    })
    notify('success', t(key ? 'toast.questionSaved' : 'toast.questionAdded', { id }))
  }

  const deleteQuestion = (key) => {
    const id = bankByKey.get(key)?.id
    updateActive((b) => {
      const r = resetQuestion(b.session, b.progress, key)
      const { [key]: _removed, ...progressLeft } = r.progress
      return { questions: b.questions.filter((q) => q.key !== key), progress: progressLeft, session: r.session }
    })
    notify('success', t('toast.questionDeleted', { id }))
  }

  // Turning a question or a whole topic off takes it out of the current session; its progress is kept.
  const toggleQuestion = (key) => {
    const q = bankByKey.get(key)
    if (!q) return
    const disabling = !q.disabled
    updateActive((b) => ({
      questions: b.questions.map((x) => (x.key === key ? { ...x, disabled: disabling } : x)),
      session: disabling ? removeFromSession(b.session, b.progress, [key]) : b.session,
    }))
    notify('success', t(disabling ? 'toast.questionDisabled' : 'toast.questionEnabled', { id: q.id }))
  }

  const toggleTopic = (topic) => {
    const disabling = !disabledTopics.includes(topic)
    updateActive((b) => {
      const current = b.disabledTopics ?? []
      const keys = b.questions.filter((q) => q.topic === topic).map((q) => q.key)
      return {
        disabledTopics: disabling ? [...current, topic] : current.filter((x) => x !== topic),
        session: disabling ? removeFromSession(b.session, b.progress, keys) : b.session,
      }
    })
    notify('success', t(disabling ? 'toast.topicDisabled' : 'toast.topicEnabled', { topic }))
  }

  const downloadBank = () => {
    const base = (active?.name || 'banco').replace(/\.(md|txt|pdf)$/i, '')
    downloadText(`${base}.md`, serializeBank(bank))
  }

  // ---- Mock exam ----
  const beginExam = (examSettings) => {
    const mode = examSettings.examMode || 'write'
    const order = examSettings.examOrder || 'random'
    const pool = activeQuestions.filter((q) => !examSettings.topics || examSettings.topics.includes(q.topic))
    // The questions are always a random pick; 'bank' only shows them in the bank's numbering.
    const size = examSettings.examSize ?? DEFAULT_EXAM_SIZE
    let keys = shuffle(pool.map((q) => q.key)).slice(0, resolveExamSize(size, pool.length))
    if (order === 'bank') {
      const position = new Map(bank.map((q, i) => [q.key, i]))
      keys = keys.sort((a, b) => position.get(a) - position.get(b))
    }
    if (!keys.length) return notify('info', t('toast.nothingToStudy'))
    // Multiple choice: wrong options come from every active question of the bank, not only the chosen topics.
    if (mode === 'choice' && activeQuestions.length < 2) return notify('info', t('toast.choiceNeedsMore'))
    const options = mode === 'choice' ? Object.fromEntries(keys.map((k) => [k, buildChoice(bankByKey.get(k), activeQuestions)])) : null
    updateActive((b) => ({ settings: { ...b.settings, examMode: mode, examOrder: order, examSize: size } }))
    setExam({ keys, index: 0, results: [], topics: examSettings.topics, mode, order, size, options })
    setView('exam')
  }

  const answerExam = ({ result, ratio, response }) => {
    const key = exam.keys[exam.index]
    const results = [...exam.results, { key, result, ratio, response }]
    const done = exam.index + 1 >= exam.keys.length
    const skipped = (exam.skipped ?? []).filter((k) => k !== key)
    setExam({ ...exam, results, skipped, index: done ? exam.index : exam.index + 1 })
    if (done) setView('examSummary')
  }

  // Skipping moves the question to the end of the exam (and remembers it so you can go back to it);
  // the last one left is recorded as skipped.
  const skipExam = () => {
    if (exam.index >= exam.keys.length - 1) return answerExam({ result: 'skipped', ratio: 0, response: null })
    const keys = [...exam.keys]
    const [key] = keys.splice(exam.index, 1)
    const skipped = [...(exam.skipped ?? []).filter((k) => k !== key), key]
    setExam({ ...exam, keys: [...keys, key], skipped })
  }

  // The most recently skipped question still pending (after the current one), or null.
  const examSkippedKey = exam
    ? [...(exam.skipped ?? [])].reverse().find((k) => exam.keys.indexOf(k) > exam.index) ?? null
    : null

  // Brings that question back to the current position; the current one becomes the next.
  const backToSkippedExam = () => {
    if (!examSkippedKey) return
    const keys = exam.keys.filter((k) => k !== examSkippedKey)
    keys.splice(exam.index, 0, examSkippedKey)
    setExam({ ...exam, keys, skipped: exam.skipped.filter((k) => k !== examSkippedKey) })
  }

  // ---- Banks ----
  const switchBank = (id) => {
    setLibrary((lib) => ({ ...lib, activeId: id }))
    setExam(null)
    setSummary(null)
    setView('home')
  }

  const handleUpload = async (file) => {
    try {
      const parsed = await readBankFile(file)
      if (!parsed.questions.length) {
        notify('error', t('toast.noQuestionsFound'))
        return
      }
      // With no bank yet there is nothing to add to or replace.
      if (!active) applyUpload('new', { name: file.name, parsed })
      else setModal({ kind: 'upload', payload: { name: file.name, parsed } })
    } catch (err) {
      notify('error', err?.message === 'unsupportedFile' ? t('toast.unsupportedFile') : t('toast.readFailed'))
    }
  }

  const applyUpload = (mode, payload = modal.payload) => {
    const { name, parsed } = payload
    if (mode === 'new') {
      const created = createBank({ name, questions: assignKeys(parsed.questions), warnings: parsed.warnings })
      setLibrary((lib) => ({ banks: [...lib.banks, created], activeId: created.id }))
    } else if (mode === 'replace') {
      updateActive(() => ({ name, questions: assignKeys(parsed.questions), warnings: parsed.warnings, progress: {}, session: null, settings: DEFAULT_SETTINGS }))
    } else {
      updateActive((b) => ({
        name: `${b.name} + ${name}`,
        questions: [...b.questions, ...assignKeys(parsed.questions, new Set(b.questions.map((q) => q.key)))],
        warnings: [...(b.warnings || []), ...parsed.warnings],
      }))
    }
    setModal(null)
    setExam(null)
    setView('home')
    notify('success', t('toast.bankLoaded', { questions: parsed.questions.length, topics: parsed.topics.length }))
  }

  const renameBank = (name) => {
    updateActive(() => ({ name }))
    setModal(null)
  }

  const deleteBank = () => {
    setLibrary((lib) => {
      const banks = lib.banks.filter((b) => b.id !== lib.activeId)
      return { banks, activeId: banks[0]?.id ?? null }
    })
    setExam(null)
    setSummary(null)
    notify('success', t('toast.bankDeleted', { name: active?.name }))
  }

  // ---- Data ----
  const exportData = () => {
    const date = new Date().toISOString().slice(0, 10)
    downloadJson(`study-progress-${date}.json`, buildBackup(library))
  }

  const importData = async (file) => {
    try {
      const backup = JSON.parse(await file.text())
      if (!isValidBackup(backup)) throw new Error('invalid')
      setModal({ kind: 'import', payload: backup })
    } catch {
      notify('error', t('toast.importInvalid'))
    }
  }

  const confirmModal = () => {
    if (modal.kind === 'import') {
      setLibrary(libraryFromBackup(modal.payload))
      notify('success', t('toast.imported'))
    } else if (modal.kind === 'reset') {
      updateActive(() => ({ progress: {}, session: null }))
      notify('success', t('toast.resetDone'))
    } else if (modal.kind === 'deleteBank') {
      deleteBank()
    }
    // A reset keeps you where you were (home, progress or data); the rest change what is shown.
    if (modal.kind !== 'reset') setView('home')
    setModal(null)
  }

  const hasSession = !!session?.queue?.length

  const navItems = [
    { id: 'home', label: t('nav.home') },
    { id: 'progress', label: t('nav.progress') },
    { id: 'data', label: t('nav.data') },
    {
      id: 'help',
      label: t('nav.help'),
      icon: (
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17v.5" strokeLinecap="round" />
        </svg>
      ),
    },
  ]
  const activeNav = ['progress', 'data', 'help'].includes(view) ? view : 'home'

  return (
    <div className="min-h-dvh bg-base-200/50">
      <header className="navbar sticky top-0 z-20 border-b border-base-300 bg-base-100/95 px-2 backdrop-blur sm:px-4">
        <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center gap-2">
          <button type="button" className="mr-auto flex items-center gap-2 text-lg font-bold" onClick={() => setView('home')}>
            <span className="grid size-8 place-items-center rounded-field bg-primary text-primary-content">
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M4 19.5V5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2Zm0 0A2 2 0 0 0 6 22h13" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="hidden sm:inline">{t('app.title')}</span>
          </button>
          <nav className="flex items-center gap-1" aria-label={t('nav.label')}>
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`btn btn-sm gap-1.5 ${activeNav === item.id ? 'btn-active' : 'btn-ghost'}`}
                onClick={() => setView(item.id)}
                aria-label={item.icon ? item.label : undefined}
                title={item.icon ? item.label : undefined}
              >
                {item.icon}
                {/* Items with an icon show only the icon on phones. */}
                <span className={item.icon ? 'hidden sm:inline' : ''}>{item.label}</span>
              </button>
            ))}
          </nav>
          <LanguageMenu />
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl px-4 pb-48 pt-6">
        {view === 'home' && (
          <HomeScreen
            banks={library.banks}
            activeBank={active}
            topics={topics}
            disabledTopics={disabledTopics}
            inactiveCount={bank.length - activeQuestions.length}
            counts={counts}
            hasSession={hasSession}
            dueReviews={dueReviews}
            onSwitchBank={switchBank}
            onRenameBank={() => setModal({ kind: 'rename' })}
            onEditBank={() => setView('editor')}
            onDeleteBank={() => setModal({ kind: 'deleteBank' })}
            onUpload={handleUpload}
            onContinue={() => setView('study')}
            onNewSession={() => {
              setSetupPurpose('study')
              setView('setup')
            }}
            onReview={() => beginSession(settings, 'review')}
            onExam={() => {
              setSetupPurpose('exam')
              setView('setup')
            }}
            onStartOver={() => setModal({ kind: 'reset' })}
            onShowAiPrompt={() => setModal({ kind: 'aiPrompt' })}
            onShowHelp={() => setView('help')}
          />
        )}
        {view === 'setup' && (
          <SetupScreen
            purpose={setupPurpose}
            topics={studyTopics}
            topicCounts={topicCounts}
            settings={settings}
            hasSession={hasSession}
            onCancel={() => setView('home')}
            onStart={(s) => (setupPurpose === 'exam' ? beginExam(s) : beginSession(s, 'normal'))}
          />
        )}
        {view === 'study' && hasSession && (
          <StudyScreen
            key={library.activeId}
            session={session}
            bankByKey={bankByKey}
            counts={counts}
            onResult={handleResult}
            onSkip={() => updateActive((b) => ({ session: skipCurrent(b.session) }))}
            onBackToSkipped={() => updateActive((b) => ({ session: backToSkipped(b.session) }))}
            onFinish={() => finishSession(session)}
          />
        )}
        {view === 'study' && !hasSession && <EmptyState text={t('toast.nothingToStudy')} onHome={() => setView('home')} />}
        {view === 'summary' && summary && (
          <SummaryScreen
            summary={summary}
            counts={counts}
            onHome={() => setView('home')}
            onNewSession={() => {
              setSetupPurpose('study')
              setView('setup')
            }}
          />
        )}
        {view === 'progress' && (
          <ProgressScreen
            banks={library.banks}
            activeBank={active}
            bank={bank}
            topics={topics}
            disabledTopics={disabledTopics}
            progress={progress}
            lastKey={lastStudiedKey(progress)}
            onSwitchBank={(id) => {
              switchBank(id)
              setView('progress')
            }}
            onResetQuestion={resetOne}
            onResetAll={() => setModal({ kind: 'reset' })}
          />
        )}
        {view === 'help' && (
          <HelpScreen onShowAiPrompt={() => setModal({ kind: 'aiPrompt' })} onStart={() => setView('home')} />
        )}
        {view === 'editor' && active && (
          <EditorScreen
            key={library.activeId}
            bankName={active.name}
            bank={bank}
            topics={topics}
            disabledTopics={disabledTopics}
            onSave={saveQuestion}
            onDelete={deleteQuestion}
            onToggleQuestion={toggleQuestion}
            onToggleTopic={toggleTopic}
            onDownload={downloadBank}
            onBack={() => setView('home')}
          />
        )}
        {view === 'data' && (
          <DataScreen
            hasBank={!!active}
            onExport={exportData}
            onImport={importData}
            onReset={() => setModal({ kind: 'reset' })}
          />
        )}
        {view === 'exam' && exam && (
          <ExamScreen
            exam={exam}
            bankByKey={bankByKey}
            skippedKey={examSkippedKey}
            onAnswer={answerExam}
            onSkip={skipExam}
            onBackToSkipped={backToSkippedExam}
            onQuit={() => setView('home')}
          />
        )}
        {view === 'examSummary' && exam && (
          <ExamSummaryScreen
            exam={exam}
            bankByKey={bankByKey}
            onHome={() => setView('home')}
            onRetry={() => beginExam({ topics: exam.topics, examMode: exam.mode, examOrder: exam.order, examSize: exam.size })}
          />
        )}

        <p className="mt-10 hidden text-center text-xs opacity-50 sm:block">{t('app.shortcuts')}</p>
      </main>

      <ConfirmModal
        open={modal?.kind === 'upload'}
        title={t('modal.uploadTitle')}
        onClose={() => setModal(null)}
        actions={[
          { label: t('modal.replace'), className: 'btn-outline btn-error', onClick: () => applyUpload('replace') },
          { label: t('modal.append'), className: 'btn-outline', onClick: () => applyUpload('append') },
          { label: t('modal.newBank'), className: 'btn-primary', onClick: () => applyUpload('new') },
        ]}
      >
        {modal?.kind === 'upload' && (
          <div className="space-y-2">
            <p>
              <strong className="break-all">{modal.payload.name}</strong>:{' '}
              {t('home.summary', { questions: modal.payload.parsed.questions.length, topics: modal.payload.parsed.topics.length })}
            </p>
            {modal.payload.parsed.warnings.length > 0 && (
              <p className="text-sm text-warning">{t('home.warningsTitle', { count: modal.payload.parsed.warnings.length })}</p>
            )}
            <ul className="list-inside list-disc space-y-1 text-sm opacity-80">
              <li>{t('modal.newBankHelp')}</li>
              <li>{t('modal.appendHelp', { name: active?.name })}</li>
              <li>{t('modal.replaceHelp', { name: active?.name })}</li>
            </ul>
          </div>
        )}
      </ConfirmModal>

      <ConfirmModal
        open={['import', 'reset', 'deleteBank'].includes(modal?.kind)}
        title={modal ? t(`modal.${modal.kind}Title`) : ''}
        onClose={() => setModal(null)}
        actions={[{ label: t('common.confirm'), className: modal?.kind === 'import' ? 'btn-primary' : 'btn-error', onClick: confirmModal }]}
      >
        {modal && <p>{t(`modal.${modal.kind}Help`, { name: active?.name })}</p>}
      </ConfirmModal>

      <RenameModal open={modal?.kind === 'rename'} initialName={active?.name ?? ''} onSave={renameBank} onClose={() => setModal(null)} />
      <AiPromptModal open={modal?.kind === 'aiPrompt'} onClose={() => setModal(null)} />

      {toast && (
        <div className="toast toast-center toast-top z-50">
          <div role="status" className={`alert ${TOAST_CLASSES[toast.type]} flex items-center gap-2 py-2 pr-2 shadow-lg`}>
            <span className="flex-1">{toast.text}</span>
            <Tooltip text={t('common.close')} side="bottom">
              <button
                type="button"
                className="btn btn-ghost btn-sm btn-circle"
                onClick={() => setToast(null)}
                aria-label={t('common.close')}
              >
                <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                  <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
                </svg>
              </button>
            </Tooltip>
          </div>
        </div>
      )}
    </div>
  )
}

function EmptyState({ text, onHome }) {
  const { t } = useI18n()
  return (
    <div className="card border border-base-300 bg-base-100">
      <div className="card-body items-center text-center">
        <p>{text}</p>
        <button type="button" className="btn btn-primary" onClick={onHome}>
          {t('nav.home')}
        </button>
      </div>
    </div>
  )
}
