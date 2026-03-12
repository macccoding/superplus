'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ChecklistTemplate, Profile } from '@superplus/db';
import { StatusBadge } from '@superplus/ui';
import { RoleGate, useAuth, useSupabase } from '@superplus/auth';
import { CHECKLIST_TYPES } from '@superplus/config';
import { DashboardShell } from '../components/dashboard-shell';

export default function SettingsPage() {
  const { profile, role } = useAuth();

  return (
    <DashboardShell>
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold text-text-primary">Settings</h1>
        <p className="text-sm text-text-secondary mt-1">System configuration and management</p>
      </div>

      <div className="space-y-8">
        {/* Store Information */}
        <StoreInfoSection />

        {/* Checklist Template Management */}
        <RoleGate requiredRole="manager">
          <ChecklistTemplateSection />
        </RoleGate>

        {/* User Management */}
        <RoleGate requiredRole="owner">
          <UserManagementSection />
        </RoleGate>
      </div>
    </DashboardShell>
  );
}

function StoreInfoSection() {
  return (
    <div className="bg-surface rounded-card border border-gray-100 p-6">
      <h2 className="text-base font-heading font-semibold text-text-primary mb-4">
        Store Information
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1">Store Name</label>
          <input
            type="text"
            defaultValue="SuperPlus Convenience"
            className="w-full px-3 py-2 border border-gray-200 rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1">Phone</label>
          <input
            type="tel"
            defaultValue=""
            placeholder="(555) 123-4567"
            className="w-full px-3 py-2 border border-gray-200 rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-text-primary mb-1">Address</label>
          <input
            type="text"
            defaultValue=""
            placeholder="123 Main Street"
            className="w-full px-3 py-2 border border-gray-200 rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
          />
        </div>
      </div>
      <div className="mt-4">
        <button className="px-4 py-2 bg-brand-primary text-white text-sm font-semibold rounded-button hover:bg-brand-primary/90 transition-colors">
          Save Store Info
        </button>
      </div>
    </div>
  );
}

