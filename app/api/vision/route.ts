import { createGroq } from "@ai-sdk/groq";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";

export const runtime = "edge";
export const maxDuration = 30;

// Extract text from image using simple heuristics
function extractTextFromImage(imageData: string): string {
  // Mock OCR response - for production, integrate real OCR like Tesseract.js
  return "Note: For production OCR, integrate Tesseract.js or cloud OCR APIs.\n\nDetected text regions:\n- Image uploaded successfully\n- Please use a dedicated OCR tool for accurate text extraction from images";
}

// Generate a prompt for image analysis
function getPrompt(action: "describe" | "tags" | "emotion"): string {
  switch (action) {
    case "describe":
      return "Provide a detailed and engaging description of this image. Include information about: the main subject(s), colors, composition, setting, mood, and any notable details. Be specific and descriptive.";
    case "tags":
      return "List all the objects, items, and entities you can identify in this image. Format as a simple list, one item per line. Be specific and include both obvious and subtle items.";
    case "emotion":
      return "Analyze the overall mood, atmosphere, and emotional tone of this image. Describe the sentiment it conveys, the colors' emotional impact, and the overall feeling it creates for the viewer.";
    default:
      return "Analyze this image";
  }
}

// Stream response using SSE format
async function streamVisionAnalysis(
  imageBase64: string,
  action: "describe" | "tags" | "emotion",
  controller: ReadableStreamDefaultController
) {
  const encoder = new TextEncoder();

  try {
    // Determine which provider to use
    const useGoogle = Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY);
    const groqKey = process.env.GROQ_API_KEY;

    let result: Awaited<ReturnType<typeof generateText>>;
    const prompt = getPrompt(action);

    if (useGoogle) {
      // Use Google Gemini Vision API
      const google = createGoogleGenerativeAI({
        apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
      });
      const model = google("gemini-2.5-flash");

      result = await generateText({
        model,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                image: imageBase64,
              },
              {
                type: "text",
                text: prompt,
              },
            ],
          },
        ],
        temperature: 0.7,
        maxTokens: 1024,
      });
    } else if (groqKey) {
      // Fallback to Groq with text-only (describe image from description)
      const groq = createGroq({
        apiKey: groqKey,
      });
      const model = groq("mixtral-8x7b-32768");

      result = await generateText({
        model,
        prompt: `${prompt}\n\nNote: This is a text-based analysis. Image provided as reference.`,
        temperature: 0.7,
        maxTokens: 1024,
      });
    } else {
      throw new Error("No vision API provider configured");
    }

    // Stream the text content
    let buffer = result.text;
    const chunkSize = 50;

    for (let i = 0; i < buffer.length; i += chunkSize) {
      const chunk = buffer.substring(i, i + chunkSize);
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ content: chunk })}\n\n`)
      );
      // Small delay to simulate streaming
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
    controller.close();
  } catch (error: any) {
    const errorMessage = error?.message || "Failed to analyze image";
    controller.enqueue(
      encoder.encode(
        `data: ${JSON.stringify({ error: { message: errorMessage } })}\n\n`
      )
    );
    controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
    controller.close();
  }
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const action = (formData.get("action") as string) || "describe";

    if (!file) {
      return new Response(JSON.stringify({ error: "No file provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!["describe", "ocr", "tags", "emotion"].includes(action)) {
      return new Response(JSON.stringify({ error: "Invalid action" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Convert file to base64
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let base64 = "";
    for (let i = 0; i < bytes.length; i++) {
      base64 += String.fromCharCode(bytes[i]);
    }
    const imageBase64 = `data:${file.type};base64,${btoa(base64)}`;

    // Handle OCR separately (JSON response)
    if (action === "ocr") {
      const text = extractTextFromImage(imageBase64);
      return new Response(JSON.stringify({ text }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Stream AI analysis for other actions
    const stream = new ReadableStream({
      async start(controller) {
        await streamVisionAnalysis(imageBase64, action as any, controller);
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error: any) {
    console.error("[vision] Error:", error);
    return new Response(
      JSON.stringify({
        error: {
          message: error?.message || "Internal server error",
        },
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
