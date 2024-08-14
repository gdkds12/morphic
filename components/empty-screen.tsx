import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'

const exampleMessages = [
  {
    heading: 'GPT-4o mini는 왜 저렴한가요?',
    message: 'GPT-4o mini는 왜 저렴한가요?'
  },
  {
    heading: '최근 엔비디아가 어떻게 급성장 했나요?',
    message: '최근 엔비디아가 어떻게 급성장 했나요?'
  },
  {
    heading: 'Llama3.1이란 무엇인가요?',
    message: 'Llama3.1이란 무엇인가요?'
  },
  {
    heading: 'AWS vs Cloudflare',
    message: 'AWS vs Cloudflare'
  }
]
export function EmptyScreen({
  submitMessage,
  className
}: {
  submitMessage: (message: string) => void
  className?: string
}) {
  return (
    <div className={`mx-auto w-full transition-all ${className}`}>
      <div className="bg-background p-2">
        <div className="mt-4 flex flex-col items-start space-y-2 mb-4">
          {exampleMessages.map((message, index) => (
            <Button
              key={index}
              variant="link"
              className="h-auto p-0 text-base"
              name={message.message}
              onClick={async () => {
                submitMessage(message.message)
              }}
            >
              <ArrowRight size={16} className="mr-2 text-muted-foreground" />
              {message.heading}
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}
