import { upload } from '@vercel/blob/client';

export const MAX_THREAD_UPLOAD_BYTES = 5_000_000;

export type DraftThreadAttachment = {
  type: 'IMAGE' | 'DOCUMENT' | 'LINK';
  url: string;
  label?: string;
  mimeType?: string;
  sizeBytes?: number;
  storageKey?: string;
};

function attachmentType(file: File): DraftThreadAttachment['type'] {
  if (file.type.startsWith('image/')) return 'IMAGE';
  return 'DOCUMENT';
}

function isAllowedFile(file: File) {
  if (file.type.startsWith('image/')) return true;
  return [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
  ].includes(file.type);
}

export function humanFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function safeUploadName(file: File) {
  const clean = file.name.replace(/[^a-z0-9._-]/gi, '_').slice(-90) || 'attachment';
  return `threads/${Date.now()}-${clean}`;
}

export async function fileToThreadAttachment(file: File): Promise<DraftThreadAttachment> {
  if (file.size > MAX_THREAD_UPLOAD_BYTES) {
    throw new Error(`Keep files under ${humanFileSize(MAX_THREAD_UPLOAD_BYTES)}.`);
  }
  if (!isAllowedFile(file)) {
    throw new Error('Attach a photo, PDF, document, spreadsheet, or text file.');
  }
  const blob = await upload(safeUploadName(file), file, {
    access: 'public',
    handleUploadUrl: '/api/blob/upload',
  });
  return {
    type: attachmentType(file),
    url: blob.url,
    label: file.name,
    mimeType: file.type || 'application/octet-stream',
    sizeBytes: file.size,
    storageKey: blob.pathname,
  };
}
