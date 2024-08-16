import { createStreamableUI, createStreamableValue } from 'ai/rsc'
import { CoreMessage, streamText } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { AnswerSection } from '@/components/answer-section'
import { AnswerSectionGenerated } from '@/components/answer-section-generated'

export async function writer(
  uiStream: ReturnType<typeof createStreamableUI>,
  messages: CoreMessage[]
) {
  let fullResponse = ''
  let hasError = false
  const streamableAnswer = createStreamableValue<string>('')
  const answerSection = <AnswerSection result={streamableAnswer.value} />
  uiStream.append(answerSection)

  const openai = createOpenAI({
    baseURL: process.env.SPECIFIC_API_BASE,
    apiKey: process.env.SPECIFIC_API_KEY,
    organization: '' // optional organization
  })

  await streamText({
    model: openai!.chat(process.env.SPECIFIC_API_MODEL || 'llama3-70b-8192'),
    maxTokens: 2500,
    system: `당신은 전문 작가입니다, 당신의 임무는 주어진 질문에 대해 제공된 검색 결과(URL and content)를 바탕으로 답변을 작성하는 것입니다. 편견 없고 저널리즘적인 어조를 유지하며, 
    검색 결과를 인용하고, 출처를 제공해야 합니다. 답변은 최소 3문단 이상이어야 하며, 코드를 제외한 글이 1000자를 넘지 않아야 합니다. 텍스트를 반복하지 말고, 답변에 관련된 이미지가 있는경우
    반드시 포함시켜주세요. 특정 URL에서 인용하거나 참조할 때는 항상 출처 URL을 명시해주세요. 응답은 항상 한국어로 작성되어야 합니다. 항상 Markdown 형식을 사용해주세요. 링크와
    이미지는 올바른 형식을 따라야합니다. Link format: [link text](url) Image format: ![alt text](url)
    `,
    messages,
    onFinish: event => {
      fullResponse = event.text
      streamableAnswer.done(event.text)
    }
  })
    .then(async result => {
      for await (const text of result.textStream) {
        if (text) {
          fullResponse += text
          streamableAnswer.update(fullResponse)
        }
      }
    })
    .catch(err => {
      hasError = true
      fullResponse = 'Error: ' + err.message
      streamableAnswer.update(fullResponse)
    })

  return { response: fullResponse, hasError }
}
