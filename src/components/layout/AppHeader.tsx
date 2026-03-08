import React, { useState, useRef, useEffect } from 'react';
import { Menu, MapPin, User, LogOut, Shield, Settings, Mail, Phone, Share2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation } from '../../contexts/LocationContext';
import { signOutUser } from '../../services/auth';
import { Link, useNavigate } from 'react-router-dom';
import { LocationPicker } from '../shared/LocationPicker';

// Social media SVG icons for hamburger menu
const InstagramIcon: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none" />
  </svg>
);

const FacebookIcon: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
  </svg>
);

const TwitterIcon: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const TikTokIcon: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.6a8.22 8.22 0 0 0 4.76 1.51V6.69h-1z" />
  </svg>
);

export const AppHeader: React.FC = () => {
  const { user, userProfile, isAdmin } = useAuth();
  const { selectedLocation } = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Placeholder links — will be updated with real URLs later
  const socialLinks = {
    instagram: '#',
    facebook: '#',
    twitter: '#',
    tiktok: '#',
  };

  const handleShare = async () => {
    setMenuOpen(false);
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'ethniCity',
          text: 'Our culture, connected. Discover diverse communities near you!',
          url: window.location.href,
        });
      } catch (error) {
        console.error('Error sharing:', error);
      }
    } else {
      try {
        await navigator.clipboard.writeText(window.location.href);
        alert('Link copied to clipboard!');
      } catch (error) {
        console.error('Error copying to clipboard:', error);
      }
    }
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuOpen]);

  const handleSignOut = async () => {
    try {
      await signOutUser();
      navigate('/');
      setMenuOpen(false);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const displayLocation = selectedLocation
    ? `${selectedLocation.city}, ${selectedLocation.stateAbbr}`
    : 'Set Location';

  return (
    <>
      <header className="sticky top-0 z-40 glass-strong">
        <div className="flex items-center justify-between h-14 px-4">
          {/* Left: Logo + Avatar + Greeting */}
          <div className="flex items-center gap-2 shrink-0 min-w-0">
            <Link to="/feed" className="flex items-center shrink-0">
              <img src="/ethnicity-logo.svg" alt="ethniCity" className="w-7 h-7 sm:w-8 sm:h-8" />
            </Link>

            {user && (
              <>
                {userProfile?.avatar && userProfile.avatar.startsWith('http') ? (
                  <img
                    src={userProfile.avatar}
                    alt={userProfile.name}
                    className="w-8 h-8 rounded-full object-cover ring-2 ring-aurora-indigo/30 shrink-0"
                  />
                ) : userProfile?.avatar ? (
                  <span className="w-8 h-8 rounded-full bg-aurora-indigo/20 flex items-center justify-center text-lg shrink-0">
                    {userProfile.avatar}
                  </span>
                ) : (
                  <span className="w-8 h-8 rounded-full bg-aurora-indigo/20 flex items-center justify-center shrink-0">
                    <User size={18} />
                  </span>
                )}
                <span className="text-sm font-semibold text-[var(--aurora-text)] truncate max-w-[120px] sm:max-w-[200px]">
                  Welcome, {(userProfile as any)?.preferredName || userProfile?.name?.split(' ')[0] || 'there'}!
                </span>
              </>
            )}

            {!user && (
              <div className="flex flex-col leading-none ml-1">
                <span className="text-lg sm:text-xl font-extrabold tracking-tight">
                  <span style={{ color: '#c96830' }}>ethni</span><span style={{ color: '#0d4f5a' }} className="font-black">City</span>
                </span>
              </div>
            )}
          </div>

          {/* Right: Location + Hamburger Menu */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setLocationPickerOpen(true)}
              className="p-2 text-aurora-text-secondary hover:text-aurora-mint hover:bg-gray-50 rounded-lg transition-colors"
              aria-label="Location"
              title={displayLocation}
            >
              <MapPin size={20} className="text-aurora-mint" />
            </button>

            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-2 text-aurora-text-secondary hover:text-aurora-text hover:bg-gray-50 rounded-lg transition-colors"
              aria-label="Menu"
            >
              <Menu size={22} />
            </button>
          </div>
        </div>

        {/* Menu dropdown */}
        {menuOpen && (
          <>
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={() => setMenuOpen(false)} />

            <div
              ref={menuRef}
              className="absolute top-14 right-2 w-72 bg-aurora-surface rounded-2xl border border-aurora-border-glass shadow-aurora-3 z-50 overflow-hidden max-h-[calc(100vh-4rem)] overflow-y-auto"
            >
              {/* User info header */}
              {user && userProfile && (
                <div className="px-4 py-3 border-b border-aurora-border bg-aurora-surface-variant">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{userProfile.avatar || '🧑'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-aurora-text truncate">{userProfile.name || 'User'}</p>
                      <p className="text-xs text-aurora-text-muted truncate">{userProfile.email || user.email}</p>
                    </div>
                  </div>
                </div>
              )}

              <nav className="py-2">
                {/* Profile */}
                {user && (
                  <Link
                    to="/profile"
                    className="px-4 py-2.5 flex items-center gap-3 text-aurora-text-secondary hover:bg-gray-50 transition-colors"
                    onClick={() => setMenuOpen(false)}
                  >
                    <User size={18} />
                    <span className="text-sm font-medium">Profile</span>
                  </Link>
                )}

                {/* Settings */}
                {user && (
                  <Link
                    to="/settings"
                    className="px-4 py-2.5 flex items-center gap-3 text-aurora-text-secondary hover:bg-gray-50 transition-colors"
                    onClick={() => setMenuOpen(false)}
                  >
                    <Settings size={18} />
                    <span className="text-sm font-medium">Settings</span>
                  </Link>
                )}

                {/* Admin panel */}
                {isAdmin && (
                  <Link
                    to="/admin"
                    className="px-4 py-2.5 flex items-center gap-3 text-aurora-text-secondary hover:bg-gray-50 transition-colors"
                    onClick={() => setMenuOpen(false)}
                  >
                    <Shield size={18} className="text-aurora-warning" />
                    <span className="text-sm font-medium">Admin Panel</span>
                  </Link>
                )}

                {/* Location */}
                <button
                  onClick={() => { setMenuOpen(false); setLocationPickerOpen(true); }}
                  className="w-full px-4 py-2.5 flex items-center gap-3 text-aurora-text-secondary hover:bg-gray-50 transition-colors"
                >
                  <MapPin size={18} className="text-aurora-mint" />
                  <div className="text-left">
                    <span className="text-sm font-medium">Location</span>
                    <span className="text-xs text-aurora-text-muted ml-2">{displayLocation}</span>
                  </div>
                </button>

                {/* Divider before Connect With Us */}
                <div className="my-1 border-t border-aurora-border" />

                {/* Connect With Us section */}
                <div className="px-4 py-1.5">
                  <span className="text-[11px] font-semibold text-aurora-text-muted uppercase tracking-wider">Connect With Us</span>
                </div>

                {/* Social media icons row */}
                <div className="px-4 py-2 flex items-center justify-between">
                  <a href={socialLinks.instagram} target="_blank" rel="noopener noreferrer" onClick={() => setMenuOpen(false)} className="w-10 h-10 flex items-center justify-center rounded-full text-gray-500 hover:text-pink-500 hover:bg-pink-500/10 transition-colors" title="Instagram">
                    <InstagramIcon size={20} />
                  </a>
                  <a href={socialLinks.facebook} target="_blank" rel="noopener noreferrer" onClick={() => setMenuOpen(false)} className="w-10 h-10 flex items-center justify-center rounded-full text-gray-500 hover:text-blue-600 hover:bg-blue-600/10 transition-colors" title="Facebook">
                    <FacebookIcon size={20} />
                  </a>
                  <a href={socialLinks.twitter} target="_blank" rel="noopener noreferrer" onClick={() => setMenuOpen(false)} className="w-10 h-10 flex items-center justify-center rounded-full text-gray-500 hover:text-black hover:bg-gray-100 transition-colors" title="X (Twitter)">
                    <TwitterIcon size={20} />
                  </a>
                  <a href={socialLinks.tiktok} target="_blank" rel="noopener noreferrer" onClick={() => setMenuOpen(false)} className="w-10 h-10 flex items-center justify-center rounded-full text-gray-500 hover:text-black hover:bg-gray-100 transition-colors" title="TikTok">
                    <TikTokIcon size={20} />
                  </a>
                  <button onClick={handleShare} className="w-10 h-10 flex items-center justify-center rounded-full text-gray-500 hover:text-aurora-mint hover:bg-aurora-mint/10 transition-colors" title="Share the app">
                    <Share2 size={20} />
                  </button>
                </div>

                {/* Divider before Support */}
                <div className="my-1 border-t border-aurora-border" />

                {/* Support section label */}
                <div className="px-4 py-1.5">
                  <span className="text-[11px] font-semibold text-aurora-text-muted uppercase tracking-wider">Support</span>
                </div>

                {/* Feedback */}
                <a
                  href="mailto:feedback@ethnicity.com"
                  className="px-4 py-2.5 flex items-center gap-3 text-aurora-text-secondary hover:bg-gray-50 transition-colors"
                  onClick={() => setMenuOpen(false)}
                >
                  <Mail size={18} className="text-aurora-indigo" />
                  <span className="text-sm font-medium">Feedback</span>
                </a>

                {/* Call */}
                <a
                  href="tel:+1-800-SANGAM"
                  className="px-4 py-2.5 flex items-center gap-3 text-aurora-text-secondary hover:bg-gray-50 transition-colors"
                  onClick={() => setMenuOpen(false)}
                >
                  <Phone size={18} className="text-aurora-mint" />
                  <span className="text-sm font-medium">Call Us</span>
                </a>

                {/* Divider */}
                <div className="my-1 border-t border-aurora-border" />

                {/* Sign Out */}
                {user && (
                  <button
                    onClick={handleSignOut}
                    className="w-full px-4 py-2.5 flex items-center gap-3 text-aurora-danger hover:bg-aurora-danger/10 transition-colors"
                  >
                    <LogOut size={18} />
                    <span className="text-sm font-medium">Sign Out</span>
                  </button>
                )}

                {!user && (
                  <>
                    <Link
                      to="/auth/login"
                      className="px-4 py-2.5 flex items-center gap-3 text-aurora-indigo hover:bg-aurora-indigo/10 transition-colors"
                      onClick={() => setMenuOpen(false)}
                    >
                      <span className="text-sm font-medium">Sign In</span>
                    </Link>
                    <Link
                      to="/auth/signup"
                      className="px-4 py-2.5 flex items-center gap-3 text-aurora-indigo hover:bg-aurora-indigo/10 transition-colors"
                      onClick={() => setMenuOpen(false)}
                    >
                      <span className="text-sm font-medium">Sign Up</span>
                    </Link>
                  </>
                )}
              </nav>
            </div>
          </>
        )}
      </header>

      {/* Location Picker Modal */}
      <LocationPicker
        isOpen={locationPickerOpen}
        onClose={() => setLocationPickerOpen(false)}
      />
    </>
  );
};

export default AppHeader;
