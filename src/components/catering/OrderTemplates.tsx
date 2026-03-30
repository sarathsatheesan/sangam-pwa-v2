// ═════════════════════════════════════════════════════════════════════════════════
// ORDER TEMPLATES
// Shareable order templates for organizations and quick link sharing.
// - Create from a favorite or delivered order
// - Share via unique link code
// - Organization-level template library
// - Use a template to pre-fill a new order
// ═════════════════════════════════════════════════════════════════════════════════

import React, { useEffect, useState, useCallback } from 'react';
import {
  ArrowLeft, Share2, Copy, Link2, Loader2, Plus, Trash2, Edit3,
  ChevronDown, ChevronUp, Users, Building2, Globe, Lock, ShoppingCart,
  Check, Search, ExternalLink,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import type { FavoriteOrder, OrderTemplate, OrderItem } from '@/services/cateringService';
import {
  subscribeToTemplates,
  createOrderTemplate,
  updateOrderTemplate,
  deleteOrderTemplate,
  fetchTemplateByShareCode,
  recordTemplateUsage,
  formatPrice,
  calculateOrderTotal,
} from '@/services/cateringService';

interface OrderTemplatesProps {
  onBack: () => void;
  prefillFromFavorite?: FavoriteOrder | null;
  onUseTemplate?: (template: OrderTemplate) => void;
}

export default function OrderTemplates({ onBack, prefillFromFavorite, onUseTemplate }: OrderTemplatesProps) {
  const { user, userProfile } = useAuth();
  const { addToast } = useToast();
  const [templates, setTemplates] = useState<OrderTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(!!prefillFromFavorite);
  const [submitting, setSubmitting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [lookupMode, setLookupMode] = useState(false);
  const [shareCodeInput, setShareCodeInput] = useState('');
  const [lookedUpTemplate, setLookedUpTemplate] = useState<OrderTemplate | null>(null);
  const [lookingUp, setLookingUp] = useState(false);

  // ── Create form state ──
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [organizationName, setOrganizationName] = useState('');

  // Subscribe to templates
  useEffect(() => {
    if (!user) { setLoading(false); return; }
    const orgId = (userProfile as any)?.organizationId || null;
    const unsub = subscribeToTemplates(user.uid, orgId, (tmpls) => {
      setTemplates(tmpls);
      setLoading(false);
    });
    return unsub;
  }, [user, userProfile]);

  // Prefill title from favorite
  useEffect(() => {
    if (prefillFromFavorite) {
      setTitle(`${prefillFromFavorite.label} Template`);
    }
  }, [prefillFromFavorite]);

  // ── Handlers ──

  const handleCreate = useCallback(async () => {
    if (!user || !userProfile || !prefillFromFavorite) return;
    if (!title.trim()) {
      addToast('Please enter a template title', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const result = await createOrderTemplate({
        creatorId: user.uid,
        creatorName: userProfile.name || '',
        businessId: prefillFromFavorite.businessId,
        businessName: prefillFromFavorite.businessName,
        title: title.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
        items: prefillFromFavorite.items,
        ...(prefillFromFavorite.headcount ? { headcount: prefillFromFavorite.headcount } : {}),
        ...(prefillFromFavorite.specialInstructions ? { specialInstructions: prefillFromFavorite.specialInstructions } : {}),
        isPublic,
        ...(organizationName.trim() ? {
          organizationId: organizationName.trim().toLowerCase().replace(/\s+/g, '-'),
          organizationName: organizationName.trim(),
        } : {}),
      });
      addToast(`Template created! Share code: ${result.shareCode}`, 'success', 5000);
      setShowCreateForm(false);
      setTitle('');
      setDescription('');
    } catch (err: any) {
      addToast(err.message || 'Failed to create template', 'error');
    } finally {
      setSubmitting(false);
    }
  }, [user, userProfile, prefillFromFavorite, title, description, isPublic, organizationName, addToast]);

  const handleCopyLink = useCallback(async (tmpl: OrderTemplate) => {
    const shareUrl = `${window.location.origin}/catering?template=${tmpl.shareCode}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedId(tmpl.id);
      addToast('Share link copied!', 'success', 2000);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      addToast(shareUrl, 'info', 8000);
    }
  }, [addToast]);

  const handleLookup = useCallback(async () => {
    if (!shareCodeInput.trim()) return;
    setLookingUp(true);
    setLookedUpTemplate(null);
    try {
      const tmpl = await fetchTemplateByShareCode(shareCodeInput.trim());
      if (tmpl) {
        setLookedUpTemplate(tmpl);
      } else {
        addToast('Template not found. Check the share code.', 'error');
      }
    } catch (err: any) {
      addToast(err.message || 'Failed to look up template', 'error');
    } finally {
      setLookingUp(false);
    }
  }, [shareCodeInput, addToast]);

  const handleUseTemplate = useCallback(async (tmpl: OrderTemplate) => {
    try {
      await recordTemplateUsage(tmpl.id);
    } catch { /* ignore stats failure */ }
    if (onUseTemplate) {
      onUseTemplate(tmpl);
    } else {
      addToast('Template loaded! Go to the cart to customize and place your order.', 'success', 4000);
    }
  }, [onUseTemplate, addToast]);

  const handleDelete = useCallback(async (tmplId: string) => {
    try {
      await deleteOrderTemplate(tmplId);
      addToast('Template deleted', 'success', 2000);
    } catch (err: any) {
      addToast(err.message || 'Failed to delete', 'error');
    }
  }, [addToast]);

  // ═══════════════════ RENDER ═══════════════════

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin" style={{ color: '#6366F1' }} />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
          <ArrowLeft size={20} style={{ color: 'var(--aurora-text)' }} />
        </button>
        <div className="flex-1">
          <h2 className="text-lg font-bold" style={{ color: 'var(--aurora-text)' }}>
            Order Templates
          </h2>
          <p className="text-xs" style={{ color: 'var(--aurora-text-secondary)' }}>
            Share order presets with your team or anyone via link
          </p>
        </div>
        <button
          onClick={() => setLookupMode(!lookupMode)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border"
          style={{
            color: lookupMode ? '#6366F1' : 'var(--aurora-text-secondary)',
            borderColor: lookupMode ? '#6366F1' : 'var(--aurora-border)',
          }}
        >
          <Link2 size={12} />
          Use Code
        </button>
      </div>

      {/* ── Share Code Lookup ── */}
      {lookupMode && (
        <div
          className="rounded-2xl border p-4 mb-4"
          style={{ backgroundColor: 'rgba(99,102,241,0.04)', borderColor: 'rgba(99,102,241,0.15)' }}
        >
          <p className="text-xs font-medium mb-2" style={{ color: 'var(--aurora-text)' }}>
            Enter a template share code to load it
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={shareCodeInput}
              onChange={(e) => setShareCodeInput(e.target.value)}
              placeholder="e.g., Ab3kN7xQ"
              className="flex-1 px-3 py-2 rounded-lg border text-sm"
              style={{ borderColor: 'var(--aurora-border)' }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleLookup(); }}
            />
            <button
              onClick={handleLookup}
              disabled={lookingUp || !shareCodeInput.trim()}
              className="px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: '#6366F1' }}
            >
              {lookingUp ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            </button>
          </div>

          {/* Looked up template */}
          {lookedUpTemplate && (
            <div className="mt-3 p-3 rounded-xl border" style={{ backgroundColor: 'var(--aurora-surface)', borderColor: 'var(--aurora-border)' }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold" style={{ color: 'var(--aurora-text)' }}>
                  {lookedUpTemplate.title}
                </span>
                <span className="text-[10px]" style={{ color: 'var(--aurora-text-muted)' }}>
                  by {lookedUpTemplate.creatorName}
                </span>
              </div>
              <p className="text-xs mb-2" style={{ color: 'var(--aurora-text-secondary)' }}>
                {lookedUpTemplate.businessName} · {lookedUpTemplate.items.length} items · {formatPrice(calculateOrderTotal(lookedUpTemplate.items))}
              </p>
              {lookedUpTemplate.description && (
                <p className="text-xs mb-2" style={{ color: 'var(--aurora-text-secondary)' }}>
                  {lookedUpTemplate.description}
                </p>
              )}
              <button
                onClick={() => handleUseTemplate(lookedUpTemplate)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white"
                style={{ backgroundColor: '#059669' }}
              >
                <ShoppingCart size={14} />
                Use This Template
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Create Form ── */}
      {showCreateForm && prefillFromFavorite && (
        <div
          className="rounded-2xl border p-4 mb-4"
          style={{ backgroundColor: 'var(--aurora-surface)', borderColor: 'var(--aurora-border)' }}
        >
          <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--aurora-text)' }}>
            Create Template from "{prefillFromFavorite.label}"
          </h3>
          <p className="text-xs mb-4" style={{ color: 'var(--aurora-text-secondary)' }}>
            {prefillFromFavorite.businessName} · {prefillFromFavorite.items.length} items · {formatPrice(calculateOrderTotal(prefillFromFavorite.items))}
          </p>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium" style={{ color: 'var(--aurora-text)' }}>Template Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Q1 Team Lunch"
                className="w-full mt-1 px-3 py-2 rounded-lg border text-sm"
                style={{ borderColor: 'var(--aurora-border)' }}
              />
            </div>

            <div>
              <label className="text-xs font-medium" style={{ color: 'var(--aurora-text)' }}>
                Description <span style={{ color: 'var(--aurora-text-muted)' }}>(optional)</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Notes about this template..."
                rows={2}
                className="w-full mt-1 px-3 py-2 rounded-lg border text-sm resize-none"
                style={{ borderColor: 'var(--aurora-border)' }}
              />
            </div>

            {/* Visibility */}
            <div>
              <label className="text-xs font-medium" style={{ color: 'var(--aurora-text)' }}>Visibility</label>
              <div className="flex gap-2 mt-1">
                <button
                  onClick={() => setIsPublic(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
                  style={{
                    backgroundColor: isPublic ? 'rgba(99,102,241,0.1)' : 'transparent',
                    color: isPublic ? '#6366F1' : 'var(--aurora-text-secondary)',
                    borderColor: isPublic ? '#6366F1' : 'var(--aurora-border)',
                  }}
                >
                  <Globe size={12} />
                  Anyone with link
                </button>
                <button
                  onClick={() => setIsPublic(false)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
                  style={{
                    backgroundColor: !isPublic ? 'rgba(99,102,241,0.1)' : 'transparent',
                    color: !isPublic ? '#6366F1' : 'var(--aurora-text-secondary)',
                    borderColor: !isPublic ? '#6366F1' : 'var(--aurora-border)',
                  }}
                >
                  <Lock size={12} />
                  Organization only
                </button>
              </div>
            </div>

            {/* Organization (optional) */}
            <div>
              <label className="text-xs font-medium" style={{ color: 'var(--aurora-text)' }}>
                Organization Name <span style={{ color: 'var(--aurora-text-muted)' }}>(optional — for team library)</span>
              </label>
              <input
                type="text"
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                placeholder="e.g., Acme Corp"
                className="w-full mt-1 px-3 py-2 rounded-lg border text-sm"
                style={{ borderColor: 'var(--aurora-border)' }}
              />
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <button
              onClick={handleCreate}
              disabled={submitting}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: '#6366F1' }}
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />}
              {submitting ? 'Creating...' : 'Create Template'}
            </button>
            <button
              onClick={() => setShowCreateForm(false)}
              className="px-4 py-2.5 rounded-xl text-sm font-medium"
              style={{ color: 'var(--aurora-text-secondary)' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Templates List ── */}
      {templates.length === 0 && !showCreateForm && !lookupMode && (
        <div className="text-center py-16">
          <Share2 size={40} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm font-medium" style={{ color: 'var(--aurora-text-secondary)' }}>
            No templates yet
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--aurora-text-muted)' }}>
            Save a favorite order, then create a shareable template from it.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {templates.map((tmpl) => {
          const isExpanded = expandedId === tmpl.id;
          const total = calculateOrderTotal(tmpl.items);
          const isMine = tmpl.creatorId === user?.uid;

          return (
            <div
              key={tmpl.id}
              className="rounded-2xl border overflow-hidden transition-shadow hover:shadow-md"
              style={{ backgroundColor: 'var(--aurora-surface)', borderColor: 'var(--aurora-border)' }}
            >
              <div
                className="flex items-center justify-between p-4 cursor-pointer"
                onClick={() => setExpandedId(isExpanded ? null : tmpl.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Share2 size={14} style={{ color: '#6366F1' }} />
                    <span className="text-sm font-semibold truncate" style={{ color: 'var(--aurora-text)' }}>
                      {tmpl.title}
                    </span>
                    {tmpl.organizationName && (
                      <span
                        className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                        style={{ backgroundColor: '#EEF2FF', color: '#6366F1' }}
                      >
                        <Building2 size={8} className="inline mr-0.5" />
                        {tmpl.organizationName}
                      </span>
                    )}
                    <span
                      className="px-1.5 py-0.5 rounded text-[9px]"
                      style={{
                        backgroundColor: tmpl.isPublic ? '#D1FAE5' : '#FEF3C7',
                        color: tmpl.isPublic ? '#059669' : '#D97706',
                      }}
                    >
                      {tmpl.isPublic ? 'Public' : 'Private'}
                    </span>
                  </div>
                  <p className="text-xs" style={{ color: 'var(--aurora-text-secondary)' }}>
                    {tmpl.businessName} · {tmpl.items.length} items · {formatPrice(total)}
                    {!isMine && ` · by ${tmpl.creatorName}`}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--aurora-text-muted)' }}>
                    Used {tmpl.useCount}x · Code: {tmpl.shareCode}
                  </p>
                </div>
                {isExpanded ? <ChevronUp size={16} className="opacity-40" /> : <ChevronDown size={16} className="opacity-40" />}
              </div>

              {isExpanded && (
                <div className="px-4 pb-4 border-t" style={{ borderColor: 'var(--aurora-border)' }}>
                  {tmpl.description && (
                    <p className="text-xs mt-3 mb-2" style={{ color: 'var(--aurora-text-secondary)' }}>
                      {tmpl.description}
                    </p>
                  )}

                  {/* Items */}
                  <div className="mt-2 space-y-1">
                    <p className="text-[10px] font-medium uppercase tracking-wider mb-1" style={{ color: 'var(--aurora-text-muted)' }}>Items</p>
                    {tmpl.items.map((item, i) => (
                      <div key={i} className="flex justify-between text-xs py-0.5">
                        <span style={{ color: 'var(--aurora-text)' }}>{item.qty}x {item.name}</span>
                        <span style={{ color: 'var(--aurora-text-secondary)' }}>{formatPrice(item.unitPrice * item.qty)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-xs font-semibold pt-1 border-t" style={{ borderColor: 'var(--aurora-border)' }}>
                      <span>Total</span>
                      <span style={{ color: '#6366F1' }}>{formatPrice(total)}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 mt-3">
                    <button
                      onClick={() => handleUseTemplate(tmpl)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-white"
                      style={{ backgroundColor: '#059669' }}
                    >
                      <ShoppingCart size={12} />
                      Use Template
                    </button>
                    <button
                      onClick={() => handleCopyLink(tmpl)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border"
                      style={{ color: '#6366F1', borderColor: '#6366F1' }}
                    >
                      {copiedId === tmpl.id ? <Check size={12} /> : <Copy size={12} />}
                      {copiedId === tmpl.id ? 'Copied!' : 'Copy Link'}
                    </button>
                    {isMine && (
                      <button
                        onClick={() => handleDelete(tmpl.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium"
                        style={{ color: '#EF4444' }}
                      >
                        <Trash2 size={12} />
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
