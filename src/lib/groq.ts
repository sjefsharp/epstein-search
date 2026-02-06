// Groq AI client for generating summaries
import Groq from "groq-sdk";

// Lazy initialization to avoid build-time errors
let groqClient: Groq | null = null;

function getGroqClient(): Groq {
  if (!groqClient) {
    if (!process.env.GROQ_API_KEY) {
      throw new Error("GROQ_API_KEY environment variable is required");
    }
    groqClient = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    });
  }
  return groqClient;
}

export const groq = getGroqClient;

export const GROQ_MODEL = "llama-3.3-70b-versatile";

type SupportedLocale = "en" | "nl" | "fr" | "de" | "es" | "pt";

const SUMMARY_PROMPTS: Record<
  SupportedLocale,
  (input: {
    searchTerm: string;
    documentsCount: number;
    context: string;
  }) => string
> = {
  en: ({
    searchTerm,
    documentsCount,
    context,
  }) => `You are an assistant analyzing legal documents related to the Epstein case.

The user searched for: "${searchTerm}"

Below are ${documentsCount} relevant documents found on DOJ.gov:

${context}

Provide an English summary with:
1. **Key findings**: Most relevant facts
2. **Named individuals**: People mentioned in relation to "${searchTerm}"
3. **Dates and locations**: Important time points and places
4. **Context**: Overall context of these documents

Be factual, objective, and concise. Avoid speculation. Use bullet points where possible.`,
  nl: ({
    searchTerm,
    documentsCount,
    context,
  }) => `Je bent een Nederlandse assistent die juridische documenten analyseert over de Epstein rechtszaak.

Een gebruiker heeft gezocht naar: "${searchTerm}"

Hieronder staan ${documentsCount} relevante documenten gevonden op DOJ.gov:

${context}

Geef een Nederlandse samenvatting met:
1. **Belangrijkste bevindingen**: Wat zijn de meest relevante feiten?
2. **Genoemde personen**: Welke namen worden genoemd in relatie tot "${searchTerm}"?
3. **Datums en locaties**: Belangrijke tijdstippen en plaatsen
4. **Context**: Wat is de generale context van deze documenten?

Wees feitelijk, objectief en bondig. Vermijd speculatie. Gebruik bullet points waar mogelijk.`,
  fr: ({
    searchTerm,
    documentsCount,
    context,
  }) => `Vous êtes un assistant qui analyse des documents juridiques liés à l'affaire Epstein.

L'utilisateur a recherché : "${searchTerm}"

Voici ${documentsCount} documents pertinents trouvés sur DOJ.gov :

${context}

Fournissez un résumé en français avec :
1. **Principales conclusions** : faits les plus pertinents
2. **Personnes nommées** : personnes mentionnées en relation avec "${searchTerm}"
3. **Dates et lieux** : dates et lieux importants
4. **Contexte** : contexte général de ces documents

Soyez factuel, objectif et concis. Évitez la spéculation. Utilisez des puces si possible.`,
  de: ({
    searchTerm,
    documentsCount,
    context,
  }) => `Sie sind ein Assistent, der juristische Dokumente zum Epstein-Fall analysiert.

Der Nutzer suchte nach: "${searchTerm}"

Nachfolgend ${documentsCount} relevante Dokumente von DOJ.gov:

${context}

Geben Sie eine Zusammenfassung auf Deutsch mit:
1. **Wichtigste Erkenntnisse**: relevanteste Fakten
2. **Genannte Personen**: Personen im Zusammenhang mit "${searchTerm}"
3. **Daten und Orte**: wichtige Zeitpunkte und Orte
4. **Kontext**: Gesamtzusammenhang dieser Dokumente

Seien Sie sachlich, objektiv und prägnant. Vermeiden Sie Spekulationen. Nutzen Sie Bullet Points, wenn möglich.`,
  es: ({
    searchTerm,
    documentsCount,
    context,
  }) => `Eres un asistente que analiza documentos legales relacionados con el caso Epstein.

El usuario buscó: "${searchTerm}"

A continuación hay ${documentsCount} documentos relevantes encontrados en DOJ.gov:

${context}

Proporciona un resumen en español con:
1. **Hallazgos clave**: hechos más relevantes
2. **Personas nombradas**: personas mencionadas en relación con "${searchTerm}"
3. **Fechas y lugares**: fechas y lugares importantes
4. **Contexto**: contexto general de estos documentos

Sé factual, objetivo y conciso. Evita la especulación. Usa viñetas cuando sea posible.`,
  pt: ({
    searchTerm,
    documentsCount,
    context,
  }) => `Você é um assistente que analisa documentos legais relacionados ao caso Epstein.

O usuário pesquisou por: "${searchTerm}"

Abaixo estão ${documentsCount} documentos relevantes encontrados em DOJ.gov:

${context}

Forneça um resumo em português com:
1. **Principais achados**: fatos mais relevantes
2. **Pessoas mencionadas**: pessoas citadas em relação a "${searchTerm}"
3. **Datas e locais**: datas e lugares importantes
4. **Contexto**: contexto geral destes documentos

Seja factual, objetivo e conciso. Evite especulação. Use marcadores quando possível.`,
};

const DEEP_ANALYSIS_PROMPTS: Record<
  SupportedLocale,
  (input: {
    fileName: string;
    searchTerm?: string;
    textPreview: string;
  }) => string
