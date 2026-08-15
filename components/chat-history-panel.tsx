'use client';

import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';

interface ChatSession {
  id: string;
  title: string;
  date: Date;
}

interface ChatHistoryPanelProps {
  sessions: ChatSession[];
  activeSessionId?: string;
  onSessionSelect: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onNewChat: () => void;
  onCloseMobile?: () => void;
  isLoading?: boolean;
}

export function ChatHistoryPanel({
  sessions,
  activeSessionId,
  onSessionSelect,
  onDeleteSession,
  onNewChat,
  onCloseMobile,
  isLoading,
}: ChatHistoryPanelProps) {
  const timeAgo = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    const weeks = Math.floor(days / 7);
    if (weeks < 4) return `${weeks}w ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="w-80 sm:w-72 md:w-80 bg-sidebar border-l border-sidebar-border flex flex-col h-full">
      {/* New Chat Action - Fixed */}
      <div className="p-3 sm:p-4 shrink-0">
        <Button
          onClick={onNewChat}
          className="w-full justify-center rounded-sm bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          New Chat
        </Button>
      </div>

      {/* Chat List - Scrollable */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-4 pb-3 sm:pb-4 space-y-1.5 scroll-smooth my-class min-h-0">
        {isLoading ? (
          <div className="space-y-1.5">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="px-3 py-3 rounded-lg border-2 border-border/60"
              >
                <div className="h-4 w-[75%] rounded bg-muted animate-pulse"></div>
                <div className="h-2.5 w-[35%] rounded bg-muted animate-pulse mt-2"></div>
              </div>
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center mt-10">
            <img
              src="/no-history.svg"
              alt="No History"
              className="w-14 h-14 mb-4"
            />
            <p className="text-xs sm:text-sm text-muted-foreground text-center">
              No history yet
            </p>
          </div>
        ) : (
          sessions.map((session) => {
            const isActive = activeSessionId === session.id;
            const isGenerating = session.title === 'Generating title...';

            return (
              <div
                key={session.id}
                onClick={() => onSessionSelect(session.id)}
                className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-150 ${
                  isActive
                    ? 'bg-primary/10 border-2 border-primary'
                    : 'border-2 border-border/60 hover:border-border hover:bg-muted/50'
                }`}
              >
                {isGenerating ? (
                  <div className="flex-1 min-w-0 flex flex-col gap-2 py-0.5">
                    <div className="h-3 w-[80%] rounded bg-muted animate-pulse"></div>
                    <div className="h-2.5 w-[45%] rounded bg-muted animate-pulse"></div>
                  </div>
                ) : (
                  <>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm font-medium truncate ${isActive ? 'text-primary' : 'text-foreground'}`}
                      >
                        {session.title}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {timeAgo(session.date)}
                      </p>
                    </div>
                    <button
                      className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-destructive/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteSession(session.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground group-hover:text-destructive transition-colors" />
                    </button>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
