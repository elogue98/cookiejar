'use client'

import { useState, useRef, useEffect } from 'react'
import { useUser } from '@/lib/userContext'
import type { IngredientGroup, InstructionGroup } from '@/types/recipe'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface CookieBotProps {
  recipeId: string
  recipeTitle: string
  ingredients: IngredientGroup[] | null
  instructions: InstructionGroup[] | null
  tags: string[] | null
}

// Intent detection - checks if user wants to mutate the recipe
function isMutationIntent(message: string): boolean {
  const lowerMessage = message.toLowerCase()
  const triggers = [
    'update the recipe',
    'change the recipe',
    'modify the recipe',
    'edit the recipe',
    'update ingredient',
    'use instead',
    'replace',
    'swap',
    'change amount',
    'update the',
    'change the',
    'modify the',
    'edit the',
    'works better',
    'please update',
    'can you update',
    'update it',
    'change it',
    'modify it',
    'edit it',
    'save this',
    'apply this',
    'make this change',
  ]
  
  return triggers.some(trigger => lowerMessage.includes(trigger))
}

export default function CookieBot({ recipeId, recipeTitle, ingredients, instructions, tags }: CookieBotProps) {
  const { user } = useUser()
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput('')
    setIsLoading(true)

    // Add user message to UI immediately
    const newMessages: Message[] = [...messages, { role: 'user', content: userMessage }]
    setMessages(newMessages)

    // Check if this is a mutation intent
    const isMutation = isMutationIntent(userMessage)

    try {
      if (isMutation) {
        // MUTATION MODE: Call mutation API, then save via PUT
        setMessages([
          ...newMessages,
          { role: 'assistant', content: 'Applying your changes...' },
        ])

        // Step 1: Generate mutation via AI
        const mutateResponse = await fetch('/api/recipe-mutate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            recipeId,
            recipeTitle,
            ingredients,
            instructions,
            tags,
            userMessage,
            messageHistory: messages,
          }),
        })

        if (!mutateResponse.ok) {
          const errorData = await mutateResponse.json()
          throw new Error(errorData.error || 'Failed to generate mutation')
        }

        const mutateData = await mutateResponse.json()
        if (!mutateData.success || !mutateData.mutatedRecipe) {
          throw new Error('Invalid mutation response')
        }

        // Convert structured instructions to string format if needed
        let instructionsForSave: string | null = null
        if (mutateData.mutatedRecipe.instructions) {
          if (Array.isArray(mutateData.mutatedRecipe.instructions)) {
            // Structured format: convert to string
            const instructionParts: string[] = []
            mutateData.mutatedRecipe.instructions.forEach((group: { section?: string; steps?: string[] }) => {
              if (group.section && group.section.trim()) {
                instructionParts.push(group.section)
              }
              if (group.steps && Array.isArray(group.steps)) {
                group.steps.forEach((step: string, idx: number) => {
                  instructionParts.push(`${idx + 1}. ${step}`)
                })
              }
            })
            instructionsForSave = instructionParts.join('\n\n')
          } else if (typeof mutateData.mutatedRecipe.instructions === 'string') {
            instructionsForSave = mutateData.mutatedRecipe.instructions
          }
        }

        // Step 2: Save the mutated recipe via PUT
        const saveResponse = await fetch(`/api/recipes/${recipeId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: mutateData.mutatedRecipe.title,
            ingredients: mutateData.mutatedRecipe.ingredients, // Structured format should work
            instructions: instructionsForSave,
            tags: mutateData.mutatedRecipe.tags,
            user_id: user?.id || null, // Pass user_id for version tracking
          }),
        })

        if (!saveResponse.ok) {
          const errorData = await saveResponse.json()
          throw new Error(errorData.error || 'Failed to save changes')
        }

        // Success! Update UI and reload page to show changes
        setMessages([
          ...newMessages,
          {
            role: 'assistant',
            content: '✅ Recipe updated! Reloading page to show changes...',
          },
        ])

        // Reload page after a short delay to show the success message
        setTimeout(() => {
          window.location.reload()
        }, 1500)
      } else {
        // NORMAL CHAT MODE: Just chat
        const response = await fetch('/api/assistant', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            recipeTitle,
            ingredients,
            instructions,
            tags,
            userMessage,
            messageHistory: messages, // Send previous messages only, not including the new one
          }),
        })

        if (!response.ok) {
          throw new Error('Failed to get response from assistant')
        }

        const data = await response.json()
        const assistantMessage = data.response || 'Sorry, I encountered an error.'

        setMessages([...newMessages, { role: 'assistant', content: assistantMessage }])
      }
    } catch (error) {
      console.error('Error:', error)
      setMessages([
        ...newMessages,
        {
          role: 'assistant',
          content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`
    }
  }, [input])

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center text-2xl sm:bottom-6 sm:right-6"
        style={{
          background: '#DDC57A',
          color: '#2B2B2B',
        }}
        aria-label="Open CookieBot chat"
      >
        🍪
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <div
          className="fixed bottom-24 right-6 z-50 w-96 max-w-[calc(100vw-3rem)] h-[500px] max-h-[calc(100vh-8rem)] flex flex-col rounded-lg shadow-xl sm:bottom-24 sm:right-6"
          style={{
            background: 'white',
            border: '1px solid rgba(211, 78, 78, 0.1)',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between p-4 border-b rounded-t-lg"
            style={{
              borderColor: 'rgba(211, 78, 78, 0.1)',
              background: 'var(--accent-light)',
            }}
          >
            <h3 className="font-semibold" style={{ color: 'var(--text-main)' }}>
              CookieBot — Recipe Assistant
            </h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-xl hover:opacity-70 transition-opacity"
              style={{ color: 'var(--text-main)' }}
              aria-label="Close chat"
            >
              ×
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ color: 'var(--text-main)' }}>
            {messages.length === 0 && (
              <div className="text-sm text-center text-gray-500 mt-4">
                Ask me anything about this recipe! Try:
                <ul className="mt-2 space-y-1 text-left list-disc list-inside">
                  <li>&quot;Can I make this gluten-free?&quot;</li>
                  <li>&quot;Halve this recipe&quot;</li>
                  <li>&quot;Convert everything to grams&quot;</li>
                  <li>&quot;What can I swap for buttermilk?&quot;</li>
                </ul>
              </div>
            )}

            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 ${
                    msg.role === 'user'
                      ? 'rounded-br-none'
                      : 'rounded-bl-none'
                  }`}
                  style={{
                    background:
                      msg.role === 'user'
                        ? '#DDC57A'
                        : 'var(--accent-light)',
                    color: 'var(--text-main)',
                  }}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div
                  className="max-w-[80%] rounded-lg rounded-bl-none px-4 py-2"
                  style={{
                    background: 'var(--accent-light)',
                    color: 'var(--text-main)',
                  }}
                >
                  <div className="flex gap-1">
                    <span className="animate-pulse">●</span>
                    <span className="animate-pulse" style={{ animationDelay: '0.2s' }}>
                      ●
                    </span>
                    <span className="animate-pulse" style={{ animationDelay: '0.4s' }}>
                      ●
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div
            className="p-4 border-t rounded-b-lg"
            style={{
              borderColor: 'rgba(211, 78, 78, 0.1)',
              background: 'white',
            }}
          >
            <div className="flex gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about this recipe..."
                className="flex-1 px-3 py-2 text-sm rounded-lg border resize-none focus:outline-none focus:ring-2"
                style={{
                  borderColor: 'rgba(211, 78, 78, 0.2)',
                  color: 'var(--text-main)',
                  minHeight: '40px',
                  maxHeight: '120px',
                }}
                rows={1}
                disabled={isLoading}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="px-4 py-2 font-medium rounded-lg transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: '#D34E4E',
                  color: 'white',
                }}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
