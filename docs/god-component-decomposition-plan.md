# God Component Decomposition Plan

This document outlines the strategic breakdown of three "god components" (>2,000 lines) into focused, testable sub-components. Each proposal is based on actual code structure analysis, section markers, and hook usage patterns.

---

## messages.tsx (5,744 lines)

**Current State:** Monolithic messaging page with 156 hook references, 15+ sub-component functions, and deeply coupled state management.

**Key Issues:**
- Single component handles conversation list, message rendering, input composition, voice messages, calls, encryption, search, notifications, forwarding, pinning, stars, and moderation
- 40+ useState declarations mixed with complex useEffect dependency chains
- Difficult to test individual features in isolation
- Hard to reuse message rendering, conversation state, or input logic in other pages

### Proposed Sub-Components & Hook Extraction

#### 1. **ConversationSidebar** (~800 lines)
Encapsulates the left-hand conversation list panel.

**Responsibility:**
- Display filtered conversation list (all, unread, connects, archived)
- Handle conversation search
- Show typing indicators per conversation
- Pin/unpin conversations
- New conversation creation UI
- Group creation/management launcher

**Props:**
```tsx
interface ConversationSidebarProps {
  conversations: Conversation[];
  selectedConvId: string | null;
  onSelectConversation: (convId: string) => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  activeFilter: 'all' | 'unread' | 'connects' | 'archived';
  onFilterChange: (filter: typeof activeFilter) => void;
  onCreateNew: () => void;
  onCreateGroup: () => void;
}
```

**Hooks to Extract:**
- `useConversationList` — fetch/subscribe to conversations, apply filters, compute typing states
- `useConversationSearch` — debounced search across conversations

**Lines (Est.):** 800

---

#### 2. **ChatMessages** (~1,200 lines)
Encapsulates the main message rendering area.

**Responsibility:**
- Render message list with date separators
- Handle message grouping by sender
- Render different message types (text, voice, image, file, call event)
- Message actions (reply, react, forward, delete, report, pin, star)
- Scroll-to-bottom behavior
- Message search highlighting
- Read receipts display

**Props:**
```tsx
interface ChatMessagesProps {
  messages: Message[];
  currentUserId: string;
  selectedUser: User | null;
  conversationId: string | null;
  loading: boolean;
  onReplyStart: (msg: Message) => void;
  onEditStart: (msg: Message) => void;
  onDeleteStart: (msg: Message) => void;
  onForwardStart: (msg: Message) => void;
  onReactToMessage: (msgId: string, emoji: string) => void;
  onMessageRead: (msgId: string) => void;
  searchQuery?: string;
  wallpaper?: string;
  compactMode?: boolean;
  readReceiptsEnabled?: boolean;
  starredMessagesEnabled?: boolean;
  pinnedMessagesEnabled?: boolean;
}
```

**Hooks to Extract:**
- `useMessages` — fetch/subscribe to messages, handle encryption decryption
- `useMessageActions` — delete, report, block, forward operations
- `useMessageSearch` — highlight search results in message list
- `useScrollToBottom` — auto-scroll behavior and scroll-to-bottom button
- `useMessageReactions` — emoji reaction UI and persistence

**Lines (Est.):** 1,200

---

#### 3. **ChatComposer** (~600 lines)
Encapsulates the message input and sending logic.

**Responsibility:**
- Text input with auto-expand textarea
- Formatting toolbar (bold, italic, code, strikethrough)
- Emoji picker
- GIF picker
- Voice recorder
- Image upload with compression
- File upload
- Message sending with encryption
- Reply/edit mode UI
- Disappearing message timer UI
- Link preview generation

**Props:**
```tsx
interface ChatComposerProps {
  convId: string | null;
  currentUserId: string;
  onMessageSend: (msg: Message) => void;
  replyingTo: Message | null;
  onReplyCancel: () => void;
  editingMessage: Message | null;
  onEditCancel: () => void;
  disabled?: boolean;
  encryptionEnabled?: boolean;
  voiceMessagesEnabled?: boolean;
  fileShareEnabled?: boolean;
  linkPreviewsEnabled?: boolean;
  gifStickersEnabled?: boolean;
  disappearingMessagesEnabled?: boolean;
  typingIndicatorEnabled?: boolean;
}
```

