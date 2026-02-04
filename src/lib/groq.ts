// Groq AI client for generating summaries
import Groq from "groq-sdk";

if (!process.env.GROQ_API_KEY) {
  throw new Error("GROQ_API_KEY environment variable is required");
}

export const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export const GROQ_MODEL = "llama-3.3-70b-versatile";

/**
 * Generate a Dutch summary of DOJ search results
 */
export async function generateSummary(
  searchTerm: string,
  documents: Array<{ fileName: string; content: string; fileUri: string }>,
  onStream?: (text: string) => void,
): Promise<string> {
  // Prepare context from documents
  const context = documents
    .slice(0, 10) // Limit to top 10 to avoid token limits
    .map((doc, idx) => {
      const preview = doc.content.substring(0, 500); // First 500 chars
      return `Document ${idx + 1} (${doc.fileName}):\n${preview}...`;
    })
    .join("\n\n---\n\n");

  const prompt = `Je bent een Nederlandse assistent die juridische documenten analyseert over de Epstein rechtszaak.

Een gebruiker heeft gezocht naar: "${searchTerm}"

Hieronder staan ${documents.length} relevante documenten gevonden op DOJ.gov:

${context}

Geef een Nederlandse samenvatting met:
1. **Belangrijkste bevindingen**: Wat zijn de meest relevante feiten?
2. **Genoemde personen**: Welke namen worden genoemd in relatie tot "${searchTerm}"?
3. **Datums en locaties**: Belangrijke tijdstippen en plaatsen
4. **Context**: Wat is de generale context van deze documenten?

Wees feitelijk, objectief en bondig. Vermijd speculatie. Gebruik bullet points waar mogelijk.`;

  if (onStream) {
    // Streaming mode
    const stream = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      stream: true,
      temperature: 0.3,
      max_tokens: 2000,
    });

    let fullText = "";
    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content || "";
      fullText += text;
      onStream(text);
    }

    return fullText;
  } else {
    // Non-streaming mode
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    });

    return (
      completion.choices[0]?.message?.content ||
      "Geen samenvatting beschikbaar."
    );
  }
}

/**
 * Generate a deep analysis summary from full PDF text
 */
export async function generateDeepSummary(
  fileName: string,
  fullText: string,
  searchTerm?: string,
  onStream?: (text: string) => void,
): Promise<string> {
  const textPreview = fullText.substring(0, 8000); // Limit to ~8K chars to fit token budget

  const prompt = `Je bent een Nederlandse assistent die een gedetailleerde analyse maakt van een juridisch document uit de Epstein rechtszaak.

Document: ${fileName}
${searchTerm ? `Zoekterm: "${searchTerm}"` : ""}

Volledige tekst (preview):
${textPreview}

Maak een uitgebreide Nederlandse analyse met:

1. **Documenttype**: Wat voor soort document is dit? (email, SMS, juridisch document, etc.)
2. **Betrokken personen**: Alle genoemde namen en hun relaties
3. **Tijdlijn**: Belangrijke datums en gebeurtenissen in chronologische volgorde
4. **Locaties**: Genoemde plaatsen en hun relevantie
5. **Kerninhoud**: Gedetailleerde samenvatting van de belangrijkste feiten
6. **Relevantie**: Waarom is dit document mogelijk belangrijk?

Wees grondig en feitelijk. Citeer specifieke passages waar relevant.`;

  if (onStream) {
    const stream = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [{ role: "user", content: prompt }],
      stream: true,
      temperature: 0.3,
      max_tokens: 3000,
    });

    let fullResponse = "";
    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content || "";
      fullResponse += text;
      onStream(text);
    }

    return fullResponse;
  } else {
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 3000,
    });

    return (
      completion.choices[0]?.message?.content || "Geen analyse beschikbaar."
    );
  }
}
