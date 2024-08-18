// 필요한 모듈과 함수들을 불러옴
import {
  StreamableValue,
  createAI,
  createStreamableUI,
  createStreamableValue,
  getAIState,
  getMutableAIState
} from 'ai/rsc'

import { CoreMessage, generateId, ToolResultPart } from 'ai'
import { Spinner } from '@/components/ui/spinner'
import { Section } from '@/components/section'
import { FollowupPanel } from '@/components/followup-panel'
import { inquire, researcher, taskManager, querySuggestor } from '@/lib/agents'
import { writer } from '@/lib/agents/writer'
import { saveChat } from '@/lib/actions/chat'
import { Chat } from '@/lib/types'
import { AIMessage } from '@/lib/types'
import { UserMessage } from '@/components/user-message'
import { SearchSection } from '@/components/search-section'
import SearchRelated from '@/components/search-related'
import { CopilotDisplay } from '@/components/copilot-display'
import RetrieveSection from '@/components/retrieve-section'
import { VideoSearchSection } from '@/components/video-search-section'
import { transformToolMessages } from '@/lib/utils'
import { AnswerSection } from '@/components/answer-section'
import { ErrorCard } from '@/components/error-card'

// 비동기 함수 submit: 사용자 입력을 처리하고 AI 메시지를 전송함
async function submit(
  formData?: FormData, // 사용자가 입력한 데이터를 포함하는 FormData 객체
  skip?: boolean, // 사용자가 작업을 건너뛰기를 원할 때 사용
  retryMessages?: AIMessage[] // 실패한 메시지를 다시 시도할 때 사용
) {
  'use server'

  // AI 상태와 UI 상태를 관리하는 값들을 생성
  const aiState = getMutableAIState<typeof AI>()
  const uiStream = createStreamableUI() // UI 업데이트를 위한 스트림 생성
  const isGenerating = createStreamableValue(true) // 응답이 생성 중인지 나타내는 값
  const isCollapsed = createStreamableValue(false) // UI가 축소되었는지 나타내는 값

  // 현재 상태에서 메시지 가져오기, 재시도 메시지가 있으면 그것을 우선 사용
  const aiMessages = [...(retryMessages ?? aiState.get().messages)]
  
  // 메시지 중 도구 관련 메시지(tool)를 필터링하고 남은 메시지를 정리
  const messages: CoreMessage[] = aiMessages
    .filter(
      message =>
        message.role !== 'tool' && // 'tool' 역할을 가진 메시지 제외
        message.type !== 'followup' && // 'followup' 유형의 메시지 제외
        message.type !== 'related' && // 'related' 유형의 메시지 제외
        message.type !== 'end' // 'end' 유형의 메시지 제외
    )
    .map(message => {
      const { role, content } = message
      return { role, content } as CoreMessage
    })

  // 메시지 그룹을 식별하는 고유 ID 생성
  const groupId = generateId()

  // 특정 API 사용 여부 확인
  const useSpecificAPI = process.env.USE_SPECIFIC_API_FOR_WRITER === 'true'
  const useOllamaProvider = !!(
    process.env.OLLAMA_MODEL && process.env.OLLAMA_BASE_URL
  )
  
  // 사용할 수 있는 메시지의 최대 개수를 설정 (각 API마다 다름)
  const maxMessages = useSpecificAPI ? 5 : useOllamaProvider ? 1 : 10
  messages.splice(0, Math.max(messages.length - maxMessages, 0))

  // 사용자 입력 데이터를 가져옴. skip이 true면 건너뛰기 동작 처리
  const userInput = skip
    ? `{"action": "skip"}`
    : (formData?.get('input') as string)

  // 사용자 입력을 기반으로 메시지의 유형(type)을 설정
  const content = skip
    ? userInput
    : formData
    ? JSON.stringify(Object.fromEntries(formData))
    : null
  const type = skip
    ? undefined
    : formData?.has('input')
    ? 'input'
    : formData?.has('related_query')
    ? 'input_related'
    : 'inquiry'

  // 검색 키워드 여부 확인 (현재는 로직이 미완성인 것으로 보임)
  const isSearchQuery = content && content.includes('')

  // 사용자 메시지를 상태에 추가 (content가 있는 경우에만)
  if (content) {
    aiState.update({
      ...aiState.get(),
      messages: [
        ...aiState.get().messages,
        {
          id: generateId(), // 메시지 ID 생성
          role: 'user', // 역할은 'user'로 설정
          content, // 내용 설정
          type // 메시지 유형 설정
        }
      ]
    })
    messages.push({
      role: 'user',
      content
    })
  }

  // 검색 키워드 검사 (현재는 빈 문자열 검사 로직이 있음)
  const containsSearchKeyword = messages.some(message =>
    typeof message.content === 'string' && message.content.includes('')
  )

  // 메시지를 처리하는 비동기 함수
  async function processEvents() {
    // UI에 스피너 표시
    uiStream.append(<Spinner />)

    // 기본 액션 설정
    let action = { object: { next: 'proceed' } }
    if (!skip) action = (await taskManager(messages)) ?? action

    // 검색 쿼리인 경우 검색 관련 처리
    if (isSearchQuery) {
      if (action.object.next === 'inquire') {
        const inquiry = await inquire(uiStream, messages)
        uiStream.done()
        isGenerating.done()
        isCollapsed.done(false)
        aiState.done({
          ...aiState.get(),
          messages: [
            ...aiState.get().messages,
            {
              id: generateId(),
              role: 'assistant',
              content: `inquiry: ${inquiry?.question}`,
              type: 'inquiry'
            }
          ]
        })
        return
      }

      // 메시지를 분석하고 도구나 검색 기능을 호출해 답변 생성
      isCollapsed.done(true)
      let answer = ''
      let stopReason = ''
      let toolOutputs: ToolResultPart[] = []
      let errorOccurred = false

      const streamText = createStreamableValue<string>()

      if (process.env.ANTHROPIC_API_KEY) {
        uiStream.update(
          <AnswerSection result={streamText.value} hasHeader={false} />
        )
      } else {
        uiStream.update(<div />)
      }

      // 계속해서 도구 또는 모델을 사용해 답변 생성 시도
      while (
        useSpecificAPI
          ? toolOutputs.length === 0 && answer.length === 0 && !errorOccurred
          : (stopReason !== 'stop' || answer.length === 0) && !errorOccurred
      ) {
        const { fullResponse, hasError, toolResponses, finishReason } =
          await researcher(uiStream, streamText, messages)
        stopReason = finishReason || ''
        answer = fullResponse
        toolOutputs = toolResponses
        errorOccurred = hasError

        if (toolOutputs.length > 0) {
          toolOutputs.map(output => {
            aiState.update({
              ...aiState.get(),
              messages: [
                ...aiState.get().messages,
                {
                  id: groupId,
                  role: 'tool',
                  content: JSON.stringify(output.result),
                  name: output.toolName,
                  type: 'tool'
                }
              ]
            })
          })
        }
      }

      // 생성된 답변을 AI 상태에 추가
      if (!errorOccurred) {
        streamText.done()
        aiState.update({
          ...aiState.get(),
          messages: [
            ...aiState.get().messages,
            {
              id: groupId,
              role: 'assistant',
              content: answer,
              type: 'answer'
            }
          ]
        })
      } else {
        // 오류 발생 시 오류 메시지 표시
        streamText.done()
        uiStream.append(
          <ErrorCard errorMessage={answer || 'An error occurred. Please try again.'} />
        )
      }

      isGenerating.done(false)
      uiStream.done()
    } else {
      // 검색 쿼리가 아닌 경우 직접 writer에게 메시지를 전달해 답변 생성
      const { response, hasError } = await writer(uiStream, messages)
      const answer = response
      const errorOccurred = hasError

      if (!errorOccurred) {
        aiState.update({
          ...aiState.get(),
          messages: [
            ...aiState.get().messages,
            {
              id: groupId,
              role: 'assistant',
              content: answer,
              type: 'answer'
            }
          ]
        })
      } else {
        uiStream.append(
          <ErrorCard errorMessage={answer || 'An error occurred. Please try again.'} />
        )
      }

      isGenerating.done(false)
      uiStream.done()
    }
  }

  // 비동기 함수 호출
  processEvents()

  return {
    id: generateId(),
    isGenerating: isGenerating.value,
    component: uiStream.value,
    isCollapsed: isCollapsed.value
  }
}

