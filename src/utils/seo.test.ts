import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRouteSeo,
  buildSitemapXml,
  cityToSlug,
  parseAppUrlPath,
  SAHIROOMIE_FAQS,
} from './seo';
import { INITIAL_LISTINGS } from '../data/seedData';

test('cityToSlug and parseAppUrlPath resolve clean SEO routes without hash', () => {
  assert.equal(cityToSlug('Delhi NCR'), 'delhi-ncr');
  assert.deepEqual(parseAppUrlPath('/city/delhi-ncr'), { tab: 'home', city: 'Delhi NCR' });
  assert.deepEqual(parseAppUrlPath('/stays/lst-101'), { tab: 'home', listingId: 'lst-101' });
  assert.deepEqual(parseAppUrlPath('/faq'), { tab: 'find', showFaq: true });
});

test('buildRouteSeo outputs valid Apartment JSON-LD for listing pages and FAQPage JSON-LD for home/FAQ', () => {
  const origin = 'https://sahiroomie.in';
  const listingSeo = buildRouteSeo({
    origin,
    pathname: '/stays/lst-101',
    selectedCity: 'Bengaluru',
    activeTab: 'home',
    selectedListing: INITIAL_LISTINGS[0],
    listingsCount: INITIAL_LISTINGS.length,
  });
  assert.equal(listingSeo.canonicalPath, '/stays/lst-101');
  assert.ok(listingSeo.title.length <= 60);
  assert.ok(listingSeo.title.endsWith(' | Sahiroomie'));
  assert.equal(listingSeo.jsonLd[1]['@type'], 'Apartment');
  assert.equal(listingSeo.jsonLd[1].offers.priceCurrency, 'INR');

  const faqSeo = buildRouteSeo({
    origin,
    pathname: '/faq',
    selectedCity: 'Bengaluru',
    activeTab: 'find',
    listingsCount: INITIAL_LISTINGS.length,
    showFaq: true,
  });
  assert.equal(faqSeo.jsonLd[1]['@type'], 'FAQPage');
  assert.equal(faqSeo.jsonLd[1].mainEntity.length, SAHIROOMIE_FAQS.length);
});

test('buildSitemapXml generates valid XML with city and listing URLs', () => {
  const xml = buildSitemapXml('https://sahiroomie.in', ['Bengaluru', 'Mumbai'], ['lst-101']);
  assert.ok(xml.includes('<loc>https://sahiroomie.in/city/bengaluru</loc>'));
  assert.ok(xml.includes('<loc>https://sahiroomie.in/stays/lst-101</loc>'));
  assert.ok(xml.includes('<loc>https://sahiroomie.in/faq</loc>'));
});
