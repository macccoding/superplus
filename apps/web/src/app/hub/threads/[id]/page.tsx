'use client';

import { Suspense, use, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { trpc } from '@/lib/trpc-client';
import {
  cacheThreadDetail,
  queueThreadMutation,
  readCachedThreadDetail,
  readQueuedThreadMutations,
} from '@/lib/thread-offline';
import { type DraftThreadAttachment, fileToThreadAttachment, humanFileSize, MAX_THREAD_UPLOAD_BYTES } from '@/lib/thread-attachments';

const roleRank: Record<string, number> = { STAFF: 1, SUPERVISOR: 2, MANAGER: 3, OWNER: 4 };
const attachmentTypes = ['IMAGE', 'DOCUMENT', 'LINK'] as const;
const quickReplies = ['Done', 'Checking now', 'Need help', 'Can someone confirm?', 'On my way', 'Ordered'];

function sourceHref(type: string, entityId: string) {
  const hrefs: Record<string, string> = {
    TASK: `/hub/tasks/${entityId}`,
    INCIDENT: `/tools/incidents/${entityId}`,
    LOGBOOK: '/hub/logbook',
    CHECKLIST: '/tools/closing-checklist',
    PRODUCT: `/tools/product-lookup/${entityId}`,
    STOCK_OUT: '/tools/stock-out',
    EXPIRY_ALERT: '/tools/expiry-tracker',
    PURCHASE_ORDER: '/admin/orders',
    SOP_GUIDE: `/hub/training/${entityId}`,
    THREAD: `/hub/threads/${entityId}`,
  };
  return hrefs[type] ?? null;
}

function reactionCounts(reactions: any[]) {
  return reactions.reduce((acc, reaction) => {
    acc[reaction.type] = (acc[reaction.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

function initials(name: string) {
  return name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}

function messageDateLabel(value: Date | string) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
}

function sameDay(a: Date | string, b: Date | string) {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

function nearBottom(element: HTMLDivElement | null) {
  if (!element) return true;
  return element.scrollHeight - element.scrollTop - element.clientHeight < 160;
}

function plainError(message?: string) {
  if (!message) return '';
  if (message.includes('TRPC') || message.includes('Unexpected')) return 'Something went wrong. Try again.';
  return message;
}

function RecapRows({ title, rows }: { title: string; rows: Array<{ id: string; author: string; body: string }> }) {
  if (rows.length === 0) return null;
  return (
    <div>
      <p className="mb-1 text-xs font-extrabold uppercase text-on-surface-secondary">{title}</p>
      <div className="space-y-1">
        {rows.map((row) => (
          <button
            key={row.id}
            onClick={() => document.getElementById(`message-${row.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
            className="w-full rounded-[--radius-lg] bg-surface-white px-3 py-2 text-left"
          >
            <p className="text-xs font-bold text-on-surface-secondary">{row.author}</p>
            <p className="truncate text-sm font-bold text-on-surface">{row.body}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

function ThreadDetailContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const [reply, setReply] = useState('');
  const [replyMoreOpen, setReplyMoreOpen] = useState(false);
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([]);
  const [mentionGroupIds, setMentionGroupIds] = useState<string[]>([]);
  const [mentionSearch, setMentionSearch] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [attachmentLabel, setAttachmentLabel] = useState('');
  const [attachmentType, setAttachmentType] = useState<typeof attachmentTypes[number]>('IMAGE');
  const [attachments, setAttachments] = useState<DraftThreadAttachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [cachedThread, setCachedThread] = useState<any>(null);
  const [actionMessage, setActionMessage] = useState('');
  const [editMessageId, setEditMessageId] = useState('');
  const [editBody, setEditBody] = useState('');
  const [ackMessageId, setAckMessageId] = useState('');
  const [taskMessageId, setTaskMessageId] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskAssignedToId, setTaskAssignedToId] = useState('');
  const [taskPriority, setTaskPriority] = useState<'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'>('NORMAL');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskCategory, setTaskCategory] = useState('');
  const [taskQuote, setTaskQuote] = useState('');
  const [recapOpen, setRecapOpen] = useState(false);
  const [receiptsOpen, setReceiptsOpen] = useState(false);
  const [moderationOpen, setModerationOpen] = useState(false);
  const [threadMenuOpen, setThreadMenuOpen] = useState(false);
  const [messageMenuId, setMessageMenuId] = useState('');
  const [optimisticMessages, setOptimisticMessages] = useState<any[]>([]);
  const [showNewMessages, setShowNewMessages] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [threadSearch, setThreadSearch] = useState('');
  const [searchIndex, setSearchIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const markedReadRef = useRef('');
  const messageCountRef = useRef(0);
  const utils = trpc.useUtils();
  const from = searchParams.get('from') || 'all';
  const canManage = roleRank[session?.user?.role || 'STAFF'] >= 2;

  const { data: liveThread, isLoading, isError } = trpc.threads.getById.useQuery({ id }, {
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
  });
  const { data: mentionTargets } = trpc.threads.mentionTargets.useQuery();
  const { data: taskUsers } = trpc.tasks.assignableUsers.useQuery(undefined, { enabled: canManage });
  const { data: recap } = trpc.threads.recap.useQuery({ id }, { enabled: recapOpen && !!id });
  const { data: readReceipts } = trpc.threads.readReceipts.useQuery({ id }, { enabled: receiptsOpen && canManage });
  const { data: taskPreview } = trpc.threads.taskEscalationPreview.useQuery({ messageId: taskMessageId }, { enabled: canManage && !!taskMessageId });
  const { data: opsSuggestions } = trpc.threads.detectOpsSuggestions.useQuery({ threadId: id }, { enabled: canManage && !!id });
  const sendReply = trpc.threads.reply.useMutation({
    onSuccess: () => {
      setReply('');
      setMentionedUserIds([]);
      setMentionGroupIds([]);
      setMentionSearch('');
      setAttachmentUrl('');
      setAttachmentLabel('');
      setAttachments([]);
      setReplyMoreOpen(false);
      setActionMessage('Reply sent');
      utils.threads.invalidate();
    },
  });
  const markRead = trpc.threads.markRead.useMutation({ onSuccess: () => utils.threads.invalidate() });
  const toggleSave = trpc.threads.toggleSave.useMutation({ onSuccess: () => utils.threads.invalidate() });
  const toggleFollow = trpc.threads.toggleFollow.useMutation({ onSuccess: () => utils.threads.invalidate() });
  const toggleMute = trpc.threads.toggleMute.useMutation({ onSuccess: () => utils.threads.invalidate() });
  const togglePin = trpc.threads.togglePin.useMutation({ onSuccess: () => utils.threads.invalidate() });
  const resolve = trpc.threads.resolve.useMutation({ onSuccess: () => utils.threads.invalidate() });
  const react = trpc.threads.react.useMutation({ onSuccess: () => utils.threads.invalidate() });
  const deleteMessage = trpc.threads.deleteMessage.useMutation({ onSuccess: () => utils.threads.invalidate() });
  const toggleMessagePin = trpc.threads.toggleMessagePin.useMutation({ onSuccess: () => utils.threads.invalidate() });
  const editMessage = trpc.threads.editMessage.useMutation({
    onSuccess: () => {
      setEditMessageId('');
      setEditBody('');
      utils.threads.invalidate();
    },
  });
  const createTask = trpc.threads.createTaskFromMessage.useMutation({
    onSuccess: (task) => {
      setActionMessage(`Task created: ${task.title}`);
      utils.threads.invalidate();
    },
  });
  const dismissSuggestion = trpc.threads.dismissOpsSuggestion.useMutation({ onSuccess: () => utils.threads.invalidate() });

  useEffect(() => {
    setCachedThread(readCachedThreadDetail<any>(id)?.thread ?? null);
  }, [id]);

  useEffect(() => {
    if (liveThread) cacheThreadDetail(liveThread);
  }, [liveThread]);

  useEffect(() => {
    if (!taskPreview) return;
    setTaskTitle(taskPreview.suggestedTitle);
    setTaskAssignedToId(taskPreview.suggestedAssigneeId || '');
    setTaskPriority(taskPreview.suggestedPriority as typeof taskPriority);
    setTaskCategory(taskPreview.suggestedCategory || '');
    setTaskQuote(taskPreview.quote || '');
  }, [taskPreview]);

  const thread = liveThread ?? cachedThread;
  const usingCache = !liveThread && !!cachedThread && isError;
  const canSendReply = !!reply.trim() || attachments.length > 0 || !!attachmentUrl.trim();
  const queuedReplyMessages = readQueuedThreadMutations()
    .filter((entry) => entry.type === 'REPLY' && (entry.payload as any)?.threadId === id)
    .map((entry) => {
      const payload = entry.payload as any;
      return {
        id: entry.id,
        authorId: session?.user?.id,
        author: { id: session?.user?.id, fullName: session?.user?.name || 'You', role: session?.user?.role },
        body: payload.body,
        createdAt: entry.createdAt,
        editedAt: null,
        deletedAt: null,
        isPinned: false,
        mentions: [],
        reactions: [],
        attachments: payload.attachments || [],
        links: [],
        deliveryStatus: 'queued',
      };
    });
  const visibleMessages = thread
    ? [
      ...thread.messages,
      ...queuedReplyMessages,
      ...optimisticMessages.filter((message) => !queuedReplyMessages.some((queued) => queued.id === message.id)),
    ].sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    : [];
  const searchMatches = useMemo(() => {
    const term = threadSearch.trim().toLowerCase();
    if (!term) return [];
    return visibleMessages
      .filter((message: any) => !message.deletedAt && `${message.body} ${message.author?.fullName || ''}`.toLowerCase().includes(term))
      .map((message: any) => message.id);
  }, [threadSearch, visibleMessages]);
  const searchMatchKey = searchMatches.join('|');

  useEffect(() => {
    if (!thread) return;
    const previousCount = messageCountRef.current;
    const nextCount = visibleMessages.length;
    const shouldJumpToBottom = previousCount === 0 || nearBottom(scrollRef.current);
    messageCountRef.current = nextCount;
    if (shouldJumpToBottom) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      setShowNewMessages(false);
    } else if (nextCount > previousCount) {
      setShowNewMessages(true);
    }
  }, [visibleMessages.length, thread]);

  useEffect(() => {
    setSearchIndex(0);
  }, [threadSearch]);

  useEffect(() => {
    if (!searchOpen || !threadSearch.trim() || searchMatches.length === 0) return;
    setSearchIndex(0);
    document.getElementById(`message-${searchMatches[0]}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [searchMatchKey, searchOpen, threadSearch]);

  useEffect(() => {
    if (!thread?.id || markedReadRef.current === thread.id) return;
    markedReadRef.current = thread.id;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      queueThreadMutation('MARK_READ', { id: thread.id });
      return;
    }
    markRead.mutate({ id: thread.id });
  }, [thread?.id]);

  const toggleMention = (userId: string) => {
    setMentionedUserIds((current) => (
      current.includes(userId) ? current.filter((item) => item !== userId) : [...current, userId]
    ));
  };

  const toggleMentionGroup = (groupId: string) => {
    setMentionGroupIds((current) => (
      current.includes(groupId) ? current.filter((item) => item !== groupId) : [...current, groupId]
    ));
  };

  const replyPayload = () => ({
    threadId: id,
    body: reply.trim() || (attachments.length > 0 || attachmentUrl.trim() ? 'Attachment' : reply),
    mentionedUserIds,
    mentionGroupIds: mentionGroupIds as any,
    attachments: [
      ...attachments,
      ...(attachmentUrl.trim()
        ? [{ type: attachmentType, url: attachmentUrl.trim(), label: attachmentLabel.trim() || undefined }]
        : []),
    ].slice(0, 5),
  });

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    try {
      setIsUploading(true);
      setActionMessage('Uploading file...');
      const next = await Promise.all(Array.from(files).slice(0, 5 - attachments.length).map(fileToThreadAttachment));
      setAttachments((current) => [...current, ...next].slice(0, 5));
      setActionMessage('');
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : 'Could not attach that file.');
    } finally {
      setIsUploading(false);
    }
  };

  const openTaskSheet = (msg: any) => {
    setTaskMessageId(msg.id);
    setTaskTitle(`Follow up: ${thread.title}`);
    setTaskAssignedToId('');
    setTaskPriority('NORMAL');
    setTaskDueDate('');
    setTaskCategory('');
    setTaskQuote(msg.body.slice(0, 500));
  };

  const openTaskSheetFromSuggestion = (suggestion: any) => {
    const msg = thread.messages.find((item: any) => item.id === suggestion.messageId) || thread.messages[thread.messages.length - 1];
    if (!msg) return;
    setTaskMessageId(msg.id);
    setTaskTitle(`Follow up: ${suggestion.title}`);
    setTaskAssignedToId('');
    setTaskPriority(suggestion.priority || 'NORMAL');
    setTaskDueDate('');
    setTaskCategory(suggestion.taskCategory || '');
    setTaskQuote(msg.body.slice(0, 500));
  };

  const submitTaskFromMessage = () => {
    if (!taskMessageId) return;
    createTask.mutate({
      messageId: taskMessageId,
      title: taskTitle,
      assignedToId: taskAssignedToId || undefined,
      priority: taskPriority,
      dueDate: taskDueDate ? new Date(`${taskDueDate}T12:00:00`) : undefined,
      category: taskCategory || undefined,
      quote: taskQuote || undefined,
      preventDuplicate: true,
    }, {
      onSuccess: () => {
        setTaskMessageId('');
        setTaskTitle('');
      },
    });
  };

  const submitReply = () => {
    const hasAttachment = attachments.length > 0 || !!attachmentUrl.trim();
    if (!reply.trim() && !hasAttachment) return;
    if (!session?.user) return;
    const input = replyPayload();
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const queued = queueThreadMutation('REPLY', input);
      setReply('');
      setMentionedUserIds([]);
      setMentionGroupIds([]);
      setAttachments([]);
      setReplyMoreOpen(false);
      setActionMessage(queued ? 'Queued. It will send when online.' : 'Could not save this reply on this phone. Try again when online.');
      return;
    }
    const optimisticId = `sending-${Date.now()}`;
    const currentUser = session.user;
    setOptimisticMessages((current) => [
      ...current,
      {
        id: optimisticId,
        authorId: currentUser.id,
        author: { id: currentUser.id, fullName: currentUser.name || 'You', role: currentUser.role },
        body: input.body,
        createdAt: new Date().toISOString(),
        editedAt: null,
        deletedAt: null,
        isPinned: false,
        mentions: [],
        reactions: [],
        attachments: input.attachments || [],
        links: [],
        deliveryStatus: 'sending',
        payload: input,
      },
    ]);
    setReply('');
    setMentionedUserIds([]);
    setMentionGroupIds([]);
    setMentionSearch('');
    setAttachmentUrl('');
    setAttachmentLabel('');
    setAttachments([]);
    setReplyMoreOpen(false);
    sendReply.mutate(input, {
      onSuccess: () => {
        setOptimisticMessages((current) => current.filter((message) => message.id !== optimisticId));
      },
      onError: () => {
        setOptimisticMessages((current) => current.map((message) => (
          message.id === optimisticId ? { ...message, deliveryStatus: 'failed' } : message
        )));
      },
    });
  };

  const runReaction = (messageId: string, type: 'ACK' | 'THANKS') => {
    const input = { messageId, type };
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const queued = queueThreadMutation('REACT', input);
      setActionMessage(queued ? `Reaction saved on this phone. ${readQueuedThreadMutations().length} waiting.` : 'Could not save this reaction on this phone. Try again when online.');
      return;
    }
    react.mutate(input);
  };

  const retryFailedReply = (msg: any) => {
    if (!msg.payload) return;
    setOptimisticMessages((current) => current.map((item) => (
      item.id === msg.id ? { ...item, deliveryStatus: 'sending' } : item
    )));
    sendReply.mutate(msg.payload, {
      onSuccess: () => {
        setOptimisticMessages((current) => current.filter((item) => item.id !== msg.id));
      },
      onError: () => {
        setOptimisticMessages((current) => current.map((item) => (
          item.id === msg.id ? { ...item, deliveryStatus: 'failed' } : item
        )));
      },
    });
  };

  const goToSearchResult = (direction: 1 | -1) => {
    if (searchMatches.length === 0) return;
    const nextIndex = (searchIndex + direction + searchMatches.length) % searchMatches.length;
    setSearchIndex(nextIndex);
    document.getElementById(`message-${searchMatches[nextIndex]}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const addQuickReply = (text: string) => {
    setReply((current) => current.trim() ? `${current.trim()}\n${text}` : text);
  };

  const filteredMentionUsers = (mentionTargets?.users || []).filter((user) => (
    !mentionSearch.trim() || user.fullName.toLowerCase().includes(mentionSearch.trim().toLowerCase())
  ));

  if ((isLoading && !thread) || !session?.user) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="material-symbols-outlined animate-spin text-brand text-[32px]">progress_activity</span>
      </div>
    );
  }

  if (!thread) {
    return (
      <div className="px-5 py-6">
        <button onClick={() => router.push(`/hub/threads?tab=${from}`)} className="flex items-center gap-1 text-sm text-on-surface-secondary mb-6">
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Back
        </button>
        <div className="text-center py-12">
          <span className="material-symbols-outlined text-[48px] text-outline mb-3">search_off</span>
          <p className="text-on-surface-secondary">Thread not found</p>
        </div>
      </div>
    );
  }

  const mutationError =
    plainError(sendReply.error?.message) ||
    plainError(toggleSave.error?.message) ||
    plainError(toggleFollow.error?.message) ||
    plainError(toggleMute.error?.message) ||
    plainError(togglePin.error?.message) ||
    plainError(resolve.error?.message) ||
    plainError(react.error?.message) ||
    plainError(toggleMessagePin.error?.message) ||
    plainError(editMessage.error?.message) ||
    plainError(deleteMessage.error?.message) ||
    plainError(createTask.error?.message) ||
    plainError(dismissSuggestion.error?.message) ||
    actionMessage;
  const isDirect = thread.type === 'DIRECT';
  const canManageThreadActions = canManage && !isDirect;
  const pinnedMessages = thread.messages.filter((msg: any) => msg.isPinned && !msg.deletedAt);
  const urgentAckUsers = Array.from(new Map(
    thread.messages
      .flatMap((msg: any) => msg.reactions || [])
      .filter((reaction: any) => reaction.type === 'ACK')
      .map((reaction: any) => [reaction.user.id, reaction.user])
  ).values());

  return (
    <div className="flex flex-col h-[calc(100dvh-64px)]">
      <div className="sticky top-0 z-30 bg-surface-white px-3 py-2 border-b border-outline/30 shrink-0">
        <div className="flex items-center gap-2">
          <button onClick={() => router.push(`/hub/threads?tab=${from}`)} className="w-11 h-11 rounded-full bg-surface text-on-surface-secondary flex items-center justify-center">
            <span className="material-symbols-outlined text-[22px]">arrow_back</span>
          </button>
          <div className={`w-11 h-11 rounded-full ${isDirect ? 'bg-navy' : thread.category === 'URGENT' ? 'bg-brand' : 'bg-success'} text-white flex items-center justify-center shrink-0`}>
            <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>{isDirect ? 'person' : thread.type === 'CHANNEL' ? 'storefront' : 'forum'}</span>
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-extrabold text-on-surface">{thread.title}</h2>
            <p className="truncate text-xs font-bold text-on-surface-secondary">
              {isDirect ? 'Private staff message' : `${thread.category.toLowerCase().replace('_', ' ')} · ${thread.messages.length} messages`}
              {thread.isResolved ? ' · Done' : ''}
            </p>
          </div>
          <button
            onClick={() => setThreadMenuOpen(true)}
            className="w-11 h-11 rounded-full bg-surface text-on-surface-secondary flex items-center justify-center"
            aria-label="Chat actions"
          >
            <span className="material-symbols-outlined text-[22px]">more_vert</span>
          </button>
        </div>
      </div>

      {(usingCache || mutationError) && (
        <div className={`mx-5 mt-3 rounded-[--radius-lg] px-4 py-3 text-sm font-bold flex items-center gap-2 ${usingCache || sendReply.error || toggleSave.error || toggleFollow.error || toggleMute.error || togglePin.error || resolve.error || react.error || toggleMessagePin.error || editMessage.error || deleteMessage.error || createTask.error ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'}`}>
          <span className="material-symbols-outlined text-[20px]">{usingCache ? 'cloud_off' : sendReply.error || toggleSave.error || toggleFollow.error || toggleMute.error || togglePin.error || resolve.error || react.error || toggleMessagePin.error || editMessage.error || deleteMessage.error || createTask.error ? 'info' : 'check_circle'}</span>
          {usingCache ? 'Showing saved thread details' : mutationError}
        </div>
      )}

      {searchOpen && (
        <div className="border-b border-outline/30 bg-surface-white px-3 py-2">
          <div className="flex items-center gap-2">
            <label className="relative min-w-0 flex-1">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-secondary">search</span>
              <input
                value={threadSearch}
                onChange={(event) => setThreadSearch(event.target.value)}
                placeholder="Search in chat"
                className="h-11 w-full rounded-full border-2 border-outline bg-surface pl-10 pr-4 text-sm font-bold text-on-surface placeholder:text-on-surface-secondary focus:border-primary focus:outline-none"
              />
            </label>
            <button onClick={() => goToSearchResult(-1)} disabled={searchMatches.length === 0} className="h-10 w-10 rounded-full bg-surface text-on-surface-secondary disabled:opacity-30">
              <span className="material-symbols-outlined text-[20px]">keyboard_arrow_up</span>
            </button>
            <button onClick={() => goToSearchResult(1)} disabled={searchMatches.length === 0} className="h-10 w-10 rounded-full bg-surface text-on-surface-secondary disabled:opacity-30">
              <span className="material-symbols-outlined text-[20px]">keyboard_arrow_down</span>
            </button>
            <button onClick={() => { setSearchOpen(false); setThreadSearch(''); }} className="h-10 w-10 rounded-full bg-surface text-on-surface-secondary">
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
          {threadSearch.trim() && (
            <p className="mt-1 px-2 text-xs font-bold text-on-surface-secondary">
              {searchMatches.length === 0 ? 'No messages found' : `${searchIndex + 1} of ${searchMatches.length}`}
            </p>
          )}
        </div>
      )}

      {threadMenuOpen && (
        <div className="fixed inset-0 z-[70] bg-black/30 flex items-end" onClick={() => setThreadMenuOpen(false)}>
          <div className="w-full rounded-t-[--radius-lg] bg-surface-white p-4 shadow-[--shadow-elevated]" onClick={(event) => event.stopPropagation()}>
            <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-outline/60" />
            <div className="space-y-3">
              <div className="space-y-1">
                <p className="px-2 text-xs font-extrabold uppercase text-on-surface-secondary">Chat</p>
                <button onClick={() => { setThreadMenuOpen(false); setSearchOpen(true); }} className="min-h-[52px] w-full rounded-[--radius-lg] bg-surface px-4 text-left text-on-surface font-bold flex items-center gap-3">
                  <span className="material-symbols-outlined">search</span>
                  Search in chat
                </button>
                <button onClick={() => { setThreadMenuOpen(false); setRecapOpen(!recapOpen); }} className="min-h-[52px] w-full rounded-[--radius-lg] bg-navy/10 px-4 text-left text-navy font-bold flex items-center gap-3">
                  <span className="material-symbols-outlined">summarize</span>
                  Catch up
                </button>
              </div>
              <div className="space-y-1">
                <p className="px-2 text-xs font-extrabold uppercase text-on-surface-secondary">Notifications</p>
                <button onClick={() => { setThreadMenuOpen(false); toggleSave.mutate({ id }); }} className="min-h-[52px] w-full rounded-[--radius-lg] bg-surface px-4 text-left text-on-surface font-bold flex items-center gap-3">
                  <span className="material-symbols-outlined">{thread.isSaved ? 'bookmark_remove' : 'bookmark'}</span>
                  {thread.isSaved ? 'Unsave chat' : 'Save chat'}
                </button>
                <button onClick={() => { setThreadMenuOpen(false); toggleMute.mutate({ id }); }} className="min-h-[52px] w-full rounded-[--radius-lg] bg-surface px-4 text-left text-on-surface font-bold flex items-center gap-3">
                  <span className="material-symbols-outlined">{thread.isMuted ? 'volume_up' : 'volume_off'}</span>
                  {thread.isMuted ? 'Unmute alerts' : 'Mute alerts'}
                </button>
                <button onClick={() => { setThreadMenuOpen(false); toggleFollow.mutate({ id }); }} className="min-h-[52px] w-full rounded-[--radius-lg] bg-surface px-4 text-left text-on-surface font-bold flex items-center gap-3">
                  <span className="material-symbols-outlined">{thread.isFollowing ? 'notifications_off' : 'notifications_active'}</span>
                  {thread.isFollowing ? 'Stop following' : 'Follow replies'}
                </button>
              </div>
              {canManageThreadActions && (
                <div className="space-y-1 border-t border-outline/30 pt-3">
                  <p className="px-2 text-xs font-extrabold uppercase text-on-surface-secondary">Supervisor</p>
                  <button onClick={() => { setThreadMenuOpen(false); togglePin.mutate({ id }); }} className="min-h-[52px] w-full rounded-[--radius-lg] bg-warning/10 px-4 text-left text-warning font-bold flex items-center gap-3">
                    <span className="material-symbols-outlined">push_pin</span>
                    {thread.isPinned ? 'Unpin chat' : 'Pin chat'}
                  </button>
                  {!thread.isResolved && (
                    <button onClick={() => { setThreadMenuOpen(false); resolve.mutate({ id }); }} className="min-h-[52px] w-full rounded-[--radius-lg] bg-success/10 px-4 text-left text-success font-bold flex items-center gap-3">
                      <span className="material-symbols-outlined">check_circle</span>
                      Mark done
                    </button>
                  )}
                  {thread.category === 'URGENT' && (
                    <button onClick={() => { setThreadMenuOpen(false); setReceiptsOpen(!receiptsOpen); }} className="min-h-[52px] w-full rounded-[--radius-lg] bg-brand/10 px-4 text-left text-brand font-bold flex items-center gap-3">
                      <span className="material-symbols-outlined">visibility</span>
                      Seen list
                    </button>
                  )}
                  <button onClick={() => { setThreadMenuOpen(false); setModerationOpen(!moderationOpen); }} className="min-h-[52px] w-full rounded-[--radius-lg] bg-surface px-4 text-left text-on-surface-secondary font-bold flex items-center gap-3">
                    <span className="material-symbols-outlined">history</span>
                    Action trail
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto bg-surface p-[--spacing-container] space-y-3"
        style={{ paddingBottom: thread.isResolved ? '96px' : replyMoreOpen ? '420px' : '176px' }}
      >
        {(thread.unreadCount || 0) >= 5 && !recapOpen && (
          <button
            onClick={() => setRecapOpen(true)}
            className="w-full min-h-12 rounded-[--radius-lg] bg-navy/10 px-4 text-sm font-extrabold text-navy flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[20px]">summarize</span>
            Catch up on {thread.unreadCount} new messages
          </button>
        )}
        {recapOpen && (
          <div className="rounded-[--radius-lg] bg-navy/5 p-3 space-y-3">
            <div className="flex items-center gap-2 text-navy font-extrabold text-sm">
              <span className="material-symbols-outlined text-[20px]">summarize</span>
              Catch Up
            </div>
            {!recap ? (
              <p className="text-sm font-bold text-on-surface-secondary">Loading...</p>
            ) : (
              <>
                <p className="text-xs font-bold text-on-surface-secondary">{recap.messageCount} messages · {recap.ackCount} acknowledged · {recap.taskLinks.length} linked tasks</p>
                {recap.pinned.length > 0 && <RecapRows title="Pinned" rows={recap.pinned} />}
                {recap.decisions.length > 0 && <RecapRows title="Decisions" rows={recap.decisions} />}
                {recap.openQuestions.length > 0 && <RecapRows title="Questions" rows={recap.openQuestions} />}
                <RecapRows title="Latest" rows={recap.latest} />
              </>
            )}
          </div>
        )}

        {receiptsOpen && canManageThreadActions && thread.category === 'URGENT' && (
          <div className="rounded-[--radius-lg] bg-brand/10 p-3 space-y-2 text-brand">
            <div className="flex items-center gap-2 font-extrabold text-sm">
              <span className="material-symbols-outlined text-[20px]">visibility</span>
              Urgent Seen List
            </div>
            {(readReceipts || []).map((user) => (
              <div key={user.id} className="min-h-10 rounded-[--radius-lg] bg-surface-white px-3 py-2 flex items-center gap-2 text-on-surface">
                <span className={`material-symbols-outlined text-[18px] ${user.hasAcknowledged ? 'text-success' : user.hasSeen ? 'text-navy' : 'text-outline'}`}>
                  {user.hasAcknowledged ? 'check_circle' : user.hasSeen ? 'visibility' : 'visibility_off'}
                </span>
                <span className="flex-1 text-sm font-bold">{user.fullName}</span>
                <span className="text-xs font-bold text-on-surface-secondary">{user.hasAcknowledged ? 'Ack' : user.hasSeen ? 'Seen' : 'Not yet'}</span>
              </div>
            ))}
          </div>
        )}

        {moderationOpen && canManageThreadActions && (
          <div className="rounded-[--radius-lg] bg-surface-white p-3 space-y-2 shadow-sm">
            <div className="flex items-center gap-2 text-on-surface font-extrabold text-sm">
              <span className="material-symbols-outlined text-[20px]">history</span>
              Action Trail
            </div>
            {(thread.moderationEvents || []).length === 0 ? (
              <p className="text-sm text-on-surface-secondary">No supervisor actions yet</p>
            ) : (thread.moderationEvents || []).map((event: any) => (
              <div key={event.id} className="rounded-[--radius-lg] bg-surface px-3 py-2">
                <p className="text-sm font-bold text-on-surface">{event.action.replaceAll('_', ' ').toLowerCase()}</p>
                <p className="text-xs text-on-surface-secondary">{event.actor.fullName} · {new Date(event.createdAt).toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}

        {pinnedMessages.length > 0 && (
          <div className="rounded-[--radius-lg] bg-warning/10 p-3 space-y-2">
            <div className="flex items-center gap-2 text-warning font-extrabold text-sm">
              <span className="material-symbols-outlined text-[20px]">push_pin</span>
              Pinned
            </div>
            {pinnedMessages.map((msg: any) => (
              <button
                key={msg.id}
                onClick={() => document.getElementById(`message-${msg.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                className="w-full rounded-[--radius-lg] bg-surface-white px-3 py-2 text-left"
              >
                <p className="text-xs font-bold text-on-surface-secondary">{msg.author.fullName}</p>
                <p className="text-sm font-bold text-on-surface truncate">{msg.body}</p>
              </button>
            ))}
          </div>
        )}

        {canManageThreadActions && thread.category === 'URGENT' && (
          <div className="rounded-[--radius-lg] bg-brand/10 p-3 text-brand">
            <div className="flex items-center gap-2 font-extrabold text-sm">
              <span className="material-symbols-outlined text-[20px]">check_circle</span>
              {urgentAckUsers.length} staff acknowledged
            </div>
            {urgentAckUsers.length > 0 && (
              <p className="mt-1 text-xs font-bold text-brand/80">
                {(urgentAckUsers as any[]).map((user) => user.fullName).join(', ')}
              </p>
            )}
          </div>
        )}

        {canManageThreadActions && (opsSuggestions || []).length > 0 && (
          <div className="rounded-[--radius-lg] bg-warning/10 p-3 space-y-2 text-warning">
            <div className="flex items-center gap-2 font-extrabold text-sm">
              <span className="material-symbols-outlined text-[20px]">tips_and_updates</span>
              Suggested Follow-up
            </div>
            {(opsSuggestions || []).map((suggestion: any) => (
              <div key={suggestion.id} className="rounded-[--radius-lg] bg-surface-white p-3 text-on-surface">
                <div className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-[20px] text-warning">{suggestion.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-extrabold">{suggestion.title}</p>
                    <p className="mt-1 text-xs font-bold text-on-surface-secondary">{suggestion.body}</p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => openTaskSheetFromSuggestion(suggestion)}
                    className="min-h-10 rounded-[--radius-lg] bg-brand text-on-brand text-sm font-bold flex items-center justify-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[18px]">add_task</span>
                    Make Task
                  </button>
                  <button
                    onClick={() => dismissSuggestion.mutate({ threadId: id, suggestionId: suggestion.id })}
                    className="min-h-10 rounded-[--radius-lg] bg-surface text-on-surface-secondary text-sm font-bold"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {thread.links?.length > 0 && (
          <div className="bg-navy/5 rounded-[--radius-lg] p-3 flex flex-wrap gap-2">
            {thread.links.map((link: any) => {
              const href = sourceHref(link.type, link.entityId);
              const className = 'min-h-10 px-3 rounded-[--radius-lg] bg-surface-white text-navy text-sm font-bold inline-flex items-center gap-2';
              return href ? (
                <button key={link.id} onClick={() => router.push(href)} className={className}>
                  <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                  {link.label || link.type}
                </button>
              ) : <span key={link.id} className={className}>{link.label || link.type}</span>;
            })}
          </div>
        )}

        {visibleMessages.map((msg: any, index: number) => {
          const mine = msg.authorId === session.user.id;
          const counts = reactionCounts(msg.reactions || []);
          const ackUsers = (msg.reactions || []).filter((reaction: any) => reaction.type === 'ACK').map((reaction: any) => reaction.user);
          const isEditing = editMessageId === msg.id;
          const showAuthor = !mine && !isDirect;
          const showDate = index === 0 || !sameDay(visibleMessages[index - 1].createdAt, msg.createdAt);
          const deliveryStatus = msg.deliveryStatus as 'sending' | 'queued' | 'failed' | undefined;
          const isSearchHit = searchMatches.includes(msg.id);
          const isActiveSearchHit = searchMatches[searchIndex] === msg.id;
          return (
            <div key={msg.id}>
              {showDate && (
                <div className="my-3 flex justify-center">
                  <span className="rounded-full bg-surface-white px-3 py-1 text-xs font-bold text-on-surface-secondary shadow-sm">
                    {messageDateLabel(msg.createdAt)}
                  </span>
                </div>
              )}
              <div id={`message-${msg.id}`} className={`flex ${mine ? 'justify-end' : 'justify-start'} gap-2`}>
                {!mine && !isDirect && (
                  <div className="mt-1 w-8 h-8 rounded-full bg-navy/10 text-navy flex items-center justify-center shrink-0">
                    <span className="text-xs font-extrabold">{initials(msg.author.fullName)}</span>
                  </div>
                )}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => !deliveryStatus && setMessageMenuId(messageMenuId === msg.id ? '' : msg.id)}
                  onKeyDown={(event) => {
                    if ((event.key === 'Enter' || event.key === ' ') && !deliveryStatus) {
                      event.preventDefault();
                      setMessageMenuId(messageMenuId === msg.id ? '' : msg.id);
                    }
                  }}
                  className={`relative max-w-[82%] rounded-2xl px-3 py-2 text-left shadow-sm ${mine ? 'rounded-br-md bg-brand text-on-brand' : 'rounded-bl-md bg-surface-white text-on-surface'} ${msg.isPinned ? 'ring-2 ring-warning/30' : ''} ${isSearchHit ? (isActiveSearchHit ? 'ring-2 ring-brand' : 'ring-2 ring-warning/40') : ''}`}
                  aria-label="Open message actions"
                >
                  {showAuthor && <p className="mb-1 text-xs font-extrabold text-navy">{msg.author.fullName}</p>}

                  {msg.deletedAt ? (
                    <p className={`text-sm italic ${mine ? 'text-on-brand/80' : 'text-on-surface-secondary'}`}>Message deleted</p>
                  ) : isEditing ? (
                    <div className="space-y-2" onClick={(event) => event.stopPropagation()}>
                      <textarea
                        value={editBody}
                        onChange={(event) => setEditBody(event.target.value)}
                        className="w-full min-w-[220px] px-3 py-2 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-sm text-on-surface"
                        rows={3}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => setEditMessageId('')} className="min-h-10 rounded-[--radius-lg] bg-surface text-on-surface-secondary font-bold">Cancel</button>
                        <button onClick={() => editMessage.mutate({ messageId: msg.id, body: editBody })} className="min-h-10 rounded-[--radius-lg] bg-brand text-on-brand font-bold">Save</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{msg.body}</p>

                      {msg.mentions?.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {msg.mentions.map((mention: any) => (
                            <span key={mention.id} className={`px-2 py-1 rounded-full text-xs font-bold ${mine ? 'bg-white/20 text-on-brand' : 'bg-brand/10 text-brand'}`}>
                              @{mention.user.fullName}
                            </span>
                          ))}
                        </div>
                      )}

                      {msg.attachments?.length > 0 && (
                        <div className="mt-2 space-y-2">
                          {msg.attachments.map((attachment: any) => (
                            <a
                              key={attachment.id || attachment.url}
                              href={attachment.url}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(event) => event.stopPropagation()}
                              className={`min-h-11 rounded-[--radius-lg] px-3 py-2 text-sm font-bold flex items-center gap-2 ${mine ? 'bg-white/15 text-on-brand' : 'bg-surface text-navy'}`}
                            >
                              {attachment.type === 'IMAGE' ? (
                                <img src={attachment.url} alt={attachment.label || 'Thread attachment'} className="h-14 w-14 rounded-md object-cover" />
                              ) : (
                                <span className="material-symbols-outlined text-[20px]">{attachment.type === 'DOCUMENT' ? 'description' : 'link'}</span>
                              )}
                              <span className="min-w-0 flex-1 truncate">{attachment.label || 'Attachment'}</span>
                              {attachment.sizeBytes ? <span className={`text-xs ${mine ? 'text-on-brand/75' : 'text-on-surface-secondary'}`}>{humanFileSize(attachment.sizeBytes)}</span> : null}
                            </a>
                          ))}
                        </div>
                      )}

                      {msg.links?.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {msg.links.map((link: any) => {
                            const href = sourceHref(link.type, link.entityId);
                            return href ? (
                              <button key={link.id} onClick={(event) => { event.stopPropagation(); router.push(href); }} className={`min-h-10 px-3 rounded-[--radius-lg] text-sm font-bold inline-flex items-center gap-2 ${mine ? 'bg-white/15 text-on-brand' : 'bg-navy/10 text-navy'}`}>
                                <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                                {link.label || link.type}
                              </button>
                            ) : null;
                          })}
                        </div>
                      )}

                      <div className={`mt-1 flex items-center justify-end gap-1 text-[11px] font-bold ${mine ? 'text-on-brand/75' : 'text-on-surface-secondary'}`}>
                        {msg.editedAt && !msg.deletedAt && <span>edited</span>}
                        {deliveryStatus && <span>{deliveryStatus}</span>}
                        <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        {mine && <span className="material-symbols-outlined text-[15px]">{deliveryStatus === 'queued' ? 'schedule' : deliveryStatus === 'failed' ? 'error' : 'done_all'}</span>}
                      </div>
                      {deliveryStatus === 'failed' && (
                        <button
                          onClick={(event) => { event.stopPropagation(); retryFailedReply(msg); }}
                          className="mt-2 min-h-9 rounded-full bg-white/20 px-3 text-xs font-extrabold text-on-brand"
                        >
                          Retry
                        </button>
                      )}
                    </>
                  )}

                  {!deliveryStatus && (
                    <span className={`pointer-events-none absolute -bottom-2 ${mine ? '-left-1' : '-right-1'} rounded-full bg-surface-white px-1.5 py-0.5 text-[10px] font-bold text-on-surface-secondary shadow ${messageMenuId === msg.id ? 'opacity-100' : 'opacity-0'}`}>
                      Actions
                    </span>
                  )}
                </div>
              </div>

              {messageMenuId === msg.id && (
                <div className={`mt-2 flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div className="max-w-[82%] rounded-[--radius-lg] bg-surface-white p-2 shadow-sm flex flex-wrap gap-2">
                    {!isDirect && (
                      <>
                        <button onClick={() => { setMessageMenuId(''); runReaction(msg.id, 'ACK'); }} className="min-h-10 px-3 rounded-full bg-success/10 text-success text-xs font-bold inline-flex items-center gap-1">
                          <span className="material-symbols-outlined text-[17px]">check_circle</span>
                          ACK {counts.ACK || 0}
                        </button>
                        <button onClick={() => { setMessageMenuId(''); runReaction(msg.id, 'THANKS'); }} className="min-h-10 px-3 rounded-full bg-warning/10 text-warning text-xs font-bold inline-flex items-center gap-1">
                          <span className="material-symbols-outlined text-[17px]">thumb_up</span>
                          Thanks {counts.THANKS || 0}
                        </button>
                      </>
                    )}
                    {canManageThreadActions && ackUsers.length > 0 && (
                      <button onClick={() => setAckMessageId(ackMessageId === msg.id ? '' : msg.id)} className="min-h-10 px-3 rounded-full bg-success/10 text-success text-xs font-bold inline-flex items-center gap-1">
                        <span className="material-symbols-outlined text-[17px]">groups</span>
                        Who
                      </button>
                    )}
                    {mine && (
                      <button onClick={() => { setMessageMenuId(''); setEditMessageId(msg.id); setEditBody(msg.body); }} className="min-h-10 px-3 rounded-full bg-surface text-on-surface-secondary text-xs font-bold inline-flex items-center gap-1">
                        <span className="material-symbols-outlined text-[17px]">edit</span>
                        Edit
                      </button>
                    )}
                    {(mine || canManageThreadActions) && (
                      <button onClick={() => { setMessageMenuId(''); deleteMessage.mutate({ messageId: msg.id }); }} className="min-h-10 px-3 rounded-full bg-error/10 text-error text-xs font-bold inline-flex items-center gap-1">
                        <span className="material-symbols-outlined text-[17px]">delete</span>
                        Delete
                      </button>
                    )}
                    {canManageThreadActions && (
                      <>
                        <button onClick={() => { setMessageMenuId(''); openTaskSheet(msg); }} className="min-h-10 px-3 rounded-full bg-brand/10 text-brand text-xs font-bold inline-flex items-center gap-1">
                          <span className="material-symbols-outlined text-[17px]">add_task</span>
                          Task
                        </button>
                        <button onClick={() => { setMessageMenuId(''); toggleMessagePin.mutate({ messageId: msg.id }); }} className={`min-h-10 px-3 rounded-full text-xs font-bold inline-flex items-center gap-1 ${msg.isPinned ? 'bg-warning text-white' : 'bg-warning/10 text-warning'}`}>
                          <span className="material-symbols-outlined text-[17px]">push_pin</span>
                          {msg.isPinned ? 'Unpin' : 'Pin'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}

              {canManageThreadActions && ackMessageId === msg.id && (
                <div className={`mt-2 flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div className="max-w-[82%] rounded-[--radius-lg] bg-success/10 p-3 text-success">
                    <p className="text-xs font-extrabold uppercase">Acknowledged by</p>
                    <p className="mt-1 text-sm font-bold">
                      {ackUsers.map((user: any) => user.fullName).join(', ')}
                    </p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {showNewMessages && (
        <button
          onClick={() => {
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
            setShowNewMessages(false);
          }}
          className="fixed bottom-[calc(var(--spacing-nav-height)+88px)] left-1/2 z-40 -translate-x-1/2 rounded-full bg-navy px-4 py-2 text-sm font-extrabold text-on-navy shadow-lg"
        >
          New messages
        </button>
      )}

      {!thread.isResolved && (
        <div className="fixed bottom-[--spacing-nav-height] left-0 right-0 bg-surface-white border-t-2 border-surface-variant p-3 z-40">
          {replyMoreOpen && (
            <div className="mb-3 rounded-[--radius-lg] bg-surface p-3 space-y-3">
              {!isDirect && (
              <div>
                <p className="text-xs font-bold uppercase text-on-surface-secondary mb-2">Mention</p>
                <input
                  value={mentionSearch}
                  onChange={(event) => setMentionSearch(event.target.value)}
                  placeholder="Search staff"
                  className="mb-2 w-full h-10 px-3 bg-surface-white border border-outline rounded-[--radius-lg] text-sm text-on-surface"
                />
                {(mentionTargets?.groups || []).length > 0 && (
                  <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
                    {(mentionTargets?.groups || []).map((group) => (
                      <button
                        key={group.id}
                        onClick={() => toggleMentionGroup(group.id)}
                        className={`min-h-10 shrink-0 rounded-full px-3 text-sm font-bold ${mentionGroupIds.includes(group.id) ? 'bg-navy text-white' : 'bg-surface-white text-on-surface-secondary'}`}
                      >
                        @{group.label}
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {filteredMentionUsers.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => toggleMention(user.id)}
                      className={`min-h-10 shrink-0 rounded-full px-3 text-sm font-bold ${mentionedUserIds.includes(user.id) ? 'bg-brand text-on-brand' : 'bg-surface-white text-on-surface-secondary'}`}
                    >
                      @{user.fullName}
                    </button>
                  ))}
                </div>
              </div>
              )}
              <div className="grid grid-cols-3 gap-2">
                {attachmentTypes.map((type) => (
                  <button
                    key={type}
                    onClick={() => setAttachmentType(type)}
                    className={`min-h-11 rounded-[--radius-lg] text-xs font-bold flex items-center justify-center gap-1 ${attachmentType === type ? 'bg-navy text-white' : 'bg-surface-white text-on-surface-secondary'}`}
                  >
                    <span className="material-symbols-outlined text-[18px]">{type === 'IMAGE' ? 'photo_camera' : type === 'DOCUMENT' ? 'description' : 'link'}</span>
                    {type === 'IMAGE' ? 'Photo' : type === 'DOCUMENT' ? 'File' : 'Link'}
                  </button>
                ))}
              </div>
              {attachmentType !== 'LINK' && (
                <>
                  <label className="min-h-11 rounded-[--radius-lg] bg-success/10 text-success font-bold flex items-center justify-center gap-2">
                    <span className={`material-symbols-outlined text-[20px] ${isUploading ? 'animate-spin' : ''}`}>{isUploading ? 'progress_activity' : attachmentType === 'IMAGE' ? 'photo_camera' : 'attach_file'}</span>
                    {isUploading ? 'Uploading...' : attachmentType === 'IMAGE' ? 'Choose Photo' : 'Choose File'}
                    <input
                      type="file"
                      multiple
                      accept={attachmentType === 'IMAGE' ? 'image/*' : '.pdf,.doc,.docx,.xls,.xlsx,.txt'}
                      className="hidden"
                      onChange={(event) => addFiles(event.target.files)}
                    />
                  </label>
                  <p className="text-xs text-on-surface-secondary">Up to {humanFileSize(MAX_THREAD_UPLOAD_BYTES)} each.</p>
                </>
              )}
              {attachments.length > 0 && (
                <div className="space-y-2">
                  {attachments.map((attachment, index) => (
                    <div key={`${attachment.label}-${index}`} className="min-h-10 rounded-[--radius-lg] bg-surface-white px-3 py-2 flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-navy">{attachment.type === 'IMAGE' ? 'image' : 'description'}</span>
                      <span className="flex-1 truncate text-sm font-bold text-on-surface">{attachment.label}</span>
                      <button
                        onClick={() => setAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                        className="w-8 h-8 rounded-full bg-surface text-on-surface-secondary flex items-center justify-center"
                      >
                        <span className="material-symbols-outlined text-[17px]">close</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {attachmentType === 'LINK' && (
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={attachmentUrl}
                    onChange={(event) => setAttachmentUrl(event.target.value)}
                    placeholder="https://..."
                    className="h-11 px-3 bg-surface-white border border-outline rounded-[--radius-lg] text-sm text-on-surface"
                  />
                  <input
                    value={attachmentLabel}
                    onChange={(event) => setAttachmentLabel(event.target.value)}
                    placeholder="Short label"
                    className="h-11 px-3 bg-surface-white border border-outline rounded-[--radius-lg] text-sm text-on-surface"
                  />
                </div>
              )}
            </div>
          )}
          {!replyMoreOpen && !reply.trim() && (
            <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
              {quickReplies.map((text) => (
                <button
                  key={text}
                  onClick={() => addQuickReply(text)}
                  className="min-h-9 shrink-0 rounded-full bg-surface px-3 text-xs font-extrabold text-on-surface-secondary"
                >
                  {text}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => setReplyMoreOpen(!replyMoreOpen)}
              className="w-12 h-12 bg-surface text-on-surface-secondary rounded-full flex items-center justify-center active:scale-90 transition-all duration-200"
            >
              <span className="material-symbols-outlined">{replyMoreOpen ? 'close' : 'add'}</span>
            </button>
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Message"
              rows={1}
              className="max-h-28 min-h-12 flex-1 resize-none rounded-[24px] border-2 border-outline bg-surface px-4 py-3 text-sm text-on-surface placeholder:text-on-surface-secondary transition-colors focus:border-primary focus:outline-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && reply.trim()) {
                  e.preventDefault();
                  submitReply();
                }
              }}
            />
            <button
              onClick={submitReply}
              disabled={!canSendReply || sendReply.isPending || isUploading}
              className="w-12 h-12 bg-brand text-on-brand rounded-full flex items-center justify-center disabled:opacity-40 active:scale-90 transition-all duration-200"
            >
              <span className="material-symbols-outlined">send</span>
            </button>
          </div>
        </div>
      )}

      {taskMessageId && (
        <div className="fixed inset-0 z-[60] bg-black/40 flex items-end md:items-center justify-center">
          <div className="max-h-[90dvh] w-full overflow-y-auto md:max-w-md bg-surface-white rounded-t-[--radius-lg] md:rounded-[--radius-lg] p-5 shadow-[--shadow-elevated] space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-extrabold text-on-surface">Create Task</h3>
              <button
                onClick={() => setTaskMessageId('')}
                className="w-10 h-10 rounded-full bg-surface text-on-surface-secondary flex items-center justify-center"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div>
              <label className="block text-sm font-bold text-on-surface mb-2">Task title</label>
              <input
                value={taskTitle}
                onChange={(event) => setTaskTitle(event.target.value)}
                className="w-full h-12 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-sm text-on-surface"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-on-surface mb-2">Assign to</label>
              <select
                value={taskAssignedToId}
                onChange={(event) => setTaskAssignedToId(event.target.value)}
                className="w-full h-12 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-sm text-on-surface"
              >
                <option value="">Unassigned</option>
                {(taskUsers || []).map((user) => (
                  <option key={user.id} value={user.id}>{user.fullName}</option>
                ))}
              </select>
            </div>
            {(taskPreview?.existingTasks || []).length > 0 && (
              <div className="rounded-[--radius-lg] bg-warning/10 p-3 text-warning">
                <p className="text-sm font-extrabold">Task already linked</p>
                {(taskPreview?.existingTasks || []).map((task) => (
                  <button
                    key={task.id}
                    onClick={() => router.push(`/hub/tasks/${task.id}`)}
                    className="mt-2 w-full rounded-[--radius-lg] bg-surface-white px-3 py-2 text-left text-sm font-bold text-on-surface"
                  >
                    {task.title}
                  </button>
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-bold text-on-surface mb-2">Priority</label>
                <select
                  value={taskPriority}
                  onChange={(event) => setTaskPriority(event.target.value as typeof taskPriority)}
                  className="w-full h-12 px-3 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-sm text-on-surface"
                >
                  <option value="NORMAL">Normal</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                  <option value="LOW">Low</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-on-surface mb-2">Due date</label>
                <input
                  type="date"
                  value={taskDueDate}
                  onChange={(event) => setTaskDueDate(event.target.value)}
                  className="w-full h-12 px-3 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-sm text-on-surface"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-on-surface mb-2">Category</label>
              <input
                value={taskCategory}
                onChange={(event) => setTaskCategory(event.target.value)}
                placeholder="Optional"
                className="w-full h-12 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-sm text-on-surface"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-on-surface mb-2">Source quote</label>
              <textarea
                value={taskQuote}
                onChange={(event) => setTaskQuote(event.target.value)}
                rows={3}
                className="w-full px-4 py-3 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-sm text-on-surface"
              />
            </div>
            <button
              onClick={submitTaskFromMessage}
              disabled={!taskTitle.trim() || createTask.isPending || (taskPreview?.existingTasks || []).length > 0}
              className="w-full h-14 bg-brand text-on-brand font-bold rounded-[--radius-lg] disabled:opacity-40 active:scale-95 transition-all duration-200 flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined">add_task</span>
              Create Task
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ThreadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><span className="material-symbols-outlined animate-spin text-brand text-[32px]">progress_activity</span></div>}>
      <ThreadDetailContent params={params} />
    </Suspense>
  );
}
