'use client';

import { useState, useRef, useEffect } from 'react';
import { Bot, Send, Loader2, RotateCcw, Smartphone } from 'lucide-react';
import type { CustomerType } from '@/lib/types';

interface ChatMsg {
  role: 'customer' | 'bot';
  text: string;
}

const quickPrompts = [
  'مرحبا',
  'أطلب لنفسي',
  '5 كيلو طماطم و 3 كيلو خيار',
  'أريد 10 كيلو بصل و 5 كيلو جزر',
  'نعم أريد التأكيد',
  'الدفع عند الاستلام',
  'موقع: المعادي، القاهرة',
];

export default function MockChat() {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [customerType, setCustomerType] = useState<CustomerType>('retail');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || sending) return;

    const customerMsg: ChatMsg = { role: 'customer', text: msg };
    setMessages(prev => [...prev, customerMsg]);
    setInput('');
    setSending(true);

    try {
      const res = await fetch('/api/chat/mock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          history: messages,
          customerType,
        }),
      });
      const data = await res.json();

      if (data.customerType) setCustomerType(data.customerType);

      setMessages(prev => [...prev, { role: 'bot', text: data.reply }]);
    } catch {
      setMessages(prev => [...prev, { role: 'bot', text: 'حدث خطأ، حاول مرة أخرى.' }]);
    } finally {
      setSending(false);
    }
  };

  const reset = () => {
    setMessages([]);
    setInput('');
    setCustomerType('retail');
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm flex flex-col" style={{ height: 520 }}>
      {/* Header */}
      <div className="px-4 py-3 bg-[#075E54] flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-emerald-400 flex items-center justify-center">
          <Bot className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm">AI Bot (Mock)</p>
          <p className="text-emerald-200 text-xs flex items-center gap-1">
            <Smartphone className="w-3 h-3" />
            Simulates WhatsApp conversation
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={customerType}
            onChange={e => setCustomerType(e.target.value as CustomerType)}
            className="text-xs bg-white/15 text-white px-2 py-1 rounded-lg border-none outline-none cursor-pointer"
          >
            <option value="retail" className="text-gray-900">Retail</option>
            <option value="shop" className="text-gray-900">Shop</option>
            <option value="restaurant" className="text-gray-900">Restaurant</option>
          </select>
          <button onClick={reset} title="Reset conversation" className="text-white/70 hover:text-white transition-colors">
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2" style={{ backgroundColor: '#e5ddd5' }}>
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-2">
            <Bot className="w-10 h-10 opacity-30" />
            <p className="text-xs text-center">Start a conversation to test the AI bot flow.</p>
            <p className="text-[11px] text-gray-400 text-center">Type or tap a quick prompt below.</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'bot' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-xs lg:max-w-sm px-3 py-2 rounded-xl shadow-sm text-sm whitespace-pre-wrap ${
                msg.role === 'bot'
                  ? 'bg-[#dcf8c6] text-gray-800 rounded-tr-none'
                  : 'bg-white text-gray-800 rounded-tl-none'
              }`}
            >
              <p className="leading-relaxed" dir="auto">{msg.text}</p>
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-end">
            <div className="bg-[#dcf8c6] px-3 py-2 rounded-xl rounded-tr-none text-sm flex items-center gap-1.5 text-gray-500">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Bot is typing...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick prompts */}
      {messages.length < 4 && (
        <div className="px-4 py-2 border-t border-gray-100 flex flex-wrap gap-1.5">
          {quickPrompts.slice(0, messages.length === 0 ? 3 : 4).map((p, i) => (
            <button
              key={i}
              onClick={() => sendMessage(p)}
              disabled={sending}
              className="text-[11px] bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full hover:bg-emerald-100 transition-colors disabled:opacity-50"
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="px-4 py-2.5 bg-[#f0f0f0] border-t border-gray-200 flex items-center gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') sendMessage(); }}
          placeholder="Type a message..."
          className="flex-1 bg-white rounded-full px-4 py-2 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-emerald-300"
        />
        <button
          onClick={() => sendMessage()}
          disabled={sending || !input.trim()}
          className="w-9 h-9 rounded-full bg-[#075E54] flex items-center justify-center hover:bg-[#0a7a6c] transition-colors disabled:opacity-50"
        >
          {sending ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : <Send className="w-4 h-4 text-white" />}
        </button>
      </div>
    </div>
  );
}
