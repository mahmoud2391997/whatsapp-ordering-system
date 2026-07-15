'use client';

import { useState } from 'react';
import { CheckCheck, MapPin, Link2, MessageCircle } from 'lucide-react';
import type { Conversation, Message } from '@/lib/types';

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
}

export default function WhatsAppChat({ conversations, onViewMenu }: WhatsAppChatProps) {
  const [selectedId, setSelectedId] = useState<string>(conversations[0]?.id ?? '');
  const selected = conversations.find(c => c.id === selectedId) ?? conversations[0];

  if (!selected) return null;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm" style={{ height: 600 }}>
      <div className="flex h-full">
        <div className="w-64 shrink-0 border-r border-gray-100 flex flex-col">
          <div className="px-4 py-3 border-b border-gray-100 bg-[#075E54]">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-white" />
              <span className="font-semibold text-white text-sm">WhatsApp Inbox</span>
            </div>
          </div>
          <div className="overflow-y-auto flex-1">
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
          <div className="px-4 py-3 bg-[#075E54] flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-300 to-emerald-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
              {selected.customer_name[0]}
            </div>
            <div className="min-w-0">
              <p className="text-white font-semibold text-sm truncate">{selected.customer_name}</p>
              <p className="text-emerald-200 text-xs">{selected.phone}</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium text-white ${
                selected.status === 'active' ? 'bg-[#25D366]' : selected.status === 'waiting' ? 'bg-amber-500' : 'bg-white/20'
              }`}>
                {selected.status}
              </span>
              {selected.order_id && (
                <span className="text-xs text-emerald-200 bg-white/10 px-2 py-0.5 rounded-full">{selected.order_id}</span>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2" style={{ backgroundColor: '#e5ddd5' }}>
            {(selected.messages ?? []).map(msg => (
              <MessageBubble key={msg.id} msg={msg} onViewMenu={onViewMenu} />
            ))}
          </div>

          <div className="px-4 py-2.5 bg-[#f0f0f0] border-t border-gray-200 flex items-center gap-2">
            <div className="flex-1 bg-white rounded-full px-4 py-2 text-sm text-gray-400">
              Type a message...
            </div>
            <div className="w-9 h-9 rounded-full bg-[#075E54] flex items-center justify-center">
              <MessageCircle className="w-4 h-4 text-white" />
            </div>
          </div>
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
    <div className={`flex ${isBot ? 'justify-start' : 'justify-end'}`}>
      <div
        className={`max-w-xs lg:max-w-sm px-3 py-2 rounded-xl shadow-sm text-sm ${
          isBot
            ? 'bg-white text-gray-800 rounded-tl-none'
            : 'bg-[#dcf8c6] text-gray-800 rounded-tr-none'
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
        <div className={`flex items-center justify-end gap-1 mt-1 ${isBot ? 'text-gray-400' : 'text-gray-500'}`}>
          <span className="text-xs">{msg.time}</span>
          {!isBot && <CheckCheck className="w-3 h-3 text-blue-500" />}
        </div>
      </div>
    </div>
  );
}
