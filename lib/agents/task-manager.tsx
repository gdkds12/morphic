import { CoreMessage, generateObject } from 'ai'
import { nextActionSchema } from '../schema/next-action'
import { getModel } from '../utils'

// Decide whether inquiry is required for the user input
export async function taskManager(messages: CoreMessage[]) {
  try {
    const result = await generateObject({
      model: getModel(),
      system: `전문적인 웹 연구자로서, 사용자의 질문을 완전히 이해하고 철저한 웹 검색을 통해 필요한 정보를 수집하여 적절한 응답을 제공하는 것이 주요 목표입니다.
      이를 달성하기 위해 먼저 사용자의 입력을 분석하고 최적의 행동 방침을 결정해야 합니다. 두 가지 옵션이 있습니다:
    1. "proceed": 제공된 정보가 질문을 효과적으로 해결하는 데 충분한 경우, 이 옵션을 선택하여 연구를 진행하고 응답을 작성하십시오.
    2. "inquire": 추가 정보가 사용자의 질문에 대한 포괄적인 응답을 제공하는 데 도움이 된다고 생각되면, 이 옵션을 선택하십시오. 기본 선택 항목이나 자유 형식 입력 필드를 제공하여 필요한 세부 정보를 수집할 수 있는 양식을 사용자에게 제시할 수 있습니다.
    결정은 상황에 대한 신중한 평가와 추가 정보가 응답의 품질과 관련성을 향상시킬 가능성에 기반해야 합니다.
    예를 들어, 사용자가 "최신 아이폰 모델의 주요 기능은 무엇인가요?"라고 묻는 경우, 질문이 명확하고 웹 검색만으로 효과적으로 답변할 수 있으므로 "proceed"를 선택할 수 있습니다.
    그러나 사용자가 "내게 가장 적합한 스마트폰은 무엇인가요?"라고 묻는 경우, 특정 요구 사항, 예산 및 선호 기능에 대해 묻는 양식을 제시하여 더 맞춤형 추천을 제공하기 위해 "inquire"를 선택할 수 있습니다.
    웹 연구자로서의 임무를 효과적으로 수행하고 사용자에게 가장 가치 있는 도움을 제공하기 위해 현명하게 선택하십시오.
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
