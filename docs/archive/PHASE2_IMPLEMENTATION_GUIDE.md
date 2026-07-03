# Phase 2: Admin.tsx Refactoring Implementation Guide

## Overview
This guide shows exactly how to refactor `src/pages/admin.tsx` to use the extracted components from Phase 1.

## High-Level Structure

The refactored admin.tsx will have this structure:

```
1. Imports (60 lines)
   - Types from @/types/admin
   - Components from @/components/admin
   - Panels from @/components/admin/panels
   - Context and Firebase

2. State Declarations (80 lines)
   - All useState hooks (dashboard, users, listings, etc.)
   - Filter and search states
   - UI states (expanded rows, modals, toast)

3. Hooks (100 lines)
   - useEffect for auto-dismiss toast
   - useEffect for section-specific loading
   - useMemo for filtered data

4. Data Loading Functions (350 lines)
   - loadDashboardData()
   - loadUsers()
   - loadListings()
   - loadEvents()
   - loadAnnouncements()
   - etc.

5. Action Handlers (500 lines)
   - User actions: disableUser, banUser, deleteAllUserContent, etc.
   - Listing actions: toggleVerifyListing, toggleDisableListing, deleteListing
   - Event actions: togglePromoteEvent, toggleDisableEvent, deleteEvent
   - Moderation actions: approveModItem, rejectModItem, hidePost, etc.
   - Catering actions: handleCateringStatusChange
   - Announcement actions: addAnnouncement, deleteAnnouncement
   - Admin actions: addAdminEmail, removeAdminEmail

6. Helper Functions (50 lines)
   - sourceIcon(source)
   - sourceLabel(source)
   - isUserAdmin(user)

7. Navigation Config (20 lines)
   - navItems array
   - sourceIcon/Label functions

8. Render (600 lines)
   - Top header with moderation badge
   - Sidebar/mobile navigation
   - Main content area with conditional panels
   - Toast notification
   - Confirmation modal

Total estimated: 1,760 lines (47% of original)
```

## Step-by-Step Refactoring

### Step 1: Update Imports

**Before:** All components defined inline
**After:**
```typescript
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useFeatureSettings, FEATURE_GROUPS } from '@/contexts/FeatureSettingsContext';
import { db } from '@/services/firebase';
import {
  collection, getDocs, doc, deleteDoc, setDoc, updateDoc, addDoc,
  serverTimestamp, query, where, getDoc, orderBy, limit,
} from 'firebase/firestore';
import {
  LayoutDashboard, Users, ClipboardList, Settings, Megaphone, ShieldCheck,
  TrendingUp, TrendingDown, UserCheck, UserX, Store, Home, Plane,
  MessageSquare, Calendar, Search, MoreVertical, Trash2, Ban, CheckCircle2,
  XCircle, AlertTriangle, ChevronRight, BarChart3, Activity, Eye, EyeOff,
  Plus, Send, Shield, Lock, Flag, Bell, BellOff, X, Power, ToggleLeft,
  ToggleRight, Sparkles, Filter, AlertOctagon, MessageCircle, BadgeCheck,
  FileText, ChefHat, Package, Clock,
} from 'lucide-react';
import { fetchPendingRegistrations, approveRegistration, rejectRegistration } from '@/services/businessRegistration';
import { formatPrice, updateOrderStatus } from '@/services/cateringService';
import AvatarImg from '@/components/shared/AvatarImg';

// Import types
import type { Listing, UserRecord, Announcement, ModerationItem, EventRecord } from '@/types/admin';
import type { PendingBusiness } from '@/services/businessRegistration';
import type { CateringOrder } from '@/services/cateringService';

// Import helper components
import { SkeletonCard, SkeletonRow } from '@/components/admin';

// Import panel components
import {
  DashboardPanel, UserManagementPanel, ListingPanel, EventPanel,
  RegistrationPanel, AnnouncementPanel, AdminEmailPanel,
  ModerationPanel, CateringPanel,
} from '@/components/admin/panels';
```

