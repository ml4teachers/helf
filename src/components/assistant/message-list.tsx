// src/components/assistant/message-list.tsx (oder dein Pfad)
'use client'

import React from 'react'
import {
  Card,
  CardContent
} from '@/components/ui/card'
import ReactMarkdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'

type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface MessageListProps {
  messages: Message[]
  isLoading?: boolean
  isPlanningMode?: boolean // Behalte dies bei, wenn du es brauchst
}

// ThinkingIndicator bleibt unverändert
const ThinkingIndicator = ({ planningMode = false }: { planningMode?: boolean }) => {
  const [dots, setDots] = React.useState(1);
  React.useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev === 3 ? 1 : prev + 1);
    }, 400);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex justify-start mb-4 ml-4">
      <Card className="max-w-[80%] py-0 bg-muted/50">
        <CardContent className="p-3">
          <div className="flex items-center space-x-1">
            <span className="text-sm font-medium">
              {planningMode ? "Planning" : "Thinking"}
            </span>
            <span className="text-sm min-w-[18px]">
              {'.'.repeat(dots)}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export function MessageList({ messages, isLoading = false, isPlanningMode = false }: MessageListProps) {
  // Planungsmodus-Erkennung bleibt unverändert
  const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
  const detectPlanMode = lastMessage?.role === 'user' &&
                         (lastMessage.content.toLowerCase().includes('create') ||
                          lastMessage.content.toLowerCase().includes('plan') ||
                          lastMessage.content.toLowerCase().includes('change') ||
                          lastMessage.content.toLowerCase().includes('wochenplan'));
  const showPlanningIndicator = isPlanningMode || (isLoading && detectPlanMode);

  return (
    <div className="w-full overflow-hidden">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`flex w-full ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <Card className={`max-w-[70%] py-0 my-2 shadow-sm ${ 
            message.role === 'user' ? 'bg-primary text-primary-foreground mr-4' : 'bg-muted ml-4'
          }`}>
            <CardContent className="p-3">
              {message.role === 'user' ? (
                // User-Nachrichten: Einfacher Text, JSON entfernen
                 <div className="whitespace-pre-wrap break-words"> {/* Added break-words */}
                  {message.content.replace(/```json\n[\s\S]*?\n```/g, '')}
                </div>
              ) : (
                // Assistant-Nachrichten: Markdown rendern mit verbesserten Komponenten
                <div className="prose prose-sm dark:prose-invert max-w-none break-words"> {/* Added break-words */}
                  <ReactMarkdown
                    // Du brauchst rehypeRaw WAHRSCHEINLICH NICHT, wenn du schon sanitize verwendest.
                    // Raw erlaubt potenziell unsicheres HTML. Sanitize entfernt es.
                    // Entscheide, was du brauchst. Wenn du HTML vom Assistenten nicht brauchst/willst, nimm nur rehypeSanitize.
                    rehypePlugins={[rehypeSanitize]} // Oder [rehypeRaw, rehypeSanitize] wenn HTML erlaubt sein soll
                    components={{
                      // Link styling
                      a: ({ node, ...props }) => (
                        <a {...props} className="text-primary underline hover:no-underline" target="_blank" rel="noopener noreferrer" />
                      ),
                      // Paragraph styling
                      p: ({ node, ...props }) => (
                        <p {...props} className="mb-3 last:mb-0" />
                      ),
                      // Code styling (improved block handling)
                      code: ({ node, className, children, style, ...props }) => {
                        const match = /language-(\w+)/.exec(className || '');
                        const hasLanguage = !!match;
                        const isMultiLine = String(children).includes('\n');
                        const isBlock = hasLanguage || isMultiLine;

                        return !isBlock ? (
                          <code {...props} style={style} className={`relative rounded bg-muted/70 dark:bg-muted/40 px-[0.4rem] py-[0.2rem] font-mono text-sm ${className || ''}`}>
                            {children}
                          </code>
                        ) : (
                          <pre className="block p-3 my-3 rounded-md bg-muted/70 dark:bg-muted/40 font-mono text-sm overflow-x-auto">
                            <code {...props} style={style} className={hasLanguage ? className : ''}>
                                {children}
                            </code>
                          </pre>
                        );
                      },
                      // Unordered List styling
                      ul: ({ node, ...props }) => (
                        <ul {...props} className="list-disc pl-5 mb-3" /> // Increased padding
                      ),
                      // Ordered List styling
                      ol: ({ node, ...props }) => (
                        <ol {...props} className="list-decimal pl-8 mb-3" /> // Increased padding
                      ),
                      // List Item styling
                      li: ({ node, ...props }) => (
                        <li {...props} className="my-1.5" /> // Added vertical spacing
                      ),
                      // Optional: Heading styling
                      h1: ({ node, ...props }) => <h1 {...props} className="text-xl font-bold mt-4 mb-2 border-b pb-1" />,
                      h2: ({ node, ...props }) => <h2 {...props} className="text-lg font-semibold mt-3 mb-1.5" />,
                      h3: ({ node, ...props }) => <h3 {...props} className="text-base font-semibold mt-2 mb-1" />,
                      // Optional: Blockquote styling
                      blockquote: ({ node, ...props }) => <blockquote {...props} className="border-l-4 border-border pl-4 italic my-3 text-muted-foreground" />,
                    }}
                  >
                    {message.content.replace(/```json\n[\s\S]*?\n```/g, '')}
                  </ReactMarkdown>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ))}

      {/* Thinking/Planning Indicator */}
      {isLoading && <ThinkingIndicator planningMode={showPlanningIndicator} />}
    </div>
  )
}