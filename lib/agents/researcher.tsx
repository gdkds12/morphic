import { createStreamableUI, createStreamableValue } from 'ai/rsc'
import { CoreMessage, ToolCallPart, ToolResultPart, streamText } from 'ai'
import { getTools } from './tools'
import { getModel, transformToolMessages } from '../utils'
import { AnswerSection } from '@/components/answer-section'

export async function researcher(
  uiStream: ReturnType<typeof createStreamableUI>,
  streamableText: ReturnType<typeof createStreamableValue<string>>,
  messages: CoreMessage[]
) {
  let fullResponse = ''
  let hasError = false
  let finishReason = ''

  // Transform the messages if using Ollama provider
  let processedMessages = messages
  const useOllamaProvider = !!(
    process.env.OLLAMA_MODEL && process.env.OLLAMA_BASE_URL
  )
  const useAnthropicProvider = !!process.env.ANTHROPIC_API_KEY
  if (useOllamaProvider) {
    processedMessages = transformToolMessages(messages)
  }
  const includeToolResponses = messages.some(message => message.role === 'tool')
  const useSubModel = useOllamaProvider && includeToolResponses

  const streamableAnswer = createStreamableValue<string>('')
  const answerSection = <AnswerSection result={streamableAnswer.value} />

  const currentDate = new Date().toLocaleString()
  const result = await streamText({
    model: getModel(useSubModel),
    maxTokens: 2500,
    system: `당신은 검색 전문가이자 프로그래밍 강사, 수학 강사로서, 당신은 웹에서 모든 정보를 검색할 수 있는 능력을 가지고 있습니다.
    각 사용자 쿼리에 대해, 검색 결과를 최대한 활용하여 추가 정보를 제공하고 응답에 도움을 주십시오.
    응답과 관련된 이미지가 있다면 반드시 포함하십시오.
    검색 결과에서 얻은 통찰력을 바탕으로 사용자의 질문에 직접적으로 답변하는 것을 목표로 하십시오.
    특정 URL에서 정보를 인용하거나 참조할 때는 항상 [[number]](url) 형식을 사용하여 출처 URL을 명시적으로 인용하십시오. 필요한 경우 여러 인용을 포함할 수 있습니다. 예: [[number]](url), [[number]](url).
    번호는 항상 검색 결과의 순서를 따라야 합니다.
    검색 도구는 사용자가 제공한 URL과만 사용할 수 있습니다. 검색 결과에서 얻은 URL은 사용할 수 없습니다.
    도메인 대신 URL인 경우, 검색 도구의 include_domains에 지정하십시오.
    응답의 언어는 사용자의 언어와 일치시켜 주십시오. 현재 날짜와 시간: ${currentDate}
    `,
    messages: processedMessages,
    tools: getTools({
      uiStream,
      fullResponse
    }),
    onFinish: async event => {
      finishReason = event.finishReason
      fullResponse = event.text
      streamableAnswer.done()
    }
  }).catch(err => {
    hasError = true
    fullResponse = 'Error: ' + err.message
    streamableText.update(fullResponse)
  })

  // If the result is not available, return an error response
  if (!result) {
    return { result, fullResponse, hasError, toolResponses: [] }
  }

  const hasToolResult = messages.some(message => message.role === 'tool')
  if (!useAnthropicProvider || hasToolResult) {
    uiStream.append(answerSection)
  }

  // Process the response
  const toolCalls: ToolCallPart[] = []
  const toolResponses: ToolResultPart[] = []
  for await (const delta of result.fullStream) {
    switch (delta.type) {
      case 'text-delta':
        if (delta.textDelta) {
          fullResponse += delta.textDelta
          if (useAnthropicProvider && !hasToolResult) {
            streamableText.update(fullResponse)
          } else {
            streamableAnswer.update(fullResponse)
          }
        }
        break
      case 'tool-call':
        toolCalls.push(delta)
        break
      case 'tool-result':
        if (!delta.result) {
          hasError = true
        }
        toolResponses.push(delta)
        break
      case 'error':
        console.log('Error: ' + delta.error)
        hasError = true
        fullResponse += `\nError occurred while executing the tool`
        break
    }
  }
  messages.push({
    role: 'assistant',
    content: [{ type: 'text', text: fullResponse }, ...toolCalls]
  })

  if (toolResponses.length > 0) {
    // Add tool responses to the messages
    messages.push({ role: 'tool', content: toolResponses })
  }

  return { result, fullResponse, hasError, toolResponses, finishReason }
}
