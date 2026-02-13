import type { SupportedLocale } from "@/lib/types";

export const SEARCH_ERROR_MESSAGES: Record<
  SupportedLocale,
  { rateLimit: string; invalidInput: string }
> = {
  en: {
    rateLimit: "Rate limit exceeded. Please try again later.",
    invalidInput: "Invalid input",
  },
  nl: {
    rateLimit: "Rate limit bereikt. Probeer het later opnieuw.",
    invalidInput: "Ongeldige invoer",
  },
  fr: {
    rateLimit: "Limite de débit dépassée. Veuillez réessayer plus tard.",
    invalidInput: "Entrée invalide",
  },
  de: {
    rateLimit: "Rate-Limit überschritten. Bitte später erneut versuchen.",
    invalidInput: "Ungültige Eingabe",
  },
  es: {
    rateLimit: "Límite de velocidad excedido. Por favor intente más tarde.",
    invalidInput: "Entrada inválida",
  },
  pt: {
    rateLimit: "Limite de taxa excedido. Por favor tente mais tarde.",
    invalidInput: "Entrada inválida",
  },
};

export const DEEP_ANALYZE_ERROR_MESSAGES: Record<
  SupportedLocale,
  {
    rateLimit: string;
    invalidInput: string;
    workerMissing: string;
    analyzeFailed: string;
  }
> = {
  en: {
    rateLimit: "Rate limit exceeded. Please try again later.",
    invalidInput: "Invalid input",
    workerMissing: "WORKER_URL is not set",
    analyzeFailed: "Analysis failed",
  },
  nl: {
    rateLimit: "Rate limit bereikt. Probeer het later opnieuw.",
    invalidInput: "Ongeldige invoer",
    workerMissing: "WORKER_URL is niet ingesteld",
    analyzeFailed: "Analyse mislukt",
  },
  fr: {
    rateLimit: "Limite de débit dépassée. Veuillez réessayer plus tard.",
    invalidInput: "Entrée invalide",
    workerMissing: "WORKER_URL n'est pas défini",
    analyzeFailed: "Échec de l'analyse",
  },
  de: {
    rateLimit: "Rate-Limit überschritten. Bitte später erneut versuchen.",
    invalidInput: "Ungültige Eingabe",
    workerMissing: "WORKER_URL ist nicht gesetzt",
    analyzeFailed: "Analyse fehlgeschlagen",
  },
  es: {
    rateLimit: "Límite de velocidad excedido. Por favor intente más tarde.",
    invalidInput: "Entrada inválida",
    workerMissing: "WORKER_URL no está configurado",
    analyzeFailed: "Análisis fallido",
  },
  pt: {
    rateLimit: "Limite de taxa excedido. Por favor tente mais tarde.",
    invalidInput: "Entrada inválida",
    workerMissing: "WORKER_URL não está definido",
    analyzeFailed: "Análise falhou",
  },
};

export const SUMMARIZE_ERROR_MESSAGES: Record<
  SupportedLocale,
  { required: string; summaryFailed: string; unknown: string }
> = {
  en: {
    required: "searchTerm and documents array are required",
    summaryFailed: "Summary generation failed",
    unknown: "Unknown error occurred",
  },
  nl: {
    required: "searchTerm en documents array zijn verplicht",
    summaryFailed: "Samenvatting genereren mislukt",
    unknown: "Onbekende fout opgetreden",
  },
  fr: {
    required: "searchTerm et documents array sont requis",
    summaryFailed: "Échec de la génération du résumé",
    unknown: "Erreur inconnue",
  },
  de: {
    required: "searchTerm und documents array sind erforderlich",
    summaryFailed: "Zusammenfassungserstellung fehlgeschlagen",
    unknown: "Unbekannter Fehler",
  },
  es: {
    required: "searchTerm y documents array son obligatorios",
    summaryFailed: "Fallo al generar el resumen",
    unknown: "Ocurrió un error desconocido",
  },
  pt: {
    required: "searchTerm e documents array são obrigatórios",
    summaryFailed: "Falha na geração do resumo",
    unknown: "Erro desconhecido",
  },
};

export const CONSENT_ERROR_MESSAGES: Record<
  SupportedLocale,
  { rateLimit: string; invalidInput: string; serverError: string }
> = {
  en: {
    rateLimit: "Rate limit exceeded. Please try again later.",
    invalidInput: "Invalid input",
    serverError: "Unable to record consent",
  },
  nl: {
    rateLimit: "Rate limit bereikt. Probeer het later opnieuw.",
    invalidInput: "Ongeldige invoer",
    serverError: "Kan toestemming niet opslaan",
  },
  fr: {
    rateLimit: "Limite de débit dépassée. Veuillez réessayer plus tard.",
    invalidInput: "Entrée invalide",
    serverError: "Impossible d'enregistrer le consentement",
  },
  de: {
    rateLimit: "Rate-Limit überschritten. Bitte später erneut versuchen.",
    invalidInput: "Ungültige Eingabe",
    serverError: "Zustimmung konnte nicht gespeichert werden",
  },
  es: {
    rateLimit: "Límite de velocidad excedido. Por favor intente más tarde.",
    invalidInput: "Entrada inválida",
    serverError: "No se pudo guardar el consentimiento",
  },
  pt: {
    rateLimit: "Limite de taxa excedido. Por favor tente mais tarde.",
    invalidInput: "Entrada inválida",
    serverError: "Não foi possível salvar o consentimento",
  },
};
