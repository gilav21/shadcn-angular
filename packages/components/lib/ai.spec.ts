import { describe, it, expect } from 'vitest';
import { firstValueFrom, lastValueFrom, of, Subject, toArray } from 'rxjs';
import { runAiTask, type AiProvider, type AiRequest } from './ai';

const REQ: AiRequest = { task: 'rewrite', input: 'hello' };

describe('runAiTask', () => {
  it('wraps a plain string result in a single-emission Observable', async () => {
    const provider: AiProvider = () => 'rewritten';
    expect(await firstValueFrom(runAiTask(provider, REQ))).toBe('rewritten');
  });

  it('wraps a Promise result', async () => {
    const provider: AiProvider = () => Promise.resolve('async result');
    expect(await lastValueFrom(runAiTask(provider, REQ))).toBe('async result');
  });

  it('passes an Observable through, preserving progressive (streamed) emissions', async () => {
    const stream = new Subject<string>();
    const provider: AiProvider = () => stream;
    const collected = lastValueFrom(runAiTask(provider, REQ).pipe(toArray()));
    stream.next('Hel');
    stream.next('Hello');
    stream.next('Hello world');
    stream.complete();
    expect(await collected).toEqual(['Hel', 'Hello', 'Hello world']);
  });

  it('forwards the full request (task, prompt, context, signal) to the provider', () => {
    const controller = new AbortController();
    let received: AiRequest | null = null;
    const provider: AiProvider = (req) => {
      received = req;
      return of('');
    };
    const request: AiRequest = {
      task: 'translate',
      input: 'bonjour',
      prompt: 'to English',
      context: { locale: 'fr' },
      signal: controller.signal,
    };
    runAiTask(provider, request).subscribe();
    expect(received).toBe(request);
  });
});
