import { describe, expect, it, vi } from 'vitest';
import { log, setRequestId } from './logger';

describe('logger', () => {
  it('emits JSON lines', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    log.info('test.event', { foo: 'bar', n: 42 });
    expect(spy).toHaveBeenCalledOnce();
    const line = spy.mock.calls[0][0] as string;
    const parsed = JSON.parse(line);
    expect(parsed.level).toBe('info');
    expect(parsed.msg).toBe('test.event');
    expect(parsed.foo).toBe('bar');
    expect(parsed.n).toBe(42);
    expect(typeof parsed.ts).toBe('string');
    spy.mockRestore();
  });

  it('serialises Error objects safely', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    log.error('boom', { err: new Error('thing exploded') });
    const line = spy.mock.calls[0][0] as string;
    const parsed = JSON.parse(line);
    expect(parsed.err.message).toBe('thing exploded');
    expect(typeof parsed.err.stack).toBe('string');
    spy.mockRestore();
  });

  it('tags lines with the active request id', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    setRequestId('req-123');
    log.info('hello');
    expect(JSON.parse(spy.mock.calls[0][0] as string).request_id).toBe('req-123');
    setRequestId(null);
    log.info('hello again');
    expect(JSON.parse(spy.mock.calls[1][0] as string).request_id).toBeUndefined();
    spy.mockRestore();
  });
});
