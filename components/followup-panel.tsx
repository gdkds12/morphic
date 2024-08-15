'use client'

import { useState } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { useActions, useUIState } from 'ai/rsc'
import type { AI } from '@/app/actions'
import { UserMessage } from './user-message'
import { ArrowRight } from 'lucide-react'
import { useAppState } from '@/lib/utils/app-state'

export function FollowupPanel() {
  const [input, setInput] = useState('')
  const { submit } = useActions()
  const [, setMessages] = useUIState<typeof AI>()
  const { isGenerating, setIsGenerating } = useAppState()

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (isGenerating) return

    setIsGenerating(true)
    setInput('')

    const formData = new FormData(event.currentTarget as HTMLFormElement)

    const userMessage = {
      id: Date.now(),
      isGenerating: false,
      component: <UserMessage message={input} />
    }

    const responseMessage = await submit(formData)
    setMessages(currentMessages => [
      ...currentMessages,
      userMessage,
      responseMessage
    ])
  }

  return (
    <form
  onSubmit={handleSubmit}
  className="fixed bottom-4 left-1/2 transform -translate-x-1/2 flex items-center w-full max-w-3xl px-8 sm:px-12 pt-12 md:pt-14 pb-14 md:pb-24"
>
  <div className="relative flex items-center w-full">
    <Textarea
      ref={inputRef}
      name="input"
      rows={1}
      maxRows={5}
      placeholder="무엇이든 질문해주세요"
      spellCheck={false}
      value={input}
      className="resize-none w-full min-h-12 rounded-fill bg-muted border border-input pl-4 pr-14 pt-3 pb-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 placeholder:text-muted-foreground"
      onChange={e => setInput(e.target.value)}
      onKeyDown={e => {
        // Enter should submit the form
        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
          // Prevent the default action to avoid adding a new line
          if (input.trim().length === 0) {
            e.preventDefault()
            return
          }
          e.preventDefault()
          const textarea = e.target as HTMLTextAreaElement
          textarea.form?.requestSubmit()
        }
      }}
      onHeightChange={height => {
        // Ensure inputRef.current is defined
        if (!inputRef.current) return

        // The initial height and left padding is 70px and 2rem
        const initialHeight = 70
        // The initial border radius is 32px
        const initialBorder = 32
        // The height is incremented by multiples of 20px
        const multiple = (height - initialHeight) / 20

        // Decrease the border radius by 4px for each 20px height increase
        const newBorder = initialBorder - 4 * multiple
        // The lowest border radius will be 8px
        inputRef.current.style.borderRadius = Math.max(8, newBorder) + 'px'
      }}
      onFocus={() => setShowEmptyScreen(true)}
      onBlur={() => setShowEmptyScreen(false)}
    />
    <Button
      type="submit"
      size="icon"
      disabled={input.length === 0 || isGenerating}
      variant="ghost"
      className="absolute right-2 top-1/2 transform -translate-y-1/2"
    >
      <ArrowRight size={20} />
    </Button>
  </div>
</form>


  )
  
  
}
