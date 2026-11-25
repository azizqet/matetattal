import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useI18n } from '../i18n';
import { useTheme } from '../theme/ThemeProvider';

/**
 * FIKRA icon set — drawn on a 24 grid with straight geometric segments
 * (echoing the logo's line work), 1.75 stroke, round joins.
 * Category icons carry a single "spark" dot in the brand accent: the light
 * of the bulb. UI icons stay monochrome.
 */
export type IconName =
  | 'home' | 'grid' | 'plus' | 'chat' | 'user' | 'search' | 'bell' | 'heart' | 'heartFill' | 'filter' | 'sort'
  | 'back' | 'forward' | 'close' | 'camera' | 'image' | 'phone' | 'whatsapp' | 'send' | 'more' | 'share' | 'flag'
  | 'pin' | 'eye' | 'check' | 'checks' | 'trash' | 'edit' | 'refresh' | 'bump' | 'clock' | 'settings' | 'lock'
  | 'globe' | 'moon' | 'help' | 'doc' | 'shield' | 'logout' | 'star' | 'list' | 'mail' | 'tag' | 'sparkle'
  | 'block' | 'location' | 'down' | 'bookmark' | 'package' | 'sold' | 'hide' | 'wifiOff' | 'crown'
  // categories
  | 'car' | 'motorcycle' | 'gear' | 'building' | 'mobile' | 'tv' | 'gamepad' | 'sofa' | 'appliance' | 'watch'
  | 'hanger' | 'paw' | 'excavator' | 'tent' | 'briefcase' | 'wrench' | 'store' | 'spark' | 'misc' | 'boat';

type P = { name: IconName | string; size?: number; color?: string; spark?: string | false; strokeWidth?: number };

const CATEGORY_ALIASES: Record<string, IconName> = { phone: 'mobile', grid: 'misc' };