**Hooks to Extract:**
- `useMessageComposer` — input state, sending logic, validation
- `useVoiceRecorder` — record/playback audio
- `useImageUpload` — image selection, compression, preview
- `useFileUpload` — file selection and validation
- `useLinkPreview` — fetch and cache link metadata
- `useFormattingToolbar` — text formatting operations
- `useDisappearingTimer` — timer selection and countdown

**Lines (Est.):** 600

---

#### 4. **GroupChatManager** (~400 lines)
Encapsulates group conversation creation and management.

**Responsibility:**
- Create new group (name, member selection, avatar)
- Add/remove group members
- Edit group name/avatar
- Leave group
- Admin role management
- Display group settings modal

**Props:**
```tsx
interface GroupChatManagerProps {
  isOpen: boolean;
  existingGroup?: Conversation;
  availableUsers: User[];
  currentUserId: string;
  onGroupCreated: (conv: Conversation) => void;
  onGroupUpdated: (conv: Conversation) => void;
  onClose: () => void;
}
```

**Hooks to Extract:**
- `useGroupCreation` — create new group, manage encryption keys
- `useGroupSettings` — update group metadata, member management

**Lines (Est.):** 400

---

#### 5. **CallManager** (~300 lines)
Encapsulates WebRTC calling UI and state.

**Responsibility:**
- Display call state (ringing, connected, etc.)
- Render one-to-one call UI
- Render group call UI
- Handle call controls (answer, reject, hang up, mute, video toggle, screen share)
- Display call timer and participant roster

**Props:**
```tsx
interface CallManagerProps {
  callState: CallState;
  groupCallState: GroupCallState;
  activeGroupCallId: string | null;
  selectedUser: User | null;
  onEndCall: () => void;
  onRejectCall: () => void;
  screenSharingEnabled?: boolean;
}
```

**Hooks to Extract:**
- `useCallState` — subscribe to CallManager state changes
- `useGroupCallState` — subscribe to GroupCallManager state changes
- `useCallControls` — mute, video, screen share, hang up

**Lines (Est.):** 300

---

#### 6. **MessageForwardingModal** (~200 lines)
Modal for forwarding messages to other conversations.

**Props:**
```tsx
interface MessageForwardingModalProps {
  message: Message | null;
  conversations: Conversation[];
  isOpen: boolean;
  onClose: () => void;
  onForward: (convId: string) => void;
}
```

**Lines (Est.):** 200

---

#### 7. **MessageReportModal** (~150 lines)
Modal for reporting inappropriate messages.

**Props:**
```tsx
interface MessageReportModalProps {
  message: Message | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmitReport: (reason: string, details: string) => void;
}
```

**Lines (Est.):** 150

---

#### 8. **PinnedMessagesPanel** (~200 lines)
Sidebar or modal showing pinned messages in current conversation.

**Props:**
```tsx
interface PinnedMessagesPanelProps {
  messages: Message[];
  isOpen: boolean;
  onClose: () => void;
  onJumpToMessage: (msgId: string) => void;
}
```

**Lines (Est.):** 200

---

#### 9. **StarredMessagesView** (~150 lines)
Dedicated view (possibly full-page or modal) for browsing starred messages.

**Props:**
```tsx
interface StarredMessagesViewProps {
  messages: Message[];
  isOpen: boolean;
  onClose: () => void;
  onJumpToMessage: (convId: string, msgId: string) => void;
}
```

**Lines (Est.):** 150

---

### Supporting Components (Already Extracted)

The following components should be extracted from `messages.tsx` and placed in `src/components/messages/`:

