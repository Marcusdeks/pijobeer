/**
 * Tests de las cabeceras de seguridad (helmet).
 */
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { buildTestApp } from './helpers/test-app';

describe('cabeceras de seguridad', () => {
  it('la CSP deja reproducir audio blob: (la canción del jugador), pero no scripts blob:', async () => {
    const res = await request(buildTestApp().app).get('/api/health');
    const csp = res.headers['content-security-policy'] as string;
    expect(csp).toContain("media-src 'self' blob:");
    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toMatch(/script-src[^;]*blob:/);
  });
});