export function Icon({ name, size = 24, color, spark, strokeWidth = 1.75 }: P) {
  const { c } = useTheme();
  const { isRTL } = useI18n();
  const col = color ?? c.text;
  const sparkCol = spark === false ? undefined : spark ?? c.accent;
  const s = { stroke: col, strokeWidth, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  const dot = (cx: number, cy: number, r = 1.9) => (sparkCol ? <Circle cx={cx} cy={cy} r={r} fill={sparkCol} /> : null);
  const flip = isRTL && (name === 'back' || name === 'forward' || name === 'send');

  let body: React.ReactNode;
  switch (name) {
    // ── UI ──────────────────────────────────────────────────────────────
    case 'home': body = <><Path d="M3.5 10.5 12 3.5l8.5 7V20a.5.5 0 0 1-.5.5h-5v-6h-6v6H4a.5.5 0 0 1-.5-.5z" {...s} /></>; break;
    case 'grid': body = <><Rect x="3.5" y="3.5" width="7" height="7" rx="2" {...s} /><Rect x="13.5" y="3.5" width="7" height="7" rx="3.5" {...s} /><Rect x="3.5" y="13.5" width="7" height="7" rx="2" {...s} /><Rect x="13.5" y="13.5" width="7" height="7" rx="2" {...s} /></>; break;
    case 'plus': body = <Path d="M12 5v14M5 12h14" {...s} />; break;
    case 'chat': body = <Path d="M4 5.5h16v10.5H10l-4.5 3.5V16H4z M8 9.5h8M8 12.5h5" {...s} />; break;
    case 'user': body = <><Circle cx="12" cy="8.5" r="4" {...s} /><Path d="M4.5 20.5c1-4 4-6 7.5-6s6.5 2 7.5 6" {...s} /></>; break;
    case 'search': body = <><Circle cx="10.5" cy="10.5" r="6.5" {...s} /><Path d="m15.5 15.5 5 5" {...s} /></>; break;
    case 'bell': body = <Path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 2h-15zM10 21h4" {...s} />; break;
    case 'heart': body = <Path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7.5 2.8C19.5 15.4 12 20 12 20z" {...s} />; break;
    case 'heartFill': body = <Path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7.5 2.8C19.5 15.4 12 20 12 20z" {...s} fill={col} />; break;
    case 'filter': body = <Path d="M4 6h10M18 6h2M4 12h3M11 12h9M4 18h12M20 18h0 M14 4v4M7 10v4M16 16v4" {...s} />; break;
    case 'sort': body = <Path d="M7 4v16M3.5 16.5 7 20l3.5-3.5M17 20V4m-3.5 3.5L17 4l3.5 3.5" {...s} />; break;
    case 'back': body = <Path d="m14.5 5-7 7 7 7" {...s} />; break;
    case 'forward': body = <Path d="m9.5 5 7 7-7 7" {...s} />; break;
    case 'down': body = <Path d="m5 9.5 7 7 7-7" {...s} />; break;
    case 'close': body = <Path d="m6 6 12 12M18 6 6 18" {...s} />; break;
    case 'camera': body = <><Path d="M3.5 8h4l2-3h5l2 3h4v11.5h-17z" {...s} /><Circle cx="12" cy="13" r="3.5" {...s} /></>; break;
    case 'image': body = <><Rect x="3.5" y="4.5" width="17" height="15" rx="2.5" {...s} /><Path d="m3.5 16 5-5 4 4 2.5-2.5 5.5 5.5" {...s} /><Circle cx="15.5" cy="9" r="1.5" {...s} /></>; break;
    case 'phone': body = <Path d="M5 4h4l1.5 4.5-2.5 1.5a11 11 0 0 0 6 6l1.5-2.5L20 15v4a1.5 1.5 0 0 1-1.5 1.5A15.5 15.5 0 0 1 3.5 5.5 1.5 1.5 0 0 1 5 4z" {...s} />; break;
    case 'whatsapp': body = <><Path d="M4 20.5 5.3 16A8.5 8.5 0 1 1 8.3 19z" {...s} /><Path d="M9 8.5c0 3.5 3 6.5 6.5 6.5l1-1.6-2-1-1 .9a4.5 4.5 0 0 1-2.4-2.4l.9-1-1-2z" {...s} strokeWidth={strokeWidth * 0.85} /></>; break;
    case 'send': body = <Path d="M20.5 3.5 3.5 10.5l7 3 3 7zM10.5 13.5l4-4" {...s} />; break;
    case 'more': body = <><Circle cx="5.5" cy="12" r="1.4" fill={col} /><Circle cx="12" cy="12" r="1.4" fill={col} /><Circle cx="18.5" cy="12" r="1.4" fill={col} /></>; break;
    case 'share': body = <Path d="M12 3.5v11M8 7.5l4-4 4 4M5.5 12v8h13v-8" {...s} />; break;
    case 'flag': body = <Path d="M5 21V4m0 0h12l-2.5 4L17 12H5" {...s} />; break;
    case 'pin': body = <Path d="M9 4h6l-1 6 3.5 3.5h-11L10 10zM12 13.5V21" {...s} />; break;
    case 'location': body = <><Path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z" {...s} /><Circle cx="12" cy="10" r="2.3" {...s} /></>; break;
    case 'eye': body = <><Path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" {...s} /><Circle cx="12" cy="12" r="3" {...s} /></>; break;
    case 'hide': body = <Path d="M3.5 3.5l17 17M10 6a8.6 8.6 0 0 1 2-.5C18 5.5 21.5 12 21.5 12a16 16 0 0 1-2.6 3.4M6.4 7.4A15 15 0 0 0 2.5 12S6 18.5 12 18.5a8.5 8.5 0 0 0 4-1M9.9 10a3 3 0 0 0 4.1 4.1" {...s} />; break;
    case 'check': body = <Path d="m4.5 12.5 5 5 10-11" {...s} />; break;
    case 'checks': body = <Path d="m2 12.5 5 5 9-10M12.5 16.5l1 1 9-10" {...s} />; break;
    case 'trash': body = <Path d="M4 6.5h16M9 6.5V4h6v2.5M6 6.5l1 14h10l1-14M10 10.5v6M14 10.5v6" {...s} />; break;
    case 'edit': body = <Path d="M14.5 5.5l4 4L8 20H4v-4zM12.5 7.5l4 4" {...s} />; break;
    case 'refresh': body = <Path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4v4h-4" {...s} />; break;
    case 'bump': body = <Path d="M12 20V6m-6 6 6-6 6 6M5 3.5h14" {...s} />; break;
    case 'clock': body = <><Circle cx="12" cy="12" r="8.5" {...s} /><Path d="M12 7.5V12l3 2" {...s} /></>; break;
    case 'settings': body = <><Path d="M12 2.8 19.9 7.4v9.2L12 21.2l-7.9-4.6V7.4z" {...s} /><Circle cx="12" cy="12" r="3" {...s} /></>; break;
    case 'lock': body = <><Rect x="4.5" y="10.5" width="15" height="10" rx="2.5" {...s} /><Path d="M8 10.5V8a4 4 0 0 1 8 0v2.5M12 14.5v2" {...s} /></>; break;
    case 'globe': body = <><Circle cx="12" cy="12" r="8.5" {...s} /><Path d="M3.5 12h17M12 3.5c-2.8 3-2.8 14 0 17M12 3.5c2.8 3 2.8 14 0 17" {...s} /></>; break;
    case 'moon': body = <Path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z" {...s} />; break;
    case 'help': body = <><Circle cx="12" cy="12" r="8.5" {...s} /><Path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h0" {...s} /></>; break;
    case 'doc': body = <Path d="M6 3.5h8l4 4v13H6zM14 3.5v4h4M9 12h6M9 15.5h6" {...s} />; break;
    case 'shield': body = <Path d="M12 3.5 19.5 6v6c0 4.5-3.2 7.6-7.5 9-4.3-1.4-7.5-4.5-7.5-9V6zM9 12l2 2 4-4" {...s} />; break;
    case 'logout': body = <Path d="M14 4.5H5v15h9M10 12h10.5M17 8.5l3.5 3.5-3.5 3.5" {...s} />; break;
    case 'star': body = <Path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z" {...s} />; break;
    case 'crown': body = <Path d="M4 18.5h16M4.5 16 3.5 7l5 4L12 5l3.5 6 5-4-1 9z" {...s} />; break;
    case 'list': body = <Path d="M8.5 6.5h12M8.5 12h12M8.5 17.5h12M4 6.5h0M4 12h0M4 17.5h0" {...s} strokeWidth={strokeWidth + 0.5} />; break;
    case 'mail': body = <Path d="M3.5 5.5h17v13h-17zM3.5 6l8.5 7 8.5-7" {...s} />; break;
    case 'tag': body = <><Path d="M3.5 12.5V4h8.5l8.5 8.5-8.5 8.5z" {...s} /><Circle cx="8" cy="8.5" r="1.5" {...s} /></>; break;
    case 'bookmark': body = <Path d="M6 3.5h12v17l-6-4.5-6 4.5z" {...s} />; break;
    case 'package': body = <Path d="M12 3 20 7.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9" {...s} />; break;
    case 'sold': body = <><Circle cx="12" cy="12" r="8.5" {...s} /><Path d="m8 12.3 2.8 2.7L16 9.5" {...s} /></>; break;
    case 'block': body = <><Circle cx="12" cy="12" r="8.5" {...s} /><Path d="m6 6 12 12" {...s} /></>; break;
    case 'wifiOff': body = <Path d="M3 3l18 18M8.5 16a5 5 0 0 1 7 0M5 12.5a10 10 0 0 1 4.5-2.4M14.5 10a10 10 0 0 1 4.5 2.5M2 9a15 15 0 0 1 4-2.6M12 20h0" {...s} />; break;
    case 'sparkle': body = <Path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" {...s} />; break;

    // ── Categories (each with a spark) ──────────────────────────────────
    case 'car': body = <><Path d="M3 16.5v-4l2.2-5h13.6l2.2 5v4zM3 16.5V19h3v-2.5M18 16.5V19h3v-2.5M3 12.5h18" {...s} /><Circle cx="7" cy="14.5" r=".6" fill={col} /><Circle cx="17" cy="14.5" r=".6" fill={col} />{dot(12, 4.2)}</>; break;
    case 'motorcycle': body = <><Circle cx="5.5" cy="16" r="3.2" {...s} /><Circle cx="18.5" cy="16" r="3.2" {...s} /><Path d="M5.5 16 9 9.5h5l4.5 6.5M14 9.5l-1.5-3H15M9 9.5l3 6.5h-6.5" {...s} />{dot(20, 7)}</>; break;
    case 'gear': body = <><Path d="M12 3.5l2 2.2 3-.4.6 2.9 2.6 1.5-1.2 2.8 1.2 2.8-2.6 1.5-.6 2.9-3-.4-2 2.2-2-2.2-3 .4-.6-2.9-2.6-1.5L4 12.5l-1.2-2.8 2.6-1.5.6-2.9 3 .4z" {...s} /><Circle cx="12" cy="12.5" r="2.4" fill={sparkCol ?? 'none'} stroke={sparkCol ? 'none' : col} /></>; break;
    case 'building': body = <><Path d="M4 20.5V8l7-4.5V20.5M11 9.5h9v11M2.5 20.5h19M7 9.5v.01M7 13v.01M7 16.5v.01M14.5 13h2M14.5 16.5h2" {...s} />{dot(17.5, 6.2)}</>; break;
    case 'mobile': body = <><Rect x="6.5" y="2.5" width="11" height="19" rx="2.5" {...s} /><Path d="M10.5 5.5h3" {...s} />{dot(12, 18)}</>; break;
    case 'tv': body = <><Rect x="2.5" y="5" width="19" height="12.5" rx="2" {...s} /><Path d="M8 21h8M12 17.5V21M8.5 2.5 12 5l3.5-2.5" {...s} />{dot(18.5, 14.5, 1.5)}</>; break;
    case 'gamepad': body = <><Path d="M7 7.5h10a4.5 4.5 0 0 1 4.3 5.8l-1.2 4a2.3 2.3 0 0 1-4 .8L14 16H10l-2.1 2.1a2.3 2.3 0 0 1-4-.8l-1.2-4A4.5 4.5 0 0 1 7 7.5zM7.5 10.5v3M6 12h3" {...s} />{dot(16.5, 11)}</>; break;
    case 'sofa': body = <><Path d="M5 11V7.5A2.5 2.5 0 0 1 7.5 5h9A2.5 2.5 0 0 1 19 7.5V11M3 11h4v3.5h10V11h4v7H3zM5 18v2M19 18v2" {...s} />{dot(12, 8.5)}</>; break;
    case 'appliance': body = <><Rect x="5" y="2.5" width="14" height="19" rx="2" {...s} /><Path d="M5 7.5h14" {...s} /><Circle cx="12" cy="14" r="4" {...s} />{dot(8, 5, 1.2)}</>; break;
    case 'watch': body = <><Circle cx="12" cy="12" r="5.5" {...s} /><Path d="M9 7l.8-4.5h4.4L15 7M9 17l.8 4.5h4.4L15 17M12 9.5V12l1.5 1" {...s} />{dot(17.5, 12, 1.3)}</>; break;
    case 'hanger': body = <><Path d="M12 7.5a2 2 0 1 1 2-2M12 7.5v1.5L2.5 16a1 1 0 0 0 .6 1.8h17.8a1 1 0 0 0 .6-1.8L12 9" {...s} />{dot(12, 14.2)}</>; break;
    case 'paw': body = <><Path d="M12 12.5c-3 0-5.5 3.3-5.5 5.5 0 1.5 1.2 2.5 2.7 2.5 1 0 1.8-.6 2.8-.6s1.8.6 2.8.6c1.5 0 2.7-1 2.7-2.5 0-2.2-2.5-5.5-5.5-5.5z" {...s} /><Circle cx="5" cy="10" r="1.8" {...s} /><Circle cx="9" cy="5.5" r="1.8" {...s} /><Circle cx="19" cy="10" r="1.8" {...s} />{dot(15, 5.5)}</>; break;
    case 'excavator': body = <><Path d="M2.5 17.5h11M3.5 15h9v-4.5H8l-1.5 4.5M12.5 10.5 17 5l4 4.5-2.5 3.5h-2" {...s} /><Rect x="2.5" y="17.5" width="11" height="3" rx="1.5" {...s} />{dot(10.5, 7.5)}</>; break;
    case 'tent': body = <><Path d="M12 4 2.5 20h19zM12 4l-3.5 16M12 4l3.5 16M12 4 10.5 1.5M12 4l1.5-2.5" {...s} />{dot(19, 6)}</>; break;
    case 'briefcase': body = <><Rect x="3" y="7" width="18" height="13" rx="2" {...s} /><Path d="M9 7V4.5h6V7M3 12.5h18" {...s} />{dot(12, 12.5, 1.6)}</>; break;
    case 'wrench': body = <><Path d="M14.5 3.5a5 5 0 0 0-4.6 6.9L3.5 16.8 7.2 20.5l6.4-6.4a5 5 0 0 0 6.9-4.6l-3 1.5-3-3z" {...s} />{dot(6, 18, 1.2)}</>; break;
    case 'store': body = <><Path d="M3.5 9.5 5 4h14l1.5 5.5M3.5 9.5h17a2.8 2.8 0 0 1-5.6 0 2.8 2.8 0 0 1-5.6 0 2.8 2.8 0 0 1-5.8 0zM5 11.5v9h14v-9M9.5 20.5v-5h5v5" {...s} />{dot(12, 6.7, 1.4)}</>; break;
    case 'spark': body = <><Path d="M12 2.5l2.2 6.3 6.3 2.2-6.3 2.2L12 19.5l-2.2-6.3L3.5 11l6.3-2.2z" {...s} />{dot(19, 19)}</>; break;
    case 'boat': body = <><Path d="M3 15.5h18l-2.5 4.5h-13zM6 15.5V11h12v4.5M12 11V4l5 4h-5" {...s} />{dot(7, 6.5)}</>; break;
    case 'misc':
    default: {
      const alias = CATEGORY_ALIASES[name];
      if (alias) return <Icon name={alias} size={size} color={color} spark={spark} strokeWidth={strokeWidth} />;
      body = <><Rect x="3.5" y="3.5" width="7" height="7" rx="1.5" {...s} /><Rect x="13.5" y="13.5" width="7" height="7" rx="1.5" {...s} /><Rect x="3.5" y="13.5" width="7" height="7" rx="1.5" {...s} />{dot(17, 7, 2.4)}</>;
    }
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={flip ? { transform: [{ scaleX: -1 }] } : undefined}>
      {body}
    </Svg>
  );
}