1. **ChatAvatar** (~60 lines) — Avatar rendering with online status
2. **SkeletonConversation** (~20 lines) — Loading skeleton for conversation list
3. **TypingIndicator** (~20 lines) — "User is typing…" animation
4. **ScrollToBottomButton** (~20 lines) — Sticky scroll-to-bottom FAB
5. **QuickReactionBar** (~40 lines) — Quick emoji reaction picker
6. **MessageContextMenu** (~110 lines) — Message action menu (reply, react, delete, etc.)
7. **FormattingToolbar** (~30 lines) — Text formatting buttons
8. **EmojiPicker** (~120 lines) — Emoji search and selection UI
9. **GifPicker** (~100 lines) — GIF search and preview UI
10. **VoiceRecorder** (~110 lines) — Audio recording UI
11. **VoiceMessageBubble** (~170 lines) — Voice message display and playback
12. **CallEventBubble** (~50 lines) — Missed/completed call display
13. **WallpaperPicker** (~50 lines) — Chat background selection UI
14. **NotificationToast** (~60 lines) — Toast notification component
15. **MessageSearchBar** (~100 lines) — Search bar for chat history

### New Custom Hooks (`src/hooks/messages/`)

```
useConversations.ts      — fetch/subscribe, filtering
useMessages.ts           — fetch/subscribe messages, encryption/decryption
useMessageActions.ts     — delete, report, block, forward
useMessageSearch.ts      — search and highlight
useScrollToBottom.ts     — auto-scroll logic
useMessageReactions.ts   — emoji reactions
useMessageComposer.ts    — input state, validation, sending
useVoiceRecorder.ts      — audio recording
useImageUpload.ts        — image selection and compression
useFileUpload.ts         — file selection
useLinkPreview.ts        — fetch and cache link metadata
useFormattingToolbar.ts  — text formatting
useDisappearingTimer.ts  — timer logic
useCallState.ts          — call state subscription
useGroupCallState.ts     — group call state subscription
useCallControls.ts       — call control operations
useGroupCreation.ts      — group creation and encryption
useGroupSettings.ts      — group metadata updates
```

---

## admin.tsx (3,335 lines)

**Current State:** Monolithic admin dashboard with 55 hook references managing 9+ different feature areas (registrations, users, listings, events, announcements, emails, moderation, hidden posts, catering).

**Key Issues:**
- All admin features in one component (registration approval, user management, listing moderation, event management, announcement posting, admin email management, content moderation, post hiding, catering order management)
- Mixed state management for unrelated domains
- Difficult to test individual admin features
- Hard to reuse moderation logic in other contexts (e.g., catering moderation)

### Proposed Sub-Components

#### 1. **RegistrationApprovalPanel** (~300 lines)
Manage business registration applications.

**Responsibility:**
- Display pending business registrations
- Approve/reject with optional reason
- View registration details (business info, documents, contact)

**Props:**
```tsx
interface RegistrationApprovalPanelProps {
  pending: PendingBusiness[];
  loading: boolean;
  onApprove: (businessId: string) => void;
  onReject: (businessId: string, reason: string) => void;
}
```

**Lines (Est.):** 300

---

#### 2. **UserManagementPanel** (~500 lines)
Manage user accounts, roles, and status.

**Responsibility:**
- List users (all, active, business, disabled, banned, admin)
- Search users by name/email
- View user details (avatar, name, email, role, join date, listings, events)
- Ban/unban user
- Disable/enable user
- Grant/revoke admin role
- Delete user content

**Props:**
```tsx
interface UserManagementPanelProps {
  users: UserRecord[];
  bannedUserIds: string[];
  disabledUserIds: string[];
  loading: boolean;
  onBanUser: (userId: string) => void;
  onUnbanUser: (userId: string) => void;
  onDisableUser: (userId: string) => void;
  onEnableUser: (userId: string) => void;
  onGrantAdmin: (userId: string) => void;
  onRevokeAdmin: (userId: string) => void;
  onDeleteUserContent: (userId: string) => void;
}
```

**Lines (Est.):** 500

---

#### 3. **ListingModerationPanel** (~350 lines)
Approve and moderate listings.

**Responsibility:**
- List all listings (all, business, housing, travel, disabled)
- Search listings by title
- View listing details with owner info
- Disable/enable listing
- Delete listing
- View poster profile

**Props:**
```tsx
interface ListingModerationPanelProps {
  listings: Listing[];
  loading: boolean;
  onDisableListing: (listingId: string) => void;
  onEnableListing: (listingId: string) => void;
  onDeleteListing: (listingId: string) => void;
  filter: 'all' | 'business' | 'housing' | 'travel' | 'disabled';
  onFilterChange: (filter: typeof filter) => void;
}
```

