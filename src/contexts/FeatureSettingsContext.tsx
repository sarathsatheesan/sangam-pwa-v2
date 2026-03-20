import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { doc, getDoc, setDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../services/firebase';

// All feature keys with defaults
export const DEFAULT_FEATURES: Record<string, boolean> = {
  // Module visibility (tabs)
  modules_feed: true,
  modules_business: true,
  modules_housing: true,
  modules_events: true,
  modules_travel: true,
  modules_discover: true,
  modules_messages: true,
  modules_marketplace: true,

  // Marketplace module features
  marketplace_addListing: true,
  marketplace_featured: true,
  marketplace_search: true,
  marketplace_categoryFilter: true,
  marketplace_comments: true,
  marketplace_favorites: true,
  marketplace_sharing: true,
  marketplace_viewTracking: true,
  marketplace_negotiable: true,
  marketplace_delivery: true,

  // Business module features
  business_addListing: true,
  business_featured: true,
  business_search: true,
  business_categoryFilter: true,
  business_heritageFilter: true,
  business_reviews: true,
  business_favorites: true,
  business_deals: true,
  business_contactInfo: true,
  business_merchantView: true,
  business_photos: true,

  // Housing module features
  housing_addListing: true,
  housing_featured: true,
  housing_search: true,
  housing_typeFilter: true,
  housing_heritageFilter: true,
  housing_comments: true,
  housing_favorites: true,
  housing_sharing: true,
  housing_viewTracking: true,
  housing_mortgageCalc: true,
  housing_photos: true,

  // Events module features
  events_addEvent: true,
  events_featured: true,
  events_search: true,
  events_categoryFilter: true,
  events_heritageFilter: true,
  events_rsvp: true,
  events_waitlist: true,
  events_ticketing: true,
  events_comments: true,
  events_sharing: true,
  events_calendarExport: true,
  events_photos: true,

  // Feed module features
  feed_createPost: true,
  feed_likes: true,
  feed_comments: true,
  feed_heritageFilter: true,
  feed_sharing: true,
  feed_reporting: true,
  feed_reactions: true,
  feed_bookmarks: true,
  feed_feelings: true,
  feed_polls: true,

  // Travel module features
  travel_heritageFilter: true,
  travel_createPost: true,
  travel_search: true,
  travel_comments: true,
  travel_contactInfo: true,

  // Discover module features
  discover_connectionRequests: true,
  discover_matchScore: true,
  discover_search: true,
  discover_locationFilter: true,
  discover_professionFilter: true,
  discover_directMessage: true,

  // Messages module features
  messages_voiceMessages: true,
  messages_emojiPicker: true,
  messages_reactions: true,
  messages_textFormatting: true,
  messages_typingIndicators: true,
  messages_readReceipts: true,
  messages_wallpaper: true,
  messages_search: true,
  messages_groupMessaging: true,

  // Forum module features
  modules_forum: true,
  forum_createThread: true,
  forum_replies: true,
  forum_likes: true,
  forum_contentModeration: true,
  forum_heritageFilter: true,
  forum_voting: true,
  forum_pinning: true,
  forum_flairs: true,
  forum_reporting: true,

  // Authentication & Verification
  auth_emailVerification: false,
  auth_phoneOTP: false,

  // Safety & Privacy
  safety_reporting: true,
  safety_blocking: true,
  safety_keywordFiltering: true,
  safety_messagingPrivacy: true,
  safety_addressPrivacy: true,
  safety_smartFilter: true,
  messages_encryption: true,
};

// Feature group definitions for admin UI
export interface FeatureItem {
  key: string;
  name: string;
  description: string;
}

export interface FeatureGroup {
  id: string;
  title: string;
  icon: string;
  features: FeatureItem[];
}

export const FEATURE_GROUPS: FeatureGroup[] = [
  {
    id: 'modules',
    title: 'Module Visibility',
    icon: '📱',
    features: [
      { key: 'modules_feed', name: 'Feed', description: 'Community feed tab' },
      { key: 'modules_business', name: 'Business Directory', description: 'Business listings tab' },
      { key: 'modules_housing', name: 'Housing & Rentals', description: 'Housing listings tab' },
      { key: 'modules_events', name: 'Events', description: 'Community events tab' },
      { key: 'modules_travel', name: 'Travel Companion', description: 'Travel sharing tab' },
      { key: 'modules_discover', name: 'Discover People', description: 'People discovery tab' },
      { key: 'modules_messages', name: 'Messages', description: 'Direct messaging tab' },
      { key: 'modules_forum', name: 'Community Forum', description: 'Forum discussions tab' },
      { key: 'modules_marketplace', name: 'Marketplace', description: 'Buy & sell items marketplace tab' },
    ],
  },
  {
    id: 'feed',
    title: 'Feed Features',
    icon: '📝',
    features: [
      { key: 'feed_createPost', name: 'Create Post', description: 'Allow users to create new posts' },
      { key: 'feed_likes', name: 'Likes & Reactions', description: 'Enable like/reaction buttons on posts' },
      { key: 'feed_reactions', name: 'Emoji Reactions', description: 'Enable emoji reaction bar (love, haha, wow, etc.)' },
      { key: 'feed_comments', name: 'Comments', description: 'Enable commenting on posts' },
      { key: 'feed_sharing', name: 'Share Posts', description: 'Allow sharing posts via link or native share' },
      { key: 'feed_reporting', name: 'Report Posts', description: 'Allow users to flag/report posts' },
      { key: 'feed_bookmarks', name: 'Bookmarks', description: 'Allow users to save/bookmark posts' },
      { key: 'feed_feelings', name: 'Feeling Selector', description: 'Enable feeling/mood selector when creating posts' },
      { key: 'feed_polls', name: 'Polls', description: 'Enable poll voting on posts with polls' },
      { key: 'feed_heritageFilter', name: 'Heritage Filter', description: 'Enable heritage/EthniZity filter chips' },
    ],
  },
  {
    id: 'discover',
    title: 'Discover Features',
    icon: '🔍',
    features: [
      { key: 'discover_connectionRequests', name: 'Connection Requests', description: 'Allow sending/accepting connection requests' },
      { key: 'discover_matchScore', name: 'Match Score', description: 'Show compatibility match score on profiles' },
      { key: 'discover_search', name: 'Search People', description: 'Enable search bar to find people' },
      { key: 'discover_locationFilter', name: 'Location Filter', description: 'Filter people by city/location' },
      { key: 'discover_professionFilter', name: 'Profession Filter', description: 'Filter people by profession/industry' },
      { key: 'discover_directMessage', name: 'Direct Message', description: 'Allow messaging from profile cards' },
    ],
  },
  {
    id: 'business',
    title: 'Business Features',
    icon: '🏪',
    features: [
      { key: 'business_addListing', name: 'Add Business', description: 'Allow users to add businesses' },
      { key: 'business_featured', name: 'Featured Carousel', description: 'Show featured businesses section' },
      { key: 'business_search', name: 'Search', description: 'Enable search bar' },
      { key: 'business_categoryFilter', name: 'Category Filter', description: 'Enable category filter chips' },
      { key: 'business_heritageFilter', name: 'Heritage Filter', description: 'Enable heritage/EthniZity filter chips' },
      { key: 'business_reviews', name: 'Reviews & Ratings', description: 'Allow users to write reviews and rate businesses' },
      { key: 'business_favorites', name: 'Favorites', description: 'Allow users to save favorite businesses' },
      { key: 'business_deals', name: 'Deals & Promotions', description: 'Show deals section on business pages' },
      { key: 'business_contactInfo', name: 'Contact Info', description: 'Display phone, email, and website on listings' },
      { key: 'business_merchantView', name: 'Merchant Dashboard', description: 'Enable merchant view for business owners' },
      { key: 'business_photos', name: 'Business Photos', description: 'Allow photo uploads on business listings' },
    ],
  },
  {
    id: 'housing',
    title: 'Housing Features',
    icon: '🏢',
    features: [
      { key: 'housing_addListing', name: 'Add Listing', description: 'Allow users to add listings' },
      { key: 'housing_featured', name: 'Featured Carousel', description: 'Show featured listings section' },
      { key: 'housing_search', name: 'Search', description: 'Enable search bar' },
      { key: 'housing_typeFilter', name: 'Type Filter', description: 'Enable type filter chips (sale/rent)' },
      { key: 'housing_heritageFilter', name: 'Heritage Filter', description: 'Enable heritage/EthniZity filter chips' },
      { key: 'housing_comments', name: 'Comments', description: 'Enable comments on listings' },
      { key: 'housing_favorites', name: 'Save Listings', description: 'Allow users to save/favorite listings' },
      { key: 'housing_sharing', name: 'Share Listings', description: 'Allow sharing listings via link or native share' },
      { key: 'housing_viewTracking', name: 'View Tracking', description: 'Track and display listing view counts' },
      { key: 'housing_mortgageCalc', name: 'Mortgage Calculator', description: 'Show mortgage calculator on sale listings' },
      { key: 'housing_photos', name: 'Housing Photos', description: 'Allow photo uploads on housing listings' },
    ],
  },
  {
    id: 'marketplace',
    title: 'Marketplace Features',
    icon: '🛍️',
    features: [
      { key: 'marketplace_addListing', name: 'Add Listing', description: 'Allow users to create marketplace listings' },
      { key: 'marketplace_featured', name: 'Featured Items', description: 'Show featured items carousel' },
      { key: 'marketplace_search', name: 'Search', description: 'Enable search bar for items' },
      { key: 'marketplace_categoryFilter', name: 'Category Filter', description: 'Enable category filter pills' },
      { key: 'marketplace_comments', name: 'Comments', description: 'Enable comments on listings' },
      { key: 'marketplace_favorites', name: 'Save Items', description: 'Allow users to save/favorite items' },
      { key: 'marketplace_sharing', name: 'Share Listings', description: 'Allow sharing listings via link or native share' },
      { key: 'marketplace_viewTracking', name: 'View Tracking', description: 'Track and display listing view counts' },
      { key: 'marketplace_negotiable', name: 'Negotiable Price', description: 'Allow sellers to mark prices as negotiable' },
      { key: 'marketplace_delivery', name: 'Delivery Options', description: 'Enable shipping/delivery method selection' },
    ],
  },
  {
    id: 'events',
    title: 'Events Features',
    icon: '🎉',
    features: [
      { key: 'events_addEvent', name: 'Add Event', description: 'Allow users to add events' },
      { key: 'events_featured', name: 'Featured Carousel', description: 'Show featured events section' },
      { key: 'events_search', name: 'Search', description: 'Enable search bar' },
      { key: 'events_categoryFilter', name: 'Category Filter', description: 'Enable category filter chips' },
      { key: 'events_heritageFilter', name: 'Heritage Filter', description: 'Enable heritage/EthniZity filter chips' },
      { key: 'events_rsvp', name: 'RSVP', description: 'Allow users to RSVP to events' },
      { key: 'events_waitlist', name: 'Waitlist', description: 'Enable waitlist when events reach capacity' },
      { key: 'events_ticketing', name: 'Ticketing', description: 'Enable ticket tiers and pricing on events' },
      { key: 'events_comments', name: 'Comments', description: 'Enable discussion comments on events' },
      { key: 'events_sharing', name: 'Share Events', description: 'Allow sharing events via link or native share' },
      { key: 'events_calendarExport', name: 'Calendar Export', description: 'Allow exporting events to calendar (ICS)' },
      { key: 'events_photos', name: 'Event Photos', description: 'Allow photo uploads on event listings' },
    ],
  },
  {
    id: 'messages',
    title: 'Messages Features',
    icon: '💬',
    features: [
      { key: 'messages_voiceMessages', name: 'Voice Messages', description: 'Allow recording and sending voice messages' },
      { key: 'messages_emojiPicker', name: 'Emoji Picker', description: 'Enable emoji picker in chat' },
      { key: 'messages_reactions', name: 'Message Reactions', description: 'Allow emoji reactions on individual messages' },
      { key: 'messages_textFormatting', name: 'Text Formatting', description: 'Enable bold, italic, code, strikethrough formatting' },
      { key: 'messages_typingIndicators', name: 'Typing Indicators', description: 'Show when other user is typing' },
      { key: 'messages_readReceipts', name: 'Read Receipts', description: 'Show when messages have been read' },
      { key: 'messages_wallpaper', name: 'Chat Wallpaper', description: 'Allow custom chat background wallpapers' },
      { key: 'messages_search', name: 'Message Search', description: 'Enable searching within conversations' },
      { key: 'messages_groupMessaging', name: 'Group Messaging', description: 'Allow users to create and participate in group conversations' },
    ],
  },
  {
    id: 'travel',
    title: 'Travel Features',
    icon: '✈️',
    features: [
      { key: 'travel_createPost', name: 'Create Travel Post', description: 'Allow users to create travel assistance/offer posts' },
      { key: 'travel_search', name: 'Search', description: 'Enable search bar for travel posts' },
      { key: 'travel_comments', name: 'Comments', description: 'Enable comments on travel posts' },
      { key: 'travel_contactInfo', name: 'Contact Info', description: 'Display contact details on travel posts' },
      { key: 'travel_heritageFilter', name: 'Heritage Filter', description: 'Enable heritage/EthniZity filter chips' },
    ],
  },
  {
    id: 'forum',
    title: 'Forum Features',
    icon: '🗣️',
    features: [
      { key: 'forum_createThread', name: 'Create Thread', description: 'Allow users to create forum threads' },
      { key: 'forum_replies', name: 'Replies', description: 'Allow users to reply to threads' },
      { key: 'forum_likes', name: 'Likes', description: 'Enable like buttons on threads and replies' },
      { key: 'forum_voting', name: 'Upvote/Downvote', description: 'Enable upvote and downvote on threads' },
      { key: 'forum_pinning', name: 'Pin Threads', description: 'Allow pinning important threads to top' },
      { key: 'forum_flairs', name: 'Thread Flairs', description: 'Enable flair tags (Discussion, Question, Advice, etc.)' },
      { key: 'forum_reporting', name: 'Report Content', description: 'Allow reporting threads and replies' },
      { key: 'forum_contentModeration', name: 'Content Moderation', description: 'Auto-scan posts for harmful content' },
      { key: 'forum_heritageFilter', name: 'Heritage Filter', description: 'Enable heritage/EthniZity filter chips' },
    ],
  },
  {
    id: 'auth',
    title: 'Authentication & Verification',
    icon: '🔑',
    features: [
      { key: 'auth_emailVerification', name: 'Email Verification', description: 'Require email verification before allowing full access' },
      { key: 'auth_phoneOTP', name: 'Phone OTP Login', description: 'Allow sign-in using phone number and OTP' },
    ],
  },
  {
    id: 'safety',
    title: 'Safety & Privacy',
    icon: '🔒',
    features: [
      { key: 'safety_reporting', name: 'Content Reporting', description: 'Allow users to report content' },
      { key: 'safety_blocking', name: 'User Blocking', description: 'Allow users to block others' },
      { key: 'safety_keywordFiltering', name: 'Keyword Filtering', description: 'Auto-filter inappropriate content' },
      { key: 'safety_messagingPrivacy', name: 'Messaging Privacy', description: 'Privacy controls for messages' },
      { key: 'safety_addressPrivacy', name: 'Address Privacy', description: 'Privacy controls for addresses' },
      { key: 'safety_smartFilter', name: 'Smart Filter', description: 'AI-powered offensive language detection' },
      { key: 'messages_encryption', name: 'Message Encryption', description: 'End-to-end encryption for direct messages' },
    ],
  },
];

interface FeatureSettingsContextType {
  features: Record<string, boolean>;
  isLoaded: boolean;
  isFeatureEnabled: (key: string) => boolean;
  toggleFeature: (key: string) => Promise<void>;
  setFeature: (key: string, value: boolean) => Promise<void>;
  toggleGroupAll: (groupId: string, enabled: boolean) => Promise<void>;
  featureGroups: FeatureGroup[];
}

const FeatureSettingsContext = createContext<FeatureSettingsContextType>({
  features: DEFAULT_FEATURES,
  isLoaded: false,
  isFeatureEnabled: () => true,
  toggleFeature: async () => {},
  setFeature: async () => {},
  toggleGroupAll: async () => {},
  featureGroups: FEATURE_GROUPS,
});

export const useFeatureSettings = () => useContext(FeatureSettingsContext);

const FIRESTORE_DOC = 'appConfig';
const FIRESTORE_ID = 'featureSettings';

export function FeatureSettingsProvider({ children }: { children: React.ReactNode }) {
  const [features, setFeatures] = useState<Record<string, boolean>>(DEFAULT_FEATURES);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load feature settings from Firestore with real-time listener
  // Subscribes only when user is authenticated; unsubscribes on sign-out
  useEffect(() => {
    let unsubscribeSnapshot: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      // Clean up any existing listener first
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = null;
      }

      if (!user) {
        // User signed out — use defaults, don't listen to Firestore
        setFeatures(DEFAULT_FEATURES);
        setIsLoaded(true);
        return;
      }

      // User is authenticated — start listening
      const docRef = doc(db, FIRESTORE_DOC, FIRESTORE_ID);
      unsubscribeSnapshot = onSnapshot(
        docRef,
        (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data() as Record<string, boolean>;
            setFeatures({ ...DEFAULT_FEATURES, ...data });
          } else {
            setDoc(docRef, DEFAULT_FEATURES).catch(console.error);
            setFeatures(DEFAULT_FEATURES);
          }
          setIsLoaded(true);
        },
        (error) => {
          console.error('Error listening to feature settings:', error);
          setFeatures(DEFAULT_FEATURES);
          setIsLoaded(true);
        }
      );
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, []);

  const isFeatureEnabled = useCallback(
    (key: string): boolean => {
      return features[key] ?? true;
    },
    [features]
  );

  const toggleFeature = useCallback(
    async (key: string) => {
      const newValue = !features[key];
      // Optimistic update
      setFeatures((prev) => ({ ...prev, [key]: newValue }));

      try {
        const docRef = doc(db, FIRESTORE_DOC, FIRESTORE_ID);
        await updateDoc(docRef, { [key]: newValue });
      } catch (error) {
        // Revert on failure
        setFeatures((prev) => ({ ...prev, [key]: !newValue }));
        console.error('Error toggling feature:', error);
      }
    },
    [features]
  );

  const setFeature = useCallback(
    async (key: string, value: boolean) => {
      setFeatures((prev) => ({ ...prev, [key]: value }));
      try {
        const docRef = doc(db, FIRESTORE_DOC, FIRESTORE_ID);
        await updateDoc(docRef, { [key]: value });
      } catch (error) {
        setFeatures((prev) => ({ ...prev, [key]: !value }));
        console.error('Error setting feature:', error);
      }
    },
    [features]
  );

  const toggleGroupAll = useCallback(
    async (groupId: string, enabled: boolean) => {
      const group = FEATURE_GROUPS.find((g) => g.id === groupId);
      if (!group) return;

      const updates: Record<string, boolean> = {};
      group.features.forEach((f) => {
        updates[f.key] = enabled;
      });

      // Optimistic update
      setFeatures((prev) => ({ ...prev, ...updates }));

      try {
        const docRef = doc(db, FIRESTORE_DOC, FIRESTORE_ID);
        await updateDoc(docRef, updates);
      } catch (error) {
        // Revert
        const reverted: Record<string, boolean> = {};
        group.features.forEach((f) => {
          reverted[f.key] = !enabled;
        });
        setFeatures((prev) => ({ ...prev, ...reverted }));
        console.error('Error toggling group:', error);
      }
    },
    [features]
  );

  const value = useMemo(
    () => ({
      features,
      isLoaded,
      isFeatureEnabled,
      toggleFeature,
      setFeature,
      toggleGroupAll,
      featureGroups: FEATURE_GROUPS,
    }),
    [features, isLoaded, isFeatureEnabled, toggleFeature, setFeature, toggleGroupAll]
  );

  return (
    <FeatureSettingsContext.Provider value={value}>
      {children}
    </FeatureSettingsContext.Provider>
  );
}
