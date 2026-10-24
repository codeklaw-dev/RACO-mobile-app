/**
 * Sample replies used when no model is connected: the app's demo mode and the
 * API's LLM_PROVIDER=demo. They show how replies look, not what a model says.
 */

const REPLIES: { match: RegExp; text: string }[] = [
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
export function demoReply(message: string): string {
  return REPLIES.find((r) => r.match.test(message))?.text ?? FALLBACK;
}
