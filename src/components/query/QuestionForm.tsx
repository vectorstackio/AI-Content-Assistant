// components/query/QuestionForm.tsx

import type { ChangeEventHandler, FormEventHandler, KeyboardEventHandler, Ref } from 'react'

interface QuestionFormProps {
  currentQuestion: string
  placeholder: string
  message: string
  messageClasses: string
  buttonDisabled: boolean
  loading: boolean
  isStreaming: boolean
  textareaRef: Ref<HTMLTextAreaElement>
  onSubmit: FormEventHandler<HTMLFormElement>
  onChange: ChangeEventHandler<HTMLTextAreaElement>
  onKeyDown: KeyboardEventHandler<HTMLTextAreaElement>
}

export default function QuestionForm({
  currentQuestion,
  placeholder,
  message,
  messageClasses,
  buttonDisabled,
  loading,
  isStreaming,
  textareaRef,
  onSubmit,
  onChange,
  onKeyDown,
}: QuestionFormProps) {
  return (
    <div className="border border-gray-300 rounded-3xl p-3 shadow-sm bg-white">
      <form className="flex flex-col gap-4" onSubmit={onSubmit}>
        <textarea
          ref={textareaRef}
          name="question"
          placeholder={placeholder}
          rows={1}
          value={currentQuestion}
          onChange={onChange}
          className="w-full resize-none overflow-hidden border border-gray-300 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          onKeyDown={onKeyDown}
        />

        {message && <div className={messageClasses}>{message}</div>}

        <button
          disabled={buttonDisabled || loading || isStreaming}
          type="submit"
          className={`bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition ${buttonDisabled || loading || isStreaming ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {loading ? 'Thinking...' : 'Ask'}
        </button>
      </form>
    </div>
  )
}