**Lines (Est.):** 350

---

#### 4. **EventManagementPanel** (~300 lines)
Manage event listings.

**Responsibility:**
- List events (all, promoted, disabled, past)
- Search events
- Promote event (featured placement)
- Disable/enable event
- Delete event
- View event details and organizer

**Props:**
```tsx
interface EventManagementPanelProps {
  events: EventRecord[];
  loading: boolean;
  onPromoteEvent: (eventId: string) => void;
  onUnpromoteEvent: (eventId: string) => void;
  onDisableEvent: (eventId: string) => void;
  onEnableEvent: (eventId: string) => void;
  onDeleteEvent: (eventId: string) => void;
}
```

**Lines (Est.):** 300

---

#### 5. **AnnouncementPanel** (~200 lines)
Create and manage announcements.

**Responsibility:**
- Create new announcement (title, message)
- List active announcements
- Delete announcement
- Edit announcement

**Props:**
```tsx
interface AnnouncementPanelProps {
  announcements: Announcement[];
  loading: boolean;
  onCreateAnnouncement: (title: string, message: string) => void;
  onDeleteAnnouncement: (announcementId: string) => void;
  onEditAnnouncement: (announcementId: string, title: string, message: string) => void;
}
```

**Lines (Est.):** 200

---

#### 6. **AdminEmailManagementPanel** (~200 lines)
Manage admin email addresses.

**Responsibility:**
- List admin emails
- Add new admin email
- Remove admin email

**Props:**
```tsx
interface AdminEmailManagementPanelProps {
  adminEmails: string[];
  loading: boolean;
  onAddAdminEmail: (email: string) => void;
  onRemoveAdminEmail: (email: string) => void;
}
```

**Lines (Est.):** 200

---

#### 7. **ContentModerationPanel** (~350 lines)
Moderate user-generated content (posts, comments).

**Responsibility:**
- Display moderation queue (reports, flagged content)
- View flagged post/comment with context
- Approve/reject content
- Ban user for violations
- Delete content

**Props:**
```tsx
interface ContentModerationPanelProps {
  modQueue: ModerationItem[];
  loading: boolean;
  onApproveItem: (itemId: string) => void;
  onRejectItem: (itemId: string) => void;
  onDeleteContent: (itemId: string) => void;
  onBanUser: (userId: string) => void;
}
```

**Lines (Est.):** 350

---

#### 8. **HiddenPostsPanel** (~250 lines)
Manage hidden (spam, deleted) posts.

**Responsibility:**
- List hidden posts with reasons
- Restore hidden post
- Permanently delete hidden post
- View post owner and history

**Props:**
```tsx
interface HiddenPostsPanelProps {
  hiddenPosts: any[];
  loading: boolean;
  onRestorePost: (postId: string) => void;
  onDeletePost: (postId: string) => void;
}
```

**Lines (Est.):** 250

---

#### 9. **CateringOrdersPanel** (~400 lines)
Manage catering orders and businesses (vendor admin perspective).

**Responsibility:**
- List catering orders (all, pending, active, completed)
- Filter by status
- View order details, items, timeline
- Update order status (confirm, prepare, ready, deliver, cancel)
- Manage order notes/messages
- View business payment info
- Manage vendor reviews/moderation

**Props:**
```tsx
interface CateringOrdersPanelProps {
  orders: CateringOrder[];
  businesses: any[];
  loading: boolean;
  filter: 'all' | 'pending' | 'active' | 'completed';
  onFilterChange: (filter: typeof filter) => void;
  onUpdateOrderStatus: (orderId: string, status: string) => void;
  onCancelOrder: (orderId: string) => void;
}
```

**Lines (Est.):** 400

---

#### 10. **AdminDashboard** (~350 lines)
Summary statistics and quick actions.

**Responsibility:**
- Display dashboard stats (users, listings, events, posts, mod queue, etc.)
- Show signup trend chart
- Feature flag management (toggle on/off)
- Quick links to each admin panel
- Recent activity summary

