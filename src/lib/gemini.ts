import "server-only";

const DEFAULT_BASE_URL = "https://api.cloubic.com";
const DEFAULT_API_VERSION = "v1beta";

type InlineData = {
  data: string;
  mimeType?: string;
  mime_type?: string;
};

type GenerateContentResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
        inlineData?: InlineData;
      }>;
    };
  }>;
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
};

function getRequiredApiKey() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY. Add it to .env.local before generating images.");
  }

  return apiKey;
}

function getGatewayBaseUrl() {
  return (
    process.env.GEMINI_BASE_URL ||
    process.env.CLOUBIC_BASE_URL ||
    DEFAULT_BASE_URL
  ).replace(/\/+$/, "");
}

function getApiVersion() {
  return process.env.GEMINI_API_VERSION || DEFAULT_API_VERSION;
}

function buildGenerateContentUrl(model: string) {
  const apiKey = getRequiredApiKey();
  const baseUrl = getGatewayBaseUrl();
  const apiVersion = getApiVersion();
  const normalizedModel = model.startsWith("models/") ? model : `models/${model}`;

  return `${baseUrl}/${apiVersion}/${normalizedModel}:generateContent?key=${encodeURIComponent(apiKey)}`;
}

export async function generateContentWithGeminiGateway(
  model: string,
  body: Record<string, unknown>,
) {
  const apiKey = getRequiredApiKey();
  const response = await fetch(buildGenerateContentUrl(model), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const json = (await response.json()) as GenerateContentResponse;

  if (!response.ok) {
    const message =
      json.error?.message ||
      `Gateway request failed with status ${response.status}.`;
    throw new Error(message);
  }

  return json;
}
