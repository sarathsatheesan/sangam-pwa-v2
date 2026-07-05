import { useState, useCallback } from 'react';
import type { User } from '@/types/messages';

/**
 * Group-management UI domain (Session 60 — messages.tsx decomposition
 * tranche 8, domain 8 of docs/messages-state-decomposition-plan.md).
 *
 * Owns the UI state for three related surfaces:
 *  - Pen menu → new-message picker + group-creator entry points.
 *  - Group creator: name/members/search for building a new group. The
 *    open/close helpers reset the draft (name, selected members, search)
 *    so re-opening always starts clean.
 *  - Group settings ("Group Info"): the settings sheet, inline group-name
 *    edit, and the add-member picker + its search.
 *
 * The async handlers (create group, rename, add/remove member — Firestore)
 * stay in the page; this hook owns only the UI state. Controlled-input
 * setters and the functional-update member setter are exposed raw so the
 * page keeps its exact input/onChange behavior.
 */
export function useGroupManagement() {
  // ── pen menu ──
  const [showPenMenu, setShowPenMenu] = useState(false);
  const togglePenMenu = useCallback(() => setShowPenMenu((o) => !o), []);
  const closePenMenu = useCallback(() => setShowPenMenu(false), []);

  // ── new-message picker ──
  const [showNewMsgPicker, setShowNewMsgPicker] = useState(false);
  const openNewMsgPicker = useCallback(() => setShowNewMsgPicker(true), []);
  const closeNewMsgPicker = useCallback(() => setShowNewMsgPicker(false), []);

  // ── group creator ──
  const [showGroupCreator, setShowGroupCreator] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedGroupMembers, setSelectedGroupMembers] = useState<User[]>([]);
  const [groupSearchTerm, setGroupSearchTerm] = useState('');

  const resetGroupCreatorDraft = useCallback(() => {
    setGroupName('');
    setSelectedGroupMembers([]);
    setGroupSearchTerm('');
  }, []);
  const openGroupCreator = useCallback(() => {
    setShowGroupCreator(true);
    resetGroupCreatorDraft();
  }, [resetGroupCreatorDraft]);
  const closeGroupCreator = useCallback(() => {
    setShowGroupCreator(false);
    resetGroupCreatorDraft();
  }, [resetGroupCreatorDraft]);

  // ── group settings + inline name edit + add-member picker ──
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const [editingGroupName, setEditingGroupName] = useState(false);
  const [editGroupNameValue, setEditGroupNameValue] = useState('');
  const [showAddMemberPicker, setShowAddMemberPicker] = useState(false);
  const [addMemberSearchTerm, setAddMemberSearchTerm] = useState('');

  const openGroupSettings = useCallback((name: string) => {
    setShowGroupSettings(true);
    setEditGroupNameValue(name);
  }, []);
  const closeGroupSettings = useCallback(() => {
    setShowGroupSettings(false);
    setEditingGroupName(false);
    setShowAddMemberPicker(false);
    setAddMemberSearchTerm('');
  }, []);

  const startEditGroupName = useCallback((name: string) => {
    setEditingGroupName(true);
    setEditGroupNameValue(name);
  }, []);
  const cancelEditGroupName = useCallback(() => setEditingGroupName(false), []);

  const toggleAddMemberPicker = useCallback(() => setShowAddMemberPicker((o) => !o), []);
  const closeAddMemberPicker = useCallback(() => setShowAddMemberPicker(false), []);

  return {
    // pen menu
    showPenMenu, togglePenMenu, closePenMenu,
    // new-message picker
    showNewMsgPicker, openNewMsgPicker, closeNewMsgPicker,
    // group creator
    showGroupCreator, openGroupCreator, closeGroupCreator,
    groupName, setGroupName,
    selectedGroupMembers, setSelectedGroupMembers,
    groupSearchTerm, setGroupSearchTerm,
    // group settings
    showGroupSettings, openGroupSettings, closeGroupSettings,
    editingGroupName, startEditGroupName, cancelEditGroupName,
    editGroupNameValue, setEditGroupNameValue,
    showAddMemberPicker, toggleAddMemberPicker, closeAddMemberPicker,
    addMemberSearchTerm, setAddMemberSearchTerm,
  };
}
