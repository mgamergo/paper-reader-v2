import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { mkdir, writeFile } from "node:fs/promises";
export async function makeReaderFixture(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle("Contextual Reading and Attention");
  pdf.setAuthor("Reader verification team");
  pdf.setSubject(
    "An original test fixture for the research reader, not a published study",
  );
  const font = await pdf.embedFont(StandardFonts.TimesRoman);
  const bold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const addPage = (lines: string[]) => {
    const page = pdf.addPage([612, 792]);
    let y = 740;
    for (const line of lines) {
      const heading = /^(?:\d |Abstract|References|Figure|Table)/.test(line);
      page.drawText(line, {
        x: 50,
        y,
        size: heading ? 14 : 11,
        font: heading ? bold : font,
        color: rgb(0.08, 0.13, 0.2),
      });
      y -= line === "" ? 12 : 20;
    }
    return page;
  };
  addPage([
    "Contextual Reading and Attention",
    "Reader verification team, 2026",
    "An original verification fixture. Not a published research study.",
    "",
    "Abstract",
    "Attention is a mechanism that weights input representations according to relevance.",
    "This fixture explains attention in machine learning and includes citation examples.",
    "",
    "1 Introduction",
    "In machine learning, attention assigns different weights to input representations.",
    "The Transformer uses attention instead of recurrence for sequence modeling [1].",
    "The word attention here refers to a weighting mechanism, not human concentration.",
    "See Fig. 1 for the information flow and Eq. (1) for the attention formula.",
    "",
    "2 Methods",
    "We compute scaled dot-product attention using queries, keys, and values.",
    "A query compares against keys to determine the weights applied to values.",
    "Attention(Q, K, V) = softmax(QK^T / sqrt(d_k)) V   (1)",
    "",
    "Figure 1. Information flow through a self-attention block.",
    "Input representations -> Queries, keys, values -> Weighted output.",
    "",
    "Table 1. Components of scaled dot-product attention.",
    "Query: current position. Key: matching representation. Value: content.",
  ]);
  addPage([
    "3 Results and limitations",
    "This fixture demonstrates selection, citation jumps, and contextual explanations.",
    "It does not report an empirical experiment or establish performance improvements.",
    "Information absent from the text must be answered with an unsupported refusal.",
    "Retrieval augmentation combines parametric and non-parametric memory [2].",
    "",
    "References",
    "[1] Ashish Vaswani, Noam Shazeer, Niki Parmar, Jakob Uszkoreit, Llion Jones.",
    "Attention Is All You Need. Advances in Neural Information Processing Systems. 2017.",
    "https://arxiv.org/abs/1706.03762",
    "[2] Patrick Lewis, Ethan Perez, Aleksandra Piktus, Fabio Petroni.",
    "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks. 2020.",
    "https://arxiv.org/abs/2005.11401",
  ]);
  return pdf.save();
}
if (import.meta.main) {
  await mkdir("tests/fixtures/reader", { recursive: true });
  await writeFile(
    "tests/fixtures/reader/contextual-reading.pdf",
    await makeReaderFixture(),
  );
}
