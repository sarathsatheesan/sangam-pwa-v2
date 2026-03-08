import React, { useState } from 'react';
import { useUserSettings } from '../../contexts/UserSettingsContext';
import {
  Settings,
  Bell,
  Shield,
  Globe,
  Palette,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  Moon,
  Sun,
  Type,
  Eye,
  EyeOff,
  Lock,
  Users,
  MessageSquare,
  Mail,
  Smartphone,
  Trash2,
  Download,
  FileText,
  ExternalLink,
  AlertTriangle,
  Check,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { auth } from '../../services/firebase';
import { db } from '../../services/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { signOut, deleteUser } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { resetPassword } from '../../services/auth';

// Types imported from context

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'Hindi' },
  { code: 'ta', label: 'Tamil' },
  { code: 'te', label: 'Telugu' },
  { code: 'ml', label: 'Malayalam' },
  { code: 'kn', label: 'Kannada' },
  { code: 'bn', label: 'Bengali' },
  { code: 'gu', label: 'Gujarati' },
  { code: 'mr', label: 'Marathi' },
  { code: 'pa', label: 'Punjabi' },
  { code: 'es', label: 'Spanish' },
];

type Section = 'main' | 'notifications' | 'privacy' | 'language' | 'appearance' | 'help' | 'account';

