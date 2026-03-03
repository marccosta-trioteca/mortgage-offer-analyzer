

## Simplify Edge Function: Send PDF Directly to LLM

### What the user wants
The current edge function has a custom PDF text parser (lines 11-80) that tries to extract text from the PDF binary. The user wants a simpler approach: send the PDF directly to the AI model and let it do all the work.

### Plan

**Single change: Rewrite `supabase/functions/analyze-mortgage/index.ts`**

1. **Remove** the custom `extractTextFromPdf` function entirely (lines 11-80)
2. **Send the PDF as base64 to Gemini's multimodal API** — Gemini models support PDF/image inputs natively via the `image_url` content type with a `data:application/pdf;base64,...` data URI
3. **Keep everything else**: the system prompt, tool calling schema, validation logic, and response mapping

The flow becomes:
```text
Client sends base64 PDF → Edge function forwards to Gemini as multimodal input → Gemini reads the PDF directly → Returns structured data via tool calling → Validation → Response
```

The key change is in the `messages` payload — instead of sending extracted text as a user message, we send the PDF as a multimodal content part:

```typescript
messages: [
  { role: "system", content: SYSTEM_PROMPT },
  {
    role: "user",
    content: [
      { type: "text", text: `Analiza este documento hipotecario: "${file_name}"` },
      { type: "image_url", url: { url: `data:application/pdf;base64,${pdf_base64}` } }
    ]
  }
]
```

This eliminates the fragile text extraction, supports scanned PDFs (Gemini has built-in OCR), and gives the model full visual context of tables and layouts.

### What stays the same
- CORS headers
- Tool calling schema for structured output
- Validation logic (TAE ≥ TIN, bonificado ≤ sin bonificar, count check)
- Response mapping to the expected JSON schema
- Rate limit / error handling

