import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseSocialLink, socialPlatform, MAX_SOCIAL_LINKS } from '../src/utils/socialLinks.js';

describe('Buyer social media links', () => {
  it('adds https:// and names the platform', () => {
    assert.deepEqual(parseSocialLink('instagram.com/myshop'), { url: 'https://instagram.com/myshop', platform: 'Instagram' });
    assert.deepEqual(parseSocialLink(' https://www.facebook.com/myshop '), { url: 'https://www.facebook.com/myshop', platform: 'Facebook' });
    assert.equal(parseSocialLink('wa.me/919876543210').platform, 'WhatsApp');
    assert.equal(parseSocialLink('myshop.in').platform, 'Website');
  });

  it('rejects anything that is not a web link', () => {
    for (const bad of ['', 'not a link', 'javascript:alert(1)', 'ftp://files.example.com', 'localhost']) {
      assert.equal(parseSocialLink(bad), null, bad);
    }
  });

  it('matches the server limit and platform names', () => {
    assert.equal(MAX_SOCIAL_LINKS, 10);
    assert.equal(socialPlatform('m.youtube.com'), 'YouTube');
    assert.equal(socialPlatform('x.com'), 'X');
  });
});
