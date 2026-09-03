'use client';

import { useState, useEffect } from 'react';
import { CheckCheck, MapPin, Link2, MessageCircle, Send, UserPlus, X, Loader2, CheckCircle2 } from 'lucide-react';
import type { Conversation, Message, CustomerType } from '@/lib/types';

const customerTypeBadge: Record<string, string> = {
  retail: 'bg-emerald-100 text-emerald-700',
  shop: 'bg-blue-100 text-blue-700',
  restaurant: 'bg-amber-100 text-amber-700',
};

const statusDot: Record<string, string> = {
  active: 'bg-[#25D366]',
  completed: 'bg-gray-400',
  waiting: 'bg-amber-400',
};

interface WhatsAppChatProps {
  conversations: Conversation[];
  onViewMenu: () => void;
  onRefresh: () => void | Promise<void>;
}

export default function WhatsAppChat({ conversations, onViewMenu, onRefresh }: WhatsAppChatProps) {
  const [selectedId, setSelectedId] = useState<string>(conversations[0]?.id ?? '');
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    if (!selectedId && conversations[0]) setSelectedId(conversations[0].id);
  }, [conversations, selectedId]);

  const selected = conversations.find(c => c.id === selectedId) ?? conversations[0];

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm" style={{ height: 600 }}>
      <div className="flex h-full">
        <div className="w-64 shrink-0 border-r border-gray-100 flex flex-col">
          <div className="px-4 py-3 border-b border-gray-100 bg-[#075E54] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-white" />
              <span className="font-semibold text-white text-sm">WhatsApp Inbox</span>
            </div>
            <button
              onClick={() => setShowNew(true)}
              title="New conversation"
              className="text-white/90 hover:text-white transition-colors"
            >
              <UserPlus className="w-4 h-4" />
            </button>
          </div>
          <div className="overflow-y-auto flex-1">
            {conversations.length === 0 && (
              <div className="px-4 py-8 text-center text-gray-400 text-xs">
                No conversations yet. Start one with the + icon above.
              </div>
            )}
            {conversations.map(conv => (
              <button
                key={conv.id}
                onClick={() => setSelectedId(conv.id)}
                className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${selectedId === conv.id ? 'bg-emerald-50 border-l-2 border-l-emerald-500' : ''}`}
              >
                <div className="flex items-start gap-2.5">
                  <div className="relative shrink-0 mt-0.5">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white text-sm font-bold">
                      {conv.customer_name[0]}
                    </div>
                    <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${statusDot[conv.status]}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between items-center">
                      <p className="text-xs font-semibold text-gray-900 truncate">{conv.customer_name}</p>
                      <span className="text-xs text-gray-400 shrink-0 ml-1">{conv.last_activity}</span>
                    </div>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${customerTypeBadge[conv.customer_type]}`}>
                      {conv.customer_type}
                    </span>
                    {conv.order_id && (
                      <p className="text-xs text-gray-400 mt-0.5">{conv.order_id}</p>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 flex flex-col min-w-0">
          {selected ? (
            <ChatPanel key={selected.id} selected={selected} onViewMenu={onViewMenu} onRefresh={onRefresh} />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-2">
              <MessageCircle className="w-10 h-10 opacity-40" />
              <p className="text-sm">Select or start a conversation</p>
              <button
                onClick={() => setShowNew(true)}
                className="mt-2 flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
              >
                <UserPlus className="w-4 h-4" /> New Conversation
              </button>
            </div>
          )}
        </div>
      </div>

      {showNew && (
        <NewConversationModal
          onClose={() => setShowNew(false)}
          onCreated={async (id) => {
            setShowNew(false);
            await onRefresh();
            setSelectedId(id);
          }}
        />
      )}
    </div>
  );
}

function ChatPanel({ selected, onViewMenu, onRefresh }: { selected: Conversation; onViewMenu: () => void; onRefresh: () => void | Promise<void> }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [orderId, setOrderId] = useState(selected.order_id ?? '');
  const [confirming, setConfirming] = useState(false);
  const [confirmMsg, setConfirmMsg] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const sendMessage = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/conversations/${selected.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim() }),
      });
      if (res.ok) {
        setText('');
        await onRefresh();
      }
    } finally {
      setSending(false);
    }
  };

  const confirmOrder = async () => {
    if (!orderId.trim() || confirming) return;
    setConfirming(true);
    setConfirmMsg(null);
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderId.trim())}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: selected.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setConfirmMsg(data.error ?? 'Failed to confirm order');
      } else {
        setConfirmMsg(`Order ${orderId.trim()} confirmed and sent to ${selected.customer_name}.`);
        await onRefresh();
      }
    } catch {
      setConfirmMsg('Something went wrong');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <>
      <div className="px-4 py-3 bg-[#075E54] flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-300 to-emerald-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
          {selected.customer_name[0]}
        </div>
        <div className="min-w-0">
          <p className="text-white font-semibold text-sm truncate">{selected.customer_name}</p>
          <p className="text-emerald-200 text-xs">{selected.phone}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setShowConfirm(v => !v)}
            className="text-xs px-2.5 py-1 rounded-full font-medium bg-white/15 text-white hover:bg-white/25 transition-colors flex items-center gap-1"
          >
            <CheckCircle2 className="w-3.5 h-3.5" /> Confirm order
          </button>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium text-white ${
            selected.status === 'active' ? 'bg-[#25D366]' : selected.status === 'waiting' ? 'bg-amber-500' : 'bg-white/20'
          }`}>
            {selected.status}
          </span>
        </div>
      </div>

      {showConfirm && (
        <div className="px-4 py-3 bg-emerald-50 border-b border-emerald-100 space-y-2">
          <div className="flex items-center gap-2">
            <input
              value={orderId}
              onChange={e => setOrderId(e.target.value)}
              placeholder="Order ID e.g. ORD-123456"
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              onClick={confirmOrder}
              disabled={confirming || !orderId.trim()}
              className="flex items-center gap-1.5 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              {confirming ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Confirm
            </button>
          </div>
          {confirmMsg && <p className="text-xs text-emerald-700">{confirmMsg}</p>}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-2" style={{ backgroundColor: '#e5ddd5' }}>
        {(selected.messages ?? []).length === 0 && (
          <p className="text-center text-gray-500 text-xs mt-4">No messages yet — say hello 👋</p>
        )}
        {(selected.messages ?? []).map(msg => (
          <MessageBubble key={msg.id} msg={msg} onViewMenu={onViewMenu} />
        ))}
      </div>

      <div className="px-4 py-2.5 bg-[#f0f0f0] border-t border-gray-200 flex items-center gap-2">
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') sendMessage(); }}
          placeholder="Type a message..."
          className="flex-1 bg-white rounded-full px-4 py-2 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-emerald-300"
        />
        <button
          onClick={sendMessage}
          disabled={sending || !text.trim()}
          className="w-9 h-9 rounded-full bg-[#075E54] flex items-center justify-center hover:bg-[#0a7a6c] transition-colors disabled:opacity-50"
        >
          {sending ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : <Send className="w-4 h-4 text-white" />}
        </button>
      </div>
    </>
  );
}

function NewConversationModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [customerType, setCustomerType] = useState<CustomerType>('retail');
  const [message, setMessage] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    if (!name.trim() || !phone.trim()) { setError('Name and phone are required'); return; }
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerName: name.trim(), phone: phone.trim(), customerType, message: message.trim() || undefined }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? `Failed to create conversation (${res.status})`);
      onCreated(data.conversation.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !creating && onClose()} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900 text-lg">New Conversation</h2>
          <button onClick={() => !creating && onClose()} className="text-gray-400 hover:text-gray-700 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Customer Name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Ahmed Hassan"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Phone (WhatsApp)</label>
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+20 100 123 4567"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Customer Type</label>
            <select value={customerType} onChange={e => setCustomerType(e.target.value as CustomerType)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
              <option value="retail">Retail</option>
              <option value="shop">Shop</option>
              <option value="restaurant">Restaurant</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">First Message (optional)</label>
            <textarea value={message} onChange={e => setMessage(e.target.value)} rows={2} placeholder="Hi! How can we help you today?"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            onClick={create}
            disabled={creating}
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            Start Conversation
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ msg, onViewMenu }: { msg: Message; onViewMenu: () => void }) {
  const isBot = msg.sender === 'bot';

  const renderText = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, i) => (
      <span key={i}>
        {line}
        {i < lines.length - 1 && <br />}
      </span>
    ));
  };

  return (
    <div className={`flex ${isBot ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-xs lg:max-w-sm px-3 py-2 rounded-xl shadow-sm text-sm ${
          isBot
            ? 'bg-[#dcf8c6] text-gray-800 rounded-tr-none'
            : 'bg-white text-gray-800 rounded-tl-none'
        }`}
      >
        {msg.type === 'location' && (
          <div className="flex items-center gap-1.5 mb-1 text-blue-600">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span className="text-xs font-medium">Location shared</span>
          </div>
        )}
        <p className="leading-relaxed whitespace-pre-wrap" dir="auto">{renderText(msg.text)}</p>
        {msg.type === 'link' && (
          <button
            onClick={onViewMenu}
            className="mt-2 flex items-center gap-1.5 text-emerald-600 hover:text-emerald-800 text-xs font-medium underline underline-offset-2 transition-colors"
          >
            <Link2 className="w-3.5 h-3.5" />
            View Menu &amp; Products →
          </button>
        )}
        <div className={`flex items-center justify-end gap-1 mt-1 ${isBot ? 'text-gray-500' : 'text-gray-400'}`}>
          <span className="text-xs">{msg.time}</span>
          {isBot && <CheckCheck className="w-3 h-3 text-blue-500" />}
        </div>
      </div>
    </div>
  );
}
