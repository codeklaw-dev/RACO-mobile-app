import { describe, expect, it } from 'vitest';
import { extractName, interpretLocally, type VoiceTurnRequest } from '../src/voice';

const turn = (step: VoiceTurnRequest['step'], transcript: string) => interpretLocally({ step, transcript, agentName: 'Raco' });

describe('extractName', () => {
  it.each([
    ["I'm Sam.", 'Sam'],
    ['my name is priya', 'Priya'],
    ['Call me Alex please', 'Alex'],
    ['Sam', 'Sam'],
    ["It's Jean-Luc", 'Jean-Luc'],
  ])('%s -> %s', (input, name) => expect(extractName(input)).toBe(name));

  it('ignores filler and long sentences without a name cue', () => {
    expect(extractName('um')).toBeNull();
    expect(extractName('I would like to set this up quickly today')).toBeNull();
  });
});

describe('interpretLocally', () => {
  it('reads names and greets', () => {
    expect(turn('name', "I'm Sam.")).toMatchObject({ understood: true, displayName: 'Sam', say: 'Nice to meet you, Sam.' });
    expect(turn('name', 'hmm')).toMatchObject({ understood: false });
  });

  it('keeps or renames the agent', () => {
    expect(turn('agent', 'Yes, keep it')).toMatchObject({ understood: true, agentName: 'Raco' });
    expect(turn('agent', "I'd like to call you Nova")).toMatchObject({ understood: true, agentName: 'Nova' });
    expect(turn('agent', 'Nova')).toMatchObject({ understood: true, agentName: 'Nova' });
  });

  it('maps use cases to interests', () => {
    expect(turn('uses', 'Studying for exams and planning my week.').interests).toEqual(['Study & exams', 'Planning']);
    expect(turn('uses', 'hmm').understood).toBe(false);
  });

  it('reads yes and no for calls, with no winning over a polite yes', () => {
    expect(turn('calls', 'Sure, go ahead')).toMatchObject({ callsAllowed: true });
    expect(turn('calls', "No thanks, please don't")).toMatchObject({ callsAllowed: false });
  });

  it('spots "what can you do?" at any step', () => {
    expect(turn('uses', 'Wait, what can you do?')).toMatchObject({ wantsTour: true });
  });
});
