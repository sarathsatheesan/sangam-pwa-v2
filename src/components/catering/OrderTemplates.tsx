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
  Check, Search, ExternalLink, Sparkles, TrendingUp, History,
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
  fetchPublicTemplates,
  fetchTemplateUsageStats,
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
  const [submitting, setSubmitting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [lookupMode, setLookupMode] = useState(false);
  const [shareCodeInput, setShareCodeInput] = useState('');
  const [lookedUpTemplate, setLookedUpTemplate] = useState<OrderTemplate | null>(null);
  const [lookingUp, setLookingUp] = useState(false);

  // ── Feature #29: Discover tab state ──
  const [activeTab, setActiveTab] = useState<'mine' | 'discover'>('mine');
  const [publicTemplates, setPublicTemplates] = useState<OrderTemplate[]>([]);
  const [loadingPublic, setLoadingPublic] = useState(false);

  // ── Feature #30/31: Version history and usage stats ──
  const [expandedVersionsId, setExpandedVersionsId] = useState<string | null>(null);
  const [usageStats, setUsageStats] = useState<Record<string, any>>({});
  const [statsFetchedAt, setStatsFetchedAt] = useState<Record<string, number>>({});
  const [loadingUsageStats, setLoadingUsageStats] = useState<Set<string>>(new Set());

  // ── Create form state ──
  const [createMode, setCreateMode] = useState<'from_favorite' | 'from_scratch' | null>(
    prefillFromFavorite ? 'from_favorite' : null
  );
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [organizationName, setOrganizationName] = useState('');

  // ── Create from scratch form state ──
  const [scratchTitle, setScratchTitle] = useState('');
  const [scratchDescription, setScratchDescription] = useState('');
  const [scratchBusinessName, setScratchBusinessName] = useState('');
  const [scratchItems, setScratchItems] = useState<Array<{name: string; qty: number; unitPrice: number; pricingType: string}>>([]);
  const [scratchIsPublic, setScratchIsPublic] = useState(false);
  const [scratchOrgName, setScratchOrgName] = useState('');
  const [creating, setCreating] = useState(false);

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

  // Feature #29: Load public templates for discover tab
  useEffect(() => {
    if (activeTab === 'discover' && publicTemplates.length === 0) {
      setLoadingPublic(true);
      fetchPublicTemplates({ sortBy: 'popular', limit: 20 })
        .then(setPublicTemplates)
        .catch((err) => {
          addToast('Failed to load public templates', 'error');
          console.error(err);
        })
        .finally(() => setLoadingPublic(false));
    }
  }, [activeTab, publicTemplates.length, addToast]);

  // Prefill title from favorite
  useEffect(() => {
    if (prefillFromFavorite) {
      setTitle(`${prefillFromFavorite.label} Template`);
    }
  }, [prefillFromFavorite]);

  // ── Handlers ──

  const handleCreateFromFavorite = useCallback(async () => {
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
      setCreateMode(null);
      setTitle('');
      setDescription('');
    } catch (err: any) {
      addToast(err.message || 'Failed to create template', 'error');
    } finally {
      setSubmitting(false);
    }
  }, [user, userProfile, prefillFromFavorite, title, description, isPublic, organizationName, addToast]);

  const handleCreateFromScratch = useCallback(async () => {
    if (!scratchTitle.trim() || scratchItems.length === 0) {
      addToast('Title and at least one item required', 'error');
      return;
    }
    setCreating(true);
    try {
      const items: OrderItem[] = scratchItems.map((si, idx) => ({
        menuItemId: `scratch_${idx}_${Date.now()}`,
        name: si.name,
        qty: si.qty,
        unitPrice: si.unitPrice,
        pricingType: si.pricingType || 'per_person',
      }));
      const result = await createOrderTemplate({
        creatorId: user!.uid,
        creatorName: userProfile?.name || user!.email || 'Anonymous',
        businessId: '',
        businessName: scratchBusinessName || 'Custom',
        title: scratchTitle,
        description: scratchDescription,
        items,
        isPublic: scratchIsPublic,
        organizationName: scratchOrgName || undefined,
        useCount: 0,
      } as any);
      addToast(`Template created! Share code: ${result.shareCode}`, 'success', 5000);
      // Reset form
      setScratchTitle('');
      setScratchDescription('');
      setScratchBusinessName('');
      setScratchItems([]);
      setScratchIsPublic(false);
      setScratchOrgName('');
      setCreateMode(null);
    } catch (err: any) {
      addToast(err.message || 'Failed to create template', 'error');
    } finally {
      setCreating(false);
    }
  }, [user, userProfile, scratchTitle, scratchDescription, scratchBusinessName, scratchItems, scratchIsPublic, scratchOrgName, addToast]);

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
      await recordTemplateUsage(tmpl.id, user?.uid);
    } catch { /* ignore stats failure */ }
    if (onUseTemplate) {
      onUseTemplate(tmpl);
    } else {
      addToast('Template loaded! Go to the cart to customize and place your order.', 'success', 4000);
    }
  }, [onUseTemplate, addToast, user?.uid]);

  const handleDelete = useCallback(async (tmplId: string) => {
    try {
      await deleteOrderTemplate(tmplId);
      addToast('Template deleted', 'success', 2000);
    } catch (err: any) {
      addToast(err.message || 'Failed to delete', 'error');
    }
  }, [addToast]);

  // Feature #31: Load usage stats (lazy on expand) with 5-minute TTL caching
  const handleExpandTemplate = useCallback(async (tmplId: string) => {
    if (expandedId === tmplId) {
      setExpandedId(null);
      return;
    }

    setExpandedId(tmplId);

    // Check if cache is stale (older than 5 minutes)
    const isCacheStale = statsFetchedAt[tmplId] && (Date.now() - statsFetchedAt[tmplId] > 5 * 60 * 1000);
    if (!usageStats[tmplId] || isCacheStale) {
      setLoadingUsageStats(prev => { const next = new Set(prev); next.add(tmplId); return next; });

      try {
        const stats = await fetchTemplateUsageStats(tmplId);
        setUsageStats((prev) => ({ ...prev, [tmplId]: stats }));
        setStatsFetchedAt(prev => ({ ...prev, [tmplId]: Date.now() }));
      } catch (err) {
        console.error('Failed to load usage stats:', err);
        // Store fallback so the empty container doesn't render
        setUsageStats((prev) => ({ ...prev, [tmplId]: { totalUses: 0, last7Days: 0, last30Days: 0, recentUsers: [] } }));
        setStatsFetchedAt(prev => ({ ...prev, [tmplId]: Date.now() }));
      } finally {
        setLoadingUsageStats(prev => { const next = new Set(prev); next.delete(tmplId); return next; });
      }
    }
  }, [expandedId, usageStats, statsFetchedAt]);

  // Feature #30: Restore a previous version
  const handleRestoreVersion = useCallback(async (tmpl: OrderTemplate, versionToRestore: any) => {
    if (!user) return;
    try {
      await updateOrderTemplate(tmpl.id, {
        items: versionToRestore.items,
        headcount: versionToRestore.headcount,
        specialInstructions: versionToRestore.specialInstructions,
      }, user.uid);
      addToast('Version restored successfully', 'success', 2000);
    } catch (err: any) {
      addToast(err.message || 'Failed to restore version', 'error');
    }
  }, [user, addToast]);

  // ═══════════════════ RENDER ═══════════════════

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--aurora-accent)' }} />
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
            color: lookupMode ? 'var(--aurora-accent)' : 'var(--aurora-text-secondary)',
            borderColor: lookupMode ? 'var(--aurora-accent)' : 'var(--aurora-border)',
          }}
        >
          <Link2 size={12} />
          Use Code
        </button>
      </div>

      {/* Feature #29: Tab navigation */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveTab('mine')}
          className="px-4 py-2 rounded-xl text-sm font-medium border transition-colors"
          style={{
            backgroundColor: activeTab === 'mine' ? 'rgba(99,102,241,0.1)' : 'transparent',
            color: activeTab === 'mine' ? 'var(--aurora-accent)' : 'var(--aurora-text-secondary)',
            borderColor: activeTab === 'mine' ? 'var(--aurora-accent)' : 'var(--aurora-border)',
          }}
        >
          My Templates
        </button>
        <button
          onClick={() => setActiveTab('discover')}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border transition-colors"
          style={{
            backgroundColor: activeTab === 'discover' ? 'rgba(99,102,241,0.1)' : 'transparent',
            color: activeTab === 'discover' ? 'var(--aurora-accent)' : 'var(--aurora-text-secondary)',
            borderColor: activeTab === 'discover' ? 'var(--aurora-accent)' : 'var(--aurora-border)',
          }}
        >
          <Sparkles size={14} />
          Discover
        </button>
      </div>

      {/* ── Share Code Lookup ── */}
      {lookupMode && (
        <div
          className="rounded-2xl border p-4 mb-4"
          style={{ backgroundColor: 'rgba(99,102,241,0.04)', borderColor: 'rgba(99,102,241,0.15)' }}
        >
          <p className="text-xs font-medium mb-1" style={{ color: 'var(--aurora-text)' }}>
            Enter a template share code to load it
          </p>
          <p className="text-[10px] mb-2" style={{ color: 'var(--aurora-text-muted)' }}>
            Share codes are permanent and unique to each template. The creator can delete the template to revoke access.
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
              style={{ backgroundColor: 'var(--aurora-accent)' }}
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
      {createMode && (
        <div
          className="rounded-2xl border p-4 mb-4"
          style={{ backgroundColor: 'var(--aurora-surface)', borderColor: 'var(--aurora-border)' }}
        >
          {/* Tab selection */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setCreateMode('from_favorite')}
              disabled={!prefillFromFavorite}
              className="flex-1 px-4 py-2 rounded-xl text-sm font-medium border transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: createMode === 'from_favorite' ? 'rgba(99,102,241,0.1)' : 'transparent',
                color: createMode === 'from_favorite' ? 'var(--aurora-accent)' : 'var(--aurora-text-secondary)',
                borderColor: createMode === 'from_favorite' ? 'var(--aurora-accent)' : 'var(--aurora-border)',
              }}
            >
              From Favorite
            </button>
            <button
              onClick={() => setCreateMode('from_scratch')}
              className="flex-1 px-4 py-2 rounded-xl text-sm font-medium border transition-colors"
              style={{
                backgroundColor: createMode === 'from_scratch' ? 'rgba(99,102,241,0.1)' : 'transparent',
                color: createMode === 'from_scratch' ? 'var(--aurora-accent)' : 'var(--aurora-text-secondary)',
                borderColor: createMode === 'from_scratch' ? 'var(--aurora-accent)' : 'var(--aurora-border)',
              }}
            >
              Create from Scratch
            </button>
          </div>

          {/* FROM FAVORITE MODE */}
          {createMode === 'from_favorite' && prefillFromFavorite && (
            <>
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

                <div>
                  <label className="text-xs font-medium" style={{ color: 'var(--aurora-text)' }}>Visibility</label>
                  <div className="flex gap-2 mt-1">
                    <button
                      onClick={() => setIsPublic(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
                      style={{
                        backgroundColor: isPublic ? 'rgba(99,102,241,0.1)' : 'transparent',
                        color: isPublic ? 'var(--aurora-accent)' : 'var(--aurora-text-secondary)',
                        borderColor: isPublic ? 'var(--aurora-accent)' : 'var(--aurora-border)',
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
                        color: !isPublic ? 'var(--aurora-accent)' : 'var(--aurora-text-secondary)',
                        borderColor: !isPublic ? 'var(--aurora-accent)' : 'var(--aurora-border)',
                      }}
                    >
                      <Lock size={12} />
                      Organization only
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium" style={{ color: 'var(--aurora-text)' }}>
                    Organization Name <span style={{ color: 'var(--aurora-text-muted)' }}>(optional)</span>
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
                  onClick={handleCreateFromFavorite}
                  disabled={submitting}
                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-50"
                  style={{ backgroundColor: 'var(--aurora-accent)' }}
                >
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />}
                  {submitting ? 'Creating...' : 'Create Template'}
                </button>
                <button
                  onClick={() => setCreateMode(null)}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium"
                  style={{ color: 'var(--aurora-text-secondary)' }}
                >
                  Cancel
                </button>
              </div>
            </>
          )}

          {/* FROM SCRATCH MODE */}
          {createMode === 'from_scratch' && (
            <>
              <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--aurora-text)' }}>
                Create Template from Scratch
              </h3>
              <p className="text-xs mb-4" style={{ color: 'var(--aurora-text-secondary)' }}>
                Build a custom order template with your own items
              </p>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium" style={{ color: 'var(--aurora-text)' }}>Template Title *</label>
                  <input
                    type="text"
                    value={scratchTitle}
                    onChange={(e) => setScratchTitle(e.target.value)}
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
                    value={scratchDescription}
                    onChange={(e) => setScratchDescription(e.target.value)}
                    placeholder="Notes about this template..."
                    rows={2}
                    className="w-full mt-1 px-3 py-2 rounded-lg border text-sm resize-none"
                    style={{ borderColor: 'var(--aurora-border)' }}
                  />
                </div>

                <div>
                  <label className="text-xs font-medium" style={{ color: 'var(--aurora-text)' }}>
                    Business Name <span style={{ color: 'var(--aurora-text-muted)' }}>(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={scratchBusinessName}
                    onChange={(e) => setScratchBusinessName(e.target.value)}
                    placeholder="e.g., Acme Catering"
                    className="w-full mt-1 px-3 py-2 rounded-lg border text-sm"
                    style={{ borderColor: 'var(--aurora-border)' }}
                  />
                </div>

                <div>
                  <label className="text-xs font-medium" style={{ color: 'var(--aurora-text)' }}>Visibility</label>
                  <div className="flex gap-2 mt-1">
                    <button
                      onClick={() => setScratchIsPublic(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
                      style={{
                        backgroundColor: scratchIsPublic ? 'rgba(99,102,241,0.1)' : 'transparent',
                        color: scratchIsPublic ? 'var(--aurora-accent)' : 'var(--aurora-text-secondary)',
                        borderColor: scratchIsPublic ? 'var(--aurora-accent)' : 'var(--aurora-border)',
                      }}
                    >
                      <Globe size={12} />
                      Anyone with link
                    </button>
                    <button
                      onClick={() => setScratchIsPublic(false)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
                      style={{
                        backgroundColor: !scratchIsPublic ? 'rgba(99,102,241,0.1)' : 'transparent',
                        color: !scratchIsPublic ? 'var(--aurora-accent)' : 'var(--aurora-text-secondary)',
                        borderColor: !scratchIsPublic ? 'var(--aurora-accent)' : 'var(--aurora-border)',
                      }}
                    >
                      <Lock size={12} />
                      Organization only
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium" style={{ color: 'var(--aurora-text)' }}>
                    Organization Name <span style={{ color: 'var(--aurora-text-muted)' }}>(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={scratchOrgName}
                    onChange={(e) => setScratchOrgName(e.target.value)}
                    placeholder="e.g., Acme Corp"
                    className="w-full mt-1 px-3 py-2 rounded-lg border text-sm"
                    style={{ borderColor: 'var(--aurora-border)' }}
                  />
                </div>

                {/* Items section */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium" style={{ color: 'var(--aurora-text)' }}>Items *</label>
                    <button
                      onClick={() => setScratchItems([...scratchItems, {name: '', qty: 1, unitPrice: 0, pricingType: 'per_person'}])}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-white"
                      style={{ backgroundColor: 'var(--aurora-accent)' }}
                    >
                      <Plus size={12} />
                      Add Item
                    </button>
                  </div>
                  <div className="space-y-2">
                    {scratchItems.map((item, idx) => (
                      <div key={idx} className="flex gap-2 items-end">
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => {
                            const newItems = [...scratchItems];
                            newItems[idx].name = e.target.value;
                            setScratchItems(newItems);
                          }}
                          placeholder="Item name"
                          className="flex-1 px-2 py-1.5 rounded-lg border text-xs"
                          style={{ borderColor: 'var(--aurora-border)' }}
                        />
                        <input
                          type="number"
                          value={item.qty}
                          onChange={(e) => {
                            const newItems = [...scratchItems];
                            newItems[idx].qty = parseInt(e.target.value) || 1;
                            setScratchItems(newItems);
                          }}
                          placeholder="Qty"
                          className="w-16 px-2 py-1.5 rounded-lg border text-xs"
                          style={{ borderColor: 'var(--aurora-border)' }}
                        />
                        <input
                          type="number"
                          value={item.unitPrice}
                          onChange={(e) => {
                            const newItems = [...scratchItems];
                            newItems[idx].unitPrice = parseFloat(e.target.value) || 0;
                            setScratchItems(newItems);
                          }}
                          placeholder="Price"
                          className="w-20 px-2 py-1.5 rounded-lg border text-xs"
                          style={{ borderColor: 'var(--aurora-border)' }}
                        />
                        <select
                          value={item.pricingType}
                          onChange={(e) => {
                            const newItems = [...scratchItems];
                            newItems[idx].pricingType = e.target.value;
                            setScratchItems(newItems);
                          }}
                          className="w-24 px-2 py-1.5 rounded-lg border text-xs"
                          style={{ borderColor: 'var(--aurora-border)' }}
                        >
                          <option value="per_person">Per Person</option>
                          <option value="fixed">Fixed</option>
                        </select>
                        <button
                          onClick={() => setScratchItems(scratchItems.filter((_, i) => i !== idx))}
                          className="px-2 py-1.5 rounded-lg text-xs font-medium text-white"
                          style={{ backgroundColor: '#EF4444' }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <button
                  onClick={handleCreateFromScratch}
                  disabled={creating}
                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-50"
                  style={{ backgroundColor: 'var(--aurora-accent)' }}
                >
                  {creating ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />}
                  {creating ? 'Creating...' : 'Create Template'}
                </button>
                <button
                  onClick={() => setCreateMode(null)}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium"
                  style={{ color: 'var(--aurora-text-secondary)' }}
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Templates List (My Templates) ── */}
      {activeTab === 'mine' && (
        <>
          {templates.length === 0 && !createMode && !lookupMode && (
            <div className="text-center py-16">
              <Share2 size={40} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium" style={{ color: 'var(--aurora-text-secondary)' }}>
                No templates yet
              </p>
              <p className="text-xs mt-1 mb-4" style={{ color: 'var(--aurora-text-muted)' }}>
                Create a template from scratch or save a favorite order first.
              </p>
              <button
                onClick={() => setCreateMode('from_scratch')}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium text-white"
                style={{ backgroundColor: 'var(--aurora-accent)' }}
              >
                <Plus size={14} />
                Create from Scratch
              </button>
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
                    onClick={() => handleExpandTemplate(tmpl.id)}
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

                  {/* Feature #31: Usage Stats (for owned templates) */}
                  {isMine && (loadingUsageStats.has(tmpl.id) || usageStats[tmpl.id]) && (
                    <div className="mt-3 p-3 rounded-lg" style={{ backgroundColor: 'rgba(99,102,241,0.05)', borderColor: 'rgba(99,102,241,0.1)' }}>
                      {loadingUsageStats.has(tmpl.id) ? (
                        <div className="flex items-center gap-2">
                          <Loader2 size={12} className="animate-spin" style={{ color: '#6366F1' }} />
                          <p className="text-xs" style={{ color: 'var(--aurora-text-secondary)' }}>Loading stats...</p>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--aurora-text)' }}>
                            <TrendingUp size={12} style={{ color: '#6366F1' }} />
                            <span>Total uses: <strong>{usageStats[tmpl.id].totalUses}</strong></span>
                          </div>
                          <p className="text-xs" style={{ color: 'var(--aurora-text-secondary)' }}>
                            Last 7 days: {usageStats[tmpl.id].last7Days} · Last 30 days: {usageStats[tmpl.id].last30Days}
                          </p>
                        </div>
                      )}
                    </div>
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

                  {/* Feature #30: Version History (for owned templates) */}
                  {isMine && tmpl.versionHistory && tmpl.versionHistory.length > 0 && (
                    <div className="mt-3 border-t pt-3" style={{ borderColor: 'var(--aurora-border)' }}>
                      <button
                        onClick={() => setExpandedVersionsId(expandedVersionsId === tmpl.id ? null : tmpl.id)}
                        className="flex items-center gap-1.5 text-xs font-medium"
                        style={{ color: '#6366F1' }}
                      >
                        <History size={12} />
                        Version History ({tmpl.versionHistory.length})
                        {expandedVersionsId === tmpl.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>
                      {expandedVersionsId === tmpl.id && (
                        <div className="mt-2 space-y-2">
                          {tmpl.versionHistory.map((vh, idx) => (
                            <div
                              key={idx}
                              className="p-2 rounded-lg border"
                              style={{ backgroundColor: 'var(--aurora-surface)', borderColor: 'var(--aurora-border)' }}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-semibold" style={{ color: 'var(--aurora-text)' }}>
                                  Version {vh.version}
                                </span>
                                <span className="text-[10px]" style={{ color: 'var(--aurora-text-muted)' }}>
                                  {vh.updatedAt?.toDate?.()?.toLocaleDateString?.() || 'Unknown'}
                                </span>
                              </div>
                              <p className="text-[10px] mb-2" style={{ color: 'var(--aurora-text-secondary)' }}>
                                {vh.items.length} items · by {vh.updatedBy}
                              </p>
                              <button
                                onClick={() => handleRestoreVersion(tmpl, vh)}
                                className="text-[10px] font-medium px-2 py-1 rounded text-white"
                                style={{ backgroundColor: 'var(--aurora-accent)' }}
                              >
                                Restore
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

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
        </>
      )}

      {/* Feature #29: Discover Tab */}
      {activeTab === 'discover' && (
        <>
          {loadingPublic ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={24} className="animate-spin" style={{ color: 'var(--aurora-accent)' }} />
            </div>
          ) : publicTemplates.length === 0 ? (
            <div className="text-center py-16">
              <Sparkles size={40} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium" style={{ color: 'var(--aurora-text-secondary)' }}>
                No public templates yet
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--aurora-text-muted)' }}>
                Check back later for shared templates from the community.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {publicTemplates.map((tmpl) => {
                const total = calculateOrderTotal(tmpl.items);
                return (
                  <div
                    key={tmpl.id}
                    className="rounded-2xl border p-4"
                    style={{ backgroundColor: 'var(--aurora-surface)', borderColor: 'var(--aurora-border)' }}
                  >
                    <div className="mb-2">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <span className="text-sm font-semibold truncate" style={{ color: 'var(--aurora-text)' }}>
                          {tmpl.title}
                        </span>
                        <span
                          className="px-1.5 py-0.5 rounded text-[9px] whitespace-nowrap"
                          style={{ backgroundColor: '#D1FAE5', color: '#059669' }}
                        >
                          Public
                        </span>
                      </div>
                      <p className="text-xs" style={{ color: 'var(--aurora-text-secondary)' }}>
                        {tmpl.businessName}
                      </p>
                      <p className="text-[10px] mt-0.5" style={{ color: 'var(--aurora-text-muted)' }}>
                        by {tmpl.creatorName}
                      </p>
                    </div>

                    <div className="flex items-center justify-between text-xs mb-2 p-2 rounded" style={{ backgroundColor: 'rgba(99,102,241,0.05)' }}>
                      <span style={{ color: 'var(--aurora-text-secondary)' }}>
                        {tmpl.items.length} items
                      </span>
                      <span style={{ color: '#6366F1', fontWeight: 600 }}>
                        {formatPrice(total)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-[10px] mb-3 px-2" style={{ color: 'var(--aurora-text-muted)' }}>
                      <TrendingUp size={10} />
                      Used {tmpl.useCount || 0} times
                    </div>

                    <button
                      onClick={() => handleUseTemplate(tmpl)}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white"
                      style={{ backgroundColor: '#059669' }}
                    >
                      <ShoppingCart size={12} />
                      Use Template
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
