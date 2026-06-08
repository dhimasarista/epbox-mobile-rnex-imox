import Svg, { Path } from 'react-native-svg';

type IconProps = {
  color: string;
  size?: number;
  strokeWidth?: number;
};

export function LucideHome({ color, size = 24, strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15 21v-7a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v7"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M3 10.5 10.94 3.56a1.6 1.6 0 0 1 2.12 0L21 10.5"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M5 8.75V19a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.75"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function LucideSlidersHorizontal({ color, size = 24, strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M10 5H3" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M12 19H3" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M14 3v4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M16 17v4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M21 12h-9" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M21 19h-5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M21 5h-7" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M8 10v4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M8 12H3" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function LucideActivity({ color, size = 24, strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M22 12h-4l-3 9L9 3l-3 9H2"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function LucideSettings({ color, size = 24, strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3a2 2 0 0 1 2 2v.35a2 2 0 0 0 1.37 1.9 2 2 0 0 0 2.2-.48l.25-.25a2 2 0 1 1 2.83 2.83l-.25.25a2 2 0 0 0-.48 2.2A2 2 0 0 0 21 13.65H21a2 2 0 1 1 0 4h-.35a2 2 0 0 0-1.9 1.37 2 2 0 0 0 .48 2.2l.25.25a2 2 0 1 1-2.83 2.83l-.25-.25a2 2 0 0 0-2.2-.48A2 2 0 0 0 14 24.35V24a2 2 0 1 1-4 0v-.35a2 2 0 0 0-1.37-1.9 2 2 0 0 0-2.2.48l-.25.25a2 2 0 1 1-2.83-2.83l.25-.25a2 2 0 0 0 .48-2.2A2 2 0 0 0 2.35 17H2a2 2 0 1 1 0-4h.35a2 2 0 0 0 1.9-1.37 2 2 0 0 0-.48-2.2l-.25-.25A2 2 0 1 1 6.35 6.35l.25.25a2 2 0 0 0 2.2.48A2 2 0 0 0 10 5.35V5a2 2 0 0 1 2-2Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
