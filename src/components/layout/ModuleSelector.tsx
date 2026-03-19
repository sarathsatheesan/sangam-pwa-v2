import React, { useRef, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Home,
  LayoutGrid,
  Users,
  Briefcase,
  Building2,
  Calendar,
  Plane,
  MessageSquare,
  Mail,
  UserCircle,
  Shield,
  ShoppingBag,
} from 'lucide-react';
import { useFeatureSettings } from '../../contexts/FeatureSettingsContext';
import { useAuth } from '../../contexts/AuthContext';
import { useIncomingRequestCount } from '../../hooks/useIncomingRequests';
import clsx from 'clsx';

interface Module {
  path: string;
  label: string;
  icon: React.ReactNode;
  feature: string;
}

const modules: Module[] = [
  {
    path: '/feed',
    label: 'Feed',
    icon: <Home size={20} />,
    feature: 'modules_feed',
  },
  {
    path: '/discover',
    label: 'Discover',
    icon: <Users size={20} />,
    feature: 'modules_discover',
  },
  {
    path: '/business',
    label: 'Business',
    icon: <Briefcase size={20} />,
    feature: 'modules_business',
  },
  {
    path: '/housing',
    label: 'Housing',
    icon: <Building2 size={20} />,
    feature: 'modules_housing',
  },
  {
    path: '/marketplace',
    label: 'Marketplace',
    icon: <ShoppingBag size={20} />,
    feature: 'modules_marketplace',
  },
  {
    path: '/events',
    label: 'Events',
    icon: <Calendar size={20} />,
    feature: 'modules_events',
  },
  {
    path: '/travel',
    label: 'Travel',
    icon: <Plane size={20} />,
    feature: 'modules_travel',
  },
  {
    path: '/forum',
    label: 'Forum',
    icon: <MessageSquare size={20} />,
    feature: 'modules_forum',
  },
  {
    path: '/messages',
    label: 'Messages',
    icon: <Mail size={20} />,
    feature: 'modules_messages',
  },
  {
    path: '/profile',
    label: 'Profile',
    icon: <UserCircle size={20} />,
    feature: 'always',
  },
  {
    path: '/admin',
    label: 'Admin',
    icon: <Shield size={20} />,
    feature: 'admin_only',
  },
];

export const ModuleSelector: React.FC = () => {
  const location = useLocation();
  const { isFeatureEnabled } = useFeatureSettings();
  const { isAdmin } = useAuth();
  const incomingRequestCount = useIncomingRequestCount();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const pillRefs = useRef<Map<string, HTMLAnchorElement>>(new Map());
  const [showLeftScroll, setShowLeftScroll] = useState(false);
  const [showRightScroll, setShowRightScroll] = useState(false);

  const isHome = location.pathname === '/home';

  // Filter enabled modules (profile always shows, admin only for admins)
  const enabledModules = modules.filter((m) => {
    if (m.feature === 'always') return true;
    if (m.feature === 'admin_only') return isAdmin;
    return isFeatureEnabled(m.feature);
  });

  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  // Check scroll position
  useEffect(() => {
    if (isHome) return;
    const container = scrollContainerRef.current;
    if (!container) return;

    const checkScroll = () => {
      setShowLeftScroll(container.scrollLeft > 0);
      setShowRightScroll(
        container.scrollLeft < container.scrollWidth - container.clientWidth - 10
      );
    };

    checkScroll();
    container.addEventListener('scroll', checkScroll);
    window.addEventListener('resize', checkScroll);

    return () => {
      container.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, [isHome]);

  // Auto-scroll the active pill into view when route changes
  useEffect(() => {
    if (isHome) return;
    const activeModule = enabledModules.find((m) => isActive(m.path));
    if (!activeModule) return;
    const pillEl = pillRefs.current.get(activeModule.path);
    if (pillEl && scrollContainerRef.current) {
      // Use a short delay to ensure the DOM has settled (e.g. after navigation)
      requestAnimationFrame(() => {
        pillEl.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center',
        });
      });
    }
  }, [location.pathname]);

  // Hide module selector on home/landing page (tiles replace it)
  if (isHome) return null;

  const scroll = (direction: 'left' | 'right') => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const scrollAmount = 200;
    container.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  return (
    <div className="sticky top-14 z-30 bg-aurora-surface/80 backdrop-blur-md border-b border-aurora-border">
      <div className="relative px-4 sm:px-6">
        {/* Left scroll button */}
        {showLeftScroll && (
          <button
            onClick={() => scroll('left')}
            className="absolute left-0 top-0 bottom-0 z-10 flex items-center justify-center w-8 bg-gradient-to-r from-aurora-surface to-transparent"
            aria-label="Scroll left"
          >
            <span className="text-aurora-text-muted hover:text-aurora-text">←</span>
          </button>
        )}

        {/* Scrollable container */}
        <div
          ref={scrollContainerRef}
          className="overflow-x-auto hide-scrollbar flex gap-2 py-2 px-8 sm:px-0"
          style={{
            scrollBehavior: 'smooth',
          }}
        >
          {/* Home button — always first */}
          <Link
            to="/home"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full font-medium text-sm whitespace-nowrap transition-all duration-200 text-aurora-text-secondary hover:bg-gray-50 hover:text-aurora-text"
          >
            <LayoutGrid size={18} />
            <span>Home</span>
          </Link>
          {enabledModules.map((module) => {
            const showBadge = module.path === '/discover' && incomingRequestCount > 0;
            return (
              <Link
                key={module.path}
                to={module.path}
                ref={(el) => {
                  if (el) pillRefs.current.set(module.path, el);
                }}
                className={clsx(
                  'inline-flex items-center gap-2 px-4 py-2 rounded-full font-medium text-sm whitespace-nowrap transition-all duration-200 relative',
                  isActive(module.path)
                    ? 'aurora-gradient text-white shadow-aurora-glow'
                    : 'text-aurora-text-secondary hover:bg-gray-50 hover:text-aurora-text'
                )}
              >
                <span className="relative">
                  {module.icon}
                  {showBadge && (
                    <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-bold min-w-[16px] h-4 flex items-center justify-center rounded-full px-1 animate-pulse shadow-sm">
                      {incomingRequestCount > 9 ? '9+' : incomingRequestCount}
                    </span>
                  )}
                </span>
                <span>{module.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Right scroll button */}
        {showRightScroll && (
          <button
            onClick={() => scroll('right')}
            className="absolute right-0 top-0 bottom-0 z-10 flex items-center justify-center w-8 bg-gradient-to-l from-aurora-surface to-transparent"
            aria-label="Scroll right"
          >
            <span className="text-aurora-text-muted hover:text-aurora-text">→</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default ModuleSelector;
