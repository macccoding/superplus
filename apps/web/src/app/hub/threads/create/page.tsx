'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { trpc } from '@/lib/trpc-client';
import { queueThreadMutation } from '@/lib/thread-offline';
import { type DraftThreadAttachment, fileToThreadAttachment, humanFileSize, MAX_THREAD_UPLOAD_BYTES } from '@/lib/thread-attachments';

const categories = ['GENERAL', 'URGENT', 'MAINTENANCE', 'INVENTORY', 'OTHER'] as const;
const attachmentTypes = ['IMAGE', 'DOCUMENT', 'LINK'] as const;
const categoryLabels: Record<typeof categories[number], { label: string; icon: string }> = {
  GENERAL: { label: 'General', icon: 'forum' },
  URGENT: { label: 'Urgent', icon: 'priority_high' },
  MAINTENANCE: { label: 'Fix', icon: 'build' },
  INVENTORY: { label: 'Stock', icon: 'inventory_2' },
  OTHER: { label: 'Other', icon: 'more_horiz' },
};

function plainError(message?: string) {
  if (!message) return '';
  if (message.includes('TRPC') || message.includes('Unexpected')) return 'Something went wrong. Try again.';
  return message;
}

function CreateThreadContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const utils = trpc.useUtils();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<typeof categories[number]>('GENERAL');
  const [moreOpen, setMoreOpen] = useState(false);
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([]);
  const [mentionGroupIds, setMentionGroupIds] = useState<string[]>([]);
  const [mentionSearch, setMentionSearch] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [attachmentLabel, setAttachmentLabel] = useState('');
  const [attachmentType, setAttachmentType] = useState<typeof attachmentTypes[number]>('IMAGE');
  const [attachments, setAttachments] = useState<DraftThreadAttachment[]>([]);
  const [status, setStatus] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const { data: mentionTargets } = trpc.threads.mentionTargets.useQuery();
  const { data: templates } = trpc.threads.templates.useQuery();

  const backTab = searchParams.get('from') || 'all';
  const create = trpc.threads.create.useMutation({
    onSuccess: (thread) => {
      utils.threads.invalidate();
      router.push(`/hub/threads/${thread.id}?from=${backTab}`);
    },
  });
  const errorMessage = plainError(create.error?.message);

  const toggleMention = (userId: string) => {
    setMentionedUserIds((current) => (
      current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId]
    ));
  };

  const payload = () => ({
    title,
    body,
    category,
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
      setStatus('Uploading file...');
      const next = await Promise.all(Array.from(files).slice(0, 5 - attachments.length).map(fileToThreadAttachment));
      setAttachments((current) => [...current, ...next].slice(0, 5));
      setStatus('');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not attach that file.');
    } finally {
      setIsUploading(false);
    }
  };

  const applyTemplate = (template: any) => {
    setCategory(template.category);
    setTitle(template.topic);
    setBody(template.body);
  };

  const toggleMentionGroup = (groupId: string) => {
    setMentionGroupIds((current) => (
      current.includes(groupId) ? current.filter((id) => id !== groupId) : [...current, groupId]
    ));
  };

  const filteredUsers = (mentionTargets?.users || []).filter((user) => (
    !mentionSearch.trim() || user.fullName.toLowerCase().includes(mentionSearch.trim().toLowerCase())
  ));

  const submit = () => {
    if (!title.trim() || !body.trim()) return;
    const input = payload();
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const queued = queueThreadMutation('CREATE', input);
      setStatus(queued ? 'Saved on this phone. It will post when online.' : 'Could not save on this phone. Try again when online.');
      return;
    }
    create.mutate(input);
  };

  return (
    <div className="px-5 py-6 pb-24">
      <button onClick={() => router.push(`/hub/threads?tab=${backTab}`)} className="flex items-center gap-1 text-sm text-on-surface-secondary mb-4">
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        Back
      </button>

      {(status || errorMessage) && (
        <div className="mb-4 rounded-[--radius-lg] bg-warning/10 px-4 py-3 text-sm font-bold text-warning flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px]">{status ? 'cloud_off' : 'info'}</span>
          {status || errorMessage}
        </div>
      )}

      <div className="bg-surface-white rounded-[--radius-lg] p-6 shadow-sm space-y-5">
        <h2 className="text-xl font-bold text-on-surface">New Thread</h2>

        {(templates || []).length > 0 && (
          <div>
            <p className="text-sm font-medium text-on-surface mb-3">Quick start</p>
            <div className="grid grid-cols-2 gap-2">
              {(templates || []).map((template) => (
                <button
                  key={template.id}
                  onClick={() => applyTemplate(template)}
                  className="min-h-12 rounded-[--radius-lg] bg-surface-cream px-3 text-sm font-bold text-on-surface-secondary flex items-center justify-center gap-2 active:scale-95 transition-transform"
                >
                  <span className="material-symbols-outlined text-[20px]">{template.icon}</span>
                  {template.title}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-on-surface mb-2">Topic</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What's this about?"
            className="w-full h-14 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-base text-on-surface placeholder:text-on-surface-secondary transition-colors"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-on-surface mb-3">Category</label>
          <div className="grid grid-cols-2 gap-2">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`min-h-12 px-3 rounded-[--radius-lg] text-sm font-bold transition-all duration-200 active:scale-95 flex items-center justify-center gap-2 ${
                  category === c
                    ? 'bg-brand text-on-brand'
                    : 'bg-surface-cream text-on-surface-secondary'
                }`}
              >
                <span className="material-symbols-outlined text-[20px]">{categoryLabels[c].icon}</span>
                {categoryLabels[c].label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-on-surface mb-2">Message</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Start the conversation..."
            rows={4}
            className="w-full px-4 py-3 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-base text-on-surface placeholder:text-on-surface-secondary resize-none transition-colors"
          />
        </div>

        <button
          onClick={() => setMoreOpen(!moreOpen)}
          className="w-full min-h-12 rounded-[--radius-lg] bg-surface-cream text-on-surface-secondary font-bold flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined">{moreOpen ? 'expand_less' : 'add_circle'}</span>
          More
        </button>

        {moreOpen && (
          <div className="space-y-5 border-t border-outline/20 pt-5">
            <div>
              <p className="text-sm font-bold text-on-surface mb-2">Mention staff</p>
              <input
                value={mentionSearch}
                onChange={(event) => setMentionSearch(event.target.value)}
                placeholder="Search staff"
                className="mb-2 w-full h-11 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-sm text-on-surface"
              />
              {(mentionTargets?.groups || []).length > 0 && (
                <div className="mb-2 grid grid-cols-1 gap-2">
                  {(mentionTargets?.groups || []).map((group) => (
                    <button
                      key={group.id}
                      onClick={() => toggleMentionGroup(group.id)}
                      className={`min-h-12 rounded-[--radius-lg] px-3 text-left font-bold flex items-center justify-between ${
                        mentionGroupIds.includes(group.id)
                          ? 'bg-navy/10 text-navy'
                          : 'bg-surface text-on-surface-secondary'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[20px]">{group.icon}</span>
                        @{group.label}
                      </span>
                      <span className="text-xs">{group.count}</span>
                    </button>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-1 gap-2">
                {filteredUsers.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => toggleMention(user.id)}
                    className={`min-h-12 rounded-[--radius-lg] px-3 text-left font-bold flex items-center justify-between ${
                      mentionedUserIds.includes(user.id)
                        ? 'bg-brand/10 text-brand'
                        : 'bg-surface text-on-surface-secondary'
                    }`}
                  >
                    <span>
                      {user.fullName}
                      <span className="ml-2 text-xs font-bold text-on-surface-secondary">{user.role}</span>
                    </span>
                    <span className="material-symbols-outlined text-[20px]">
                      {mentionedUserIds.includes(user.id) ? 'check_circle' : 'alternate_email'}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-bold text-on-surface">Attach photo or file</p>
              <label className="min-h-14 rounded-[--radius-lg] bg-success/10 text-success font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform">
                <span className={`material-symbols-outlined ${isUploading ? 'animate-spin' : ''}`}>{isUploading ? 'progress_activity' : 'attach_file'}</span>
                {isUploading ? 'Uploading...' : 'Choose File'}
                <input
                  type="file"
                  multiple
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                  className="hidden"
                  onChange={(event) => addFiles(event.target.files)}
                />
              </label>
              <p className="text-xs text-on-surface-secondary">
                Up to {humanFileSize(MAX_THREAD_UPLOAD_BYTES)} each.
              </p>
              {attachments.length > 0 && (
                <div className="space-y-2">
                  {attachments.map((attachment, index) => (
                    <div key={`${attachment.label}-${index}`} className="min-h-11 rounded-[--radius-lg] bg-surface px-3 py-2 flex items-center gap-2">
                      <span className="material-symbols-outlined text-[20px] text-navy">{attachment.type === 'IMAGE' ? 'image' : 'description'}</span>
                      <span className="flex-1 truncate text-sm font-bold text-on-surface">{attachment.label}</span>
                      {attachment.sizeBytes ? <span className="text-xs text-on-surface-secondary">{humanFileSize(attachment.sizeBytes)}</span> : null}
                      <button
                        onClick={() => setAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                        className="w-9 h-9 rounded-full bg-surface-white text-on-surface-secondary flex items-center justify-center"
                      >
                        <span className="material-symbols-outlined text-[18px]">close</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-sm font-bold text-on-surface pt-2">Or attach a link</p>
              <div className="grid grid-cols-3 gap-2">
                {attachmentTypes.map((type) => (
                  <button
                    key={type}
                    onClick={() => setAttachmentType(type)}
                    className={`min-h-11 rounded-[--radius-lg] text-xs font-bold ${attachmentType === type ? 'bg-navy text-white' : 'bg-surface text-on-surface-secondary'}`}
                  >
                    {type === 'IMAGE' ? 'Photo' : type === 'DOCUMENT' ? 'File' : 'Link'}
                  </button>
                ))}
              </div>
              <input
                value={attachmentUrl}
                onChange={(e) => setAttachmentUrl(e.target.value)}
                placeholder="https://..."
                className="w-full h-12 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-sm text-on-surface"
              />
              <input
                value={attachmentLabel}
                onChange={(e) => setAttachmentLabel(e.target.value)}
                placeholder="Short label"
                className="w-full h-12 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-sm text-on-surface"
              />
            </div>
          </div>
        )}

        <button
          onClick={submit}
          disabled={!title.trim() || !body.trim() || create.isPending || isUploading}
          className="w-full h-14 bg-brand text-on-brand font-bold rounded-[--radius-lg] disabled:opacity-40 active:scale-95 transition-all duration-200 flex items-center justify-center gap-2"
        >
          {create.isPending || isUploading ? (
            <>
              <span className="material-symbols-outlined animate-spin">progress_activity</span>
              {isUploading ? 'Uploading...' : 'Posting...'}
            </>
          ) : (
            <>
              <span className="material-symbols-outlined">send</span>
              Start Thread
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default function CreateThreadPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><span className="material-symbols-outlined animate-spin text-brand text-[32px]">progress_activity</span></div>}>
      <CreateThreadContent />
    </Suspense>
  );
}