> = {
  en: ({
    fileName,
    searchTerm,
    textPreview,
  }) => `You are an assistant providing a detailed analysis of a legal document from the Epstein case.

Document: ${fileName}
${searchTerm ? `Search term: "${searchTerm}"` : ""}

Full text (preview):
${textPreview}

Produce a detailed English analysis with:
1. **Document type**: What kind of document is this?
2. **Involved persons**: All named people and relationships
3. **Timeline**: Key dates and events in chronological order
4. **Locations**: Mentioned places and relevance
5. **Core content**: Detailed summary of key facts
6. **Relevance**: Why this document may be important

Be thorough and factual. Quote specific passages where relevant.`,
  nl: ({
    fileName,
    searchTerm,
    textPreview,
  }) => `Je bent een Nederlandse assistent die een gedetailleerde analyse maakt van een juridisch document uit de Epstein rechtszaak.

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

Wees grondig en feitelijk. Citeer specifieke passages waar relevant.`,
  fr: ({
    fileName,
    searchTerm,
    textPreview,
  }) => `Vous êtes un assistant fournissant une analyse détaillée d'un document juridique lié à l'affaire Epstein.

Document : ${fileName}
${searchTerm ? `Terme recherché : "${searchTerm}"` : ""}

Texte complet (aperçu) :
${textPreview}

Rédigez une analyse détaillée en français avec :
1. **Type de document** : quel type de document est-ce ?
2. **Personnes impliquées** : toutes les personnes nommées et relations
3. **Chronologie** : dates et événements clés
4. **Lieux** : lieux mentionnés et pertinence
5. **Contenu principal** : résumé détaillé des faits
6. **Pertinence** : pourquoi ce document peut être important

Soyez exhaustif et factuel. Citez des passages spécifiques si pertinent.`,
  de: ({
    fileName,
    searchTerm,
    textPreview,
  }) => `Sie sind ein Assistent und erstellen eine detaillierte Analyse eines juristischen Dokuments zum Epstein-Fall.

Dokument: ${fileName}
${searchTerm ? `Suchbegriff: "${searchTerm}"` : ""}

Volltext (Auszug):
${textPreview}

Erstellen Sie eine detaillierte Analyse auf Deutsch mit:
1. **Dokumenttyp**: Welche Art von Dokument ist das?
2. **Beteiligte Personen**: Alle genannten Personen und Beziehungen
3. **Zeitlinie**: Wichtige Daten und Ereignisse
4. **Orte**: Genannte Orte und Relevanz
5. **Kerninhalt**: Detaillierte Zusammenfassung der wichtigsten Fakten
6. **Relevanz**: Warum dieses Dokument wichtig sein könnte

Seien Sie gründlich und faktisch. Zitieren Sie relevante Passagen.`,
  es: ({
    fileName,
    searchTerm,
    textPreview,
  }) => `Eres un asistente que proporciona un análisis detallado de un documento legal del caso Epstein.

Documento: ${fileName}
${searchTerm ? `Término de búsqueda: "${searchTerm}"` : ""}

Texto completo (vista previa):
${textPreview}

Redacta un análisis detallado en español con:
1. **Tipo de documento**: ¿qué tipo de documento es?
2. **Personas involucradas**: todas las personas mencionadas y relaciones
3. **Cronología**: fechas y eventos clave en orden cronológico
4. **Ubicaciones**: lugares mencionados y relevancia
5. **Contenido central**: resumen detallado de los hechos principales
6. **Relevancia**: por qué este documento puede ser importante

Sé exhaustivo y factual. Cita pasajes específicos cuando sea relevante.`,
  pt: ({
    fileName,
    searchTerm,
    textPreview,
  }) => `Você é um assistente que fornece uma análise detalhada de um documento legal do caso Epstein.

Documento: ${fileName}
${searchTerm ? `Termo de busca: "${searchTerm}"` : ""}

Texto completo (prévia):
${textPreview}

Produza uma análise detalhada em português com:
1. **Tipo de documento**: que tipo de documento é?
2. **Pessoas envolvidas**: todas as pessoas mencionadas e relações
3. **Linha do tempo**: datas e eventos-chave em ordem cronológica
4. **Locais**: lugares mencionados e relevância
5. **Conteúdo central**: resumo detalhado dos fatos principais
6. **Relevância**: por que este documento pode ser importante

Seja completo e factual. Cite passagens específicas quando relevante.`,
};

const normalizeLocale = (locale?: string): SupportedLocale => {
  if (!locale) return "en";
  const normalized = locale.toLowerCase();
  if (normalized.startsWith("nl")) return "nl";
  if (normalized.startsWith("fr")) return "fr";
  if (normalized.startsWith("de")) return "de";
  if (normalized.startsWith("es")) return "es";
  if (normalized.startsWith("pt")) return "pt";
  return "en";
};

/**
 * Generate a Dutch summary of DOJ search results
 */
export async function generateSummary(
  searchTerm: string,
  documents: Array<{ fileName: string; content: string; fileUri: string }>,
  locale?: string,
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

  const selectedLocale = normalizeLocale(locale);
  const prompt = SUMMARY_PROMPTS[selectedLocale]({
    searchTerm,
    documentsCount: documents.length,
    context,
  });

  if (onStream) {
    // Streaming mode
    const stream = await groq().chat.completions.create({
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
    const completion = await groq().chat.completions.create({
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
  locale?: string,
  onStream?: (text: string) => void,
): Promise<string> {
  const textPreview = fullText.substring(0, 8000); // Limit to ~8K chars to fit token budget

  const selectedLocale = normalizeLocale(locale);
  const prompt = DEEP_ANALYSIS_PROMPTS[selectedLocale]({
    fileName,
    searchTerm,
    textPreview,
  });

  if (onStream) {
    const stream = await groq().chat.completions.create({
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
    const completion = await groq().chat.completions.create({
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
