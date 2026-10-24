import Svg, { Circle, ClipPath, Defs, Ellipse, G, Path, Rect } from 'react-native-svg';

/** Stroke icons copied from the design canvas. */

interface IconProps {
  color: string;
  size?: number;
}

export function BackIcon({ color }: IconProps) {
  return (
    <Svg width={11} height={18} viewBox="0 0 12 20" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M10 2L2 10l8 8" />
    </Svg>
  );
}

export function CloseIcon({ color }: IconProps) {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
      <Path d="M3 3l10 10M13 3L3 13" />
    </Svg>
  );
}

export function MenuIcon({ color }: IconProps) {
  return (
    <Svg width={20} height={14} viewBox="0 0 20 14" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round">
      <Path d="M1 1h18M1 7h12M1 13h18" />
    </Svg>
  );
}

export function NewChatIcon({ color }: IconProps) {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M9 3H4.5A1.5 1.5 0 0 0 3 4.5v11A1.5 1.5 0 0 0 4.5 17h11a1.5 1.5 0 0 0 1.5-1.5V11M15 2.5l2.5 2.5L10 12.5H7.5V10z" />
    </Svg>
  );
}

export function PlusIcon({ color }: IconProps) {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth={1.9} strokeLinecap="round">
      <Path d="M8 2.5v11M2.5 8h11" />
    </Svg>
  );
}

export function MicIcon({ color }: IconProps) {
  return (
    <Svg width={16} height={20} viewBox="0 0 16 20" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round">
      <Rect x={5} y={1} width={6} height={11} rx={3} />
      <Path d="M2 9a6 6 0 0 0 12 0M8 15v4" />
    </Svg>
  );
}

export function VoiceIcon({ color }: IconProps) {
  return (
    <Svg width={18} height={16} viewBox="0 0 18 16" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
      <Path d="M2 6v4M6 3v10M10 1v14M14 5v6" />
    </Svg>
  );
}

export function SendIcon({ color }: IconProps) {
  return (
    <Svg width={16} height={18} viewBox="0 0 16 18" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M8 16V2M2 8l6-6 6 6" />
    </Svg>
  );
}

export function StopIcon({ color }: IconProps) {
  return (
    <Svg width={14} height={14} viewBox="0 0 14 14">
      <Rect x={1} y={1} width={12} height={12} rx={3} fill={color} />
    </Svg>
  );
}

export function ArrowUpRightIcon({ color }: IconProps) {
  return (
    <Svg width={14} height={14} viewBox="0 0 14 14" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" opacity={0.55}>
      <Path d="M3 11L11 3M5 3h6v6" />
    </Svg>
  );
}

export function ArrowRightIcon({ color }: IconProps) {
  return (
    <Svg width={22} height={22} viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 10h12M11 5l5 5-5 5" />
    </Svg>
  );
}

export function ChevronRightIcon({ color }: IconProps) {
  return (
    <Svg width={8} height={14} viewBox="0 0 8 14" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" opacity={0.5}>
      <Path d="M1 1l6 6-6 6" />
    </Svg>
  );
}

export function CheckIcon({ color, size = 18 }: IconProps) {
  return (
    <Svg width={size} height={(size * 14) / 18} viewBox="0 0 18 14" fill="none" stroke={color} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M2 7.5l4.5 4.5L16 2" />
    </Svg>
  );
}

export function MailIcon({ color, size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round">
      <Rect x={2} y={4} width={16} height={12} rx={2.5} />
      <Path d="M2.5 5.5L10 11l7.5-5.5" />
    </Svg>
  );
}

export function EyeIcon({ color }: IconProps) {
  return (
    <Svg width={22} height={16} viewBox="0 0 22 16" fill="none" stroke={color} strokeWidth={1.6}>
      <Path d="M1 8s3.6-7 10-7 10 7 10 7-3.6 7-10 7S1 8 1 8z" />
      <Circle cx={11} cy={8} r={3} />
    </Svg>
  );
}

