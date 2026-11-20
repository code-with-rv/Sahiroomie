import assert from 'node:assert/strict';
import test from 'node:test';
import { INITIAL_LISTINGS } from '../data/seedData';
import { MAP_TILE_URLS, buildMapMarkers } from './mapClustering';

test('buildMapMarkers groups multi-listing cities into clusters at national zoom (<= 7)', () => {
  const markers = buildMapMarkers(INITIAL_LISTINGS, 5);
  const bengaluruCluster = markers.find(
    (m) => m.kind === 'cluster' && m.city === 'Bengaluru'
  );
  assert.ok(bengaluruCluster && bengaluruCluster.kind === 'cluster');
  assert.ok(bengaluruCluster.count >= 2);
  assert.ok(bengaluruCluster.minRent > 0);
  // Ensure total represented listings across singles + clusters equals valid listings
  const represented = markers.reduce(
    (sum, m) => sum + (m.kind === 'cluster' ? m.count : 1),
    0
  );
  assert.equal(represented, INITIAL_LISTINGS.length);
});

test('buildMapMarkers expands all individual listing pins at city/neighborhood zoom (> 7)', () => {
  const markers = buildMapMarkers(INITIAL_LISTINGS, 12);
  assert.equal(markers.length, INITIAL_LISTINGS.length);
  assert.ok(markers.every((m) => m.kind === 'single'));
});

test('keyless map tile URLs do not reference CARTO API-key-gated basemaps', () => {
  for (const url of Object.values(MAP_TILE_URLS)) {
    assert.equal(url.includes('cartocdn.com'), false);
    assert.equal(url.startsWith('https://'), true);
  }
});
