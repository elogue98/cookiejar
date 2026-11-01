'use client'

import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import type { IngredientGroup, InstructionGroup } from '@/types/recipe'
import { consumeChatStream, readableStreamText } from '@/lib/chatStream'
import {
  chatHistory,
  type ChatMessage,
  type RecipeContext,
  type RecipeProposal,
} from '@/lib/cookieBotRecipe'
import { applyRecipeProposal, prepareRecipeProposal, readChatJson } from '@/lib/cookieBotRequests'
import CookieBotText from './CookieBotText'
import CookieBotPreview from './CookieBotPreview'
import styles from './CookieBot.module.css'

type Message = ChatMessage & { id: number }
interface CookieBotProps {
  recipeId: string
  recipeTitle: string
  ingredients: IngredientGroup[] | null
  instructions: InstructionGroup[] | null
  tags: string[] | null
  servings?: number | null
}
function Icon({ name }: { name: 'close' | 'expand' | 'send' | 'copy' | 'stop' | 'down' }) {
  const paths = {
    close: 'm6 6 12 12M6 18 18 6',
    expand: 'M8 3H3v5m0-5 7 7m6 11h5v-5m0 5-7-7',
    send: 'M12 19V5m-6 6 6-6 6 6',
    copy: 'M9 8h11v13H9zM5 16H3V3h11v2',
    stop: 'M6 6h12v12H6z',
    down: 'M12 5v14m-6-6 6 6 6-6',
  }
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  )
}
const suggestions = [
  {
    label: 'Ingredient swaps',
    text: 'What ingredient substitutions would work well in this recipe?',
  },
  {
    label: 'Make half',
    text: 'How should I halve this recipe? Show the adjusted ingredient quantities and servings.',
  },
  {
    label: 'Explain a step',
    text: 'Explain the trickiest step in this recipe and what to look out for.',
  },
]

