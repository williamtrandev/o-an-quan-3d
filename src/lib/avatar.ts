export const HAIR_STYLES = ['short', 'long', 'bun', 'curly', 'buzz', 'bald'] as const;
export type HairStyle = (typeof HAIR_STYLES)[number];

export const HAIR_STYLE_LABEL: Record<HairStyle, string> = {
  short: 'Ngắn',
  long: 'Dài',
  bun: 'Búi',
  curly: 'Xoăn',
  buzz: 'Cạo sát',
  bald: 'Trọc',
};

export const BUILDS = ['slim', 'normal', 'broad'] as const;
export type Build = (typeof BUILDS)[number];

export const BUILD_LABEL: Record<Build, string> = {
  slim: 'Mảnh',
  normal: 'Vừa',
  broad: 'Vạm vỡ',
};

export interface Avatar {
  kind: 'human' | 'robot';
  name: string;
  skin: string;
  hair: string;
  hairStyle: HairStyle;
  top: string;
  bottom: string;
  shoes: string;
  build: Build;
  /** Face cut from the player's photo (PNG data URL with soft edges), if any. */
  face: string | null;
  useFace: boolean;
}

export const DEFAULT_AVATAR: Avatar = {
  kind: 'human',
  name: 'Bạn',
  skin: '#e8b996',
  hair: '#2b1d14',
  hairStyle: 'short',
  top: '#3b82f6',
  bottom: '#334155',
  shoes: '#f8fafc',
  build: 'normal',
  face: null,
  useFace: false,
};

/** Second human for "two players, one device". */
export const GUEST_AVATAR: Avatar = {
  ...DEFAULT_AVATAR,
  name: 'Người chơi 2',
  skin: '#c98e6a',
  hair: '#111111',
  hairStyle: 'long',
  top: '#e11d48',
  bottom: '#1f2937',
  shoes: '#111827',
  build: 'slim',
};

/** Stockfish, drawn as a friendly robot. */
export const ROBOT_AVATAR: Avatar = {
  ...DEFAULT_AVATAR,
  kind: 'robot',
  name: 'Stockfish',
  skin: '#cbd5e1',
  hair: '#22d3ee',
  hairStyle: 'bald',
  top: '#475569',
  bottom: '#334155',
  shoes: '#1e293b',
  build: 'broad',
};

/** Horizontal scale of the torso for a build. */
export const BUILD_WIDTH: Record<Build, number> = { slim: 0.86, normal: 1, broad: 1.16 };

const HEX = /^#[0-9a-f]{6}$/i;

/** Accept a stored avatar only if every field is valid; otherwise fall back to the default. */
export const sanitizeAvatar = (value: unknown): Avatar => {
  if (!value || typeof value !== 'object') return DEFAULT_AVATAR;
  const v = value as Partial<Avatar>;
  const color = (c: unknown, fallback: string) =>
    typeof c === 'string' && HEX.test(c) ? c : fallback;
  const face = typeof v.face === 'string' && v.face.startsWith('data:image/') ? v.face : null;
  return {
    kind: 'human',
    name:
      typeof v.name === 'string' && v.name.trim()
        ? v.name.trim().slice(0, 24)
        : DEFAULT_AVATAR.name,
    skin: color(v.skin, DEFAULT_AVATAR.skin),
    hair: color(v.hair, DEFAULT_AVATAR.hair),
    hairStyle: HAIR_STYLES.includes(v.hairStyle as HairStyle)
      ? (v.hairStyle as HairStyle)
      : DEFAULT_AVATAR.hairStyle,
    top: color(v.top, DEFAULT_AVATAR.top),
    bottom: color(v.bottom, DEFAULT_AVATAR.bottom),
    shoes: color(v.shoes, DEFAULT_AVATAR.shoes),
    build: BUILDS.includes(v.build as Build) ? (v.build as Build) : DEFAULT_AVATAR.build,
    face,
    useFace: Boolean(v.useFace) && face !== null,
  };
};
