import { describe, expect, it, vi } from 'vitest';
import {
  AUTH_EXPIRED_EVENT,
  ApiError,
  api,
  buildQuery,
  loadAuth,
  request,
  saveAuth,
} from '../api.js';
import { fakeJwt, jsonResponse } from '../test/helpers.jsx';

describe('api helper', () => {
  it('T-API-H1: adds the Bearer token when logged in', async () => {
    saveAuth({ token: 'abc123', user: { id: 1, role: 'Adopter' } });
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => jsonResponse(200, []));

    await request('/animals');

    expect(spy.mock.calls[0][1].headers.Authorization).toBe('Bearer abc123');
  });

  it('T-API-H2: sends no Authorization header when logged out', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => jsonResponse(200, []));
    await request('/animals');
    expect(spy.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  it('T-API-H3: throws ApiError with the status and server message', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      jsonResponse(404, { error: 'Animal not found' }),
    );
    await expect(request('/animals/999')).rejects.toMatchObject({
      name: 'ApiError',
      status: 404,
      message: 'Animal not found',
    });
  });

  it('T-API-H4: buildQuery skips empty filters', () => {
    expect(buildQuery({ species: 'Dog', breed: '', status: undefined })).toBe('?species=Dog');
    expect(buildQuery({ breed: '  lab  ' })).toBe('?breed=lab');
    expect(buildQuery({})).toBe('');
    expect(new ApiError(400, 'x')).toBeInstanceOf(Error);
  });

  it('T-API-H5: a 401 on an authenticated call logs the user out everywhere', async () => {
    saveAuth({ token: 'old', user: { id: 1, role: 'Adopter' } });
    const listener = vi.fn();
    window.addEventListener(AUTH_EXPIRED_EVENT, listener);
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => jsonResponse(401, { error: 'jwt expired' }));

    await expect(request('/applications/mine')).rejects.toMatchObject({ status: 401 });

    expect(loadAuth()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener(AUTH_EXPIRED_EVENT, listener);
  });

  it('T-API-H6: login never sends an old token', async () => {
    saveAuth({ token: 'stale', user: { id: 1, role: 'Adopter' } });
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      jsonResponse(200, { token: 'new', user: { id: 1, role: 'adopter' } }),
    );

    const result = await api.login('a@b.co', 'pw');

    expect(spy.mock.calls[0][1].headers.Authorization).toBeUndefined();
    expect(result.user.role).toBe('Adopter'); // normalized casing
  });

  it('T-API-H7: network failure gives a readable message with status 0', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.reject(new TypeError('Failed to fetch')));
    await expect(request('/animals')).rejects.toMatchObject({ status: 0, message: expect.stringContaining('Cannot reach the server') });
  });

  it('T-API-H8: a hung request times out with status 408', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      (_url, opts) =>
        new Promise((_resolve, reject) => {
          opts.signal.addEventListener('abort', () =>
            reject(Object.assign(new Error('aborted'), { name: 'AbortError' })),
          );
        }),
    );
    await expect(request('/animals', { timeout: 20 })).rejects.toMatchObject({ status: 408 });
  });

  it('T-API-H9: an expired JWT in storage is treated as logged out', () => {
    saveAuth({ token: fakeJwt({ exp: Math.floor(Date.now() / 1000) - 60 }), user: { role: 'Adopter' } });
    expect(loadAuth()).toBeNull();
    saveAuth({ token: fakeJwt({ exp: Math.floor(Date.now() / 1000) + 3600 }), user: { role: 'Adopter' } });
    expect(loadAuth()).not.toBeNull();
  });

  it('T-API-H10: validation error arrays become one message', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      jsonResponse(400, { errors: [{ msg: 'Name is required.' }, { msg: 'Species is required.' }] }),
    );
    await expect(request('/animals', { method: 'POST', body: {} })).rejects.toMatchObject({
      message: 'Name is required. Species is required.',
    });
  });
});
