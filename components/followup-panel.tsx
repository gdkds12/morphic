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
  className="fixed bottom-0 left-1/2 transform -translate-x-1/2 flex items-center w-full max-w-3xl px-8 sm:px-12 pt-12 md:pt-14 pb-2 md:pb-5 z-50"
>
  <div className="relative flex items-center w-full">
    <Input
      type="text"
      name="input"
      placeholder="입력해주세요"
      value={input}
      className="pr-14 h-12 w-full rounded-full bg-Neutral-900 border border-Neutral-950 text-Neutral-400"
      onChange={e => setInput(e.target.value)}
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
