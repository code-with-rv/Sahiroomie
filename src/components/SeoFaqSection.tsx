import React from 'react';
import { CITIES_DATA } from '../data/seedData';
import { cityToSlug, SAHIROOMIE_FAQS } from '../utils/seo';
import { Icon } from './Icon';

interface SeoFaqSectionProps {
  selectedCity: string;
  highlighted?: boolean;
  onSelectCityRoute: (cityName: string) => void;
  onOpenFaqRoute: () => void;
}

export const SeoFaqSection: React.FC<SeoFaqSectionProps> = ({
  selectedCity,
  highlighted = false,
  onSelectCityRoute,
  onOpenFaqRoute,
}) => {
  return (
    <section
      id="sahiroomie-seo-faq"
      aria-label="Verified City Guides and Roommate Safety FAQ"
      className={`mt-8 rounded-2xl border p-4 lg:p-6 space-y-5 ${
        highlighted ? 'ring-2 ring-[#4F46E5]/50' : ''
      }`}
      style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-extrabold">Explore Verified Rooms & PGs by Indian City</h2>
          <a
            href="/faq"
            onClick={(e) => {
              e.preventDefault();
              onOpenFaqRoute();
            }}
            className="text-xs font-bold text-[#4F46E5] hover:underline"
          >
            Permalink: /faq
          </a>
        </div>
        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          Browse zero-brokerage PG beds, shared 2BHK/3BHK rooms, and AI-matched flatmates across major Indian hubs:
        </p>
        <nav aria-label="City Landing Pages" className="flex flex-wrap gap-2 pt-1">
          {CITIES_DATA.map((city) => {
            const href = `/city/${cityToSlug(city.name)}`;
            const isActive = selectedCity === city.name;
            return (
              <a
                key={city.id}
                href={href}
                onClick={(e) => {
                  e.preventDefault();
                  onSelectCityRoute(city.name);
                }}
                className={`px-3.5 py-2 rounded-full text-xs font-bold border transition-colors ${
                  isActive ? 'bg-[#4F46E5] text-white border-[#4F46E5]' : ''
                }`}
                style={
                  !isActive
                    ? { backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text-primary)' }
                    : {}
                }
              >
                Rooms & PGs in {city.name}
              </a>
            );
          })}
        </nav>
      </div>

      <div className="border-t pt-4 space-y-3" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2">
          <Icon name="shield" size={16} className="text-[#059669]" />
          <h2 className="text-base font-extrabold">Roommate & PG Safety FAQ</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {SAHIROOMIE_FAQS.map((faq) => (
            <article
              key={faq.question}
              className="p-3.5 rounded-xl border space-y-1.5"
              style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}
            >
              <h3 className="text-xs font-extrabold leading-snug">{faq.question}</h3>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                {faq.answer}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};
