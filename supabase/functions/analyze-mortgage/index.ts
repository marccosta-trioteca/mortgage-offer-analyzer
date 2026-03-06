import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Eres un experto en análisis de ofertas hipotecarias españolas. Tu tarea es extraer datos estructurados de documentos de ofertas hipotecarias de bancos españoles.

Reglas CRÍTICAS:
1. NUNCA inventes valores. Si un campo no aparece claramente, devuelve null.
2. Para cada valor extraído, proporciona evidencia: texto exacto del documento y número de página.
3. Normaliza porcentajes: "2,35%" → 2.35
4. Normaliza moneda: "1.234,56 €" → 1234.56
5. Distingue claramente entre:
   - TIN (tipo nominal) vs TAE (tasa anual equivalente)
   - Bonificado vs sin bonificar (o "sin vinculación", "tipo base")
6. Prioriza el escenario principal que el banco llama "oferta", "condiciones ofertadas", "con bonificación"
7. Si hay varios escenarios/plazos, pon el principal y el resto en alternatives

TIPOS DE HIPOTECA:
- Detecta si la oferta es "fija", "variable" o "mixta"
- Palabras clave para mixta: "hipoteca mixta", "periodo fijo", "periodo variable", "tramo fijo", "tramo variable"
- Si es MIXTA:
  * tin_bonificado DEBE ser el TIN del TRAMO FIJO (no el variable)
  * cuota_final DEBE ser la CUOTA BONIFICADA del tramo fijo
  * Pon el tramo variable como un escenario en alternatives

Palabras clave a detectar:
- "TIN", "Tipo de interés nominal", "Tipo nominal anual"
- "TAE", "Tasa anual equivalente"  
- "Bonificación", "Tipo bonificado", "Con bonificación", "Con vinculación"
- "Sin bonificación", "Sin vinculación", "Tipo base"
- "Cuota", "cuota mensual", "importe cuota", "mensualidad"
- Productos: "nómina", "seguro hogar", "seguro vida", "tarjeta", "plan pensiones", "alarma"

