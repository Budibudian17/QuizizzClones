import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { extractPptxSlideText, extractQuizMaterialText } from "@/game/quiz-material";

describe("quiz material extraction", () => {
  it("extracts slide text and decodes XML entities", () => {
    expect(
      extractPptxSlideText("<a:t>Materi &amp; tujuan</a:t><a:t>Soal &#x31; &#64; siswa</a:t>"),
    ).toBe("Materi & tujuan Soal 1 @ siswa");
  });

  it("reads PPTX slides in presentation order", async () => {
    const archive = new JSZip();
    archive.file("ppt/slides/slide2.xml", "<a:t>" + "materi kedua ".repeat(10) + "</a:t>");
    archive.file("ppt/slides/slide1.xml", "<a:t>" + "materi pertama ".repeat(10) + "</a:t>");
    const fileBuffer = await archive.generateAsync({ type: "arraybuffer" });
    const file = new File([fileBuffer], "materi.pptx");
    Object.defineProperty(file, "arrayBuffer", {
      value: () => Promise.resolve(fileBuffer),
    });

    const text = await extractQuizMaterialText(file);

    expect(text.indexOf("materi pertama")).toBeLessThan(text.indexOf("materi kedua"));
  });

  it("rejects unsupported, empty, and oversized files", async () => {
    await expect(extractQuizMaterialText(new File(["teks"], "materi.docx"))).rejects.toThrow(
      "Format file belum didukung",
    );
    await expect(extractQuizMaterialText(new File([], "materi.pptx"))).rejects.toThrow(
      "File yang dipilih kosong",
    );
    await expect(
      extractQuizMaterialText(new File([new Uint8Array(15 * 1024 * 1024 + 1)], "materi.pdf")),
    ).rejects.toThrow("maksimal 15 MB");
  });
});
