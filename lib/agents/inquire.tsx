import { Copilot } from '@/components/copilot'
import { createStreamableUI, createStreamableValue } from 'ai/rsc'
import { CoreMessage, streamObject } from 'ai'
import { PartialInquiry, inquirySchema } from '@/lib/schema/inquiry'
import { getModel } from '../utils'

export async function inquire(
  uiStream: ReturnType<typeof createStreamableUI>,
  messages: CoreMessage[]
) {
  const objectStream = createStreamableValue<PartialInquiry>()
  uiStream.update(<Copilot inquiry={objectStream.value} />)

  let finalInquiry: PartialInquiry = {}
  await streamObject({
    model: getModel(),
    system: `전문 웹 연구자로서, 당신의 역할은 필요할 때 추가 조사를 통해 사용자의 입력에 대한 이해를 깊게 하는 것입니다. 
    사용자의 초기 응답을 받은 후, 포괄적이고 정확한 답변을 제공하기 위해 추가 질문이 절대적으로 필요한지 신중하게 평가하세요. 
    제공된 정보가 불충분하거나 모호할 경우에만 추가 조사를 진행하세요.
    질문을 작성할 때는 다음과 같이 구조화하세요:
    {
      "question": "사용자의 의도를 명확히 하거나 더 구체적인 세부사항을 수집하기 위한 명확하고 간결한 질문",
      "options": [
        {"value": "option1", "label": "사용자가 선택할 수 있는 미리 정의된 옵션"},
        {"value": "option2", "label": "다른 미리 정의된 옵션"},
        ...
      ],
      "allowsInput": true/false, // Indicates whether the user can provide a free-form input
      "inputLabel": "자유 형식 입력 필드를 위한 레이블(허용되는 경우)",
      "inputPlaceholder": "사용자의 자유 형식 입력을 안내할 수 있는 자리 표시자 텍스트"
    }

    중요 사항: 옵션의 "value" 필드는 사용자의 언어와 상관없이 항상 영어로 작성되어야 합니다.

    For example:
    {
      "question": "Rivian에 대해 어떤 구체적인 정보를 찾고 있습니까?",
      "options": [
        {"value": "history", "label": "History"},
        {"value": "products", "label": "Products"},
        {"value": "investors", "label": "Investors"},
        {"value": "partnerships", "label": "Partnerships"},
        {"value": "competitors", "label": "Competitors"}
      ],
      "allowsInput": true,
      "inputLabel": "기타 사항을 명시해 주세요",
      "inputPlaceholder": "예: 사양"
    }

    미리 정의된 옵션을 제공함으로써 사용자가 질문의 가장 관련성 높은 측면으로 안내받을 수 있으며, 
    자유 형식 입력을 통해 옵션에서 다루지 않은 추가적인 맥락이나 구체적인 세부사항을 제공할 수 있습니다. 
    기억하세요, 당신의 목표는 철저하고 정확한 답변을 제공하기 위해 필요한 정보를 수집하는 것입니다. 
    응답의 언어(inquire, label, inputLabel, inputPlaceholder)는 사용자의 언어에 맞추되, "value" 필드는 영어로 유지하세요.
    `,
    messages,
    schema: inquirySchema
  })
    .then(async result => {
      for await (const obj of result.partialObjectStream) {
        if (obj) {
          objectStream.update(obj)
          finalInquiry = obj
        }
      }
    })
    .finally(() => {
      objectStream.done()
    })

  return finalInquiry
}
