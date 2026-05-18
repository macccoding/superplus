'use client';

import { useState } from 'react';

interface Notification {
  id: string;
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
  isRead: boolean;
  createdAt: any;
}

interface NotificationBellProps {
  notifications: Notification[];
  unreadCount: number;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onNavigate: (link: string) => void;
}

const typeIcons: Record<string, string> = {
  TASK_ASSIGNED: 'assignment_ind',
  TASK_UPDATED: 'assignment',
  ANNOUNCEMENT: 'campaign',
  SCHEDULE_PUBLISHED: 'calendar_month',
  STOCK_OUT: 'remove_shopping_cart',
  INCIDENT: 'report_problem',
  SUGGESTION_RESPONSE: 'lightbulb',
  GENERAL: 'notifications',
};

export function NotificationBell({ notifications, unreadCount, onMarkRead, onMarkAllRead, onNavigate }: NotificationBellProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-on-brand/10 transition-colors relative"
      >
        <span className="material-symbols-outlined text-on-brand" style={{ fontVariationSettings: unreadCount > 0 ? "'FILL' 1" : "'FILL' 0" }}>notifications</span>
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-5 h-5 bg-brand-light text-on-brand text-[10px] font-bold rounded-full flex items-center justify-center px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-12 w-80 max-h-96 bg-surface-white rounded-[--radius-lg] shadow-[--shadow-elevated] border border-outline/30 z-50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-outline/20">
              <h3 className="font-bold text-on-surface text-sm">Notifications</h3>
              {unreadCount > 0 && (
                <button onClick={() => { onMarkAllRead(); }} className="text-xs text-brand font-medium">
                  Mark all read
                </button>
              )}
            </div>
            <div className="overflow-y-auto max-h-80">
              {notifications.length > 0 ? (
                notifications.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => {
                      if (!n.isRead) onMarkRead(n.id);
                      if (n.link) { onNavigate(n.link); setOpen(false); }
                    }}
                    className={`w-full text-left px-4 py-3 flex gap-3 hover:bg-surface transition-colors ${!n.isRead ? 'bg-brand/5' : ''}`}
                  >
                    <span className={`material-symbols-outlined text-[20px] mt-0.5 ${!n.isRead ? 'text-brand' : 'text-outline'}`}>
                      {typeIcons[n.type] || 'notifications'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm truncate ${!n.isRead ? 'font-bold text-on-surface' : 'text-on-surface-secondary'}`}>{n.title}</p>
                      {n.body && <p className="text-xs text-outline truncate mt-0.5">{n.body}</p>}
                      <p className="text-xs text-outline mt-1">{new Date(n.createdAt).toLocaleDateString()}</p>
                    </div>
                    {!n.isRead && <span className="w-2 h-2 rounded-full bg-brand mt-2 shrink-0" />}
                  </button>
                ))
              ) : (
                <div className="py-8 text-center text-sm text-outline">
                  <span className="material-symbols-outlined text-[32px] text-outline mb-2 block">notifications_off</span>
                  No notifications
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
