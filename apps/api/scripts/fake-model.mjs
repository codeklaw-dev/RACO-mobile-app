// A stand-in OpenAI-compatible model server for local testing when no real
// model is reachable. It streams back a short reply that quotes the last
// message, so you can check the whole request path end to end.
// Usage: node scripts/fake-model.mjs [port]
import http from 'node:http';

const port = Number(process.argv[2] ?? 9100);

http
  .createServer(async (req, res) => {
    if (req.method !== 'POST' || !req.url?.endsWith('/chat/completions')) {
      res.writeHead(404).end();
      return;
    }
    let raw = '';
    for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw);
    const last = body.messages.at(-1)?.content ?? '';

    // Onboarding voice turns ask for JSON: echo the first word back as a name.
    if (!body.stream) {
      const name = String(last).match(/answer[^:]*:\s*"?(?:i'?m |i am |it'?s |call me )?([a-z]+)/i)?.[1] ?? null;
      const result = {
        understood: Boolean(name),
        wantsTour: false,
        say: name ? `Nice to meet you, ${name}.` : 'Sorry, could you say that again?',
        displayName: name,
        agentName: null,
        interests: null,
        callsAllowed: null,
      };
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(result) } }] }));
      return;
    }

    res.writeHead(200, { 'content-type': 'text/event-stream' });
    const reply = `(stand-in model) You said: "${last}". The request reached the model with ${body.messages.length} messages.`;
    for (const word of reply.split(/(?<= )/)) {
      res.write(`data: ${JSON.stringify({ model: 'stand-in', choices: [{ delta: { content: word } }] })}\n\n`);
    }
    res.write(
      `data: ${JSON.stringify({ choices: [], usage: { prompt_tokens: raw.length >> 2, completion_tokens: reply.length >> 2 } })}\n\n`,
    );
    res.end('data: [DONE]\n\n');
  })
  .listen(port, () => console.log(`Stand-in model listening on http://localhost:${port}/v1`));