### Step 2: Keep All State & Logic

**DON'T MOVE** - Keep all of this in admin.tsx:
- All `useState` declarations
- All `useEffect` hooks
- All data loading functions (`loadDashboardData`, `loadUsers`, etc.)
- All action handlers (`disableUser`, `banUser`, `toggleVerifyListing`, etc.)
- All helper functions (`isUserAdmin`, `sourceIcon`, `sourceLabel`)
- Navigation config (`navItems`)

### Step 3: Replace Render Sections with Panels

Example refactoring for Dashboard:

**Before (lines 1578-1683):**
```typescript
{selectedSection === 'dashboard' && (
  <div className="space-y-6">
    <div>
      <h2 className="text-2xl font-bold text-[var(--aurora-text)]">Dashboard</h2>
      <p className="text-sm text-[var(--aurora-text-secondary)]">Overview of your community platform</p>
    </div>
    {loading ? (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => <SkeletonCard key={i} />)}
      </div>
    ) : (
      <>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard ... />
          {/* ... 7 more cards ... */}
        </div>
        {/* ... quick actions ... */}
      </>
    )}
  </div>
)}
```

**After:**
```typescript
{selectedSection === 'dashboard' && (
  <DashboardPanel
    loading={loading}
    dashStats={dashStats}
    onNavigate={setSelectedSection}
  />
)}
```

### Step 4: Panel Integration Examples

#### Dashboard
```typescript
<DashboardPanel
  loading={loading}
  dashStats={dashStats}
  onNavigate={setSelectedSection}
/>
```

#### Users
```typescript
<UserManagementPanel
  loading={loading}
  users={users}
  filteredUsers={filteredUsers}
  userSearch={userSearch}
  onUserSearchChange={setUserSearch}
  userFilter={userFilter}
  onUserFilterChange={setUserFilter}
  bannedUserIds={bannedUserIds}
  disabledUserIds={disabledUserIds}
  expandedUser={expandedUser}
  onExpandedUserChange={setExpandedUser}
  deletingContent={deletingContent}
  isUserAdmin={isUserAdmin}
  onDisableUser={disableUser}
  onEnableUser={enableUser}
  onBanUser={banUser}
  onUnbanUser={unbanUser}
  onDeleteContent={deleteAllUserContent}
  onRemoveUser={removeUser}
/>
```

#### Listings
```typescript
<ListingPanel
  loading={loading}
  filteredListings={filteredListings}
  listingSearch={listingSearch}
  onListingSearchChange={setListingSearch}
  listingFilter={listingFilter}
  onListingFilterChange={setListingFilter}
  sourceIcon={sourceIcon}
  sourceLabel={sourceLabel}
  onToggleVerify={toggleVerifyListing}
  onToggleDisable={toggleDisableListing}
  onDeleteListing={deleteListing}
/>
```

#### Events
```typescript
<EventPanel
  loading={loading}
  filteredAdminEvents={filteredAdminEvents}
  eventSearch={eventSearch}
  onEventSearchChange={setEventSearch}
  eventFilter={eventFilter}
  onEventFilterChange={setEventFilter}
  onTogglePromote={togglePromoteEvent}
  onToggleDisable={toggleDisableEvent}
  onDeleteEvent={deleteEvent}
/>
```

#### Registrations
```typescript
<RegistrationPanel
  registrationsLoading={registrationsLoading}
  pendingRegistrations={pendingRegistrations}
  rejectModalId={rejectModalId}
  rejectReason={rejectReason}
  onRejectReasonChange={setRejectReason}
  onApprove={(id) => approveRegistration(id)}
  onReject={(id, reason) => rejectRegistration(id, reason)}
  onOpenRejectModal={setRejectModalId}
  onCloseRejectModal={() => setRejectModalId(null)}
/>
```

