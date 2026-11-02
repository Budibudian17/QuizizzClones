export type UniversityLogo = {
  key: string;
  title: string;
  source: string;
};

type UniversityPage = {
  key: string;
  title: string;
  sourceUrl: string | null;
  top: string;
  left: string;
  size: number;
  depth: number;
  tilt: number;
  delay: number;
};

export type UniversityLogoPlacement = UniversityLogo & {
  top: string;
  left: string;
  size: number;
  depth: number;
  tilt: number;
  delay: number;
};

const UNIVERSITY_PAGES: UniversityPage[] = [
  {
    key: "ui",
    title: "Universitas Indonesia",
    sourceUrl: null,
    top: "12%",
    left: "7%",
    size: 112,
    depth: 0.5,
    tilt: -6,
    delay: 0,
  },
  {
    key: "itb",
    title: "Institut Teknologi Bandung",
    sourceUrl: null,
    top: "15%",
    left: "82%",
    size: 126,
    depth: 0.65,
    tilt: 7,
    delay: 0.8,
  },
  {
    key: "ipb",
    title: "Institut Pertanian Bogor",
    sourceUrl: "https://www.ipb.ac.id/wp-content/uploads/2023/03/cropped-logo_ipb_80-192x192.png",
    top: "42%",
    left: "88%",
    size: 84,
    depth: 0.35,
    tilt: 4,
    delay: 3.1,
  },
  {
    key: "ugm",
    title: "Universitas Gadjah Mada",
    sourceUrl: null,
    top: "62%",
    left: "4%",
    size: 104,
    depth: 0.9,
    tilt: 10,
    delay: 1.6,
  },
  {
    key: "its",
    title: "Institut Teknologi Sepuluh Nopember",
    sourceUrl: null,
    top: "72%",
    left: "78%",
    size: 120,
    depth: 1.1,
    tilt: -12,
    delay: 2.4,
  },
];

let universityLogosRequest: Promise<UniversityLogoPlacement[]> | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function getWikipediaThumbnail(value: unknown): string | null {
  if (!isRecord(value)) return null;
  const thumbnail = value["thumbnail"];
  if (!isRecord(thumbnail) || typeof thumbnail["source"] !== "string") return null;

  try {
    const url = new URL(thumbnail["source"]);
    return url.protocol === "https:" && url.hostname === "thumb.wikimedia.org"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

async function fetchUniversityLogo(university: UniversityPage): Promise<UniversityLogoPlacement> {
  let source = university.sourceUrl;
  if (!source) {
    const response = await fetch(
      `https://id.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(university.title.replaceAll(" ", "_"))}`,
    );
    if (!response.ok) {
      throw new Error(
        `Wikipedia API gagal mengambil logo ${university.title} (HTTP ${response.status}).`,
      );
    }

    const payload: unknown = await response.json();
    source = getWikipediaThumbnail(payload);
  }
  if (!source) {
    throw new Error(`Wikipedia API tidak menyediakan thumbnail untuk ${university.title}.`);
  }

  return {
    key: university.key,
    title: university.title,
    source,
    top: university.top,
    left: university.left,
    size: university.size,
    depth: university.depth,
    tilt: university.tilt,
    delay: university.delay,
  };
}

export function loadUniversityLogos(): Promise<UniversityLogoPlacement[]> {
  if (!universityLogosRequest) {
    universityLogosRequest = Promise.allSettled(UNIVERSITY_PAGES.map(fetchUniversityLogo)).then(
      (results) => {
        const logos: UniversityLogoPlacement[] = [];
        for (const [index, result] of results.entries()) {
          if (result.status === "fulfilled") {
            logos.push(result.value);
          } else {
            const university = UNIVERSITY_PAGES[index]!;
            console.error(`Failed to load background logo for ${university.title}.`, result.reason);
          }
        }
        return logos;
      },
    );
  }
  return universityLogosRequest;
}
