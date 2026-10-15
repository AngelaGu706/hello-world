import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load } from './load-source.mjs';

const { getReservationLink } = load('utils/reservations.ts');
const pick = (title, area = 'West Village') => ({ title, content: JSON.stringify({ format: 'nyc-food-pick-v1', area, food: 'Brunch', recommendation: 'Try the eggs.' }) });

test('verified restaurant and neighborhood open the correct booking platform', () => {
    const buvette = getReservationLink(pick('Buvette'));
    assert.equal(buvette.label, 'Check reservations');
    assert.equal(buvette.verified, true);
    assert.equal(new URL(buvette.href).pathname, '/cities/new-york-ny/venues/buvette-nyc');
    const joseph = getReservationLink(pick('Joseph Leonard'));
    assert.equal(joseph.verified, true);
    assert.equal(new URL(joseph.href).hostname, 'www.opentable.com');
    assert.equal(new URL(joseph.href).searchParams.get('restref'), '226681');
    const freda = getReservationLink(pick('Jack’s Wife Freda'));
    assert.equal(freda.verified, true);
    assert.match(freda.href, /jacks-wife-freda-west-village$/);
});

test('case, apostrophes and legacy titles are recognized without fuzzy branch matching', () => {
    assert.equal(getReservationLink(pick('Brunch at BUVETTE', 'WEST VILLAGE')).label, 'Check reservations');
    assert.equal(getReservationLink(pick("Jack's Wife Freda")).label, 'Check reservations');
    for (const candidate of [pick('Buvette London'), pick('Buvette', 'London'), pick("Jack's Wife Freda", 'Soho'), pick('Buvette', '')]) {
        assert.equal(getReservationLink(candidate).label, 'Find reservation options');
        assert.equal(getReservationLink(candidate).verified, false);
    }
});

test('unknown restaurant search includes the title, neighborhood and NYC context', () => {
    const link = getReservationLink(pick('Koronet Pizza', 'Morningside Heights'));
    assert.equal(link.label, 'Find reservation options');
    assert.equal(link.verified, false);
    const url = new URL(link.href);
    assert.equal(url.origin, 'https://www.google.com');
    assert.equal(url.searchParams.get('q'), 'Koronet Pizza Morningside Heights NYC restaurant reservations');
});

test('legacy content without a neighborhood remains searchable', () => {
    const link = getReservationLink({ title: 'Pizza at Koronet', content: 'Try a jumbo slice.' });
    assert.equal(link.label, 'Find reservation options');
    assert.match(new URL(link.href).searchParams.get('q'), /Pizza at Koronet NYC restaurant reservations/);
});

test('arbitrary titles cannot become a navigation URL or inject extra query parameters', () => {
    const title = 'javascript:alert(1)&next=https://example.com/#test';
    const url = new URL(getReservationLink(pick(title, 'Queens & Brooklyn')).href);
    assert.equal(url.origin, 'https://www.google.com');
    assert.equal([...url.searchParams.keys()].join(','), 'q');
    assert.equal(url.searchParams.get('q'), `${title} Queens & Brooklyn NYC restaurant reservations`);
});
