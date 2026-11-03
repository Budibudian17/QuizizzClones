export const AVATAR_CHARACTERS = ["cat", "fox", "frog", "bear", "robot", "bird"] as const;
export const AVATAR_COLORS = ["amber", "rose", "mint", "sky", "violet", "lime"] as const;
export const AVATAR_HATS = ["none", "cap", "beanie", "crown"] as const;
export const AVATAR_GLASSES = ["none", "round", "square", "sunglasses"] as const;
export const AVATAR_BAGS = ["none", "backpack", "sling"] as const;
export const AVATAR_HAIR = ["none", "short", "long", "curly"] as const;
export const AVATAR_SHIRTS = ["teal", "coral", "indigo", "cream", "plum"] as const;
export const AVATAR_PANTS = ["navy", "charcoal", "olive", "denim"] as const;

export type AvatarConfig = {
  character: (typeof AVATAR_CHARACTERS)[number];
  color: (typeof AVATAR_COLORS)[number];
  hat: (typeof AVATAR_HATS)[number];
  glasses: (typeof AVATAR_GLASSES)[number];
  bag: (typeof AVATAR_BAGS)[number];
  hair: (typeof AVATAR_HAIR)[number];
  shirt: (typeof AVATAR_SHIRTS)[number];
  pants: (typeof AVATAR_PANTS)[number];
};

export const DEFAULT_AVATAR: AvatarConfig = {
  character: "cat",
  color: "amber",
  hat: "none",
  glasses: "none",
  bag: "none",
  hair: "short",
  shirt: "teal",
  pants: "navy",
};

function isOneOf<const T extends readonly string[]>(
  value: unknown,
  options: T,
): value is T[number] {
  return typeof value === "string" && options.some((option) => option === value);
}

export function normalizeAvatar(value: unknown): AvatarConfig {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { ...DEFAULT_AVATAR };
  }

  const avatar = value as Record<string, unknown>;
  return {
    character: isOneOf(avatar["character"], AVATAR_CHARACTERS)
      ? avatar["character"]
      : DEFAULT_AVATAR.character,
    color: isOneOf(avatar["color"], AVATAR_COLORS) ? avatar["color"] : DEFAULT_AVATAR.color,
    hat: isOneOf(avatar["hat"], AVATAR_HATS) ? avatar["hat"] : DEFAULT_AVATAR.hat,
    glasses: isOneOf(avatar["glasses"], AVATAR_GLASSES)
      ? avatar["glasses"]
      : DEFAULT_AVATAR.glasses,
    bag: isOneOf(avatar["bag"], AVATAR_BAGS) ? avatar["bag"] : DEFAULT_AVATAR.bag,
    hair: isOneOf(avatar["hair"], AVATAR_HAIR) ? avatar["hair"] : DEFAULT_AVATAR.hair,
    shirt: isOneOf(avatar["shirt"], AVATAR_SHIRTS) ? avatar["shirt"] : DEFAULT_AVATAR.shirt,
    pants: isOneOf(avatar["pants"], AVATAR_PANTS) ? avatar["pants"] : DEFAULT_AVATAR.pants,
  };
}

export const AVATAR_CHARACTER_LABELS: Record<AvatarConfig["character"], string> = {
  cat: "Kucing",
  fox: "Rubah",
  frog: "Katak",
  bear: "Beruang",
  robot: "Robot",
  bird: "Burung",
};

export const AVATAR_COLOR_LABELS: Record<AvatarConfig["color"], string> = {
  amber: "Emas",
  rose: "Merah muda",
  mint: "Mint",
  sky: "Biru",
  violet: "Ungu",
  lime: "Hijau",
};

export const AVATAR_HAT_LABELS: Record<AvatarConfig["hat"], string> = {
  none: "Tanpa topi",
  cap: "Topi kasual",
  beanie: "Kupluk",
  crown: "Mahkota",
};

export const AVATAR_GLASSES_LABELS: Record<AvatarConfig["glasses"], string> = {
  none: "Tanpa kacamata",
  round: "Bulat",
  square: "Kotak",
  sunglasses: "Kacamata hitam",
};

export const AVATAR_BAG_LABELS: Record<AvatarConfig["bag"], string> = {
  none: "Tanpa tas",
  backpack: "Ransel",
  sling: "Tas selempang",
};

export const AVATAR_HAIR_LABELS: Record<AvatarConfig["hair"], string> = {
  none: "Tanpa rambut",
  short: "Pendek",
  long: "Panjang",
  curly: "Keriting",
};

export const AVATAR_SHIRT_LABELS: Record<AvatarConfig["shirt"], string> = {
  teal: "Toska",
  coral: "Koral",
  indigo: "Indigo",
  cream: "Krem",
  plum: "Plum",
};

export const AVATAR_PANTS_LABELS: Record<AvatarConfig["pants"], string> = {
  navy: "Navy",
  charcoal: "Arang",
  olive: "Zaitun",
  denim: "Denim",
};
