import { useMemo, useRef, useState } from 'react'
import { useI18n } from '../i18n.jsx'
import { clozeToRaw, missingFields, parseCloze } from '../lib/parser.js'
import { normalize } from '../lib/text.js'
import { isQuestionActive } from '../lib/bank.js'
import Tooltip, { InfoTip } from '../components/Tooltip.jsx'

const toLines = (text) =>
  text
    .split('\n')
    .map((l) => l.replace(/^\s*(?:-|•|–)\s*/, '').trim())
    .filter(Boolean)

function formFrom(question) {
  return {
    topic: question?.topic ?? '',
    question: question?.question ?? '',
    answer: question?.answer ?? '',
    keyPoints: (question?.keyPoints ?? []).join('\n'),
    clozeRaw: question ? clozeToRaw(question.cloze) : '',
    hints: (question?.hints ?? []).join('\n'),
  }
}

// Editor for the active bank: edit every field of a question, add new ones, delete them, and turn
// questions or whole topics on and off (off = kept, but left out of sessions, reviews and exams).
export default function EditorScreen({
  bankName,
  bank,
  topics,
  disabledTopics,
  onSave,
  onDelete,
  onToggleQuestion,
  onToggleTopic,
  onDownload,
  onBack,
}) {
  const { t } = useI18n()
  const [search, setSearch] = useState('')
  const [topic, setTopic] = useState('')
  const [state, setState] = useState('') // '' | 'active' | 'inactive'
  const [editing, setEditing] = useState(null) // question key, 'new', or null
  const [confirmDelete, setConfirmDelete] = useState(null)

  const rows = useMemo(() => {
    const needle = normalize(search)
    return bank.filter((q) => {
      const active = isQuestionActive(q, disabledTopics)
      return (
        (!topic || q.topic === topic) &&
        (!state || (state === 'active') === active) &&
        (!needle || normalize(`${q.id} ${q.question} ${q.answer} ${q.topic}`).includes(needle))
      )
    })
  }, [bank, disabledTopics, search, topic, state])

  const perTopic = (tp) => bank.filter((q) => q.topic === tp).length
  const activeCount = bank.filter((q) => isQuestionActive(q, disabledTopics)).length

  return (
    <div className="space-y-4">
      <div className="card border border-base-300 bg-base-100 shadow-sm">
        <div className="card-body gap-4 p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="card-title">{t('editor.title')}</h2>
              <p className="break-all text-sm opacity-70">
                {bankName} · {t('editor.count', { count: bank.length })}
                {activeCount < bank.length && <> · {t('editor.activeCount', { count: activeCount })}</>}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>
                {t('common.back')}
              </button>
              <button type="button" className="btn btn-outline btn-sm" onClick={onDownload}>
                {t('editor.download')}
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setEditing('new')}
                disabled={editing === 'new'}
              >
                + {t('editor.add')}
              </button>
            </div>
          </div>
          <details className="collapse collapse-arrow border border-base-300 bg-base-200/50">
            <summary className="collapse-title min-h-0 py-3 font-medium">
              {t('editor.topicsTitle')}{' '}
              <span className="text-sm font-normal opacity-60">
                {t('editor.topicsActive', { active: topics.length - disabledTopics.filter((x) => topics.includes(x)).length, total: topics.length })}
              </span>
            </summary>
            <div className="collapse-content">
              <p className="mb-2 text-sm opacity-70">{t('editor.topicsHelp')}</p>
              <ul className="space-y-1">
                {topics.map((tp) => {
                  const on = !disabledTopics.includes(tp)
                  return (
                    <li key={tp}>
                      <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-box px-2 hover:bg-base-200">
                        <input type="checkbox" className="toggle toggle-primary toggle-sm" checked={on} onChange={() => onToggleTopic(tp)} />
                        <span className={`flex-1 ${on ? '' : 'line-through opacity-50'}`}>{tp}</span>
                        <span className="text-sm opacity-60">{perTopic(tp)}</span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            </div>
          </details>

          <div className="grid gap-2 sm:grid-cols-3">
            <input
              type="search"
              className="input input-bordered w-full"
              placeholder={t('editor.search')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label={t('editor.search')}
            />
            <select className="select select-bordered w-full" value={topic} onChange={(e) => setTopic(e.target.value)} aria-label={t('progress.topic')}>
              <option value="">{t('progress.allTopics')}</option>
              {topics.map((tp) => (
                <option key={tp} value={tp}>
                  {tp}
                </option>
              ))}
            </select>
            <select className="select select-bordered w-full" value={state} onChange={(e) => setState(e.target.value)} aria-label={t('editor.stateFilter')}>
              <option value="">{t('editor.allStates')}</option>
              <option value="active">{t('editor.onlyActive')}</option>
              <option value="inactive">{t('editor.onlyInactive')}</option>
            </select>
          </div>
        </div>
      </div>

      {editing === 'new' && (
        <QuestionForm
          title={t('editor.newQuestion')}
          initial={formFrom(null)}
          topics={topics}
          onCancel={() => setEditing(null)}
          onSave={(fields) => {
            onSave(null, fields)
            setEditing(null)
          }}
        />
      )}

      <ul className="space-y-2">
        {rows.map((q) =>
          editing === q.key ? (
            <li key={q.key}>
              <QuestionForm
                title={t('exercise.questionNumber', { id: q.id })}
                initial={formFrom(q)}
                topics={topics}
                onCancel={() => setEditing(null)}
                onSave={(fields) => {
                  onSave(q.key, fields)
                  setEditing(null)
                }}
              />
            </li>
          ) : (
            <li key={q.key} className="flex items-start gap-3 rounded-box border border-base-300 bg-base-100 p-3">
              <Tooltip
                text={
                  disabledTopics.includes(q.topic)
                    ? t('editor.topicOff')
                    : q.disabled
                      ? t('editor.turnOn')
                      : t('editor.turnOff')
                }
                side="right"
              >
                <input
                  type="checkbox"
                  className="toggle toggle-primary toggle-sm mt-1"
                  checked={!q.disabled}
                  onChange={() => onToggleQuestion(q.key)}
                  aria-label={q.disabled ? t('editor.turnOn') : t('editor.turnOff')}
                />
              </Tooltip>
              <span className="badge badge-ghost mt-0.5 shrink-0 font-semibold">{q.id}</span>
              <div className={`min-w-0 flex-1 ${isQuestionActive(q, disabledTopics) ? '' : 'opacity-50'}`}>
                <div className="font-medium">{q.question}</div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="opacity-60">{q.topic}</span>
                  {q.disabled && <span className="badge badge-ghost badge-xs">{t('editor.inactive')}</span>}
                  {disabledTopics.includes(q.topic) && <span className="badge badge-ghost badge-xs">{t('editor.topicInactive')}</span>}
                </div>
              </div>
              {confirmDelete === q.key ? (
                <div className="flex shrink-0 items-center gap-1">
                  <span className="hidden text-sm sm:inline">{t('editor.confirmDelete')}</span>
                  <button
                    type="button"
                    className="btn btn-error btn-xs"
                    onClick={() => {
                      onDelete(q.key)
                      setConfirmDelete(null)
                    }}
                  >
                    {t('editor.yesDelete')}
                  </button>
                  <button type="button" className="btn btn-ghost btn-xs" onClick={() => setConfirmDelete(null)}>
                    {t('common.cancel')}
                  </button>
                </div>
              ) : (
                <div className="flex shrink-0 gap-1">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(q.key)}>
                    {t('editor.edit')}
                  </button>
                  <Tooltip text={bank.length <= 1 ? t('editor.lastQuestion') : t('editor.delete')} side="left">
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm btn-square text-error"
                      onClick={() => setConfirmDelete(q.key)}
                      disabled={bank.length <= 1}
                      aria-label={t('editor.delete')}
                    >
                      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <path d="M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </Tooltip>
                </div>
              )}
            </li>
          ),
        )}
        {!rows.length && <li className="py-6 text-center opacity-60">{t('progress.empty')}</li>}
      </ul>
    </div>
  )
}

function QuestionForm({ title, initial, topics, onSave, onCancel }) {
  const { t } = useI18n()
  const [form, setForm] = useState(initial)
  const [showErrors, setShowErrors] = useState(false)
  const clozeRef = useRef(null)

  const fields = {
    topic: form.topic,
    question: form.question,
    answer: form.answer,
    keyPoints: toLines(form.keyPoints),
    clozeRaw: form.clozeRaw,
    hints: toLines(form.hints),
  }
  const missing = missingFields(fields)
  const blanks = parseCloze(form.clozeRaw).blanks.filter(Boolean)
  const set = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }))

  // Wraps the selected text of the cloze field in {{ }} so it becomes a blank.
  const markBlank = () => {
    const el = clozeRef.current
    if (!el) return
    const { selectionStart: s, selectionEnd: e, value } = el
    if (s === e) return
    const next = `${value.slice(0, s)}{{${value.slice(s, e).trim()}}}${value.slice(e)}`
    setForm((f) => ({ ...f, clozeRaw: next }))
    requestAnimationFrame(() => el.focus())
  }

  const submit = (e) => {
    e.preventDefault()
    if (missing.length) {
      setShowErrors(true)
      return
    }
    onSave(fields)
  }

  const error = (name) => showErrors && missing.includes(name)

  return (
    <form onSubmit={submit} className="card border-2 border-primary/40 bg-base-100 shadow-sm">
      <div className="card-body gap-3 p-4 sm:p-6">
        <h3 className="font-semibold">{title}</h3>

        <Field label={t('editor.topic')} invalid={error('TEMA')}>
          <input type="text" className="input input-bordered w-full" value={form.topic} onChange={set('topic')} list="editor-topics" />
          <datalist id="editor-topics">
            {topics.map((tp) => (
              <option key={tp} value={tp} />
            ))}
          </datalist>
        </Field>

        <Field label={t('editor.question')} invalid={error('PREGUNTA')}>
          <textarea className="textarea textarea-bordered min-h-16 w-full" value={form.question} onChange={set('question')} />
        </Field>

        <Field label={t('editor.answer')} invalid={error('RESPUESTA')}>
          <textarea className="textarea textarea-bordered min-h-28 w-full" value={form.answer} onChange={set('answer')} />
        </Field>

        <Field label={t('editor.keyPoints')} help={t('editor.onePerLine')} info={t('info.keyPoints')} invalid={error('PUNTOS CLAVE')}>
          <textarea className="textarea textarea-bordered min-h-28 w-full" value={form.keyPoints} onChange={set('keyPoints')} />
        </Field>

        <Field label={t('editor.cloze')} help={t('editor.clozeHelp')} info={t('info.cloze')} invalid={error('COMPLETAR {{...}}')}>
          <textarea ref={clozeRef} className="textarea textarea-bordered min-h-24 w-full" value={form.clozeRaw} onChange={set('clozeRaw')} />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button type="button" className="btn btn-outline btn-xs" onMouseDown={(e) => e.preventDefault()} onClick={markBlank}>
              {'{{ }}'} {t('editor.markBlank')}
            </button>
            <span className="text-xs opacity-60">{t('editor.blanks', { count: blanks.length })}</span>
            {blanks.map((b, i) => (
              <span key={i} className="badge badge-primary badge-soft badge-sm">
                {b}
              </span>
            ))}
          </div>
        </Field>

        <Field label={t('editor.hints')} help={t('editor.onePerLine')} info={t('info.hints')} invalid={error('PISTAS')}>
          <textarea className="textarea textarea-bordered min-h-20 w-full" value={form.hints} onChange={set('hints')} />
        </Field>

        {showErrors && missing.length > 0 && (
          <div role="alert" className="alert alert-error text-sm">
            {t('editor.missing', { fields: missing.join(', ') })}
          </div>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn btn-primary">
            {t('common.save')}
          </button>
        </div>
      </div>
    </form>
  )
}

function Field({ label, help, info, invalid, children }) {
  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center gap-x-2">
        <span className={`text-sm font-medium ${invalid ? 'text-error' : ''}`}>
          {label} {info && <InfoTip text={info} />}
        </span>
        {help && <span className="text-xs opacity-60">{help}</span>}
      </div>
      {children}
    </div>
  )
}