function ChecklistTemplateSection() {
  const supabase = useSupabase();
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [newTaskText, setNewTaskText] = useState('');
  const [selectedType, setSelectedType] = useState<'opening' | 'closing'>('opening');

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('checklist_templates')
      .select('*')
      .eq('checklist_type', selectedType)
      .order('sort_order');
    if (data) setTemplates(data as ChecklistTemplate[]);
    setLoading(false);
  }, [selectedType]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  async function addTemplate() {
    if (!newTaskText.trim()) return;
    const maxOrder = templates.reduce((max, t) => Math.max(max, t.sort_order), 0);
    const { error } = await supabase.from('checklist_templates').insert({
      checklist_type: selectedType,
      task_text: newTaskText.trim(),
      sort_order: maxOrder + 1,
    });
    if (!error) {
      setNewTaskText('');
      loadTemplates();
    }
  }

  async function updateTemplate(id: string) {
    if (!editText.trim()) return;
    const { error } = await supabase
      .from('checklist_templates')
      .update({ task_text: editText.trim() })
      .eq('id', id);
    if (!error) {
      setEditingId(null);
      loadTemplates();
    }
  }

  async function toggleActive(id: string, currentActive: boolean) {
    await supabase
      .from('checklist_templates')
      .update({ is_active: !currentActive })
      .eq('id', id);
    loadTemplates();
  }

  async function moveTemplate(id: string, direction: 'up' | 'down') {
    const idx = templates.findIndex((t) => t.id === id);
    if (idx === -1) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= templates.length) return;

    const current = templates[idx];
    const swap = templates[swapIdx];

    await Promise.all([
      supabase.from('checklist_templates').update({ sort_order: swap.sort_order }).eq('id', current.id),
      supabase.from('checklist_templates').update({ sort_order: current.sort_order }).eq('id', swap.id),
    ]);
    loadTemplates();
  }

  return (
    <div className="bg-surface rounded-card border border-gray-100 p-6">
      <h2 className="text-base font-heading font-semibold text-text-primary mb-4">
        Checklist Templates
      </h2>

      {/* Type selector */}
      <div className="flex gap-2 mb-4">
        {CHECKLIST_TYPES.map((type) => (
          <button
            key={type}
            onClick={() => setSelectedType(type)}
            className={`px-4 py-2 text-sm font-medium rounded-button border capitalize transition-colors ${
              selectedType === type
                ? 'bg-brand-primary text-white border-brand-primary'
                : 'bg-surface text-text-secondary border-gray-200 hover:border-gray-300'
            }`}
          >
            {type} Checklist
          </button>
        ))}
      </div>

      {/* Add new item */}
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={newTaskText}
          onChange={(e) => setNewTaskText(e.target.value)}
          placeholder="Add new checklist item..."
          onKeyDown={(e) => e.key === 'Enter' && addTemplate()}
          className="flex-1 px-3 py-2 border border-gray-200 rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
        />
        <button
          onClick={addTemplate}
          className="px-4 py-2 bg-brand-primary text-white text-sm font-semibold rounded-button hover:bg-brand-primary/90 transition-colors"
        >
          Add
        </button>
      </div>

      {/* Template list */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin h-5 w-5 border-2 border-brand-primary border-t-transparent rounded-full" />
        </div>
      ) : templates.length === 0 ? (
        <p className="text-sm text-text-secondary text-center py-8">
          No templates for {selectedType} checklist
        </p>
      ) : (
        <div className="space-y-2">
          {templates.map((template, idx) => (
            <div
              key={template.id}
              className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                template.is_active ? 'bg-background border-gray-100' : 'bg-gray-50 border-gray-100 opacity-60'
              }`}
            >
              {/* Reorder buttons */}
              <div className="flex flex-col gap-0.5">
                <button
                  onClick={() => moveTemplate(template.id, 'up')}
                  disabled={idx === 0}
                  className="text-text-secondary hover:text-text-primary disabled:opacity-30"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="18 15 12 9 6 15" />
                  </svg>
                </button>
                <button
                  onClick={() => moveTemplate(template.id, 'down')}
                  disabled={idx === templates.length - 1}
                  className="text-text-secondary hover:text-text-primary disabled:opacity-30"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                {editingId === template.id ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && updateTemplate(template.id)}
                      className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
                      autoFocus
                    />
                    <button
                      onClick={() => updateTemplate(template.id)}
                      className="text-sm text-brand-primary font-medium"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="text-sm text-text-secondary"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-text-primary">{template.task_text}</p>
                    {template.is_critical && (
                      <StatusBadge label="Critical" variant="danger" size="sm" />
                    )}
                    <StatusBadge
                      label={template.item_type}
                      variant="neutral"
                      size="sm"
                    />
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => {
                    setEditingId(template.id);
                    setEditText(template.task_text);
                  }}
                  className="text-xs text-brand-primary hover:underline"
                >
                  Edit
                </button>
                <button
                  onClick={() => toggleActive(template.id, template.is_active)}
                  className={`text-xs ${template.is_active ? 'text-text-secondary' : 'text-success'} hover:underline`}
                >
                  {template.is_active ? 'Disable' : 'Enable'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function UserManagementSection() {
  const supabase = useSupabase();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<string>('staff');

  useEffect(() => {
    supabase
      .from('profiles')
      .select('*')
      .order('full_name')
      .then(({ data }) => {
        if (data) setUsers(data as Profile[]);
        setLoading(false);
      });
  }, []);

  async function updateRole(userId: string, newRole: string) {
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('user_id', userId);

    if (!error) {
      setUsers((prev) =>
        prev.map((u) =>
          u.user_id === userId ? { ...u, role: newRole as Profile['role'] } : u
        )
      );
    }
  }

  async function toggleUserActive(userId: string, isActive: boolean) {
    const { error } = await supabase
      .from('profiles')
      .update({ is_active: !isActive })
      .eq('user_id', userId);

    if (!error) {
      setUsers((prev) =>
        prev.map((u) =>
          u.user_id === userId ? { ...u, is_active: !isActive } : u
        )
      );
    }
  }

  const roleColors: Record<string, 'primary' | 'info' | 'warning' | 'success'> = {
    owner: 'primary',
    manager: 'info',
    supervisor: 'warning',
    staff: 'success',
  };

  return (
    <div className="bg-surface rounded-card border border-gray-100 p-6">
      <h2 className="text-base font-heading font-semibold text-text-primary mb-4">
        User Management
      </h2>

      {/* Invite user (placeholder) */}
      <div className="flex gap-2 mb-6">
        <input
          type="email"
          value={inviteEmail}
          onChange={(e) => setInviteEmail(e.target.value)}
          placeholder="Email address to invite..."
          className="flex-1 px-3 py-2 border border-gray-200 rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
        />
        <select
          value={inviteRole}
          onChange={(e) => setInviteRole(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
        >
          <option value="staff">Staff</option>
          <option value="supervisor">Supervisor</option>
          <option value="manager">Manager</option>
        </select>
        <button
          onClick={() => {
            if (inviteEmail) {
              alert(`Invite functionality will send invitation to ${inviteEmail} as ${inviteRole}`);
              setInviteEmail('');
            }
          }}
          className="px-4 py-2 bg-brand-primary text-white text-sm font-semibold rounded-button hover:bg-brand-primary/90 transition-colors"
        >
          Invite
        </button>
      </div>

      {/* User list */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin h-5 w-5 border-2 border-brand-primary border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="space-y-2">
          {users.map((user) => (
            <div
              key={user.id}
              className={`flex items-center gap-4 p-3 rounded-lg border ${
                user.is_active ? 'bg-background border-gray-100' : 'bg-gray-50 border-gray-100 opacity-60'
              }`}
            >
              <div className="flex items-center justify-center w-9 h-9 rounded-full bg-brand-secondary/10 text-brand-secondary text-sm font-bold flex-shrink-0">
                {user.full_name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary">{user.full_name}</p>
                {user.phone && (
                  <p className="text-xs text-text-secondary">{user.phone}</p>
                )}
              </div>
              <select
                value={user.role}
                onChange={(e) => updateRole(user.user_id, e.target.value)}
                className="px-2 py-1 text-xs border border-gray-200 rounded text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-primary/30"
              >
                <option value="staff">Staff</option>
                <option value="supervisor">Supervisor</option>
                <option value="manager">Manager</option>
                <option value="owner">Owner</option>
              </select>
              <button
                onClick={() => toggleUserActive(user.user_id, user.is_active)}
                className={`text-xs font-medium ${
                  user.is_active
                    ? 'text-text-secondary hover:text-danger'
                    : 'text-success hover:text-success/80'
                } transition-colors`}
              >
                {user.is_active ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
