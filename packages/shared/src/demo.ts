import { splitAttachments } from './chat';

/**
 * Sample replies used when no model is connected: the app's demo mode and the
 * API's LLM_PROVIDER=demo. They show how replies look, not what a model says.
 */

const REPLIES: { match: RegExp; text: string }[] = [
  {
    match: /near me|nearby|restaurant|cafe|coffee|kfc|map|directions|where (is|can)/i,
    text: `Here are a few places close by. These are **sample places** to show how place cards look; real results arrive once a places service is connected.

\`\`\`cards
[
  {"type":"place","name":"Corner Fried Chicken","category":"Fast food","address":"12 Market Street","lat":51.5154,"lon":-0.1419,"rating":4.1,"hours":"Open until 11 pm","phone":"+44 20 7946 0001"},
  {"type":"place","name":"Little Bean Café","category":"Coffee","address":"48 Station Road","lat":51.5142,"lon":-0.1385,"rating":4.6,"hours":"Open until 6 pm"},
  {"type":"place","name":"Green Bowl Kitchen","category":"Salads","address":"3 Garden Lane","lat":51.5131,"lon":-0.1442,"rating":4.4,"hours":"Opens 11 am"}
]
\`\`\`

Tap **Directions** to open one in Maps.`,
  },
  {
    match: /flashcard|exam|revise|study/i,
    text: `Happy to help you get ready. Here's a plan that fits the next three days:

**Day 1: map the material**
- List every topic on the syllabus
- Mark each one *confident*, *shaky* or *new*

**Day 2: work on the gaps**
1. Spend 25-minute blocks on each shaky topic
2. Test yourself with flashcards after each block

**Exam morning:** a quick review, not new material.

Paste in your lecture notes and I'll turn them into flashcards.`,
  },
  {
    match: /email|follow-up/i,
    text: `Here's a draft you can send as it is or adjust:

> Hi Priya,
>
> Thanks again for your time on Tuesday. I wanted to follow up on the launch timeline. Could we confirm the **14 November** date by Friday, so the team can lock the release plan?
>
> Best,
> Sam

Want it shorter, or more formal?`,
  },
  {
    match: /plan|week|schedule|deadline/i,
    text: `Let's build your week. Tell me your three deadlines and roughly how long each needs. In the meantime, here's a shape that works for most people:

- **Mornings:** deep work on the hardest deadline
- **After lunch:** meetings and messages
- **Late afternoon:** the smaller tasks

I'll turn it into a day-by-day schedule once I know what's due.`,
  },
];

const FALLBACK = `I'm running in demo mode, so my replies are samples rather than real AI answers. Once a model is connected I'll answer anything you ask, read files you share, and talk with you by voice.

Try one of the suggestions on the home screen to see how replies look.`;

/** The sample reply that best matches a message. */
/** `photos` is how many photos came with the message; attached files are inside it. */
export function demoReply(message: string, photos = 0): string {
  const { text, attachments } = splitAttachments(message);
  const files = attachments.filter((a) => a.kind === 'file').map((a) => a.name);
  if (photos > 0) {
    return `I've got your ${photos === 1 ? 'photo' : `${photos} photos`}. This is the demo, so I can't look at ${photos === 1 ? 'it' : 'them'} yet. Once a vision model is connected, I'll describe what's in ${photos === 1 ? 'it' : 'them'}, read any text and answer questions about ${photos === 1 ? 'it' : 'them'}.`;
  }
  if (files.length) {
    return `I've got **${files.join('**, **')}**. This is the demo, so I won't read ${files.length === 1 ? 'it' : 'them'} properly yet. Once a model is connected, I can summarise ${files.length === 1 ? 'it' : 'them'}, pull out key points or answer questions about the contents.`;
  }
  return REPLIES.find((r) => r.match.test(text))?.text ?? FALLBACK;
}
