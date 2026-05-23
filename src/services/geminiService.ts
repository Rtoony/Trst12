import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });

export interface ExtractionPreferences {
  lookFor: string[];
  ignore: string[];
}

export interface ExtractionResult {
  text: string;
  json: any;
}

export async function detectDocumentType(
  fileBase64: string,
  mimeType: string
): Promise<string> {
  const model = "gemini-3-flash-preview";

  const prompt = `
    Analyze this document and identify its primary type from the following categories:
    - ATF Form 4473 (Federal Firearms Transaction Record)
    - DROS (Dealer Record of Sale)
    - FSC (Firearm Safety Certificate)
    - Proof of Residency (Utility bill, Lease, etc.)
    - Other Firearms Compliance Document
    - Unknown/Non-compliant Document

    Return ONLY the name of the category.
  `;

  const result = await ai.models.generateContent({
    model: model,
    contents: [
      {
        parts: [
          {
            inlineData: {
              data: fileBase64,
              mimeType: mimeType,
            },
          },
          {
            text: prompt,
          },
        ],
      },
    ],
  });

  return result.text.trim();
}

export async function extractDocumentData(
  fileBase64: string,
  mimeType: string,
  preferences: ExtractionPreferences
): Promise<ExtractionResult> {
  const model = "gemini-3-flash-preview";

  const prompt = `
    Analyze this document specifically for California Firearms Transfer Compliance.
    
    DOMAINS TO WATCH:
    1. ATF Form 4473 (Federal Firearms Transaction Record)
    2. DROS (Dealer Record of Sale) documentation
    3. FSC (Firearm Safety Certificate)
    4. Proof of Residency (Utility bills, Lease, specific CA requirements)
    5. FSD (Firearm Safety Device) compliance and Gun Safe Affidavits
    
    SPECIFIC INFORMATION TO LOOK FOR:
    ${preferences.lookFor.length > 0 ? preferences.lookFor.join(', ') : 'Extract all relevant personal data, serial numbers, certificate numbers, and addresses.'}
    
    INFORMATION TO IGNORE:
    ${preferences.ignore.length > 0 ? preferences.ignore.join(', ') : 'Non-essential boilerplate text and logos.'}

    REQUIREMENTS:
    - If it's a Form 4473, extract Section B answers (Yes/No).
    - If it's an FSC, extract the Certificate Number and Expiration Date.
    - If it's a Proof of Residency, identify the document type and verify if it's one of the CA-allowed types (Cable/Electric/Gas/Lease/Deed/Hunting License).
    
    Output the extracted information in a structured JSON format. 
    Also provide a clean Markdown summary specifically highlighting compliance statuses or missing data.
  `;

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      json_data: {
        type: Type.OBJECT,
        description: "The extracted structured data in key-value pairs.",
      },
      markdown_summary: {
        type: Type.STRING,
        description: "A clean markdown summary of the extracted data.",
      },
    },
    required: ["json_data", "markdown_summary"],
  };

  const result = await ai.models.generateContent({
    model: model,
    contents: [
      {
        parts: [
          {
            inlineData: {
              data: fileBase64,
              mimeType: mimeType,
            },
          },
          {
            text: prompt,
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: responseSchema,
    },
  });

  const parsed = JSON.parse(result.text);

  return {
    text: parsed.markdown_summary,
    json: parsed.json_data,
  };
}