**Props:**
```tsx
interface AdminDashboardProps {
  stats: DashboardStats;
  featureFlags: Record<string, boolean>;
  onToggleFeature: (flagKey: string) => void;
  onToggleFeatureGroup: (groupKey: string) => void;
  loading: boolean;
}
```

**Lines (Est.):** 350

---

### Layout Container (`src/pages/admin.tsx` Refactored)

The page component becomes a thin layout shell:

```tsx
export default function AdminPage() {
  const { isAdmin } = useAuth();
  const [selectedSection, setSelectedSection] = useState<string>('dashboard');
  
  // Load data for selected section (hooks/context)
  const { stats, features } = useAdminDashboard();
  
  return (
    <div className="admin-layout">
      <AdminSidebar 
        selectedSection={selectedSection}
        onSelectSection={setSelectedSection}
      />
      <main>
        {selectedSection === 'dashboard' && <AdminDashboard {...} />}
        {selectedSection === 'registrations' && <RegistrationApprovalPanel {...} />}
        {selectedSection === 'users' && <UserManagementPanel {...} />}
        {selectedSection === 'listings' && <ListingModerationPanel {...} />}
        {selectedSection === 'events' && <EventManagementPanel {...} />}
        {selectedSection === 'announcements' && <AnnouncementPanel {...} />}
        {selectedSection === 'emails' && <AdminEmailManagementPanel {...} />}
        {selectedSection === 'moderation' && <ContentModerationPanel {...} />}
        {selectedSection === 'hidden' && <HiddenPostsPanel {...} />}
        {selectedSection === 'catering' && <CateringOrdersPanel {...} />}
      </main>
    </div>
  );
}
```

**Estimated Final Size:** 150–200 lines

---

## VendorCateringDashboard.tsx (2,719 lines)

**Current State:** Monolithic vendor dashboard with deep state management for orders, payment settings, notifications, moderation, and UI state.

**Key Issues:**
- Single component handles order browsing, batch actions, order modification, payment setup, notifications, reminders, and moderation
- 27+ useState declarations with complex interdependencies
- Modal and form states mixed throughout
- Difficult to test order filtering, batch operations, or moderation logic independently

### Proposed Sub-Components

#### 1. **VendorOrderList** (~600 lines)
Display orders grouped by status accordion.

**Responsibility:**
- Group orders by status (pending, confirmed, preparing, ready, out_for_delivery, delivered, cancelled)
- Show expanded/collapsed state per status group
- Sort orders within each group by date
- Checkbox selection for batch operations
- Quick actions (view details, update status, cancel)
- Order summary card (date, items count, total, customer)

**Props:**
```tsx
interface VendorOrderListProps {
  orders: CateringOrder[];
  expandedStatus: string[];
  onToggleStatus: (status: string) => void;
  selectedOrders: Set<string>;
  onSelectOrder: (orderId: string) => void;
  onSelectAllInStatus: (status: string) => void;
  onOrderClick: (orderId: string) => void;
  onStatusChange: (orderId: string, newStatus: string) => void;
  onCancelClick: (orderId: string) => void;
}
```

**Lines (Est.):** 600

---

#### 2. **VendorOrderDetails** (~400 lines)
Expanded view of a single order with timeline and interactions.

**Responsibility:**
- Display order items, quantities, special requests
- Show customer contact info with messaging link
- Display order timeline (status changes, events)
- Order notes / inline messaging
- Update status dropdown
- Modify order items
- Cancel order button
- ETA input (duration or fixed time mode)
- Customer alerts (order update notifications)

**Props:**
```tsx
interface VendorOrderDetailsProps {
  order: CateringOrder;
  isExpanded: boolean;
  onStatusChange: (newStatus: string) => void;
  onCancelOrder: () => void;
  onModifyOrder: (items: any[]) => void;
  onUpdateEta: (value: string, mode: 'duration' | 'time') => void;
  onAddNote: (note: string) => void;
  onNotifyCustomer: () => void;
}
```

**Lines (Est.):** 400

---

#### 3. **BatchOrderActions** (~200 lines)
Controls and handlers for batch operations.

