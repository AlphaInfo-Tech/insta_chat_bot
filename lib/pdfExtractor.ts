import pdfParse from 'pdf-parse';

interface PdfTextItem {
  str: string;
  transform: number[];
}

interface PdfPageData {
  getTextContent(options: { normalizeWhitespace: boolean; disableCombineTextItems: boolean }): Promise<{
    items: PdfTextItem[];
  }>;
}

/**
 * Extracts per-page plain text from a PDF buffer via pdf-parse's `pagerender`
 * hook (which pdf-parse otherwise only uses internally to build one
 * concatenated `text` string) — this is the production implementation
 * injected into KnowledgeIngestionService; tests inject a fake instead.
 */
export async function extractPdfPages(buffer: Buffer): Promise<string[]> {
  const pages: string[] = [];

  await pdfParse(buffer, {
    pagerender: async (pageData: PdfPageData) => {
      const textContent = await pageData.getTextContent({
        normalizeWhitespace: false,
        disableCombineTextItems: false,
      });

      let lastY: number | undefined;
      let text = '';
      for (const item of textContent.items) {
        if (lastY === item.transform[5] || lastY === undefined) {
          text += item.str;
        } else {
          text += `\n${item.str}`;
        }
        lastY = item.transform[5];
      }

      pages.push(text);
      return text;
    },
  });

  return pages;
}
