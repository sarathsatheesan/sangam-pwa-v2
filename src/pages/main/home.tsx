'use client';

import React from 'react';
import { Link } from 'react-router-dom';
import {
  Home, Users, Briefcase, Building2, ShoppingBag, Calendar,
  Plane, MessageSquare, Mail, UserCircle, Shield, ChefHat,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useFeatureSettings } from '../../contexts/FeatureSettingsContext';
import { useIncomingRequestCount } from '../../hooks/useIncomingRequests';

interface ModuleTile {
  path: string;
  label: string;
  desc: string;
  icon: React.ReactNode;
  emoji: string;
  gradient: string;
  feature: string;
}

const tiles: ModuleTile[] = [
  { path: '/feed', label: 'Feed', desc: 'Community posts & updates', icon: <Home size={22} />, emoji: '🏠', gradient: 'from-blue-500 to-indigo-500', feature: 'modules_feed' },
  { path: '/discover', label: 'Discover', desc: 'Find & connect with people', icon: <Users size={22} />, emoji: '👥', gradient: 'from-violet-500 to-purple-500', feature: 'modules_discover' },
  { path: '/business', label: 'Business', desc: 'Local business directory', icon: <Briefcase size={22} />, emoji: '💼', gradient: 'from-emerald-500 to-teal-500', feature: 'modules_business' },
  { path: '/housing', label: 'Housing', desc: 'Rentals & roommates', icon: <Building2 size={22} />, emoji: '🏢', gradient: 'from-amber-500 to-orange-500', feature: 'modules_housing' },
  { path: '/catering', label: 'Catering', desc: 'Order catering & menus', icon: <ChefHat size={22} />, emoji: '🍽️', gradient: 'from-orange-500 to-red-500', feature: 'modules_catering' },
  { path: '/marketplace', label: 'Marketplace', desc: 'Buy & sell items', icon: <ShoppingBag size={22} />, emoji: '🛍️', gradient: 'from-pink-500 to-rose-500', feature: 'modules_marketplace' },
  { path: '/events', label: 'Events', desc: 'Community events', icon: <Calendar size={22} />, emoji: '📅', gradient: 'from-cyan-500 to-blue-500', feature: 'modules_events' },
  { path: '/travel', label: 'Travel', desc: 'Travel groups & tips', icon: <Plane size={22} />, emoji: '✈️', gradient: 'from-indigo-500 to-violet-500', feature: 'modules_travel' },
  { path: '/forum', label: 'Forum', desc: 'Discussions & Q&A', icon: <MessageSquare size={22} />, emoji: '💬', gradient: 'from-teal-500 to-emerald-500', feature: 'modules_forum' },
  { path: '/messages', label: 'Messages', desc: 'Private messaging', icon: <Mail size={22} />, emoji: '✉️', gradient: 'from-blue-600 to-indigo-600', feature: 'modules_messages' },
  { path: '/profile', label: 'Profile', desc: 'Your profile & settings', icon: <UserCircle size={22} />, emoji: '👤', gradient: 'from-slate-500 to-gray-600', feature: 'always' },
  { path: '/admin', label: 'Admin', desc: 'Admin dashboard', icon: <Shield size={22} />, emoji: '🛡️', gradient: 'from-red-500 to-rose-600', feature: 'admin_only' },
];

const gradientColors: Record<string, string> = {
  'from-blue-500 to-indigo-500': '#3B82F6, #6366F1',
  'from-violet-500 to-purple-500': '#8B5CF6, #A855F7',
  'from-emerald-500 to-teal-500': '#10B981, #14B8A6',
  'from-amber-500 to-orange-500': '#F59E0B, #F97316',
  'from-orange-500 to-red-500': '#F97316, #EF4444',
  'from-pink-500 to-rose-500': '#EC4899, #F43F5E',
  'from-cyan-500 to-blue-500': '#06B6D4, #3B82F6',
  'from-indigo-500 to-violet-500': '#6366F1, #8B5CF6',
  'from-teal-500 to-emerald-500': '#14B8A6, #10B981',
  'from-blue-600 to-indigo-600': '#2563EB, #4F46E5',
  'from-slate-500 to-gray-600': '#64748B, #4B5563',
  'from-red-500 to-rose-600': '#EF4444, #E11D48',
};

const HomePage: React.FC = () => {
  const { user, userProfile, isAdmin } = useAuth();
  const { isFeatureEnabled } = useFeatureSettings();
  const incomingRequestCount = useIncomingRequestCount();

  const enabledTiles = tiles.filter((t) => {
    if (t.feature === 'always') return true;
    if (t.feature === 'admin_only') return isAdmin;
    return isFeatureEnabled(t.feature);
  });

  const displayName = (userProfile as any)?.preferredName || userProfile?.name || user?.displayName || 'there';

  return (
    <div className="min-h-full" style={{ background: 'linear-gradient(135deg, var(--aurora-bg, #F5F6FA) 0%, var(--aurora-surface-variant, #EDF0F7) 50%, #F0EDFA 100%)' }}>
      {/* Header */}
      <div className="pt-6 pb-2 px-5 text-center max-w-3xl mx-auto">
        <div className="mb-1">
          <span className="text-2xl sm:text-3xl font-extrabold" style={{
            background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '-0.5px',
          }}>
            EthniZity
          </span>
        </div>
        <h1 className="text-lg sm:text-xl font-bold text-[var(--aurora-text,#1E2132)] mb-1">
          Welcome back, {displayName}!
        </h1>
        <p className="text-xs sm:text-sm text-[var(--aurora-text-muted,#9295A5)]">
          What would you like to explore today?
        </p>
      </div>

      {/* Module Grid */}
      <div className="max-w-3xl mx-auto px-4 py-5">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {enabledTiles.map((tile) => {
            const colors = gradientColors[tile.gradient] || '#6366F1, #818CF8';
            return (
              <Link
                key={tile.path}
                to={tile.path}
                className="group bg-[var(--aurora-surface,#fff)] rounded-2xl border border-[var(--aurora-border,#E2E5EF)] overflow-hidden transition-all duration-200 hover:shadow-lg hover:border-[rgba(99,102,241,0.3)] hover:-translate-y-0.5 active:translate-y-0 relative flex flex-col items-center text-center"
                style={{ padding: '20px 12px 16px' }}
              >
                {/* Top accent bar */}
                <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: `linear-gradient(to right, ${colors})` }} />

                {/* Admin badge */}
                {tile.feature === 'admin_only' && (
                  <span className="absolute top-2 right-2 bg-red-100 text-red-600 text-[7px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">Admin</span>
                )}

                {/* Icon */}
                <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center text-2xl sm:text-3xl mb-2.5" style={{ background: 'var(--aurora-surface-variant, #F5F6FA)' }}>
                  {tile.emoji}
                  {tile.path === '/discover' && incomingRequestCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1 animate-pulse shadow-sm">
                      {incomingRequestCount > 9 ? '9+' : incomingRequestCount}
                    </span>
                  )}
                </div>

                {/* Label */}
                <div className="text-sm font-bold text-[var(--aurora-text,#1E2132)] mb-0.5 leading-tight">
                  {tile.label}
                </div>

                {/* Description */}
                <div className="text-[10px] sm:text-[11px] text-[var(--aurora-text-muted,#9295A5)] leading-snug">
                  {tile.desc}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default HomePage;