#### Catering
```typescript
<CateringPanel
  cateringLoading={cateringLoading}
  cateringOrders={cateringOrders}
  cateringFilter={cateringFilter}
  onCateringFilterChange={setCateringFilter}
  cateringActionLoading={cateringActionLoading}
  onStatusChange={handleCateringStatusChange}
  onDeleteOrder={(id) => {/* delete logic */}}
/>
```

#### Announcements
```typescript
<AnnouncementPanel
  announcements={announcements}
  announcementTitle={announcementTitle}
  announcementMessage={announcementMessage}
  onTitleChange={setAnnouncementTitle}
  onMessageChange={setAnnouncementMessage}
  onAddAnnouncement={addAnnouncement}
  onDeleteAnnouncement={deleteAnnouncement}
  onToggleActive={toggleAnnouncementActive}
/>
```

#### Admin Access
```typescript
<AdminEmailPanel
  adminEmails={adminEmails}
  newAdminEmail={newAdminEmail}
  onNewAdminEmailChange={setNewAdminEmail}
  onAddAdmin={addAdminEmail}
  onRemoveAdmin={removeAdminEmail}
/>
```

#### Moderation
```typescript
<ModerationPanel
  modQueue={modQueue}
  hiddenPosts={hiddenPosts}
  hiddenBusinesses={hiddenBusinesses}
  onApproveItem={approveModerationItem}
  onRejectItem={rejectModerationItem}
  onUnhidePost={unhidePost}
  onDeletePost={permanentlyDeletePost}
  onUnhideBusiness={unhideBusiness}
  onDeleteBusiness={permanentlyDeleteBusiness}
/>
```

## What Stays in admin.tsx

### State Management
```typescript
// All these remain
const [selectedSection, setSelectedSection] = useState<string>('dashboard');
const [loading, setLoading] = useState(false);
const [users, setUsers] = useState<UserRecord[]>([]);
// ... etc for all other states
```

### Data Loading
```typescript
// All these functions remain
async function loadDashboardData() { /* 60 lines */ }
async function loadUsers() { /* 40 lines */ }
async function loadListings() { /* 50 lines */ }
// ... etc
```

### Action Handlers
```typescript
// All these functions remain
async function disableUser(userId: string) { /* ... */ }
async function banUser(userId: string) { /* ... */ }
async function toggleVerifyListing(listing: Listing) { /* ... */ }
// ... etc
```

### Layout & Navigation
```typescript
// The header with moderation badge
<div className="bg-[var(--aurora-surface)] border-b border-[var(--aurora-border)]">
  {/* Top header bar remains */}
</div>

// Sidebar and mobile nav remain
<nav className="hidden lg:flex flex-col w-56 flex-shrink-0">
  {/* Navigation remains */}
</nav>

// Toast remains
{toastMessage && (
  <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[300]">
    {toastMessage}
  </div>
)}

// Confirmation modal remains
{confirmModal && (
  <div className="fixed inset-0 bg-black/50">
    {/* Modal content remains */}
  </div>
)}
```

## Testing Checklist for Phase 2

- [ ] All panel components render correctly in their respective sections
- [ ] All filters and search work (users, listings, events, etc.)
- [ ] All action buttons trigger correct callbacks
- [ ] Loading states display skeleton components
- [ ] Empty states show appropriate messages
- [ ] Toast notifications appear and auto-dismiss
- [ ] Confirmation modal appears for destructive actions
- [ ] Expand/collapse functionality works (users with actions)
- [ ] Status badges display correctly
- [ ] Mobile responsive navigation works
- [ ] Admin access check still blocks non-admin users
- [ ] Moderation badge appears when items in queue
- [ ] All tabs/sections load data on switch
- [ ] Dark mode theming applies consistently

## Estimated Time: 2-3 hours
- Import updates: 30 min
- Panel integration: 90 min
- Testing & debugging: 30-60 min