**Responsibility:**
- Display selected order count
- Batch status update button
- Batch cancel button
- Select all / deselect all toggles
- Batch operation confirmation modal

**Props:**
```tsx
interface BatchOrderActionsProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onBatchStatusUpdate: (newStatus: string) => void;
  onBatchCancel: () => void;
}
```

**Lines (Est.):** 200

---

#### 4. **PaymentSetupBanner** (~200 lines)
Payment configuration reminder and form.

**Responsibility:**
- Display banner when payment info not configured
- Show snooze countdown if deferred
- Open payment setup form modal
- Input payment URL, method, notes
- Save payment info
- Defer reminder (1, 3, 7 days)

**Props:**
```tsx
interface PaymentSetupBannerProps {
  visible: boolean;
  paymentUrl: string;
  paymentMethod: string;
  paymentNote: string;
  paymentSkippedUntil: number | null;
  onSave: (url: string, method: string, note: string) => void;
  onDefer: (days: number) => void;
  onDismiss: () => void;
  loading?: boolean;
}
```

**Lines (Est.):** 200

---

#### 5. **VendorNotificationCenter** (~300 lines)
Real-time notification feed and alert management.

**Responsibility:**
- Display notification feed (order alerts, reminders, system messages)
- Mark notification read/unread
- Mark all as read
- Mute/unmute notification types
- Show unread badge
- Notification timestamps and actions

**Props:**
```tsx
interface VendorNotificationCenterProps {
  notifications: CateringNotification[];
  unreadCount: number;
  onMarkRead: (notificationId: string) => void;
  onMarkAllRead: () => void;
  onMuteType: (type: string) => void;
  onUnmuteType: (type: string) => void;
  onNotificationClick: (notification: CateringNotification) => void;
}
```

**Lines (Est.):** 300

---

#### 6. **VendorReminderEngine** (~150 lines)
Alert system for upcoming deadlines and overdue orders.

**Responsibility:**
- Check orders periodically and raise alerts
- Display alert banners for upcoming prep deadlines
- Display alert for overdue deliveries
- Snooze/dismiss alerts
- Configure alert thresholds (prepare in advance, delivery overdue threshold)

**Props:**
```tsx
interface VendorReminderEngineProps {
  orders: CateringOrder[];
  onAlertRaised: (alert: ReminderAlert) => void;
  prepLeadMinutes?: number;
  deliveryOverdueMinutes?: number;
}
```

**Lines (Est.):** 150

---

#### 7. **OrderModificationModal** (~250 lines)
Edit order items and details.

**Responsibility:**
- Display order items in edit mode
- Add/remove items
- Adjust quantities
- Edit special requests
- Confirm modifications
- Rollback on cancel
- Preserve original order for comparison

**Props:**
```tsx
interface OrderModificationModalProps {
  order: CateringOrder;
  isOpen: boolean;
  onSave: (items: OrderItem[]) => void;
  onCancel: () => void;
  loading?: boolean;
}
```

**Lines (Est.):** 250

---

#### 8. **OrderCancellationModal** (~150 lines)
Cancellation workflow with reason selection.

**Responsibility:**
- Select cancellation reason (predefined list or custom)
- Confirm cancellation
- Display refund/impact info
- Handle cancellation submission

**Props:**
```tsx
interface OrderCancellationModalProps {
  order: CateringOrder;
  isOpen: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  reasons: string[];
  loading?: boolean;
}
```

**Lines (Est.):** 150

---

#### 9. **ReviewModerationPanel** (~150 lines)
Vendor-facing review moderation (flagged reviews).

**Responsibility:**
- Display flagged/disputed reviews
- Flag review as unfair
- Request review removal
- View customer response
- Moderation status tracking

**Props:**
```tsx
interface ReviewModerationPanelProps {
  flaggedReviews: any[];
  onFlagReview: (reviewId: string, reason: string) => void;
  onRequestRemoval: (reviewId: string, reason: string) => void;
}
```

**Lines (Est.):** 150

---

#### 10. **OnboardingPills** (~100 lines)
Contextual onboarding prompts (add items, enable notifications, set payment, etc.).