export function FaceIdIcon({ color, size = 22, strokeWidth = 1.7 }: IconProps & { strokeWidth?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 22 22" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round">
      <Path d="M1.5 7V4.5a3 3 0 0 1 3-3H7M15 1.5h2.5a3 3 0 0 1 3 3V7M20.5 15v2.5a3 3 0 0 1-3 3H15M7 20.5H4.5a3 3 0 0 1-3-3V15M7.5 8v1.5M14.5 8v1.5M11 8v4.5h-1M8 15.5s1.2 1.2 3 1.2 3-1.2 3-1.2" />
    </Svg>
  );
}

export function AppleIcon({ color }: IconProps) {
  return (
    <Svg width={18} height={20} viewBox="0 0 18 20">
      <Path
        fill={color}
        d="M14.7 10.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9C4.2 4.8 2.6 5.8 1.7 7.4c-1.8 3.2-.5 7.9 1.3 10.4.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8s2 .8 3.4.8c1.4 0 2.3-1.3 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9 0 0-2.7-1-2.7-4.4zM12.2 3c.7-.9 1.2-2 1.1-3.2-1 0-2.3.7-3 1.6-.7.8-1.2 2-1.1 3.1 1.1.1 2.3-.6 3-1.5z"
      />
    </Svg>
  );
}

export function GoogleIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18">
      <Path d="M17.6 9.2c0-.6-.1-1.2-.2-1.7H9v3.3h4.8c-.2 1.1-.8 2-1.8 2.7v2.2h2.9c1.7-1.6 2.7-3.9 2.7-6.5z" fill="#4285F4" />
      <Path d="M9 18c2.4 0 4.5-.8 5.9-2.2L12 13.6c-.8.5-1.8.9-3 .9-2.3 0-4.3-1.6-5-3.7H1v2.3C2.5 16 5.5 18 9 18z" fill="#34A853" />
      <Path d="M4 10.7c-.2-.5-.3-1.1-.3-1.7s.1-1.2.3-1.7V5H1C.4 6.2 0 7.6 0 9s.4 2.8 1 4l3-2.3z" fill="#FBBC05" />
      <Path d="M9 3.6c1.3 0 2.5.5 3.4 1.3L15 2.4C13.5.9 11.4 0 9 0 5.5 0 2.5 2 1 5l3 2.3c.7-2.1 2.7-3.7 5-3.7z" fill="#EA4335" />
    </Svg>
  );
}

/** Generic 20x20 line icon from a single path (privacy and settings rows). */
export function PathIcon({ color, d, size = 20, strokeWidth = 1.6 }: IconProps & { d: string; strokeWidth?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path d={d} />
    </Svg>
  );
}

export const PHONE_PATH =
  'M4.5 2.5h3l1.5 4-2 1.5a10 10 0 0 0 5 5l1.5-2 4 1.5v3a2 2 0 0 1-2 2A15 15 0 0 1 2.5 4.5a2 2 0 0 1 2-2z';

/** The RACO AI wordmark, drawn as strokes so it follows the text colour. */
export function Logo({ color, width = 150 }: { color: string; width?: number }) {
  const height = (width * 132) / 762;
  return (
    <Svg width={width} height={height} viewBox="0 11 762 132" accessibilityRole="image" accessibilityLabel="RACO AI">
      <Defs>
        <ClipPath id="logo-clip">
          <Rect x={0} y={11} width={762} height={132} />
        </ClipPath>
      </Defs>
      <G clipPath="url(#logo-clip)" fill="none" stroke={color} strokeWidth={30} strokeLinejoin="miter">
        <Path d="M24 158V26H70a33 33 0 0 1 0 66H24M82 92l26 56" />
        <Path d="M137 158L205 26L274 158M129 128H216" />
        <Path d="M379.5 47.5A44 51.5 0 1 0 379.5 106.5" strokeWidth={29} />
        <Ellipse cx={482} cy={77} rx={55.5} ry={51.5} strokeWidth={29} />
        <Path d="M563 158L631 26L700 158M555 128H642" />
        <Path d="M738 0V158" />
      </G>
    </Svg>
  );
}
