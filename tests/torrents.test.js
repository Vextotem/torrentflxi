import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describeRelease, qualityScore, torrentInfoHash } from '../lib/torrents.js';

test('release names are described: quality, source, codec, audio, HDR, languages, subtitles', () => {
  const a = describeRelease('Movie.2024.2160p.WEB-DL.DDP5.1.Atmos.DV.HDR10.H.265-GRP');
  assert.equal(a.quality, '2160p');
  assert.equal(a.source, 'WEB-DL');
  assert.equal(a.codec, 'HEVC');
  assert.ok(a.audio.includes('Atmos') && a.audio.includes('DD+'));
  assert.equal(a.dolbyVision, true);
  assert.equal(a.hdr, true);
  const b = describeRelease('Movie (2024) 1080p BluRay x264 Hindi English DD5.1 ESub');
  assert.equal(b.source, 'BluRay');
  assert.deepEqual(b.languages, ['en', 'hi']);
  assert.equal(b.subtitles, true);
  assert.equal(b.channels, '5.1');
  const c = describeRelease('Movie 2024 HDCAM x264');
  assert.equal(c.cam, true);
  assert.equal(c.source, 'CAM');
  assert.equal(describeRelease('Show.S01E01.720p.HDTV.x264-KILLERS').source, 'HDTV');
  assert.equal(describeRelease('Movie.2024.1080p.WEBRip.x265.10bit.AAC').tenBit, true);
  assert.deepEqual(describeRelease('Movie 2024 1080p WEB-DL TRUEFRENCH').languages, ['fr']);
});

test('score: clean well-seeded sources high, CAM and dead torrents low, always 0-100', () => {
  const good = qualityScore({ quality: '1080p', source: 'BluRay', codec: 'H.264', audio: [], seeders: 500 });
  const cam = qualityScore({ quality: '1080p', source: 'CAM', codec: 'H.264', audio: [], seeders: 500 });
  const dead = qualityScore({ quality: '1080p', source: 'BluRay', codec: 'H.264', audio: [], seeders: 0 });
  assert.ok(good > 80 && good <= 100);
  assert.ok(cam < 50);
  assert.ok(dead < good - 20);
  assert.ok(qualityScore({ quality: null, source: 'CAM', audio: [], seeders: 0, codec: 'XviD' }) >= 0);
});

test('torrentInfoHash reads the SHA-1 of the info dictionary', () => {
  const info = 'd6:lengthi1e4:name1:xe';
  const file = Buffer.from(`d8:announce3:url13:creation datei1e4:info${info}e`);
  assert.equal(torrentInfoHash(file), createHash('sha1').update(info).digest('hex'));
  assert.equal(torrentInfoHash(Buffer.from('not a torrent')), null);
  assert.equal(torrentInfoHash(Buffer.from('d4:infod4:name')), null, 'truncated file');
  assert.equal(torrentInfoHash(null), null);
});