// AI의 상태를 정의하는 타입. AIMessage 배열과 고유한 chatId, 공유 페이지 여부(isSharePage)를 포함.
export type AIState = {
  messages: AIMessage[] // AI가 주고받은 메시지들
  chatId: string // 채팅을 식별하기 위한 고유 ID
  isSharePage?: boolean // 페이지가 공유 페이지인지 여부를 나타내는 선택적 값
}

// UI의 상태를 정의하는 타입. UI를 구성하는 컴포넌트, 고유 ID, 생성 상태, 축소 상태를 포함.
export type UIState = {
  id: string // UI 요소를 식별하는 고유 ID
  component: React.ReactNode // React에서 렌더링할 수 있는 UI 컴포넌트
  isGenerating?: StreamableValue<boolean> // 현재 응답이 생성 중인지 나타내는 값
  isCollapsed?: StreamableValue<boolean> // UI가 축소된 상태인지 나타내는 값
}[]

// AI의 초기 상태를 정의. 고유한 chatId를 생성하고 빈 메시지 배열로 초기화.
const initialAIState: AIState = {
  chatId: generateId(),
  messages: []
}

// UI의 초기 상태를 빈 배열로 초기화.
const initialUIState: UIState = []

// AI는 애플리케이션을 래핑하는 제공자(provider)로서, 컴포넌트에서 AI 및 UI 상태에 접근할 수 있게 함.
export const AI = createAI<AIState, UIState>({
  actions: {
    submit // AI가 처리할 수 있는 액션으로, 사용자 입력을 처리하는 함수인 submit을 포함.
  },
  initialUIState, // 초기 UI 상태
  initialAIState, // 초기 AI 상태

  // UI 상태를 가져오는 함수로, 서버에서 실행됨 ('use server' 사용)
  onGetUIState: async () => {
    'use server'
    
    // AI 상태를 가져옴
    const aiState = getAIState()

    // AI 상태가 존재하면 해당 상태에서 UI 상태를 생성
    if (aiState) {
      const uiState = getUIStateFromAIState(aiState as Chat)
      return uiState
    } else {
      return
    }
  },

  // AI 상태를 설정하는 함수로, 새로운 상태를 저장하고 필요한 경우 추가 작업 수행 ('use server' 사용)
  onSetAIState: async ({ state, done }) => {
    'use server'

    // AI의 메시지 중 'answer' 타입이 있는지 확인
    if (!state.messages.some(e => e.type === 'answer')) {
      return
    }

    // 상태에서 채팅 ID, 메시지 목록, 현재 시간을 가져옴
    const { chatId, messages } = state
    const createdAt = new Date()
    const userId = 'anonymous' // 사용자 ID는 기본값으로 'anonymous'로 설정
    const path = `/search/${chatId}` // 경로 설정
    const title = 
      messages.length > 0 
        ? JSON.parse(messages[0].content)?.input?.substring(0, 100) || 'Untitled'
        : 'Untitled' // 메시지에서 제목을 설정하거나 기본값 'Untitled'로 설정

    // 메시지 배열 끝에 'end' 메시지를 추가하여 기록 종료를 알림
    const updatedMessages: AIMessage[] = [
      ...messages,
      {
        id: generateId(), // 고유 메시지 ID 생성
        role: 'assistant', // 역할은 'assistant'
        content: `end`, // 내용은 'end'
        type: 'end' // 메시지 타입은 'end'
      }
    ]

    // 채팅 객체 생성 및 저장
    const chat: Chat = {
      id: chatId,
      createdAt,
      userId,
      path,
      title,
      messages: updatedMessages
    }
    await saveChat(chat) // 채팅 저장
  }
})