export default function CookieBot({
  recipeId,
  recipeTitle,
  ingredients,
  instructions,
  tags,
  servings,
}: CookieBotProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState<'chat' | 'preview' | 'save' | null>(null)
  const [proposal, setProposal] = useState<{
    original: RecipeContext
    recipe: RecipeProposal
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const [pinned, setPinned] = useState(true)
  const [copied, setCopied] = useState<number | null>(null)
  const request = useRef<AbortController | null>(null)
  const sequence = useRef(0)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const launcherRef = useRef<HTMLButtonElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const followRef = useRef(true)
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const recipe: RecipeContext = { title: recipeTitle, ingredients, instructions, tags, servings }

  useEffect(
    () => () => {
      request.current?.abort()
      clearTimeout(copyTimer.current)
    },
    [],
  )
  useEffect(() => {
    if (isOpen) inputRef.current?.focus()
  }, [isOpen])
  useEffect(() => {
    if (isOpen && followRef.current && viewportRef.current)
      viewportRef.current.scrollTop = viewportRef.current.scrollHeight
  }, [messages, proposal, busy, isOpen])
  useEffect(() => {
    if (proposal && previewRef.current && viewportRef.current) {
      const viewport = viewportRef.current
      viewport.scrollTop +=
        previewRef.current.getBoundingClientRect().top - viewport.getBoundingClientRect().top - 12
    }
  }, [proposal])
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 128)}px`
    }
  }, [input, isOpen])

  function close() {
    setIsOpen(false)
    launcherRef.current?.focus()
  }
  function follow() {
    followRef.current = true
    setPinned(true)
    if (viewportRef.current) viewportRef.current.scrollTop = viewportRef.current.scrollHeight
  }

  async function send(text = input, base = messages) {
    const question = text.trim()
    if (!question || question.length > 4000 || request.current) return
    const controller = new AbortController()
    request.current = controller
    const assistantId = ++sequence.current
    const user: Message = { id: ++sequence.current, role: 'user', content: question }
    setMessages([
      ...base,
      user,
      { id: assistantId, role: 'assistant', content: '', status: 'streaming' },
    ])
    if (text === input) setInput('')
    setError(null)
    setProposal(null)
    setBusy('chat')
    setAnnouncement('CookieBot is preparing an answer.')
    follow()
    let received = ''
    let frame: number | undefined
    const flush = () => {
      frame = undefined
      setMessages((current) =>
        current.map((message) =>
            message.id === assistantId ? { ...message, content: readableStreamText(received) } : message,
        ),
      )
    }
    try {
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          recipeTitle,
          ingredients,
          instructions,
          tags,
          servings,
          userMessage: question,
          messageHistory: chatHistory(base),
        }),
      })
      if (!response.ok) await readChatJson(response)
      await consumeChatStream(
        response,
        (delta) => {
          received += delta
          if (frame === undefined) frame = requestAnimationFrame(flush)
        },
        controller.signal,
      )
      if (frame !== undefined) cancelAnimationFrame(frame)
      setMessages((current) =>
        current.map((message) =>
          message.id === assistantId
            ? { ...message, content: received, status: 'complete' }
            : message,
        ),
      )
      setAnnouncement('CookieBot’s answer is ready.')
    } catch (failure) {
      if (frame !== undefined) cancelAnimationFrame(frame)
      const stopped = controller.signal.aborted
      setMessages((current) =>
        current.map((message) =>
          message.id === assistantId
            ? { ...message, content: received, status: stopped ? 'stopped' : 'error' }
            : message,
        ),
      )
      setError(
        stopped
          ? null
          : failure instanceof Error && !(failure instanceof TypeError)
            ? failure.message
            : 'Could not connect. Please try again.',
      )
      setAnnouncement(stopped ? 'Answer stopped.' : 'The answer was interrupted. You can retry it.')
    } finally {
      if (request.current === controller) {
        request.current = null
        setBusy(null)
      }
    }
  }

  async function preview(question: string) {
    if (request.current) return
    const controller = new AbortController()
    request.current = controller
    setBusy('preview')
    setError(null)
    setProposal(null)
    setAnnouncement('Preparing a recipe preview.')
    follow()
    try {
      const result = await prepareRecipeProposal(
        recipeId,
        recipe,
        question,
        chatHistory(messages),
        controller.signal,
      )
      setProposal({ original: recipe, recipe: result })
      setAnnouncement('Recipe preview ready. Nothing has been saved.')
    } catch (failure) {
      if (!controller.signal.aborted)
        setError(
          failure instanceof Error && !(failure instanceof TypeError)
            ? failure.message
            : 'Could not prepare a preview. Please retry.',
        )
      else setAnnouncement('Preview stopped. Your recipe is unchanged.')
    } finally {
      if (request.current === controller) {
        request.current = null
        setBusy(null)
      }
    }
  }

  async function apply() {
    if (!proposal || request.current) return
    const controller = new AbortController()
    request.current = controller
    setBusy('save')
    setError(null)
    try {
      await applyRecipeProposal(recipeId, proposal.recipe, controller.signal)
      setProposal(null)
      setMessages((current) => [
        ...current,
        {
          id: ++sequence.current,
          role: 'assistant',
          content: 'Changes saved to your recipe.',
          status: 'complete',
        },
      ])
      setAnnouncement('Recipe changes saved.')
      router.refresh()
    } catch (failure) {
      setError(
        failure instanceof Error && !(failure instanceof TypeError)
          ? failure.message
          : 'Could not confirm the save. Check the recipe before retrying.',
      )
    } finally {
      if (request.current === controller) {
        request.current = null
        setBusy(null)
      }
    }
  }

  async function copy(message: Message) {
    try {
      await navigator.clipboard.writeText(message.content)
      setCopied(message.id)
      clearTimeout(copyTimer.current)
      copyTimer.current = setTimeout(() => setCopied(null), 2000)
    } catch {
      setError('Could not copy. You can select the answer text instead.')
    }
  }
  function keyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      void send()
    }
  }

  return (
    <>
      <button
        ref={launcherRef}
        type="button"
        className={styles.launcher}
        onClick={() => (isOpen ? close() : setIsOpen(true))}
        aria-label={isOpen ? 'Minimise CookieBot' : 'Open CookieBot chat'}
        aria-expanded={isOpen}
        aria-controls="cookiebot-panel"
      >
        <span aria-hidden="true">🍪</span>
        <span>Ask CookieBot</span>
      </button>
      <section
        id="cookiebot-panel"
        role="dialog"
        aria-labelledby="cookiebot-title"
        hidden={!isOpen}
        className={`${styles.panel} ${expanded ? styles.expanded : ''}`}
        onKeyDown={(event) => {
          if (event.key === 'Escape') close()
        }}
      >
        <header className={styles.header}>
          <span className={styles.avatar} aria-hidden="true">
            🍪
          </span>
          <div className={styles.heading}>
            <h2 id="cookiebot-title">CookieBot</h2>
            <p title={recipeTitle}>{recipeTitle}</p>
          </div>
          <button
            type="button"
            className={`${styles.iconButton} ${styles.expandButton}`}
            onClick={() => setExpanded(!expanded)}
            aria-label={expanded ? 'Make chat smaller' : 'Expand chat'}
            aria-pressed={expanded}
          >
            <Icon name="expand" />
          </button>
          <button
            type="button"
            className={styles.iconButton}
            onClick={close}
            aria-label="Close chat"
          >
            <Icon name="close" />
          </button>
        </header>
        <div
          ref={viewportRef}
          className={styles.messages}
          aria-label="Conversation"
          onScroll={(event) => {
            const node = event.currentTarget
            const atBottom = node.scrollHeight - node.scrollTop - node.clientHeight < 60
            followRef.current = atBottom
            setPinned(atBottom)
          }}
        >
          {messages.length === 0 && (
            <div className={styles.welcome}>
              <span className={styles.welcomeMark} aria-hidden="true">
                A pinch of help.
              </span>
              <h3>
                Let’s make
                <br />
                something good.
              </h3>
              <p>
                Ingredients, timings, or a little change?
                <br />
                I’ve got this recipe in front of me.
              </p>
              <div className={styles.suggestions}>
                {suggestions.map((suggestion) => (
                  <button
                    type="button"
                    key={suggestion.label}
                    onClick={() => void send(suggestion.text)}
                  >
                    {suggestion.label}
                    <span aria-hidden="true">↗</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((message, index) => (
            <div
              key={message.id}
              className={message.role === 'user' ? styles.userMessage : styles.assistantMessage}
            >
              {message.role === 'user' ? (
                <p>{message.content}</p>
              ) : (
                <>
                  {message.content ? (
                    <div className={styles.answer}>
                      <CookieBotText text={message.content} streaming={message.status === 'streaming'} />
                    </div>
                  ) : message.status === 'streaming' ? (
                    <span className={styles.waiting}>
                      <span />A moment to think…
                    </span>
                  ) : null}
                  {(message.status === 'stopped' || message.status === 'error') && (
                    <p className={styles.incomplete}>
                      {message.status === 'stopped' ? 'Stopped' : 'Interrupted'}
                      {message.content ? ' · This answer is incomplete' : ''}
                    </p>
                  )}
                  {message.status !== 'streaming' && (
                    <div className={styles.messageActions}>
                      {message.content && (
                        <button
                          type="button"
                          onClick={() => void copy(message)}
                          aria-label="Copy answer"
                        >
                          <Icon name="copy" />
                          {copied === message.id ? 'Copied' : 'Copy'}
                        </button>
                      )}
                      {index === messages.length - 1 &&
                        (message.status === 'stopped' || message.status === 'error') && (
                          <button
                            type="button"
                            disabled={!!busy}
                            onClick={() => {
                              const previous = messages[index - 1]
                              if (previous?.role === 'user')
                                void send(previous.content, messages.slice(0, index - 1))
                            }}
                          >
                            Retry answer
                          </button>
                        )}
                      {message.status === 'complete' &&
                        index === messages.length - 1 &&
                        messages[index - 1]?.role === 'user' &&
                        !proposal && (
                          <button
                            type="button"
                            disabled={!!busy}
                            onClick={() => void preview(messages[index - 1].content)}
                          >
                            Preview recipe changes <span aria-hidden="true">↗</span>
                          </button>
                        )}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
          {busy === 'preview' && (
            <p className={styles.waiting}>
              <span />
              Preparing your preview…
            </p>
          )}
          {proposal && (
            <div ref={previewRef}>
              <CookieBotPreview
                original={proposal.original}
                proposal={proposal.recipe}
                saving={busy === 'save'}
                onApply={() => void apply()}
                onCancel={() => {
                  setProposal(null)
                  setError(null)
                  setAnnouncement('Preview cancelled. Your recipe is unchanged.')
                }}
              />
            </div>
          )}
        </div>
        {!pinned && messages.length > 0 && !proposal && (
          <button type="button" className={styles.jump} onClick={follow}>
            <Icon name="down" />
            Latest answer
          </button>
        )}
        <footer className={styles.footer}>
          {error && (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          )}
          <form
            className={styles.composer}
            onSubmit={(event) => {
              event.preventDefault()
              void send()
            }}
          >
            <textarea
              ref={inputRef}
              aria-label="Ask about this recipe"
              placeholder={busy ? 'Draft your next question…' : 'Ask about this recipe…'}
              rows={1}
              maxLength={4000}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={keyDown}
            />
            {busy && busy !== 'save' ? (
              <button
                type="button"
                className={styles.send}
                onClick={() => request.current?.abort()}
                aria-label="Stop response"
              >
                <Icon name="stop" />
              </button>
            ) : (
              <button
                type="submit"
                className={styles.send}
                disabled={!input.trim() || !!busy}
                aria-label="Send message"
              >
                <Icon name="send" />
              </button>
            )}
          </form>
          <p className={styles.hint}>
            {proposal
              ? 'Review first. Save only when you’re ready.'
              : 'Recipe changes always need your approval.'}
          </p>
        </footer>
      </section>
      <span className={styles.srOnly} role="status" aria-live="polite">
        {announcement}
      </span>
    </>
  )
}
