import React from 'react';
import { Plus, AlertTriangle, Trash2 } from 'lucide-react';

interface AdminEmailPanelProps {
  adminEmails: string[];
  newAdminEmail: string;
  onNewAdminEmailChange: (email: string) => void;
  onAddAdmin: () => void;
  onRemoveAdmin: (email: string) => void;
}

export function AdminEmailPanel({
  adminEmails,
  newAdminEmail,
  onNewAdminEmailChange,
  onAddAdmin,
  onRemoveAdmin,
}: AdminEmailPanelProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[var(--aurora-text)]">Admin Access</h2>
        <p className="text-sm text-[var(--aurora-text-secondary)]">Manage administrator email addresses</p>
      </div>

      <div className="bg-[var(--aurora-surface)] rounded-2xl border border-[var(--aurora-border)] p-6">
        <h3 className="font-bold text-[var(--aurora-text)] mb-4 flex items-center gap-2">
          <Plus size={18} className="text-[#FF3008]" /> Add Admin
        </h3>
        <div className="flex gap-3">
          <input
            type="email"
            placeholder="Email address"
            value={newAdminEmail}
            onChange={(e) => onNewAdminEmailChange(e.target.value)}
            className="flex-1 px-4 py-2.5 bg-[var(--aurora-bg)] border border-[var(--aurora-border)] rounded-xl text-sm text-[var(--aurora-text)] placeholder:text-[var(--aurora-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[#FF3008]/30"
          />
          <button
            onClick={onAddAdmin}
            className="px-6 py-2.5 bg-[#FF3008] text-white rounded-xl text-sm font-semibold hover:bg-[#E02A06] transition shadow-md"
          >
            Add
          </button>
        </div>
      </div>

      {adminEmails.length === 1 && (
        <div className="flex items-center gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30 rounded-2xl p-4">
          <AlertTriangle size={18} className="text-amber-500 flex-shrink-0" />
          <p className="text-sm text-amber-700 dark:text-amber-400">
            Only one admin remains. You cannot remove the last admin.
          </p>
        </div>
      )}

      <div className="bg-[var(--aurora-surface)] rounded-2xl border border-[var(--aurora-border)] overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--aurora-border)]">
          <p className="text-sm font-semibold text-[var(--aurora-text)]">
            Current Admins ({adminEmails.length})
          </p>
        </div>
        {adminEmails.length === 0 ? (
          <div className="text-center py-12 text-[var(--aurora-text-secondary)]">No admins configured</div>
        ) : (
          <div className="divide-y divide-[var(--aurora-border)]">
            {adminEmails.map((email) => (
              <div key={email} className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#FF3008] to-[#FF6034] flex items-center justify-center text-white text-sm font-bold">
                    {email.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[var(--aurora-text)]">{email}</p>
                    {adminEmails.length === 1 && (
                      <span className="text-[10px] font-bold text-amber-500">LAST ADMIN</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => onRemoveAdmin(email)}
                  disabled={adminEmails.length <= 1}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    adminEmails.length <= 1
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-800 dark:text-gray-600'
                      : 'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400'
                  }`}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
