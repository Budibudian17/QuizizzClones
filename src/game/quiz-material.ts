import JSZip from "jszip";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MAX_TEXT_CHARACTERS = 50_000;
const MAX_DOCUMENT_PAGES = 100;

function decodeXmlText(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

export function extractPptxSlideText(xml: string): string {
  return [...xml.matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g)]
    .map((match) => decodeXmlText(match[1] ?? "").trim())
    .filter(Boolean)
    .join(" ");
}

function validateExtractedText(text: string): string {
  const normalized = text
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (normalized.length < 100) {
    throw new Error(
      "Teks materi terlalu sedikit untuk dibuatkan soal. Pastikan file berisi teks, bukan hanya gambar atau hasil scan.",
    );
  }
  if (normalized.length > MAX_TEXT_CHARACTERS) {
    throw new Error(
      "Materi terlalu panjang untuk diproses sekaligus. Coba ringkas atau pecah file menjadi beberapa bagian.",
    );
  }
  return normalized;
}

async function extractPptxText(file: File): Promise<string> {
  const archive = await JSZip.loadAsync(await file.arrayBuffer());
  const slideNames = Object.keys(archive.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((left, right) => {
      const leftNumber = Number(left.match(/slide(\d+)\.xml$/)?.[1] ?? 0);
      const rightNumber = Number(right.match(/slide(\d+)\.xml$/)?.[1] ?? 0);
      return leftNumber - rightNumber;
    });

  if (slideNames.length === 0) {
    throw new Error("File PPTX ini tidak memiliki slide yang bisa dibaca.");
  }
  if (slideNames.length > MAX_DOCUMENT_PAGES) {
    throw new Error(`Jumlah slide melebihi batas ${MAX_DOCUMENT_PAGES} slide.`);
  }

  const slideTexts = await Promise.all(
    slideNames.map(async (name) => {
      const slide = archive.file(name);
      if (!slide) return "";
      return extractPptxSlideText(await slide.async("text"));
    }),
  );
  return validateExtractedText(slideTexts.filter(Boolean).join("\n"));
}

async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

  const document = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  if (document.numPages > MAX_DOCUMENT_PAGES) {
    await document.destroy();
    throw new Error(`Jumlah halaman melebihi batas ${MAX_DOCUMENT_PAGES} halaman.`);
  }

  const pages: string[] = [];
  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(
        content.items.flatMap((item) => ("str" in item && item.str ? [item.str] : [])).join(" "),
      );
    }
  } finally {
    await document.destroy();
  }

  return validateExtractedText(pages.join("\n"));
}

export async function extractQuizMaterialText(file: File): Promise<string> {
  if (file.size === 0) throw new Error("File yang dipilih kosong.");
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("Ukuran file maksimal 15 MB.");
  }

  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "pptx") return extractPptxText(file);
  if (extension === "pdf") return extractPdfText(file);
  throw new Error("Format file belum didukung. Pilih file .pptx atau .pdf.");
}
