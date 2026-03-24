import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { MessageCircle, Send, ChevronRight, ChevronDown, User, Shield, Search, X } from 'lucide-react';
import {
  collection, addDoc, getDocs, updateDoc, doc, arrayUnion, serverTimestamp,
  query, orderBy, Timestamp,
} from 'firebase/firestore';
import { db } from '@/services/firebase';
import type { Business } from '@/reducers/businessReducer';

// ── Types ──

export interface QAAnswer {
  id: string;
  userId: string;
  userName: string;
  text: string;
  isOwner: boolean;
  createdAt: any;
}

export interface QAQuestion {
  id: string;
  businessId: string;
  userId: string;
  userName: string;
  text: string;
  answers: QAAnswer[];
  createdAt: any;
}

// ── Props ──

interface BusinessQASectionProps {
  business: Business;
  user: any;
  isOwnerOrAdmin: boolean;
}

// ── Helpers ──

function timeAgo(ts: any): string {
  if (!ts) return '';
  try {
    const date = (ts && typeof ts.toDate === 'function')
      ? ts.toDate()
      : (ts && ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts));
    if (isNaN(date.getTime())) return '';
    const diff = Date.now() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + 'm ago';
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + 'h ago';
    const days = Math.floor(hrs / 24);
    if (days < 30) return days + 'd ago';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

// ── Component ──

const BusinessQASection: React.FC<BusinessQASectionProps> = ({ business, user, isOwnerOrAdmin }) => {
  const [questions, setQuestions] = useState<QAQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [newQuestion, setNewQuestion] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [expandedQ, setExpandedQ] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [replySubmitting, setReplySubmitting] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  // ── Debounced search (250ms) — cross-browser safe, no AbortController needed ──
  useEffect(() => {
    var timer = setTimeout(function () { setDebouncedSearch(searchQuery); }, 250);
    return function () { clearTimeout(timer); };
  }, [searchQuery]);

  // ── Filter questions by search query (matches question text, answers, usernames) ──
  var filteredQuestions = useMemo(function () {
    if (!debouncedSearch.trim()) return questions;
    var needle = debouncedSearch.trim().toLowerCase();
    return questions.filter(function (q) {
      if (q.text.toLowerCase().indexOf(needle) >= 0) return true;
      if (q.userName.toLowerCase().indexOf(needle) >= 0) return true;
      for (var i = 0; i < q.answers.length; i++) {
        if (q.answers[i].text.toLowerCase().indexOf(needle) >= 0) return true;
        if (q.answers[i].userName.toLowerCase().indexOf(needle) >= 0) return true;
      }
      return false;
    });
  }, [questions, debouncedSearch]);

  // ── Fetch questions ──
  const fetchQuestions = useCallback(async () => {
    try {
      const q = query(
        collection(db, 'businesses', business.id, 'questions'),
        orderBy('createdAt', 'desc'),
      );
      const snap = await getDocs(q);
      const data: QAQuestion[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<QAQuestion, 'id'>),
      }));
      setQuestions(data);
    } catch (err) {
      console.error('Error fetching Q&A:', err);
    } finally {
      setLoading(false);
    }
  }, [business.id]);

  useEffect(() => { fetchQuestions(); }, [fetchQuestions]);

  // ── Ask question ──
  const handleAskQuestion = useCallback(async () => {
    if (!user || !newQuestion.trim() || submitting) return;
    setSubmitting(true);
    try {
      const docRef = await addDoc(collection(db, 'businesses', business.id, 'questions'), {
        businessId: business.id,
        userId: user.uid,
        userName: user.displayName || 'Anonymous',
        text: newQuestion.trim(),
        answers: [],
        createdAt: serverTimestamp(),
      });
      // Optimistic update
      setQuestions((prev) => [{
        id: docRef.id,
        businessId: business.id,
        userId: user.uid,
        userName: user.displayName || 'Anonymous',
        text: newQuestion.trim(),
        answers: [],
        createdAt: Timestamp.now(),
      }, ...prev]);
      setNewQuestion('');
    } catch (err) {
      console.error('Error posting question:', err);
    } finally {
      setSubmitting(false);
    }
  }, [user, newQuestion, submitting, business.id]);

  // ── Answer question ──
  const handleAnswer = useCallback(async (questionId: string) => {
    const text = replyText[questionId]?.trim();
    if (!user || !text || replySubmitting) return;
    setReplySubmitting(questionId);
    try {
      const answer: QAAnswer = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        userId: user.uid,
        userName: user.displayName || 'Anonymous',
        text,
        isOwner: user.uid === business.ownerId,
        createdAt: Timestamp.now(),
      };
      await updateDoc(doc(db, 'businesses', business.id, 'questions', questionId), {
        answers: arrayUnion({
          id: answer.id,
          userId: answer.userId,
          userName: answer.userName,
          text: answer.text,
          isOwner: answer.isOwner,
          createdAt: answer.createdAt,
        }),
      });
      // Optimistic update
      setQuestions((prev) => prev.map((q) =>
        q.id === questionId ? { ...q, answers: [...q.answers, answer] } : q
      ));
      setReplyText((prev) => ({ ...prev, [questionId]: '' }));
    } catch (err) {
      console.error('Error posting answer:', err);
    } finally {
      setReplySubmitting(null);
    }
  }, [user, replyText, replySubmitting, business.id, business.ownerId]);

  if (loading) {
    return (
      <div className="py-6 flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-aurora-indigo/30 border-t-aurora-indigo rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-indigo-500" />
          <h4 className="text-xs font-semibold text-aurora-text-muted uppercase tracking-wider">
            Questions & Answers
          </h4>
        </div>
        {questions.length > 0 && (
          <span className="text-xs text-aurora-text-secondary">
            {debouncedSearch.trim() && filteredQuestions.length !== questions.length
              ? filteredQuestions.length + ' of ' + questions.length
              : questions.length
            } question{(debouncedSearch.trim() && filteredQuestions.length !== questions.length ? filteredQuestions.length : questions.length) !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Search bar — shows when 3+ questions exist */}
      {questions.length >= 3 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-aurora-text-muted pointer-events-none" />
          <input
            ref={searchRef}
            type="search"
            inputMode="search"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            value={searchQuery}
            onChange={function (e) { setSearchQuery(e.target.value); }}
            placeholder={'Search ' + questions.length + ' questions...'}
            className="w-full bg-aurora-surface-variant rounded-xl pl-9 pr-8 py-2 text-sm text-aurora-text placeholder:text-aurora-text-muted border border-aurora-border focus:outline-none focus:ring-2 focus:ring-aurora-indigo/30 focus:border-aurora-indigo/50"
            aria-label="Search questions and answers"
          />
          {searchQuery && (
            <button
              onClick={function () { setSearchQuery(''); if (searchRef.current) searchRef.current.focus(); }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-aurora-text-muted hover:text-aurora-text hover:bg-aurora-border/30 transition-colors"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Ask question form */}
      {user && (
        <div className="flex gap-2">
          <input
            type="text"
            value={newQuestion}
            onChange={(e) => setNewQuestion(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAskQuestion()}
            placeholder="Ask a question about this business..."
            className="flex-1 bg-aurora-surface-variant rounded-xl px-3.5 py-2.5 text-sm text-aurora-text placeholder:text-aurora-text-muted border border-aurora-border focus:outline-none focus:ring-2 focus:ring-aurora-indigo/30 focus:border-aurora-indigo/50"
            maxLength={500}
          />
          <button
            onClick={handleAskQuestion}
            disabled={!newQuestion.trim() || submitting}
            className="px-3.5 py-2.5 bg-aurora-indigo text-white rounded-xl text-sm font-medium hover:bg-aurora-indigo/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
            aria-label="Post question"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Questions list */}
      {questions.length > 0 && filteredQuestions.length === 0 && debouncedSearch.trim() ? (
        <div className="text-center py-5">
          <Search className="w-8 h-8 text-aurora-text-muted/40 mx-auto mb-2" />
          <p className="text-sm text-aurora-text-secondary">No questions match "{debouncedSearch.trim()}"</p>
          <button
            onClick={function () { setSearchQuery(''); }}
            className="text-xs text-aurora-indigo font-medium mt-1 hover:underline"
          >
            Clear search
          </button>
        </div>
      ) : filteredQuestions.length > 0 ? (
        <div className="space-y-2.5">
          {filteredQuestions.map((q) => {
            const isExpanded = expandedQ === q.id;
            return (
              <div key={q.id} className="bg-aurora-surface-variant rounded-xl overflow-hidden">
                {/* Question */}
                <button
                  onClick={() => setExpandedQ(isExpanded ? null : q.id)}
                  className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-aurora-border/20 transition-colors"
                >
                  <div className="w-7 h-7 rounded-full bg-aurora-indigo/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <User className="w-3.5 h-3.5 text-aurora-indigo" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-aurora-text leading-relaxed">{q.text}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[11px] text-aurora-text-muted">{q.userName}</span>
                      <span className="text-[11px] text-aurora-text-muted">·</span>
                      <span className="text-[11px] text-aurora-text-muted">{timeAgo(q.createdAt)}</span>
                      {q.answers.length > 0 && (
                        <>
                          <span className="text-[11px] text-aurora-text-muted">·</span>
                          <span className="text-[11px] font-medium text-aurora-indigo">
                            {q.answers.length} answer{q.answers.length !== 1 ? 's' : ''}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-aurora-text-muted flex-shrink-0 mt-1" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-aurora-text-muted flex-shrink-0 mt-1" />
                  )}
                </button>

                {/* Answers (expanded) */}
                {isExpanded && (
                  <div className="px-4 pb-3 space-y-2.5 border-t border-aurora-border/50">
                    {q.answers.length > 0 ? (
                      q.answers.map((a) => (
                        <div key={a.id} className="flex items-start gap-2.5 pt-2.5">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${a.isOwner ? 'bg-emerald-100 dark:bg-emerald-500/20' : 'bg-aurora-surface'}`}>
                            {a.isOwner ? (
                              <Shield className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                            ) : (
                              <User className="w-3 h-3 text-aurora-text-muted" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-semibold text-aurora-text">{a.userName}</span>
                              {a.isOwner && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">
                                  Owner
                                </span>
                              )}
                              <span className="text-[10px] text-aurora-text-muted">{timeAgo(a.createdAt)}</span>
                            </div>
                            <p className="text-sm text-aurora-text-secondary leading-relaxed mt-0.5">{a.text}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-aurora-text-muted pt-2.5 italic">No answers yet</p>
                    )}

                    {/* Reply form */}
                    {user && (
                      <div className="flex gap-2 pt-1.5">
                        <input
                          type="text"
                          value={replyText[q.id] || ''}
                          onChange={(e) => setReplyText((prev) => ({ ...prev, [q.id]: e.target.value }))}
                          onKeyDown={(e) => e.key === 'Enter' && handleAnswer(q.id)}
                          placeholder={isOwnerOrAdmin ? 'Reply as owner...' : 'Add an answer...'}
                          className="flex-1 bg-aurora-surface rounded-lg px-3 py-2 text-xs text-aurora-text placeholder:text-aurora-text-muted border border-aurora-border focus:outline-none focus:ring-2 focus:ring-aurora-indigo/30"
                          maxLength={500}
                        />
                        <button
                          onClick={() => handleAnswer(q.id)}
                          disabled={!replyText[q.id]?.trim() || replySubmitting === q.id}
                          className="px-2.5 py-2 bg-aurora-indigo text-white rounded-lg text-xs font-medium hover:bg-aurora-indigo/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Send className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-6">
          <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center mx-auto mb-3">
            <MessageCircle className="w-6 h-6 text-indigo-400" />
          </div>
          <p className="text-sm font-medium text-aurora-text mb-1">No questions yet</p>
          <p className="text-xs text-aurora-text-muted">
            {user ? 'Be the first to ask a question about this business' : 'Sign in to ask a question'}
          </p>
        </div>
      )}
    </div>
  );
};

export default BusinessQASection;