// AI 상태에서 UI 상태를 생성하는 함수
export const getUIStateFromAIState = (aiState: Chat) => {
  const chatId = aiState.chatId
  const isSharePage = aiState.isSharePage

  // 메시지 배열을 복사하여 순수한 객체 배열로 변환
  const messages = Array.isArray(aiState.messages) 
    ? aiState.messages.map(msg => ({ ...msg })) 
    : []

  // 각 메시지에 대해 컴포넌트를 생성
  return messages
    .map((message, index) => {
      const { role, content, id, type, name } = message

      // 특정 타입이나 공유 페이지에 표시되지 말아야 하는 메시지들을 필터링
      if (
        !type ||
        type === 'end' ||
        (isSharePage && type === 'related') ||
        (isSharePage && type === 'followup')
      )
        return null

      // 사용자 메시지에 대한 컴포넌트 생성
      switch (role) {
        case 'user':
          switch (type) {
            case 'input':
            case 'input_related':
              const json = JSON.parse(content)
              const value = type === 'input' ? json.input : json.related_query
              return {
                id, // 메시지 ID
                component: (
                  <UserMessage
                    message={value} // 사용자 메시지 내용
                    chatId={chatId} // 채팅 ID
                    showShare={index === 0 && !isSharePage} // 공유 버튼 표시 여부
                  />
                )
              }
            case 'inquiry':
              return {
                id,
                component: <CopilotDisplay content={content} /> // Copilot 디스플레이 컴포넌트
              }
          }

        // AI 어시스턴트 메시지에 대한 컴포넌트 생성
        case 'assistant':
          const answer = createStreamableValue()
          answer.done(content)
          switch (type) {
            case 'answer':
              return {
                id,
                component: <AnswerSection result={answer.value} /> // 답변 섹션 컴포넌트
              }
            case 'related':
              const relatedQueries = createStreamableValue()
              relatedQueries.done(JSON.parse(content))
              return {
                id,
                component: (
                  <SearchRelated relatedQueries={relatedQueries.value} /> // 관련 검색어 컴포넌트
                )
              }
            case 'followup':
              return {
                id,
                component: (
                  <Section title="" className="pb-1">
                    <FollowupPanel /> // 후속 패널 컴포넌트
                  </Section>
                )
              }
          }

        // 도구(tool) 메시지에 대한 컴포넌트 생성
        case 'tool':
          try {
            const toolOutput = JSON.parse(content)
            const isCollapsed = createStreamableValue()
            isCollapsed.done(true)
            const searchResults = createStreamableValue()
            searchResults.done(JSON.stringify(toolOutput))
            switch (name) {
              case 'search':
                return {
                  id,
                  component: <SearchSection result={searchResults.value} />, // 검색 섹션 컴포넌트
                  isCollapsed: isCollapsed.value // 축소 상태
                }
              case 'retrieve':
                return {
                  id,
                  component: <RetrieveSection data={toolOutput} />, // 데이터 검색 섹션
                  isCollapsed: isCollapsed.value
                }
              case 'videoSearch':
                return {
                  id,
                  component: (
                    <VideoSearchSection result={searchResults.value} /> // 비디오 검색 섹션
                  ),
                  isCollapsed: isCollapsed.value
                }
            }
          } catch (error) {
            return {
              id,
              component: null // 오류 발생 시 null 반환
            }
          }

        default:
          return {
            id,
            component: null // 역할이 정의되지 않은 경우 null 반환
          }
      }
    })
    .filter(message => message !== null) as UIState // 유효한 메시지들만 필터링하여 UI 상태로 반환
}
