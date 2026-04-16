import React from 'react';
import type { PendingBusiness } from '@/services/businessRegistration';
import { AlertTriangle } from 'lucide-react';

interface RegistrationPanelProps {
  registrationsLoading: boolean;
  pendingRegistrations: PendingBusiness[];
  rejectModalId: string | null;
  rejectReason: string;
  onRejectReasonChange: (reason: string) => void;
  onApprove: (id: string) => void;
  onReject: (id: string, reason: string) => void;
  onOpenRejectModal: (id: string) => void;
  onCloseRejectModal: () => void;
}

export function RegistrationPanel({
  registrationsLoading,
  pendingRegistrations,
  rejectModalId,
  rejectReason,
  onRejectReasonChange,
  onApprove,
  onReject,
  onOpenRejectModal,
  onCloseRejectModal,
}: RegistrationPanelProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[var(--aurora-text)]">Business Registrations</h2>
        <p className="text-sm text-[var(--aurora-text-secondary)]">Review and approve pending business sign-up applications</p>
      </div>

      {registrationsLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-3 border-[var(--aurora-border)] border-t-[var(--aurora-accent)] rounded-full animate-spin" />
        </div>
      ) : pendingRegistrations.length === 0 ? (
        <div className="bg-[var(--aurora-surface)] rounded-2xl border border-[var(--aurora-border)] p-8 text-center">
          <div className="text-4xl mb-3">📋</div>
          <h3 className="font-bold text-[var(--aurora-text)] mb-1">No Pending Registrations</h3>
          <p className="text-sm text-[var(--aurora-text-secondary)]">
            All business registrations have been reviewed. New applications will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {pendingRegistrations.map((biz) => (
            <div key={biz.id} className="bg-[var(--aurora-surface)] rounded-2xl border border-[var(--aurora-border)] p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-bold text-[var(--aurora-text)]">{biz.name}</h3>
                  <p className="text-xs text-[var(--aurora-text-secondary)]">
                    {biz.category} &middot; {biz.country === 'CA' ? '🇨🇦' : '🇺🇸'} &middot; {biz.ownerName}
                  </p>
                </div>
                <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700 font-semibold">Pending</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs mb-4">
                <div>
                  <span className="text-[var(--aurora-text-secondary)]">Email: </span>
                  <span className="text-[var(--aurora-text)]">{biz.email}</span>
                </div>
                <div>
                  <span className="text-[var(--aurora-text-secondary)]">Phone: </span>
                  <span className="text-[var(--aurora-text)]">{biz.phone}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => onApprove(biz.id)} className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-xs font-semibold hover:bg-emerald-600 transition">
                  Approve
                </button>
                <button onClick={() => onOpenRejectModal(biz.id)} className="px-4 py-2 bg-red-500 text-white rounded-lg text-xs font-semibold hover:bg-red-600 transition">
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
