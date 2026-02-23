/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Mail, 
  RefreshCw, 
  Copy, 
  Trash2, 
  Inbox, 
  ShieldCheck, 
  Clock, 
  ChevronRight,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Types ---

interface Domain {
  id: string;
  domain: string;
  isActive: boolean;
}

interface Account {
  id: string;
  address: string;
  token: string;
}

interface Message {
  id: string;
  from: {
    address: string;
    name: string;
  };
  subject: string;
  intro: string;
  createdAt: string;
  seen: boolean;
}

interface MessageDetail extends Message {
  text: string;
  html: string[];
}

// --- Constants ---

const API_BASE = '/api/mail';

// --- App Component ---

export default function App() {
  const [account, setAccount] = useState<Account | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<MessageDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchingMessages, setFetchingMessages] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Helpers ---

  const generateRandomString = (length: number) => {
    return Math.random().toString(36).substring(2, 2 + length);
  };

  const safeJson = async (response: Response) => {
    const text = await response.text();
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch (e) {
      console.error('Failed to parse JSON:', text);
      return {};
    }
  };

  const createAccount = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Get domains
      const domainsRes = await fetch(`${API_BASE}/domains`);
      if (!domainsRes.ok) {
        const errorText = await domainsRes.text();
        throw new Error(`Domain fetch failed: ${domainsRes.status} ${errorText}`);
      }
      
      const domainsData = await safeJson(domainsRes);
      
      if (domainsData.error) {
        throw new Error(domainsData.error);
      }

      const members = domainsData['hydra:member'];
      if (!members || members.length === 0) {
        throw new Error('No email domains available at the moment. Please try again later.');
      }
      
      const domain = members[0].domain;

      // 2. Create account
      const username = `${generateRandomString(10)}`;
      const password = generateRandomString(12);
      const address = `${username}@${domain}`;

      const createRes = await fetch(`${API_BASE}/accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, password }),
      });

      if (!createRes.ok) {
        const errorData = await safeJson(createRes);
        throw new Error(errorData.message || errorData.error || 'Failed to create account');
      }
      const accountData = await safeJson(createRes);

      // 3. Get token
      const tokenRes = await fetch(`${API_BASE}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, password }),
      });

      if (!tokenRes.ok) {
        const errorData = await safeJson(tokenRes);
        throw new Error(errorData.message || errorData.error || 'Failed to get token');
      }
      const tokenData = await safeJson(tokenRes);
      const token = tokenData.token;

      if (!token) throw new Error('Token not received from server');

      const newAccount = { id: accountData.id, address, token };
      setAccount(newAccount);
      localStorage.setItem('kas_temp_mail_account', JSON.stringify(newAccount));
      setMessages([]);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMessages = useCallback(async () => {
    if (!account) return;
    setFetchingMessages(true);
    try {
      const res = await fetch(`${API_BASE}/messages`, {
        headers: { Authorization: `Bearer ${account.token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch messages');
      const data = await safeJson(res);
      setMessages(data['hydra:member'] || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setFetchingMessages(false);
    }
  }, [account]);

  const fetchMessageDetail = async (id: string) => {
    if (!account) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/messages/${id}`, {
        headers: { Authorization: `Bearer ${account.token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch message detail');
      const data = await safeJson(res);
      setSelectedMessage(data);
      
      // Mark as seen locally
      setMessages(prev => prev.map(m => m.id === id ? { ...m, seen: true } : m));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteMessage = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!account) return;
    try {
      await fetch(`${API_BASE}/messages/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${account.token}` },
      });
      setMessages(prev => prev.filter(m => m.id !== id));
      if (selectedMessage?.id === id) setSelectedMessage(null);
    } catch (err: any) {
      console.error(err);
    }
  };

  const copyToClipboard = () => {
    if (!account) return;
    navigator.clipboard.writeText(account.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // --- Effects ---

  useEffect(() => {
    const saved = localStorage.getItem('kas_temp_mail_account');
    if (saved) {
      setAccount(JSON.parse(saved));
    } else {
      createAccount();
    }
  }, [createAccount]);

  useEffect(() => {
    if (account) {
      fetchMessages();
      const interval = setInterval(fetchMessages, 10000); // Poll every 10s
      return () => clearInterval(interval);
    }
  }, [account, fetchMessages]);

  // --- Render ---

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1A1A1A] font-sans selection:bg-emerald-100 selection:text-emerald-900">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-black/5">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-emerald-200">
              <Mail size={18} />
            </div>
            <span className="font-bold text-xl tracking-tight">KAS<span className="text-emerald-600">MAIL</span></span>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-500">
              <span className="flex items-center gap-1.5"><ShieldCheck size={14} className="text-emerald-600" /> Secure</span>
              <span className="flex items-center gap-1.5"><Clock size={14} className="text-emerald-600" /> Temporary</span>
            </div>
            <button 
              onClick={createAccount}
              disabled={loading}
              className="px-4 py-2 bg-black text-white rounded-full text-sm font-semibold hover:bg-gray-800 transition-all active:scale-95 disabled:opacity-50"
            >
              New Address
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 md:py-12">
        {/* Email Display Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl p-6 md:p-10 shadow-xl shadow-black/5 border border-black/5 mb-8 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
            <Mail size={200} />
          </div>

          <div className="relative z-10">
            <h2 className="text-sm font-bold uppercase tracking-widest text-emerald-600 mb-4">Your Temporary Email</h2>
            <div className="flex flex-col md:flex-row items-center gap-4">
              <div className="flex-1 w-full relative group">
                <input 
                  type="text" 
                  readOnly 
                  value={account?.address || 'Generating...'} 
                  className="w-full bg-gray-50 border-2 border-transparent group-hover:border-emerald-100 focus:border-emerald-500 rounded-2xl px-6 py-4 text-lg md:text-2xl font-mono font-medium transition-all outline-none"
                />
                <button 
                  onClick={copyToClipboard}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-3 bg-white shadow-sm border border-black/5 rounded-xl hover:bg-emerald-50 hover:text-emerald-600 transition-colors"
                >
                  {copied ? <CheckCircle2 size={20} className="text-emerald-600" /> : <Copy size={20} />}
                </button>
              </div>
              <button 
                onClick={fetchMessages}
                disabled={fetchingMessages}
                className="w-full md:w-auto px-8 py-4 bg-emerald-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all active:scale-95 shadow-lg shadow-emerald-200 disabled:opacity-50"
              >
                <RefreshCw size={20} className={fetchingMessages ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>
            {copied && (
              <motion.p 
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-emerald-600 text-sm font-medium mt-3 flex items-center gap-1"
              >
                <CheckCircle2 size={14} /> Copied to clipboard!
              </motion.p>
            )}
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Inbox List */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center justify-between px-2">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Inbox size={20} className="text-emerald-600" />
                Inbox
                <span className="bg-emerald-100 text-emerald-700 text-xs px-2 py-0.5 rounded-full">
                  {messages.length}
                </span>
              </h3>
              {fetchingMessages && <Loader2 size={16} className="animate-spin text-gray-400" />}
            </div>

            <div className="space-y-3">
              <AnimatePresence mode="popLayout">
                {messages.length === 0 ? (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="bg-white border border-dashed border-gray-200 rounded-2xl p-12 text-center"
                  >
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300">
                      <Inbox size={32} />
                    </div>
                    <p className="text-gray-500 font-medium">Waiting for incoming emails...</p>
                    <p className="text-xs text-gray-400 mt-1">Updates automatically every 10 seconds</p>
                  </motion.div>
                ) : (
                  messages.map((msg) => (
                    <motion.div
                      key={msg.id}
                      layout
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      onClick={() => fetchMessageDetail(msg.id)}
                      className={`group relative bg-white border ${selectedMessage?.id === msg.id ? 'border-emerald-500 ring-1 ring-emerald-500' : 'border-black/5'} rounded-2xl p-4 cursor-pointer hover:shadow-md transition-all`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {!msg.seen && <div className="w-2 h-2 bg-emerald-500 rounded-full shrink-0" />}
                            <span className="text-sm font-bold text-gray-900 truncate">{msg.from.name || msg.from.address}</span>
                          </div>
                          <h4 className="text-sm font-medium text-gray-700 truncate mb-1">{msg.subject || '(No Subject)'}</h4>
                          <p className="text-xs text-gray-400 line-clamp-1">{msg.intro}</p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <span className="text-[10px] font-medium text-gray-400 uppercase">
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <button 
                            onClick={(e) => deleteMessage(msg.id, e)}
                            className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Message Viewer */}
          <div className="lg:col-span-7">
            <AnimatePresence mode="wait">
              {selectedMessage ? (
                <motion.div 
                  key={selectedMessage.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-white border border-black/5 rounded-3xl shadow-sm overflow-hidden min-h-[500px] flex flex-col"
                >
                  <div className="p-6 border-b border-black/5 bg-gray-50/50">
                    <div className="flex justify-between items-start mb-6">
                      <button 
                        onClick={() => setSelectedMessage(null)}
                        className="lg:hidden p-2 -ml-2 text-gray-500 hover:bg-gray-100 rounded-full"
                      >
                        <ChevronRight className="rotate-180" size={20} />
                      </button>
                      <div className="flex gap-2">
                        <button 
                          onClick={(e) => deleteMessage(selectedMessage.id, e as any)}
                          className="p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                    
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">{selectedMessage.subject || '(No Subject)'}</h2>
                    
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-700 font-bold">
                        {selectedMessage.from.name?.[0] || (selectedMessage.from.address?.[0] || '?').toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">{selectedMessage.from.name || 'Unknown'}</p>
                        <p className="text-xs text-gray-500">{selectedMessage.from.address}</p>
                      </div>
                      <div className="ml-auto text-xs text-gray-400 font-medium">
                        {new Date(selectedMessage.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div className="p-6 flex-1 overflow-auto">
                    {selectedMessage.html && selectedMessage.html.length > 0 ? (
                      <div 
                        className="prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: selectedMessage.html[0] }} 
                      />
                    ) : (
                      <div className="whitespace-pre-wrap text-gray-700 font-sans leading-relaxed">
                        {selectedMessage.text}
                      </div>
                    )}
                  </div>
                </motion.div>
              ) : (
                <div className="h-full min-h-[500px] bg-white/50 border border-dashed border-gray-200 rounded-3xl flex flex-col items-center justify-center text-center p-8">
                  <div className="w-20 h-20 bg-white rounded-2xl shadow-sm border border-black/5 flex items-center justify-center mb-6 text-gray-300">
                    <Mail size={40} />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Select an email to read</h3>
                  <p className="text-gray-500 max-w-xs">
                    Click on any message from the inbox on the left to view its full content here.
                  </p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto px-4 py-12 border-t border-black/5 mt-12">
        <div className="flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2 opacity-50 grayscale">
            <div className="w-6 h-6 bg-black rounded flex items-center justify-center text-white">
              <Mail size={14} />
            </div>
            <span className="font-bold text-sm tracking-tight">KASMAIL</span>
          </div>
          <p className="text-xs text-gray-400 font-medium">
            &copy; {new Date().getFullYear()} KAS Temp Mail. All rights reserved. 
            <span className="mx-2">|</span> 
            Protecting your digital identity.
          </p>
          <div className="flex items-center gap-4 text-xs font-bold text-gray-400 uppercase tracking-widest">
            <a href="#" className="hover:text-emerald-600 transition-colors">Privacy</a>
            <a href="#" className="hover:text-emerald-600 transition-colors">Terms</a>
            <a href="https://mail.tm" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-emerald-600 transition-colors">
              API <ExternalLink size={12} />
            </a>
          </div>
        </div>
      </footer>

      {/* Error Toast */}
      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] bg-red-600 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3"
          >
            <AlertCircle size={20} />
            <span className="font-medium">{error}</span>
            <button onClick={() => setError(null)} className="ml-2 hover:opacity-70">
              <Trash2 size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
