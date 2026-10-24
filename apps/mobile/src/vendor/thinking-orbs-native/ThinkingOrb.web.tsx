// Web stand-in for the Skia orb (the browser preview has no Skia): the
// thinking-orbs canvas component, scaled to `displaySize`.
import { ThinkingOrb as WebOrb } from 'thinking-orbs';
import type { ThinkingOrbProps } from './types';

export function ThinkingOrb({ state = 'working', size = 64, theme = 'auto', speed = 1, paused = false, displaySize, accessibilityLabel }: ThinkingOrbProps) {
  const box = displaySize ?? size;
  return (
    <div style={{ width: box, height: box, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ transform: `scale(${box / size})` }}>
        <WebOrb state={state} size={size} theme={theme} speed={speed} paused={paused} aria-label={accessibilityLabel} />
      </div>
    </div>
  );
}
