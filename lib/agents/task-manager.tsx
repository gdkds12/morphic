import { CoreMessage, generateObject } from 'ai'
import { nextActionSchema } from '../schema/next-action'
import { getModel } from '../utils'

// Decide whether inquiry is required for the user input
export async function taskManager(messages: CoreMessage[]) {
  try {
    const result = await generateObject({
      model: getModel(),
      system: `전문적인 웹 연구자로서, 사용자의 질문을 완전히 이해하고 철저한 웹 검색을 통해 필요한 정보를 수집하여 적절한 응답을 제공하는 것이 주요 목표입니다.
     
    `,
      messages,
      schema: nextActionSchema
    })

    return result
  } catch (error) {
    console.error(error)
    return null
  }
}
