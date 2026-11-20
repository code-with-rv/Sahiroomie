import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PG_PHOTOS, TRANSLATIONS } from '../data/seedData';
import type { ChatThread, Language, Listing } from '../types/sahiroomie';
import { formatCompactINR, hasScamKeyword } from '../utils/compatibility';
import { Icon } from './Icon';

interface ChatsScreenProps {
  chats: ChatThread[];
  listings: Listing[];
  activeChatId: string | null;
  onSelectChat: (id: string | null) => void;
  onSendMessage: (chatId: string, text: string, fromPeer?: boolean, isViewing?: boolean) => void;
  onScheduleVisit: (chatId: string, slot: string) => void;
  onReportUser: (name: string) => void;
  blockedNames: string[];
  onToggleBlock: (name: string) => void;
  onBrowseStays?: () => void;
  lang: Language;
}

export const ChatsScreen: React.FC<ChatsScreenProps> = ({
  chats,
  listings,
  activeChatId,
  onSelectChat,
  onSendMessage,
  onScheduleVisit,
  onReportUser,
  blockedNames,
  onToggleBlock,
  onBrowseStays,
  lang,
}) => {
  const t = TRANSLATIONS[lang];
  const [draft, setDraft] = useState('');
  const [typingChatId, setTypingChatId] = useState<string | null>(null);
  const [showVisitModal, setShowVisitModal] = useState(false);
  const [visitDate, setVisitDate] = useState('Tomorrow, 6:00 PM');
  const replyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeChatRef = useRef<string | null>(activeChatId);

  useEffect(() => {
    activeChatRef.current = activeChatId;
  }, [activeChatId]);

  useEffect(() => {
    return () => {
      if (replyTimeoutRef.current) clearTimeout(replyTimeoutRef.current);
    };
  }, []);

  const activeChat = chats.find((c) => c.id === activeChatId);
  const linkedListing = activeChat ? listings.find((l) => l.id === activeChat.listingId) : null;

  const showScamBanner = useMemo(() => {
    if (!activeChat) return false;
    if (hasScamKeyword(draft)) return true;
    return activeChat.messages.some((m) => hasScamKeyword(m.text));
  }, [activeChat, draft]);

  const handleSend = (textToSend?: string) => {
    const msg = (textToSend ?? draft).trim();
    if (!msg || !activeChat) return;
    const targetChatId = activeChat.id;
    onSendMessage(targetChatId, msg, false, true);
    setDraft('');
    setTypingChatId(targetChatId);

    if (replyTimeoutRef.current) clearTimeout(replyTimeoutRef.current);
    replyTimeoutRef.current = setTimeout(() => {
      setTypingChatId((curr) => (curr === targetChatId ? null : curr));
      const stillViewing = activeChatRef.current === targetChatId;
      onSendMessage(
        targetChatId,
        'Got it! Let’s coordinate a quick visit so you can check the room in person.',
        true,
        stillViewing
      );
    }, 950);
  };

  if (activeChat) {
    const isBlocked = blockedNames.includes(activeChat.peerName);
    return (
      <div className="flex-1 flex flex-col h-full animate-fade-in" style={{ backgroundColor: 'var(--bg)' }}>
        <div className="px-3.5 py-2.5 border-b flex items-center justify-between gap-2" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => onSelectChat(null)}
              className="w-11 h-11 rounded-full flex items-center justify-center border shrink-0"
              style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
              aria-label="Back to chats"
            >
              <Icon name="chevronLeft" size={18} />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-sm truncate">{activeChat.peerName}</span>
                {activeChat.isRoomManager && (
                  <span className="text-[11px] font-bold text-[#4F46E5] shrink-0">· {t.roomManager}</span>
                )}
              </div>
              <div className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
                {activeChat.online ? 'Online' : 'Last seen recently'}
                {linkedListing ? ` · ${linkedListing.area}` : ''}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onReportUser(activeChat.peerName)}
            className="px-3 py-2 rounded-full text-[11px] font-bold text-[#DC2626] border shrink-0 whitespace-nowrap"
            style={{ borderColor: 'var(--border)' }}
          >
            {t.blockReport}
          </button>
        </div>

        <div className="px-3 py-2 border-b flex items-center gap-2 overflow-x-auto no-scrollbar" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
          <button
            type="button"
            onClick={() => setShowVisitModal(true)}
            className="px-3.5 py-2 rounded-full text-xs font-bold bg-[#0F172A] text-white dark:bg-[#4F46E5] flex items-center gap-1.5 whitespace-nowrap"
          >
            <Icon name="calendar" size={13} /> {t.scheduleVisit}
          </button>
          <button
            type="button"
            onClick={() =>
              handleSend('Shared approximate 1 km meetup pin near ' + (linkedListing?.landmark || 'Metro Station'))
            }
            className="px-3.5 py-2 rounded-full text-xs font-bold border flex items-center gap-1.5 whitespace-nowrap"
            style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}
          >
            <Icon name="pin" size={13} /> {t.shareLocation}
          </button>
          <button
            type="button"
            onClick={() => onToggleBlock(activeChat.peerName)}
            className="px-3.5 py-2 rounded-full text-xs font-bold border whitespace-nowrap"
            style={{
              backgroundColor: 'var(--bg)',
              borderColor: 'var(--border)',
              color: isBlocked ? '#059669' : '#DC2626',
            }}
          >
            {isBlocked ? 'Unblock' : 'Block'}
          </button>
        </div>

        {showScamBanner && (
          <div className="mx-3 mt-2.5 p-3 rounded-2xl bg-[#DC2626]/12 border border-[#DC2626]/30 text-[#DC2626] text-xs font-bold flex items-start gap-2">
            <Icon name="alertTriangle" size={16} className="shrink-0 mt-0.5" />
            <span>{t.scamWarning}</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-3.5 space-y-3 no-scrollbar">
          <div className="text-center">
            <span className="text-[11px] font-bold" style={{ color: 'var(--text-muted)' }}>
              {t.today}
            </span>
          </div>

          {activeChat.messages.map((m) => (
            <div key={m.id} className={`flex flex-col ${m.sender === 'me' ? 'items-end' : 'items-start'}`}>
              <div
                className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed ${
                  m.sender === 'me' ? 'bg-[#4F46E5] text-white rounded-br-sm' : 'border rounded-bl-sm'
                }`}
                style={m.sender !== 'me' ? { backgroundColor: 'var(--surface)', borderColor: 'var(--border)' } : {}}
              >
                {m.text}
              </div>
              <span className="text-[10px] mt-1 px-1" style={{ color: 'var(--text-muted)' }}>
                {m.time} {m.sender === 'me' ? (m.read ? '✓✓' : '✓') : ''}
              </span>
            </div>
          ))}

          {typingChatId === activeChat.id && (
            <div
              className="inline-flex items-center gap-1 px-3 py-2 rounded-2xl border text-xs"
              style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}
            >
              {activeChat.peerName} is typing...
            </div>
          )}
        </div>

        <div className="p-3 border-t space-y-2" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}>
          {!isBlocked ? (
            <>
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
                {[t.quickReply1, t.quickReply2, t.quickReply3].map((qr) => (
                  <button
                    key={qr}
                    type="button"
                    onClick={() => handleSend(qr)}
                    className="px-3 py-1.5 rounded-full text-[11px] font-semibold border whitespace-nowrap"
                    style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
                  >
                    {qr}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Write a message..."
                  aria-label="Message input"
                  className="flex-1 h-11 px-4 rounded-full border text-xs font-medium outline-none"
                  style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                />
                <button
                  type="button"
                  onClick={() => handleSend()}
                  className="w-11 h-11 rounded-full bg-[#4F46E5] text-white flex items-center justify-center shrink-0"
                  aria-label="Send message"
                >
                  <Icon name="send" size={17} />
                </button>
              </div>
            </>
          ) : (
            <div className="text-center text-xs font-bold py-2 text-[#DC2626]">
              You blocked {activeChat.peerName}. Unblock above to message.
            </div>
          )}
        </div>

        {showVisitModal && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center p-3">
            <div className="w-full max-w-md p-4 rounded-2xl space-y-3 modal-slide-up" style={{ backgroundColor: 'var(--bg)' }}>
              <div className="flex items-center justify-between">
                <h3 className="text-base font-extrabold">{t.scheduleVisit}</h3>
                <button type="button" onClick={() => setShowVisitModal(false)} aria-label="Close visit scheduler" className="w-10 h-10 flex items-center justify-center">
                  <Icon name="close" />
                </button>
              </div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Pick a time to visit in person. Exact address unlocks once both sides confirm.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {['Today, 6:30 PM', 'Tomorrow, 11:00 AM', 'Tomorrow, 6:00 PM', 'Sunday, 12:00 PM'].map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => setVisitDate(slot)}
                    className={`p-2.5 rounded-xl border text-xs font-bold ${
                      visitDate === slot ? 'border-[#4F46E5] bg-[#4F46E5]/12 text-[#4F46E5]' : ''
                    }`}
                    style={visitDate !== slot ? { borderColor: 'var(--border)' } : {}}
                  >
                    {slot}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowVisitModal(false);
                  onScheduleVisit(activeChat.id, visitDate);
                }}
                className="w-full h-11 rounded-full bg-[#4F46E5] text-white text-xs font-bold"
              >
                Confirm Visit Request
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ backgroundColor: 'var(--bg)' }}>
      <div className="px-4 pt-4 pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
        <h1 className="text-xl font-extrabold">{t.navChats}</h1>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
          Direct conversations with verified hosts & roommates
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2 pb-24 no-scrollbar">
        {chats.length === 0 && (
          <div
            className="p-6 rounded-2xl border text-center space-y-3 my-6 max-w-md mx-auto"
            style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <div className="w-12 h-12 rounded-full bg-[#4F46E5]/15 text-[#4F46E5] flex items-center justify-center mx-auto">
              <Icon name="chat" size={22} />
            </div>
            <h2 className="text-base font-extrabold">No messages yet</h2>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              Your inbox starts clean with zero spam. Send an inquiry on any verified room or PG stay to start chatting directly with the flatmate or host.
            </p>
            {onBrowseStays && (
              <button
                type="button"
                onClick={onBrowseStays}
                className="px-5 h-11 rounded-full bg-[#4F46E5] text-white text-xs font-bold"
              >
                Browse Verified Stays
              </button>
            )}
          </div>
        )}
        {chats.map((c) => {
          const lst = listings.find((l) => l.id === c.listingId);
          const lastMsg = c.messages[c.messages.length - 1];
          const isBlocked = blockedNames.includes(c.peerName);
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelectChat(c.id)}
              className="w-full p-3 rounded-2xl border flex items-center gap-3 text-left transition-transform active:scale-[0.99]"
              style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <div className="relative w-14 h-14 rounded-2xl overflow-hidden shrink-0 pg-photo-fallback">
                <img
                  src={lst?.photos?.[0] || PG_PHOTOS.sunlitBedroom}
                  alt={c.peerName}
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-extrabold text-sm truncate">{c.peerName}</span>
                    {c.isRoomManager && (
                      <span className="text-[11px] font-bold text-[#4F46E5] shrink-0">· {t.roomManager}</span>
                    )}
                    {isBlocked && (
                      <span className="text-[11px] font-bold text-[#DC2626] shrink-0">· Blocked</span>
                    )}
                  </div>
                  <span className="text-[10px] shrink-0" style={{ color: 'var(--text-muted)' }}>{lastMsg?.time}</span>
                </div>
                <div className="text-[11px] font-semibold truncate text-[#4F46E5]">
                  {lst ? `${lst.area} · ${formatCompactINR(lst.rent)}/mo` : 'Direct Inquiry'}
                </div>
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{lastMsg?.text}</p>
                  {c.unread > 0 && (
                    <span className="w-5 h-5 rounded-full bg-[#4F46E5] text-white text-[10px] font-extrabold flex items-center justify-center shrink-0">
                      {c.unread}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
