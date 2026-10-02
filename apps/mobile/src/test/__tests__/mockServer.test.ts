import { createMockResponse } from '../mockServer';

describe('createMockResponse', () => {
  it('freezes/snapshots JSON response body so subsequent mutations do not leak into response.json()', async () => {
    const payload = { client: { id: 'client-1', name: 'Before Mutation' } };
    const response = createMockResponse(200, payload);

    // Mutate original object in-place after response creation
    payload.client.name = 'After Mutation';

    const text = await response.text();
    const json = await response.json();

    expect(text).toBe('{"client":{"id":"client-1","name":"Before Mutation"}}');
    expect(json).toEqual({ client: { id: 'client-1', name: 'Before Mutation' } });
  });

  it('rejects raw empty string and malformed JSON strings with SyntaxError', async () => {
    const emptyResponse = createMockResponse(200, '');
    await expect(emptyResponse.json()).rejects.toThrow(SyntaxError);

    const malformedResponse = createMockResponse(200, '{"invalid":');
    await expect(malformedResponse.json()).rejects.toThrow(SyntaxError);
  });

  it('handles string bodies, preserving exact string for text() and parsing for json() if valid JSON', async () => {
    const rawJson = '{"message":"hello"}';
    const response = createMockResponse(201, rawJson);

    expect(response.status).toBe(201);
    expect(response.ok).toBe(true);
    expect(await response.text()).toBe('{"message":"hello"}');
    expect(await response.json()).toEqual({ message: 'hello' });
  });

  it('returns undefined for json() when body is undefined', async () => {
    const undefinedResponse = createMockResponse(204, undefined);
    expect(await undefinedResponse.json()).toBeUndefined();
  });

  it.each([
    ['Uint8Array', new Uint8Array([1, 2, 3])],
    ['ArrayBuffer', new Uint8Array([4, 5, 6]).buffer],
  ])('preserves original binary instance for json() convenience: %s', async (_type, binaryData) => {
    const response = createMockResponse(200, binaryData);
    expect(await response.json()).toBe(binaryData);
  });

  it('preserves status, statusText, and custom headers', async () => {
    const response = createMockResponse(404, { error: 'Not found' }, { 'x-custom-header': 'test-val' });

    expect(response.status).toBe(404);
    expect(response.ok).toBe(false);
    expect(response.statusText).toBe('Error');
    expect(response.headers.get('x-custom-header')).toBe('test-val');
    expect(response.headers.get('content-type')).toBe('application/json');
    expect(await response.json()).toEqual({ error: 'Not found' });
  });

  it('preserves binary buffer handling', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const response = createMockResponse(200, bytes);

    expect(response.headers.get('content-type')).toBe('application/pdf');
    const buffer = await response.arrayBuffer();
    expect(new Uint8Array(buffer)).toEqual(new Uint8Array([1, 2, 3, 4]));
  });
});
