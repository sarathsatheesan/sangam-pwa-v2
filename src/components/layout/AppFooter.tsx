import React from 'react';
import { Mail, Share2, Phone } from 'lucide-react';
import { copyToClipboard } from '@/utils/clipboard';

// Social media SVG icons
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

export const AppFooter: React.FC = () => {
  const handleFeedback = () => {
    window.location.href = 'mailto:feedback@ethnicity.com';
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'EthniZity',
          text: 'Our culture, connected. Discover diverse communities near you!',
          url: window.location.href,
        });
      } catch (error) {
        console.error('Error sharing:', error);
      }
    } else {
      try {
        await copyToClipboard(window.location.href);
        alert('Link copied to clipboard!');
      } catch (error) {
        console.error('Error copying to clipboard:', error);
      }
    }
  };

  const handlePhone = () => {
    window.location.href = 'tel:+1-800-SANGAM';
  };

  // Placeholder links — will be updated with real URLs later
  const socialLinks = {
    instagram: '#',
    facebook: '#',
    twitter: '#',
    tiktok: '#',
  };

  // Desktop only — mobile footer is completely removed (social + share moved to hamburger menu)
  return (
    <footer className="hidden sm:block border-t border-aurora-border bg-aurora-surface">
      <div className="max-w-3xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={handleFeedback}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-aurora-text-secondary hover:text-aurora-indigo hover:bg-aurora-indigo/10 rounded-lg transition-colors"
              title="Send feedback"
            >
              <Mail size={18} />
              <span>Feedback</span>
            </button>

            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-aurora-text-secondary hover:text-aurora-mint hover:bg-aurora-mint/10 rounded-lg transition-colors"
              title="Share the app"
            >
              <Share2 size={18} />
              <span>Share</span>
            </button>

            <button
              onClick={handlePhone}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-aurora-text-secondary hover:text-aurora-indigo hover:bg-aurora-indigo/10 rounded-lg transition-colors"
              title="Call us"
            >
              <Phone size={18} />
              <span>Call</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <a href={socialLinks.instagram} target="_blank" rel="noopener noreferrer" className="p-2 text-aurora-text-secondary hover:text-pink-500 hover:bg-pink-500/10 rounded-lg transition-colors" title="Instagram">
              <InstagramIcon size={18} />
            </a>
            <a href={socialLinks.facebook} target="_blank" rel="noopener noreferrer" className="p-2 text-aurora-text-secondary hover:text-blue-600 hover:bg-blue-600/10 rounded-lg transition-colors" title="Facebook">
              <FacebookIcon size={18} />
            </a>
            <a href={socialLinks.twitter} target="_blank" rel="noopener noreferrer" className="p-2 text-aurora-text-secondary hover:text-black hover:bg-gray-200 rounded-lg transition-colors" title="X (Twitter)">
              <TwitterIcon size={18} />
            </a>
            <a href={socialLinks.tiktok} target="_blank" rel="noopener noreferrer" className="p-2 text-aurora-text-secondary hover:text-black hover:bg-gray-200 rounded-lg transition-colors" title="TikTok">
              <TikTokIcon size={18} />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default AppFooter;