**Responsibility:**
- Display dismissible onboarding suggestions
- Link to related tabs/settings
- Track completion state
- Callback when action triggers tab switch

**Props:**
```tsx
interface OnboardingPillsProps {
  completedActions: Set<string>;
  onActionComplete: (action: string) => void;
  onTabSwitch?: (tab: string) => void;
}
```

**Lines (Est.):** 100

---

### Layout Container (`VendorCateringDashboard.tsx` Refactored)

The component becomes a layout coordinator:

```tsx
export default function VendorCateringDashboard({ 
  businessId, 
  businessName, 
  onSwitchVendorTab 
}: VendorCateringDashboardProps) {
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [expandedStatus, setExpandedStatus] = useState<string[]>([]);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [notifications, setNotifications] = useState<CateringNotification[]>([]);
  
  // Load orders, notifications with custom hooks
  const { orders, loading } = useVendorOrders(businessId);
  const { notifications, unread } = useVendorNotifications(businessId);
  
  return (
    <div className="vendor-dashboard">
      <PaymentSetupBanner {...} />
      <OnboardingPills {...} />
      <VendorNotificationCenter {...} />
      <div className="main-content">
        <BatchOrderActions {...} />
        <VendorOrderList 
          orders={orders}
          expandedStatus={expandedStatus}
          onToggleStatus={(s) => setExpandedStatus(...)}
          selectedOrders={selectedOrders}
          {...}
        />
        {expandedOrder && (
          <VendorOrderDetails 
            order={orders.find(o => o.id === expandedOrder)!}
            {...}
          />
        )}
      </div>
    </div>
  );
}
```

**Estimated Final Size:** 200–250 lines

---

### Custom Hooks for VendorCateringDashboard (`src/hooks/catering/`)

```
useVendorOrders.ts           — subscribe to vendor's orders, filtering
useVendorNotifications.ts    — subscribe to real-time notifications (F-05)
useBatchOrderOperations.ts   — bulk status updates, cancellations
useOrderModification.ts      — edit order items, ETA
usePaymentSetup.ts           — save/defer payment info
useReminderEngine.ts         — periodic checks for deadline alerts
useCancellationReason.ts     — cancel order with reason tracking
useOnboardingState.ts        — track completed setup actions
```

---

## Migration Strategy & Success Criteria

### Phase 1: Extract Helper Components & Custom Hooks (Low Risk)
- Move small components (Avatars, Skeletons, Indicators, Modals) into shared directories
- Create custom hooks for focused concerns (useLinkPreview, useScrollToBottom, etc.)
- Update imports in parent components
- Run tests to ensure no behavioral change

### Phase 2: Extract Focused Sub-Components (Medium Risk)
- Extract Sidebar, Message List, Composer → new component files
- Update main component to import and compose
- Props-based state management (lift state)
- Update tests for new props

### Phase 3: Migrate State & Event Handlers (Medium-High Risk)
- Create context providers for each major domain if needed
- Move data-fetching hooks out
- Convert internal state mutations to callbacks
- Test integration thoroughly

### Success Criteria
1. **Each extracted component:**
   - Has <500 lines (most sub-components)
   - Handles a single, clear responsibility
   - Is testable in isolation
   - Has documented props interface

2. **Main component after refactor:**
   - <300 lines
   - Acts as layout coordinator
   - Minimal internal state
   - Mostly composition and event wiring

3. **Test Coverage:**
   - Each sub-component has unit tests
   - Integration tests for component tree
   - No regression in e2e tests

4. **Bundle Size:**
   - No increase (code-splitting friendly)
   - Improved tree-shaking potential

---

## Reference: Prior Success (business.tsx)

Session 11-12 refactored `business.tsx` from ~2,500 lines to ~552 lines by:
1. Extracting tab-based sections into dedicated panels (BusinessListingPanel, VendorDashboardPanel, etc.)
2. Creating focused custom hooks (useBusinessListings, useVendorOrders, etc.)
3. Lifting shared state into a context provider
4. Moving helper functions and small components to `src/components/business/`

This pattern should be replicated for the three god components identified in this plan.
