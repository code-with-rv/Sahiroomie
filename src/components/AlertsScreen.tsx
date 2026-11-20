import React, { useState } from 'react';
import { TRANSLATIONS } from '../data/seedData';
import type { AppNotification, Language } from '../types/sahiroomie';
import { Icon } from './Icon';

interface AlertsScreenProps {
  notifications: AppNotification[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onOpenNotification: (n: AppNotification) => void;
  lang: Language;
}

export const AlertsScreen: React.FC<AlertsScreenProps> = ({
  notifications,
  onMarkRead,
  onMarkAllRead,
  onOpenNotification,
  lang,
}) => {
  const t = TRANSLATIONS[lang];
  const [showSettings, setShowSettings] = useState(false);
  const [quietHours, setQuietHours] = useState(true);
  const [prefs, setPrefs] = useState({
    inquiries: true,
    urgentSaved: true,
    savedSearches: true,
    visits: true,
  });

  const groups: Array<'Today' | 'Yesterday' | 'Earlier'> = ['Today', 'Yesterday', 'Earlier'];

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ backgroundColor: 'var(--bg)' }}>
      <div className="px-4 pt-4 pb-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
        <h1 className="text-xl font-extrabold">{t.navAlerts}</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onMarkAllRead}
            className="text-xs font-bold text-[#4F46E5] px-3 py-2"
          >
            {t.markAllRead}
          </button>
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className="w-11 h-11 rounded-full border flex items-center justify-center"
            style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
            aria-label="Notification settings"
          >
            <Icon name="sliders" size={17} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5 pb-24 no-scrollbar">
        {notifications.length === 0 && (
          <div
            className="p-6 rounded-2xl border text-center space-y-2.5 my-6 max-w-md mx-auto"
            style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <div className="w-12 h-12 rounded-full bg-[#4F46E5]/15 text-[#4F46E5] flex items-center justify-center mx-auto">
              <Icon name="bell" size={22} />
            </div>
            <h2 className="text-base font-extrabold">No alerts yet</h2>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              Visit confirmations, urgent room updates, and safety reminders will appear here once you start inquiring.
            </p>
          </div>
        )}
        {groups.map((grp) => {
          const items = notifications.filter((n) => n.group === grp);
          if (!items.length) return null;
          const grpLabel = grp === 'Today' ? t.today : grp === 'Yesterday' ? t.yesterday : t.earlier;
          return (
            <div key={grp} className="space-y-2">
              <h2 className="text-xs font-extrabold tracking-wide" style={{ color: 'var(--text-muted)' }}>
                {grpLabel}
              </h2>
              {items.map((n) => (
                <div
                  key={n.id}
                  className="p-3.5 rounded-2xl border flex items-start gap-3 transition-transform"
                  style={{
                    backgroundColor: n.unread ? 'var(--accent-soft)' : 'var(--surface)',
                    borderColor: n.unread ? 'rgba(79, 70, 229, 0.35)' : 'var(--border)',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => onOpenNotification(n)}
                    className="flex-1 flex items-start gap-3 text-left min-w-0"
                  >
                    <div className="w-10 h-10 rounded-full bg-[#4F46E5]/15 text-[#4F46E5] flex items-center justify-center shrink-0">
                      <Icon
                        name={
                          n.type === 'chat'
                            ? 'chat'
                            : n.type === 'visit'
                              ? 'calendar'
                              : n.type === 'security'
                                ? 'shield'
                                : 'bell'
                        }
                        size={18}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-xs">{n.title}</div>
                      <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                        {n.desc}
                      </p>
                      <span className="text-[10px] mt-1 block" style={{ color: 'var(--text-muted)' }}>
                        {n.time}
                      </span>
                    </div>
                  </button>
                  {n.unread && (
                    <button
                      type="button"
                      onClick={() => onMarkRead(n.id)}
                      className="text-[11px] font-bold text-[#4F46E5] shrink-0 px-2 py-1"
                    >
                      Mark read
                    </button>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {showSettings && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center p-3">
          <div className="w-full max-w-md p-4 rounded-2xl space-y-3 modal-slide-up" style={{ backgroundColor: 'var(--bg)' }}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold">{t.notifSettings}</h3>
              <button type="button" onClick={() => setShowSettings(false)} aria-label="Close notification settings" className="w-10 h-10 flex items-center justify-center">
                <Icon name="close" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => setQuietHours(!quietHours)}
              className="w-full p-3.5 rounded-2xl border flex items-center justify-between"
              style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <span className="text-xs font-bold">{t.quietHours}</span>
              <span className="text-xs font-extrabold text-[#059669]">{quietHours ? 'ON' : 'OFF'}</span>
            </button>
            {(
              [
                { key: 'inquiries', label: 'New inquiries & chat replies' },
                { key: 'urgentSaved', label: 'Saved room fill-urgent alerts' },
                { key: 'savedSearches', label: 'New rooms matching saved search' },
                { key: 'visits', label: 'Visit confirmations & security OTP' },
              ] as const
            ).map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setPrefs((p) => ({ ...p, [item.key]: !p[item.key] }))}
                className="w-full p-3.5 rounded-2xl border flex items-center justify-between"
                style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
              >
                <span className="text-xs font-semibold">{item.label}</span>
                <span className="text-xs font-extrabold text-[#4F46E5]">
                  {prefs[item.key] ? 'Enabled' : 'Muted'}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