Analiza el documento PDF y extrae los campos solicitados.`;

const TOOL_SCHEMA = {
  type: "function",
  function: {
    name: "extract_mortgage_data",
    description: "Extrae los datos estructurados de la oferta hipotecaria",
    parameters: {
      type: "object",
      properties: {
        tin_bonificado: {
          type: "object",
          properties: {
            value: { type: ["number", "null"], description: "TIN bonificado en %. null si no encontrado" },
            confidence: { type: "number", minimum: 0, maximum: 1 },
            evidence: {
              type: "array",
              items: {
                type: "object",
                properties: { page: { type: "number" }, text: { type: "string" } },
                required: ["page", "text"],
              },
            },
          },
          required: ["value", "confidence", "evidence"],
        },
        tin_sin_bonificar: {
          type: "object",
          properties: {
            value: { type: ["number", "null"] },
            confidence: { type: "number", minimum: 0, maximum: 1 },
            evidence: {
              type: "array",
              items: {
                type: "object",
                properties: { page: { type: "number" }, text: { type: "string" } },
                required: ["page", "text"],
              },
            },
          },
          required: ["value", "confidence", "evidence"],
        },
        tae: {
          type: "object",
          properties: {
            value: { type: ["number", "null"] },
            confidence: { type: "number", minimum: 0, maximum: 1 },
            evidence: {
              type: "array",
              items: {
                type: "object",
                properties: { page: { type: "number" }, text: { type: "string" } },
                required: ["page", "text"],
              },
            },
          },
          required: ["value", "confidence", "evidence"],
        },
        cuota_final: {
          type: "object",
          properties: {
            value: { type: ["number", "null"], description: "Cuota mensual en EUR" },
            confidence: { type: "number", minimum: 0, maximum: 1 },
            evidence: {
              type: "array",
              items: {
                type: "object",
                properties: { page: { type: "number" }, text: { type: "string" } },
                required: ["page", "text"],
              },
            },
          },
          required: ["value", "confidence", "evidence"],
        },
        bonificaciones: {
          type: "object",
          properties: {
            count: { type: "number" },
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  cost_value: { type: ["number", "null"] },
                  cost_unit: { type: "string" },
                  cost_period: { type: ["string", "null"] },
                  weight_type: { type: "string" },
                  weight_value: { type: ["number", "null"] },
                  weight_unit: { type: "string" },
                  weight_notes: { type: "string" },
                  confidence: { type: "number", minimum: 0, maximum: 1 },
                  evidence: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: { page: { type: "number" }, text: { type: "string" } },
                      required: ["page", "text"],
                    },
                  },
                },
                required: ["name", "confidence", "evidence"],
              },
            },
          },
          required: ["count", "items"],
        },
        alternatives: {
          type: "array",
          items: {
            type: "object",
            properties: {
              scenario: { type: "string" },
              tin_bonificado: { type: ["number", "null"] },
              tin_sin_bonificar: { type: ["number", "null"] },
              tae: { type: ["number", "null"] },
              cuota: { type: ["number", "null"] },
              notes: { type: "string" },
              evidence: {
                type: "array",
                items: {
                  type: "object",
                  properties: { page: { type: "number" }, text: { type: "string" } },
                  required: ["page", "text"],
                },
              },
            },
            required: ["scenario"],
          },
        },
        tipo_hipoteca: {
          type: "string",
          enum: ["fija", "variable", "mixta"],
        },
        needs_review: { type: "boolean" },
        review_notes: { type: "array", items: { type: "string" } },
      },
      required: [
        "tin_bonificado", "tin_sin_bonificar", "tae", "cuota_final",
        "bonificaciones", "alternatives", "tipo_hipoteca", "needs_review", "review_notes",
      ],
    },
  },
};

const MODELS = [
  { id: "openai/gpt-5", label: "GPT-5" },
  { id: "google/gemini-2.5-pro", label: "Gemini Pro" },
  { id: "google/gemini-2.5-flash", label: "Gemini Flash" },
];

async function callModel(
  model: string,
  userContent: any[],
  apiKey: string
): Promise<any> {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      tools: [TOOL_SCHEMA],
      tool_choice: { type: "function", function: { name: "extract_mortgage_data" } },
    }),
  });

  if (!response.ok) {
    const status = response.status;
    if (status === 429) throw new Error("RATE_LIMIT");
    if (status === 402) throw new Error("PAYMENT_REQUIRED");
    const errText = await response.text();
    console.error(`Model ${model} error:`, status, errText);
    throw new Error(`Model ${model} failed: ${status}`);
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall?.function?.arguments) throw new Error(`No output from ${model}`);

  return typeof toolCall.function.arguments === "string"
    ? JSON.parse(toolCall.function.arguments)
    : toolCall.function.arguments;
}

function valuesMatch(a: number | null, b: number | null, tolerance = 0.05): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return Math.abs(a - b) <= tolerance;
}

interface FieldConsensus {
  value: number | null;
  status: "full" | "partial" | "none";
  models_agreed: string[];
}

function getFieldConsensus(
  results: { label: string; value: number | null }[],
  tolerance = 0.05
): FieldConsensus {
  const [a, b, c] = results;

  const ab = valuesMatch(a.value, b.value, tolerance);
  const ac = valuesMatch(a.value, c.value, tolerance);
  const bc = valuesMatch(b.value, c.value, tolerance);

  if (ab && ac) {
    return { value: a.value, status: "full", models_agreed: [a.label, b.label, c.label] };
  }
  if (ab) {
    return { value: a.value, status: "partial", models_agreed: [a.label, b.label] };
  }
  if (ac) {
    return { value: a.value, status: "partial", models_agreed: [a.label, c.label] };
  }
  if (bc) {
    return { value: b.value, status: "partial", models_agreed: [b.label, c.label] };
  }
  // No agreement - pick the one with highest confidence from the first model
  return { value: a.value, status: "none", models_agreed: [] };
}

function buildExtraction(extracted: any) {
  return {
    tin_bonificado: {
      value: extracted.tin_bonificado?.value ?? null,
      unit: "percent",
      confidence: extracted.tin_bonificado?.confidence ?? 0,
      evidence: (extracted.tin_bonificado?.evidence || []).map((e: any) => ({
        page: e.page, text: e.text, bbox: null,
      })),
    },
    tin_sin_bonificar: {
      value: extracted.tin_sin_bonificar?.value ?? null,
      unit: "percent",
      confidence: extracted.tin_sin_bonificar?.confidence ?? 0,
      evidence: (extracted.tin_sin_bonificar?.evidence || []).map((e: any) => ({
        page: e.page, text: e.text, bbox: null,
      })),
    },
    tae: {
      value: extracted.tae?.value ?? null,
      unit: "percent",
      confidence: extracted.tae?.confidence ?? 0,
      evidence: (extracted.tae?.evidence || []).map((e: any) => ({
        page: e.page, text: e.text, bbox: null,
      })),
    },
    cuota_final: {
      value: extracted.cuota_final?.value ?? null,
      unit: "eur_per_month",
      confidence: extracted.cuota_final?.confidence ?? 0,
      evidence: (extracted.cuota_final?.evidence || []).map((e: any) => ({
        page: e.page, text: e.text, bbox: null,
      })),
    },
    bonificaciones: {
      count: extracted.bonificaciones?.count ?? 0,
      items: (extracted.bonificaciones?.items || []).map((item: any) => ({
        name: item.name || "",
        cost: { value: item.cost_value ?? null, unit: item.cost_unit || "eur_per_year", period: item.cost_period ?? null },
        weight: { type: item.weight_type || "rate_reduction_pp", value: item.weight_value ?? null, unit: item.weight_unit || "pp", notes: item.weight_notes || "" },
        confidence: item.confidence ?? 0,
        evidence: (item.evidence || []).map((e: any) => ({ page: e.page, text: e.text, bbox: null })),
      })),
    },
    alternatives: (extracted.alternatives || []).map((alt: any) => ({
      scenario: alt.scenario || "",
      tin_bonificado: alt.tin_bonificado ?? null,
      tin_sin_bonificar: alt.tin_sin_bonificar ?? null,
      tae: alt.tae ?? null,
      cuota: alt.cuota ?? null,
      notes: alt.notes || "",
      evidence: (alt.evidence || []).map((e: any) => ({ page: e.page, text: e.text, bbox: null })),
    })),
    tipo_hipoteca: extracted.tipo_hipoteca || "fija",
    needs_review: extracted.needs_review ?? false,
    review_notes: extracted.review_notes || [],
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pdf_base64, file_name, mime_type, text } = await req.json();

    if (!pdf_base64 && !text) {
      return new Response(
        JSON.stringify({ error: "No se proporcionó documento ni texto" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const detectedMime = mime_type || "application/pdf";
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const userContent = text
      ? [{ type: "text", text: `Analiza el siguiente texto de una oferta hipotecaria y extrae todos los campos:\n\n${text}` }]
      : [
          { type: "text", text: `Analiza este documento hipotecario y extrae todos los campos. Documento: "${file_name || "documento.pdf"}"` },
          { type: "image_url", image_url: { url: `data:${detectedMime};base64,${pdf_base64}` } },
        ];

    // Call all 3 models in parallel
    console.log("Calling 3 models in parallel...");
    const modelResults = await Promise.allSettled(
      MODELS.map((m) => callModel(m.id, userContent, LOVABLE_API_KEY))
    );

    // Check for rate limit / payment errors
    for (const r of modelResults) {
      if (r.status === "rejected") {
        if (r.reason?.message === "RATE_LIMIT") {
          return new Response(JSON.stringify({ error: "Límite de peticiones excedido, inténtelo más tarde." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (r.reason?.message === "PAYMENT_REQUIRED") {
          return new Response(JSON.stringify({ error: "Créditos agotados, añada fondos a su workspace." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    // Collect successful results
    const successResults: { label: string; extracted: any }[] = [];
    const failedModels: string[] = [];
    modelResults.forEach((r, i) => {
      if (r.status === "fulfilled") {
        successResults.push({ label: MODELS[i].label, extracted: r.value });
      } else {
        failedModels.push(MODELS[i].label);
        console.error(`Model ${MODELS[i].label} failed:`, r.reason);
      }
    });

    if (successResults.length === 0) {
      throw new Error("Los 3 modelos fallaron al analizar el documento");
    }

    // If only 1 model succeeded, return it with a warning
    if (successResults.length === 1) {
      const ext = buildExtraction(successResults[0].extracted);
      ext.needs_review = true;
      ext.review_notes.push(`Solo respondió 1 modelo (${successResults[0].label}). Modelos fallidos: ${failedModels.join(", ")}`);

      return new Response(JSON.stringify({
        document_meta: { file_name: file_name || (text ? "texto_pegado" : "documento.pdf"), pages: 0, language: "es" },
        extraction: ext,
        consensus: {
          status: "none",
          details: {
            tin_bonificado: { status: "none", models_agreed: [successResults[0].label], value: ext.tin_bonificado.value },
            tin_sin_bonificar: { status: "none", models_agreed: [successResults[0].label], value: ext.tin_sin_bonificar.value },
            tae: { status: "none", models_agreed: [successResults[0].label], value: ext.tae.value },
            cuota_final: { status: "none", models_agreed: [successResults[0].label], value: ext.cuota_final.value },
            tipo_hipoteca: { status: "none", models_agreed: [successResults[0].label] },
          },
          models_used: successResults.map((r) => r.label),
          models_failed: failedModels,
        },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Build consensus for key fields
    const KEY_FIELDS = ["tin_bonificado", "tin_sin_bonificar", "tae", "cuota_final"] as const;
    const fieldConsensus: Record<string, FieldConsensus> = {};

    // Pad to 3 results for consensus logic (duplicate last if only 2)
    const padded = successResults.length === 2
      ? [...successResults, successResults[1]]
      : successResults;

    for (const field of KEY_FIELDS) {
      const tolerance = field === "cuota_final" ? 1.0 : 0.05;
      fieldConsensus[field] = getFieldConsensus(
        padded.map((r) => ({ label: r.label, value: r.extracted[field]?.value ?? null })),
        tolerance
      );
    }

    // Tipo hipoteca consensus
    const tipos = padded.map((r) => r.extracted.tipo_hipoteca || "fija");
    const tipoConsensus = tipos[0] === tipos[1] && tipos[1] === tipos[2]
      ? { status: "full" as const, models_agreed: padded.map((r) => r.label) }
      : tipos[0] === tipos[1]
        ? { status: "partial" as const, models_agreed: [padded[0].label, padded[1].label] }
        : tipos[0] === tipos[2]
          ? { status: "partial" as const, models_agreed: [padded[0].label, padded[2].label] }
          : tipos[1] === tipos[2]
            ? { status: "partial" as const, models_agreed: [padded[1].label, padded[2].label] }
            : { status: "none" as const, models_agreed: [] };

    // Determine overall consensus
    const allStatuses = [...Object.values(fieldConsensus).map((c) => c.status), tipoConsensus.status];
    const overallStatus = allStatuses.every((s) => s === "full")
      ? "full"
      : allStatuses.some((s) => s === "none")
        ? "none"
        : "partial";

    // Build the final result using consensus values for key fields, and first model's data for the rest
    const baseExtracted = successResults[0].extracted;
    const finalExtraction = buildExtraction(baseExtracted);

    // Override key fields with consensus values
    for (const field of KEY_FIELDS) {
      const c = fieldConsensus[field];
      (finalExtraction as any)[field].value = c.value;
    }

    // Override tipo
    if (tipoConsensus.status !== "none") {
      const agreedModel = successResults.find((r) => tipoConsensus.models_agreed.includes(r.label));
      if (agreedModel) finalExtraction.tipo_hipoteca = agreedModel.extracted.tipo_hipoteca || "fija";
    }

    // Add review notes based on consensus
    const reviewNotes = [...finalExtraction.review_notes];
    if (failedModels.length > 0) {
      reviewNotes.push(`Modelos fallidos: ${failedModels.join(", ")}`);
    }

    for (const field of KEY_FIELDS) {
      const c = fieldConsensus[field];
      if (c.status === "partial") {
        const disagreeing = padded
          .filter((r) => !c.models_agreed.includes(r.label))
          .map((r) => `${r.label}: ${r.extracted[field]?.value ?? "null"}`);
        reviewNotes.push(`${field}: acuerdo parcial (${c.models_agreed.join(" + ")}). Discrepa: ${disagreeing.join(", ")}`);
      } else if (c.status === "none") {
        const allVals = padded.map((r) => `${r.label}: ${r.extracted[field]?.value ?? "null"}`);
        reviewNotes.push(`${field}: sin acuerdo entre modelos (${allVals.join(", ")})`);
      }
    }

    if (overallStatus !== "full") {
      finalExtraction.needs_review = true;
    }
    finalExtraction.review_notes = reviewNotes;

    // Validation
    if (finalExtraction.tae.value !== null && finalExtraction.tin_bonificado.value !== null && finalExtraction.tae.value < finalExtraction.tin_bonificado.value) {
      reviewNotes.push("Inconsistencia: TAE es menor que TIN bonificado");
      finalExtraction.needs_review = true;
    }
    if (finalExtraction.tin_bonificado.value !== null && finalExtraction.tin_sin_bonificar.value !== null && finalExtraction.tin_bonificado.value > finalExtraction.tin_sin_bonificar.value) {
      reviewNotes.push("Inconsistencia: TIN bonificado es mayor que TIN sin bonificar");
      finalExtraction.needs_review = true;
    }
    if (finalExtraction.bonificaciones.count !== finalExtraction.bonificaciones.items.length) {
      reviewNotes.push(`Inconsistencia: count (${finalExtraction.bonificaciones.count}) ≠ items.length (${finalExtraction.bonificaciones.items.length})`);
      finalExtraction.bonificaciones.count = finalExtraction.bonificaciones.items.length;
    }

    const result = {
      document_meta: {
        file_name: file_name || (text ? "texto_pegado" : "documento.pdf"),
        pages: 0,
        language: "es",
      },
      extraction: finalExtraction,
      consensus: {
        status: overallStatus,
        details: {
          tin_bonificado: fieldConsensus.tin_bonificado,
          tin_sin_bonificar: fieldConsensus.tin_sin_bonificar,
          tae: fieldConsensus.tae,
          cuota_final: fieldConsensus.cuota_final,
          tipo_hipoteca: tipoConsensus,
        },
        models_used: successResults.map((r) => r.label),
        models_failed: failedModels,
      },
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-mortgage error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