// ─── Toggle Component ────────────────────────────────────────────────────
const Toggle: React.FC<{ enabled: boolean; onChange: (val: boolean) => void; disabled?: boolean }> = ({
  enabled,
  onChange,
  disabled,
}) => (
  <button
    onClick={() => !disabled && onChange(!enabled)}
    className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
      disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
    } ${enabled ? 'bg-aurora-indigo' : 'bg-gray-200'}`}
  >
    <span
      className={`inline-block h-5 w-5 transform rounded-full bg-aurora-surface shadow-aurora-1 transition-transform ${
        enabled ? 'translate-x-6' : 'translate-x-1'
      }`}
    />
  </button>
);

// ─── Setting Row ────────────────────────────────────────────────────────
const SettingRow: React.FC<{
  icon?: React.ReactNode;
  label: string;
  description?: string;
  rightElement?: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
}> = ({ icon, label, description, rightElement, onClick, danger }) => (
  <div
    onClick={onClick}
    className={`flex items-center gap-3 px-4 py-3.5 ${
      onClick ? 'cursor-pointer hover:bg-aurora-surface-variant active:bg-aurora-surface-variant' : ''
    } ${danger ? 'text-aurora-danger' : ''}`}
  >
    {icon && <span className={`flex-shrink-0 ${danger ? 'text-aurora-danger' : 'text-aurora-text-muted'}`}>{icon}</span>}
    <div className="flex-1 min-w-0">
      <p className={`text-sm font-medium ${danger ? 'text-aurora-danger' : 'text-aurora-text'}`}>{label}</p>
      {description && <p className="text-xs text-aurora-text-muted mt-0.5">{description}</p>}
    </div>
    {rightElement}
    {onClick && !rightElement && <ChevronRight size={18} className="text-aurora-text-muted flex-shrink-0" />}
  </div>
);

// ─── Section Header ─────────────────────────────────────────────────────
const SectionHeader: React.FC<{ title: string; onBack: () => void }> = ({ title, onBack }) => (
  <div className="flex items-center gap-3 px-4 py-4 border-b border-aurora-border bg-aurora-surface sticky top-0 z-10">
    <button onClick={onBack} className="p-1 -ml-1 hover:bg-aurora-surface-variant rounded-xl transition-colors">
      <ChevronLeft size={22} className="text-aurora-text-secondary" />
    </button>
    <h2 className="text-lg font-bold text-aurora-text">{title}</h2>
  </div>
);

// ─── Main Component ─────────────────────────────────────────────────────
const SettingsPage: React.FC = () => {
  const { user, userProfile } = useAuth();
  const { settings, updateSetting } = useUserSettings();
  const navigate = useNavigate();
  const [section, setSection] = useState<Section>('main');
  const [saved, setSaved] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [helpModal, setHelpModal] = useState<'faq' | 'tos' | 'privacy' | 'about' | null>(null);


  // Wrap updateSetting to show save indicator
  const handleUpdateSetting = <K extends keyof typeof settings>(
    category: K,
    key: keyof (typeof settings)[K],
    value: (typeof settings)[K][keyof (typeof settings)[K]]
  ) => {
    updateSetting(category, key, value);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    try {
      await deleteUser(user);
      navigate('/auth/login');
    } catch (err) {
      console.error('Failed to delete account:', err);
      alert('Please sign out and sign back in before deleting your account (re-authentication required).');
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    navigate('/auth/login');
  };

  // ─── Notification Settings ─────────────────────────────────────────
  const renderNotifications = () => (
    <div className="flex flex-col min-h-0">
      <SectionHeader title="Notifications" onBack={() => setSection('main')} />
      <div className="divide-y divide-aurora-border">
        <div className="px-4 py-3 bg-aurora-indigo/10">
          <p className="text-xs text-aurora-indigo font-medium">
            Control how and when ethniCity notifies you about activity
          </p>
        </div>

        <div className="px-4 pt-3 pb-1">
          <p className="text-xs font-semibold text-aurora-text-muted uppercase tracking-wider">Push Notifications</p>
        </div>
        <SettingRow
          icon={<Smartphone size={18} />}
          label="Push Notifications"
          description="Receive notifications on your device"
          rightElement={
            <Toggle
              enabled={settings.notifications.pushEnabled}
              onChange={(v) => handleUpdateSetting('notifications', 'pushEnabled', v)}
            />
          }
        />
        <SettingRow
          icon={<MessageSquare size={18} />}
          label="New Messages"
          description="When someone sends you a direct message"
          rightElement={
            <Toggle
              enabled={settings.notifications.newMessages}
              onChange={(v) => handleUpdateSetting('notifications', 'newMessages', v)}
            />
          }
        />
        <SettingRow
          icon={<Users size={18} />}
          label="New Followers"
          description="When someone follows your profile"
          rightElement={
            <Toggle
              enabled={settings.notifications.newFollowers}
              onChange={(v) => handleUpdateSetting('notifications', 'newFollowers', v)}
            />
          }
        />
        <SettingRow
          icon={<Bell size={18} />}
          label="Event Reminders"
          description="Reminders for upcoming events you're attending"
          rightElement={
            <Toggle
              enabled={settings.notifications.eventReminders}
              onChange={(v) => handleUpdateSetting('notifications', 'eventReminders', v)}
            />
          }
        />
        <SettingRow
          icon={<Users size={18} />}
          label="Community Updates"
          description="Updates from groups and communities you've joined"
          rightElement={
            <Toggle
              enabled={settings.notifications.communityUpdates}
              onChange={(v) => handleUpdateSetting('notifications', 'communityUpdates', v)}
            />
          }
        />

        <div className="px-4 pt-4 pb-1">
          <p className="text-xs font-semibold text-aurora-text-muted uppercase tracking-wider">Email</p>
        </div>
        <SettingRow
          icon={<Mail size={18} />}
          label="Email Digest"
          description="Weekly summary of activity and highlights"
          rightElement={
            <Toggle
              enabled={settings.notifications.emailDigest}
              onChange={(v) => handleUpdateSetting('notifications', 'emailDigest', v)}
            />
          }
        />
        <SettingRow
          icon={<Mail size={18} />}
          label="Marketing Emails"
          description="News, features, and promotional offers"
          rightElement={
            <Toggle
              enabled={settings.notifications.marketingEmails}
              onChange={(v) => handleUpdateSetting('notifications', 'marketingEmails', v)}
            />
          }
        />
      </div>
    </div>
  );

  // ─── Privacy Settings ─────────────────────────────────────────────
  const renderPrivacy = () => (
    <div className="flex flex-col min-h-0">
      <SectionHeader title="Privacy & Security" onBack={() => setSection('main')} />
      <div className="divide-y divide-aurora-border">
        <div className="px-4 py-3 bg-aurora-success/10">
          <p className="text-xs text-aurora-success font-medium">
            Control who can see your information and interact with you
          </p>
        </div>

        <div className="px-4 pt-3 pb-1">
          <p className="text-xs font-semibold text-aurora-text-muted uppercase tracking-wider">Profile Visibility</p>
        </div>
        <div className="px-4 py-3">
          <p className="text-sm font-medium text-aurora-text mb-2">Who can see your profile?</p>
          {(['public', 'community', 'private'] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => handleUpdateSetting('privacy', 'profileVisibility', opt)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl mb-2 border transition-all ${
                settings.privacy.profileVisibility === opt
                  ? 'border-aurora-indigo bg-aurora-indigo/10'
                  : 'border-aurora-border hover:border-aurora-border'
              }`}
            >
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-aurora-text capitalize">{opt}</p>
                <p className="text-xs text-aurora-text-muted">
                  {opt === 'public' && 'Anyone can view your profile'}
                  {opt === 'community' && 'Only ethniCity community members'}
                  {opt === 'private' && 'Only people you approve'}
                </p>
              </div>
              {settings.privacy.profileVisibility === opt && (
                <Check size={18} className="text-aurora-indigo" />
              )}
            </button>
          ))}
        </div>

        <div className="px-4 pt-3 pb-1">
          <p className="text-xs font-semibold text-aurora-text-muted uppercase tracking-wider">Information Display</p>
        </div>
        <SettingRow
          icon={<Mail size={18} />}
          label="Show Email Address"
          description="Display your email on your public profile"
          rightElement={
            <Toggle
              enabled={settings.privacy.showEmail}
              onChange={(v) => handleUpdateSetting('privacy', 'showEmail', v)}
            />
          }
        />
        <SettingRow
          icon={<Smartphone size={18} />}
          label="Show Phone Number"
          description="Display your phone on your public profile"
          rightElement={
            <Toggle
              enabled={settings.privacy.showPhone}
              onChange={(v) => handleUpdateSetting('privacy', 'showPhone', v)}
            />
          }
        />
        <SettingRow
          icon={<Globe size={18} />}
          label="Show Location"
          description="Display your city/state on your profile"
          rightElement={
            <Toggle
              enabled={settings.privacy.showLocation}
              onChange={(v) => handleUpdateSetting('privacy', 'showLocation', v)}
            />
          }
        />

        <div className="px-4 pt-3 pb-1">
          <p className="text-xs font-semibold text-aurora-text-muted uppercase tracking-wider">Interactions</p>
        </div>
        <div className="px-4 py-3">
          <p className="text-sm font-medium text-aurora-text mb-2">Who can message you?</p>
          {(['everyone', 'community', 'nobody'] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => handleUpdateSetting('privacy', 'messagingAllowed', opt)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl mb-2 border transition-all ${
                settings.privacy.messagingAllowed === opt
                  ? 'border-aurora-indigo bg-aurora-indigo/10'
                  : 'border-aurora-border hover:border-aurora-border'
              }`}
            >
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-aurora-text capitalize">{opt}</p>
              </div>
              {settings.privacy.messagingAllowed === opt && (
                <Check size={18} className="text-aurora-indigo" />
              )}
            </button>
          ))}
        </div>

        <SettingRow
          icon={<Eye size={18} />}
          label="Activity Status"
          description="Show when you're online or recently active"
          rightElement={
            <Toggle
              enabled={settings.privacy.activityStatus}
              onChange={(v) => handleUpdateSetting('privacy', 'activityStatus', v)}
            />
          }
        />
        <SettingRow
          icon={<Users size={18} />}
          label="Searchable Profile"
          description="Let others find you by name or email"
          rightElement={
            <Toggle
              enabled={settings.privacy.searchable}
              onChange={(v) => handleUpdateSetting('privacy', 'searchable', v)}
            />
          }
        />
      </div>
    </div>
  );

  // ─── Language Settings ────────────────────────────────────────────
  const renderLanguage = () => (
    <div className="flex flex-col min-h-0">
      <SectionHeader title="Language & Region" onBack={() => setSection('main')} />
      <div className="divide-y divide-aurora-border">
        <div className="px-4 py-3 bg-aurora-indigo/10">
          <p className="text-xs text-aurora-indigo font-medium">
            Choose your preferred language for the app interface and content
          </p>
        </div>

        <div className="px-4 pt-3 pb-1">
          <p className="text-xs font-semibold text-aurora-text-muted uppercase tracking-wider">App Language</p>
        </div>
        <div className="px-4 py-3">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleUpdateSetting('language', 'appLanguage', lang.code)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl mb-2 border transition-all ${
                settings.language.appLanguage === lang.code
                  ? 'border-aurora-indigo bg-aurora-indigo/10'
                  : 'border-aurora-border hover:border-aurora-border'
              }`}
            >
              <span className="flex-1 text-left text-sm font-medium text-aurora-text">{lang.label}</span>
              {settings.language.appLanguage === lang.code && (
                <Check size={18} className="text-aurora-indigo" />
              )}
            </button>
          ))}
        </div>

        <div className="px-4 pt-3 pb-1">
          <p className="text-xs font-semibold text-aurora-text-muted uppercase tracking-wider">Content Languages</p>
          <p className="text-xs text-aurora-text-muted mt-1">Show posts and content in these languages</p>
        </div>
        <div className="px-4 py-3 flex flex-wrap gap-2">
          {LANGUAGES.map((lang) => {
            const isSelected = settings.language.contentLanguages.includes(lang.code);
            return (
              <button
                key={lang.code}
                onClick={() => {
                  const current = settings.language.contentLanguages;
                  const updated = isSelected
                    ? current.filter((c) => c !== lang.code)
                    : [...current, lang.code];
                  if (updated.length > 0) {
                    handleUpdateSetting('language', 'contentLanguages', updated as string[] & string);
                  }
                }}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  isSelected
                    ? 'bg-aurora-indigo text-white'
                    : 'bg-aurora-surface-variant text-aurora-text-secondary hover:bg-gray-100'
                }`}
              >
                {lang.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  // ─── Appearance Settings ──────────────────────────────────────────
  const renderAppearance = () => (
    <div className="flex flex-col min-h-0">
      <SectionHeader title="Appearance" onBack={() => setSection('main')} />
      <div className="divide-y divide-aurora-border">
        <div className="px-4 py-3 bg-aurora-warning/10">
          <p className="text-xs text-orange-700 font-medium">
            Customize how the app looks and feels
          </p>
        </div>

        <div className="px-4 pt-3 pb-1">
          <p className="text-xs font-semibold text-aurora-text-muted uppercase tracking-wider">Theme</p>
        </div>
        <div className="px-4 py-3 flex gap-3">
          {([
            { key: 'light' as const, icon: <Sun size={22} />, label: 'Light' },
            { key: 'dark' as const, icon: <Moon size={22} />, label: 'Dark' },
            { key: 'system' as const, icon: <Smartphone size={22} />, label: 'System' },
          ]).map((opt) => (
            <button
              key={opt.key}
              onClick={() => handleUpdateSetting('appearance', 'theme', opt.key)}
              className={`flex-1 flex flex-col items-center gap-2 py-4 rounded-xl border-2 transition-all ${
                settings.appearance.theme === opt.key
                  ? 'border-aurora-indigo bg-aurora-indigo/10 text-aurora-indigo'
                  : 'border-aurora-border text-aurora-text-muted hover:border-aurora-border'
              }`}
            >
              {opt.icon}
              <span className="text-sm font-medium">{opt.label}</span>
            </button>
          ))}
        </div>

        <div className="px-4 pt-4 pb-1">
          <p className="text-xs font-semibold text-aurora-text-muted uppercase tracking-wider">Font Size</p>
        </div>
        <div className="px-4 py-3 flex gap-3">
          {([
            { key: 'small' as const, label: 'A', sublabel: 'Small', size: 'text-sm' },
            { key: 'medium' as const, label: 'A', sublabel: 'Medium', size: 'text-base' },
            { key: 'large' as const, label: 'A', sublabel: 'Large', size: 'text-xl' },
          ]).map((opt) => (
            <button
              key={opt.key}
              onClick={() => handleUpdateSetting('appearance', 'fontSize', opt.key)}
              className={`flex-1 flex flex-col items-center gap-1 py-4 rounded-xl border-2 transition-all ${
                settings.appearance.fontSize === opt.key
                  ? 'border-aurora-indigo bg-aurora-indigo/10'
                  : 'border-aurora-border hover:border-aurora-border'
              }`}
            >
              <span className={`font-bold ${opt.size} ${
                settings.appearance.fontSize === opt.key ? 'text-aurora-indigo' : 'text-aurora-text-secondary'
              }`}>
                {opt.label}
              </span>
              <span className="text-xs text-aurora-text-muted">{opt.sublabel}</span>
            </button>
          ))}
        </div>

        <div className="px-4 pt-4 pb-1">
          <p className="text-xs font-semibold text-aurora-text-muted uppercase tracking-wider">Layout</p>
        </div>
        <SettingRow
          icon={<Type size={18} />}
          label="Compact Mode"
          description="Show more content with smaller spacing"
          rightElement={
            <Toggle
              enabled={settings.appearance.compactMode}
              onChange={(v) => handleUpdateSetting('appearance', 'compactMode', v)}
            />
          }
        />
      </div>
    </div>
  );

  // ─── Help & Support ───────────────────────────────────────────────
  const helpModalContent: Record<string, { title: string; body: React.ReactNode }> = {
    faq: {
      title: 'Frequently Asked Questions',
      body: (
        <div className="space-y-4 text-sm text-aurora-text-secondary">
          <div>
            <p className="font-semibold text-aurora-text mb-1">What is ethniCity?</p>
            <p>ethniCity is a community platform that connects diverse professionals, businesses, and families. Share updates, discover events, find local businesses, and build meaningful connections.</p>
          </div>
          <div>
            <p className="font-semibold text-aurora-text mb-1">How do I switch from Individual to Business account?</p>
            <p>Go to your Profile page, tap "Edit Profile", and change the Account Type to Business. You'll need to provide a valid phone number and your business details will require admin approval.</p>
          </div>
          <div>
            <p className="font-semibold text-aurora-text mb-1">How do I add a business listing?</p>
            <p>Navigate to the Business tab and tap "Add Business". Your account must be a Business type with admin approval to create listings.</p>
          </div>
          <div>
            <p className="font-semibold text-aurora-text mb-1">How do I create an event?</p>
            <p>Go to the Events tab and tap the "+" button. Fill in the event details including date, location, and description.</p>
          </div>
          <div>
            <p className="font-semibold text-aurora-text mb-1">How do I reset my password?</p>
            <p>Go to Settings &gt; Account &amp; Data &gt; Change Password. A reset link will be sent to your registered email.</p>
          </div>
          <div>
            <p className="font-semibold text-aurora-text mb-1">How do I delete my account?</p>
            <p>Go to Settings &gt; Account &amp; Data &gt; Delete Account. This action is permanent and cannot be undone.</p>
          </div>
        </div>
      ),
    },
    tos: {
      title: 'Terms of Service',
      body: (
        <div className="space-y-3 text-sm text-aurora-text-secondary">
          <p><strong>Last updated:</strong> February 2026</p>
          <p>By using ethniCity, you agree to these Terms of Service. ethniCity provides a community platform for connecting individuals and businesses within diverse communities.</p>
          <p><strong>Account Responsibilities:</strong> You are responsible for maintaining the confidentiality of your account credentials and for all activity under your account. You must provide accurate information during registration.</p>
          <p><strong>Acceptable Use:</strong> You agree not to use ethniCity for any unlawful purpose, to harass or harm others, to post misleading or false content, or to attempt to gain unauthorized access to any part of the platform.</p>
          <p><strong>Content:</strong> You retain ownership of content you post. By posting, you grant ethniCity a non-exclusive license to display your content on the platform. We may remove content that violates these terms.</p>
          <p><strong>Business Listings:</strong> Business account holders are responsible for the accuracy of their business information. ethniCity reserves the right to approve, reject, or remove business listings.</p>
          <p><strong>Termination:</strong> We may suspend or terminate accounts that violate these terms. You may delete your account at any time through Settings.</p>
          <p><strong>Contact:</strong> For questions about these terms, email support@ethnicity.com.</p>
        </div>
      ),
    },
    privacy: {
      title: 'Privacy Policy',
      body: (
        <div className="space-y-3 text-sm text-aurora-text-secondary">
          <p><strong>Last updated:</strong> February 2026</p>
          <p>ethniCity is committed to protecting your privacy. This policy explains how we collect, use, and safeguard your information.</p>
          <p><strong>Information We Collect:</strong> Account details (name, email, phone), profile information (heritage, location, bio), content you create (posts, events, business listings), and usage data (app interactions, device info).</p>
          <p><strong>How We Use Your Data:</strong> To provide and improve our services, to connect you with the community, to send notifications you've opted into, and to ensure platform safety.</p>
          <p><strong>Data Sharing:</strong> We do not sell your personal information. Your profile information is visible based on your privacy settings. We may share data with service providers who help operate the platform.</p>
          <p><strong>Data Security:</strong> We use industry-standard security measures including encryption and secure Firebase infrastructure to protect your data.</p>
          <p><strong>Your Rights:</strong> You can download your data, update your privacy settings, or delete your account at any time through the Settings page.</p>
          <p><strong>Contact:</strong> For privacy concerns, email support@ethnicity.com.</p>
        </div>
      ),
    },
    about: {
      title: 'About ethniCity',
      body: (
        <div className="space-y-3 text-sm text-aurora-text-secondary text-center">
          <div className="flex items-center gap-2 justify-center"><img src="/ethnicity-logo.svg" alt="ethniCity" className="w-8 h-8" /><p className="text-lg font-bold"><span style={{ color: '#c96830' }}>ethni</span><span style={{ color: '#0d4f5a' }} className="font-black">City</span></p></div>
          <p className="text-aurora-text-muted">Version 2.0.0 (PWA)</p>
          <p>ethniCity — where ethnicity meets city — is a community platform built to connect, empower, and celebrate diverse cultures across the globe.</p>
          <p>Whether you're an individual looking to connect with your community or a business owner wanting to reach local customers, ethniCity brings everyone together.</p>
          <p className="text-xs text-aurora-text-muted pt-2">&copy; 2026 ethniCity. All rights reserved.</p>
        </div>
      ),
    },
  };

  const renderHelp = () => (
    <div className="flex flex-col min-h-0">
      <SectionHeader title="Help & Support" onBack={() => setSection('main')} />
      <div className="divide-y divide-aurora-border">
        <div className="px-4 py-3 bg-aurora-surface-variant">
          <p className="text-xs text-aurora-text-secondary font-medium">
            Get help, report issues, or learn more about ethniCity
          </p>
        </div>

        <SettingRow
          icon={<HelpCircle size={18} />}
          label="FAQs"
          description="Frequently asked questions about ethniCity"
          onClick={() => setHelpModal('faq')}
        />
        <SettingRow
          icon={<Mail size={18} />}
          label="Contact Support"
          description="Email us at support@ethnicity.com"
          onClick={() => window.open('mailto:support@ethnicity.com')}
        />
        <SettingRow
          icon={<AlertTriangle size={18} />}
          label="Report a Problem"
          description="Something not working? Let us know"
          onClick={() => window.open('mailto:support@ethnicity.com?subject=Bug%20Report')}
        />
        <SettingRow
          icon={<FileText size={18} />}
          label="Terms of Service"
          onClick={() => setHelpModal('tos')}
        />
        <SettingRow
          icon={<Shield size={18} />}
          label="Privacy Policy"
          onClick={() => setHelpModal('privacy')}
        />
        <SettingRow
          icon={<ExternalLink size={18} />}
          label="About ethniCity"
          description="Version 2.0.0 (PWA)"
          onClick={() => setHelpModal('about')}
        />
      </div>

      {/* Help modal */}
      {helpModal && helpModalContent[helpModal] && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setHelpModal(null)} />
          <div className="fixed inset-4 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-[480px] sm:top-[10%] sm:bottom-[10%] bg-aurora-surface rounded-2xl shadow-aurora-4 z-50 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-aurora-border">
              <h3 className="text-lg font-bold text-aurora-text">{helpModalContent[helpModal].title}</h3>
              <button
                onClick={() => setHelpModal(null)}
                className="p-1 hover:bg-aurora-surface-variant rounded-xl transition-colors text-aurora-text-muted"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {helpModalContent[helpModal].body}
            </div>
          </div>
        </>
      )}
    </div>
  );

  // ─── Account & Data ───────────────────────────────────────────────
  const renderAccount = () => (
    <div className="flex flex-col min-h-0">
      <SectionHeader title="Account & Data" onBack={() => setSection('main')} />
      <div className="divide-y divide-aurora-border">
        <div className="px-4 py-4 bg-aurora-surface">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{userProfile?.avatar || '🧑'}</span>
            <div>
              <p className="font-semibold text-aurora-text">{userProfile?.name || 'User'}</p>
              <p className="text-sm text-aurora-text-muted">{userProfile?.email || user?.email}</p>
            </div>
          </div>
        </div>

        <div className="px-4 pt-3 pb-1">
          <p className="text-xs font-semibold text-aurora-text-muted uppercase tracking-wider">Data</p>
        </div>
        <SettingRow
          icon={<Download size={18} />}
          label="Download My Data"
          description="Get a copy of all your ethniCity data"
          onClick={async () => {
            if (!user) return;
            try {
              const exportData: Record<string, unknown> = {};

              // Profile
              const profileDoc = await getDoc(doc(db, 'users', user.uid));
              if (profileDoc.exists()) exportData.profile = profileDoc.data();

              // Settings
              const settingsDoc = await getDoc(doc(db, 'userSettings', user.uid));
              if (settingsDoc.exists()) exportData.settings = settingsDoc.data();

              // Posts
              const postsQuery = query(collection(db, 'posts'), where('userId', '==', user.uid));
              const postsSnap = await getDocs(postsQuery);
              exportData.posts = postsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

              // Business listings
              const bizQuery = query(collection(db, 'businesses'), where('ownerId', '==', user.uid));
              const bizSnap = await getDocs(bizQuery);
              exportData.businesses = bizSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

              // Events created
              const eventsQuery = query(collection(db, 'events'), where('createdBy', '==', user.uid));
              const eventsSnap = await getDocs(eventsQuery);
              exportData.events = eventsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

              // Download as JSON
              const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `ethnicity-data-${user.uid.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.json`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            } catch (err: any) {
              alert(`Failed to export data: ${err.message || 'Please try again.'}`);
            }
          }}
        />
        <SettingRow
          icon={<Lock size={18} />}
          label="Change Password"
          description="Update your account password"
          onClick={async () => {
            const email = user?.email;
            if (!email) {
              alert('No email associated with this account.');
              return;
            }
            try {
              await resetPassword(email);
              alert(`Password reset link sent to ${email}. Please check your inbox.`);
            } catch (err: any) {
              alert(`Failed to send reset email: ${err.message || 'Please try again.'}`);
            }
          }}
        />

        <div className="px-4 pt-4 pb-1">
          <p className="text-xs font-semibold text-red-400 uppercase tracking-wider">Danger Zone</p>
        </div>
        <SettingRow
          icon={<Trash2 size={18} />}
          label="Delete Account"
          description="Permanently delete your account and all data"
          onClick={() => setShowDeleteConfirm(true)}
          danger
        />
      </div>

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setShowDeleteConfirm(false)} />
          <div className="fixed inset-x-4 top-[25%] sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-[380px] bg-aurora-surface rounded-2xl shadow-aurora-4 z-50 p-6">
            <div className="w-14 h-14 mx-auto mb-4 bg-aurora-danger/15 rounded-full flex items-center justify-center">
              <AlertTriangle size={28} className="text-aurora-danger" />
            </div>
            <h3 className="text-lg font-bold text-center text-aurora-text mb-2">Delete Account?</h3>
            <p className="text-sm text-aurora-text-secondary text-center mb-6">
              This will permanently delete your profile, posts, messages, and all associated data. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-3 rounded-xl border border-aurora-border text-aurora-text-secondary font-medium hover:bg-aurora-surface-variant transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                className="flex-1 py-3 rounded-xl bg-aurora-danger text-white font-medium hover:bg-red-800 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );

  // ─── Main Menu ─────────────────────────────────────────────────────
  const renderMain = () => {
    const sections = [
      { key: 'notifications' as Section, icon: <Bell size={20} />, label: 'Notifications', description: 'Push, email, and in-app alerts', color: 'text-aurora-indigo bg-aurora-indigo/10' },
      { key: 'privacy' as Section, icon: <Shield size={20} />, label: 'Privacy & Security', description: 'Profile visibility, messaging, data', color: 'text-aurora-success bg-aurora-success/10' },
      { key: 'language' as Section, icon: <Globe size={20} />, label: 'Language & Region', description: 'App language, content preferences', color: 'text-aurora-indigo bg-aurora-indigo/10' },
      { key: 'appearance' as Section, icon: <Palette size={20} />, label: 'Appearance', description: 'Theme, font size, layout', color: 'text-aurora-warning bg-aurora-warning/10' },
      { key: 'account' as Section, icon: <Lock size={20} />, label: 'Account & Data', description: 'Password, data export, delete account', color: 'text-aurora-danger bg-aurora-danger/10' },
      { key: 'help' as Section, icon: <HelpCircle size={20} />, label: 'Help & Support', description: 'FAQs, contact us, report issues', color: 'text-aurora-text-secondary bg-aurora-surface-variant' },
    ];

    return (
      <div>
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-5">
          <div className="p-2.5 bg-aurora-surface-variant rounded-xl">
            <Settings size={24} className="text-aurora-indigo" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-aurora-text">Settings</h1>
            <p className="text-sm text-aurora-text-muted">Manage your app preferences</p>
          </div>
        </div>

        {/* Save indicator */}
        {saved && (
          <div className="mx-4 mb-3 px-4 py-2 bg-aurora-success/10 border border-green-200 rounded-xl flex items-center gap-2">
            <Check size={16} className="text-aurora-success" />
            <span className="text-sm text-aurora-success font-medium">Settings saved</span>
          </div>
        )}

        {/* Sections */}
        <div className="px-4 space-y-2 pb-6">
          {sections.map((s) => (
            <button
              key={s.key}
              onClick={() => setSection(s.key)}
              className="w-full flex items-center gap-4 p-4 bg-aurora-surface rounded-xl border border-aurora-border hover:border-aurora-border hover:shadow-aurora-1 transition-all text-left active:bg-aurora-surface-variant"
            >
              <div className={`p-2.5 rounded-xl ${s.color}`}>{s.icon}</div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-aurora-text">{s.label}</p>
                <p className="text-sm text-aurora-text-muted">{s.description}</p>
              </div>
              <ChevronRight size={18} className="text-aurora-text-muted flex-shrink-0" />
            </button>
          ))}
        </div>

        {/* Sign out button at bottom */}
        <div className="px-4 pb-8">
          <button
            onClick={handleSignOut}
            className="w-full py-3 text-center text-aurora-danger font-medium text-sm border border-red-200 rounded-xl hover:bg-aurora-danger/10 transition-colors"
          >
            Sign Out
          </button>
          <p className="text-center text-xs text-aurora-text-muted mt-4">ethniCity v2.0.0</p>
        </div>
      </div>
    );
  };

  // ─── Route to section ──────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto bg-aurora-surface-variant">
      {section === 'main' && renderMain()}
      {section === 'notifications' && renderNotifications()}
      {section === 'privacy' && renderPrivacy()}
      {section === 'language' && renderLanguage()}
      {section === 'appearance' && renderAppearance()}
      {section === 'help' && renderHelp()}
      {section === 'account' && renderAccount()}
    </div>
  );
};

export default SettingsPage;
