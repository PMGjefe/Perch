import { errorMessage, friendlyError } from '@/lib/errors';

const DEFAULT = 'Something went wrong. Please try again.';
const OFFLINE = 'You appear to be offline. Anything you log is safe on this phone and will reach your account later.';

describe('errorMessage', () => {
  it('reads an Error, a { message } object and a plain value', () => {
    expect(errorMessage(new Error('boom'))).toBe('boom');
    expect(errorMessage({ message: 'from supabase' })).toBe('from supabase');
    expect(errorMessage({ message: 42 })).toBe('42');
    expect(errorMessage('just a string')).toBe('just a string');
    expect(errorMessage(undefined)).toBe('undefined');
    expect(errorMessage(null)).toBe('null');
  });
});

describe('friendlyError', () => {
  let warn: jest.SpyInstance;
  beforeEach(() => {
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => warn.mockRestore());

  it('offline: network failures of every flavour', () => {
    expect(friendlyError(new Error('Network request failed'))).toBe(OFFLINE);
    expect(friendlyError(new Error('TypeError: Failed to fetch'))).toBe(OFFLINE);
    expect(friendlyError(new Error('ECONNREFUSED 127.0.0.1:443'))).toBe(OFFLINE);
    expect(friendlyError(new Error('Device is offline'))).toBe(OFFLINE);
  });

  it('sign in again: expired or missing auth', () => {
    expect(friendlyError(new Error('JWT expired'))).toBe('Please sign in again.');
    expect(friendlyError(new Error('invalid token'))).toBe('Please sign in again.');
    expect(friendlyError({ message: 'Request failed with status 401' })).toBe('Please sign in again.');
    expect(friendlyError(new Error('User not authenticated'))).toBe('Please sign in again.');
  });

  it('no access: row-level security and permission errors', () => {
    expect(friendlyError(new Error('new row violates row-level security policy for table "sightings"'))).toBe('You do not have access to that.');
    expect(friendlyError({ message: 'permission denied for table lists', code: '42501' })).toBe('You do not have access to that.');
    expect(friendlyError(new Error('403 Forbidden'))).toBe('You do not have access to that.');
  });

  it('username taken', () => {
    expect(friendlyError(new Error('duplicate key value violates unique constraint "profiles_username_key"'))).toBe('That username is taken.');
    expect(friendlyError({ message: 'username already in use' })).toBe('That username is taken.');
  });

  it('already exists: duplicates that are not usernames', () => {
    expect(friendlyError(new Error('duplicate key value violates unique constraint "follows_pkey"'))).toBe('That already exists.');
    expect(friendlyError({ code: '23505', message: '23505' })).toBe('That already exists.');
    expect(friendlyError(new Error('unique violation'))).toBe('That already exists.');
  });

  it('photo upload: storage and size limits', () => {
    expect(friendlyError(new Error('StorageApiError: object not found'))).toBe('That photo could not be uploaded. Try a smaller one.');
    expect(friendlyError(new Error('Bucket not found'))).toBe('That photo could not be uploaded. Try a smaller one.');
    expect(friendlyError(new Error('Payload too large'))).toBe('That photo could not be uploaded. Try a smaller one.');
    expect(friendlyError({ message: 'status 413' })).toBe('That photo could not be uploaded. Try a smaller one.');
  });

  it('falls back to the default copy, or a custom one, for anything else', () => {
    expect(friendlyError(new Error('something odd'))).toBe(DEFAULT);
    expect(friendlyError(new Error('something odd'), 'Could not save the list.')).toBe('Could not save the list.');
  });

  it('accepts a plain string', () => {
    expect(friendlyError('Network request failed')).toBe(OFFLINE);
    expect(friendlyError('nope', 'Could not post your comment.')).toBe('Could not post your comment.');
  });

  it('accepts a { message } object', () => {
    expect(friendlyError({ message: 'JWT expired', status: 401 })).toBe('Please sign in again.');
    expect(friendlyError({ message: 'weird' })).toBe(DEFAULT);
  });

  it('never throws, and warns once in dev for an unmapped error', () => {
    expect(() => friendlyError(undefined)).not.toThrow();
    expect(friendlyError(null)).toBe(DEFAULT);
    expect(friendlyError({})).toBe(DEFAULT);
    expect(friendlyError(Symbol('x'))).toBe(DEFAULT);
    warn.mockClear();
    expect(friendlyError(new Error('unmapped thing'))).toBe(DEFAULT);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith('[perch] unmapped error', 'unmapped thing');
  });

  it('does not warn for a mapped error', () => {
    warn.mockClear();
    friendlyError(new Error('Network request failed'));
    expect(warn).not.toHaveBeenCalled();
  });
});
