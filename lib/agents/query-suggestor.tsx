import { createStreamableUI, createStreamableValue } from 'ai/rsc'
import { CoreMessage, streamObject } from 'ai'
import { PartialRelated, relatedSchema } from '@/lib/schema/related'
import SearchRelated from '@/components/search-related'
import { getModel } from '../utils'

export async function querySuggestor(
  uiStream: ReturnType<typeof createStreamableUI>,
  messages: CoreMessage[]
) {
  const objectStream = createStreamableValue<PartialRelated>()
  uiStream.append(<SearchRelated relatedQueries={objectStream.value} />)

  const lastMessages = messages.slice(-1).map(message => {
    return {
      ...message,
      role: 'user'
    }
  }) as CoreMessage[]

  let finalRelatedQueries: PartialRelated = {}
  await streamObject({
    model: getModel(),
    system: `전문 웹 연구자로서, 당신의 임무는 초기 쿼리와 그 검색 결과에서 발견된 정보를 바탕으로 주제를 더 깊이 탐구하는 세 가지 쿼리 세트를 생성하는 것입니다.

    예를 들어, 초기 쿼리가 "스타십의 세 번째 시험 비행 주요 이정표"였다면, 당신의 출력은 다음 형식을 따라야 합니다:

    "{
      "related": [
        "스타십의 세 번째 시험 비행 동안 달성된 주요 목표는 무엇인가요?",
        "스타십의 세 번째 시험 비행의 최종 결과에 기여한 요인은 무엇인가요?",
        "세 번째 시험 비행의 결과가 스타십의 향후 개발 계획에 어떤 영향을 미칠 것인가요?"
      ]
    }"

    초기 쿼리와 관련된 점점 더 구체적인 측면, 영향 또는 인접 주제를 탐구하는 쿼리를 생성하는 것을 목표로 하세요. 목표는 사용자의 잠재적인 정보 요구를 예측하고 주제에 대한 더 포괄적인 이해로 안내하는 것입니다.
    응답의 언어는 사용자의 언어와 일치해야 합니다.`,
    messages: lastMessages,
    schema: relatedSchema
  })
    .then(async result => {
      for await (const obj of result.partialObjectStream) {
        if (obj.items) {
          objectStream.update(obj)
          finalRelatedQueries = obj
        }
      }
    })
    .finally(() => {
      objectStream.done()
    })

  return finalRelatedQueries
}
