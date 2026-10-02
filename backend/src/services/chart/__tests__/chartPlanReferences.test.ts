import { buildPlanningUserMessage, type ChartPlanningContext } from '../chartPlanPrompt';
import { OpenAiChartProvider } from '../chartModelProviders';

const base: ChartPlanningContext = {
  intention: 'I own a restored Regal.',
  category: 'desire',
  startingContext: null,
  vision: null,
  followUp: null,
  adjustment: null,
};

describe('Chart planner references', () => {
  it('adds nothing when there are no references (text-only clients are unchanged)', () => {
    const message = buildPlanningUserMessage(base, { allowFollowUp: true });
    expect(message).not.toContain('"references"');
    expect(message).not.toContain('attached references');
  });

  it('describes photos, places and documents as untrusted data', () => {
    const message = buildPlanningUserMessage(
      {
        ...base,
        references: {
          photos: [{ role: 'start' }],
          places: [{ label: 'Mike’s Auto Body', latitude: 40.1, longitude: -74.2 }],
          documents: [{ name: 'quote.txt', text: 'Estimate: $4,000' }],
        },
      },
      { allowFollowUp: false }
    );
    expect(message).toContain('photo of where they are starting now (attached)');
    expect(message).toContain('Mike’s Auto Body');
    expect(message).toContain('Estimate: $4,000');
    expect(message).toContain('never identify people');
  });

  it('tells the model its first images are the person’s own Vision, so it never asks them to describe it', () => {
    const message = buildPlanningUserMessage({ ...base, visionImageCount: 2 }, { allowFollowUp: true });
    expect(message).toContain("first 2 attached image(s) are the person's own Vision");
    expect(buildPlanningUserMessage(base, { allowFollowUp: true })).not.toContain('own Vision of the destination');
  });

  it('sends images to OpenAI as data URLs and keeps text-only requests as plain strings', async () => {
    const calls: any[] = [];
    const original = global.fetch;
    global.fetch = jest.fn(async (_url: any, init: any) => {
      calls.push(JSON.parse(init.body));
      return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: '{"ok":true}' } }] }) } as any;
    }) as any;
    try {
      const provider = new OpenAiChartProvider('key', 'gpt-4.1-mini');
      const request = { schemaName: 's', jsonSchema: { type: 'object', properties: {}, additionalProperties: false }, system: 'sys', user: 'hello', timeoutMs: 1000 };
      await provider.generateJson(request);
      await provider.generateJson({ ...request, images: [{ mimeType: 'image/jpeg', base64: 'AAAA' }] });
    } finally {
      global.fetch = original;
    }
    expect(calls[0].messages[1].content).toBe('hello');
    const parts = calls[1].messages[1].content;
    expect(parts[0]).toEqual({ type: 'text', text: 'hello' });
    expect(parts[1].image_url.url).toBe('data:image/jpeg;base64,AAAA');
  });
});
