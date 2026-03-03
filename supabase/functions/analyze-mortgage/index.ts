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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pdf_base64, file_name } = await req.json();

    if (!pdf_base64) {
      return new Response(
        JSON.stringify({ error: "No se proporcionó el PDF" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Call Lovable AI with tool calling for structured output
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: `Analiza este documento hipotecario y extrae todos los campos. Documento: "${file_name || "documento.pdf"}"` },
              { type: "image_url", image_url: { url: `data:application/pdf;base64,${pdf_base64}` } },
            ],
          },
        ],
        tools: [
          {
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
                          properties: {
                            page: { type: "number" },
                            text: { type: "string", description: "Texto exacto del documento" },
                          },
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
                    description: "Tipo de hipoteca detectado: fija, variable o mixta",
                  },
                  needs_review: { type: "boolean" },
                  review_notes: { type: "array", items: { type: "string" } },
                },
                required: [
                  "tin_bonificado",
                  "tin_sin_bonificar",
                  "tae",
                  "cuota_final",
                  "bonificaciones",
                  "alternatives",
                  "tipo_hipoteca",
                  "needs_review",
                  "review_notes",
                ],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_mortgage_data" } },
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Límite de peticiones excedido, inténtelo más tarde." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos agotados, añada fondos a su workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      throw new Error("No structured output from AI");
    }

    let extracted;
    try {
      extracted = typeof toolCall.function.arguments === "string"
        ? JSON.parse(toolCall.function.arguments)
        : toolCall.function.arguments;
    } catch {
      throw new Error("Failed to parse AI structured output");
    }

    // Build response in the expected schema
    const result = {
      document_meta: {
        file_name: file_name || "documento.pdf",
        pages: 0,
        language: "es",
      },
      extraction: {
        tin_bonificado: {
          value: extracted.tin_bonificado?.value ?? null,
          unit: "percent",
          confidence: extracted.tin_bonificado?.confidence ?? 0,
          evidence: (extracted.tin_bonificado?.evidence || []).map((e: any) => ({
            page: e.page,
            text: e.text,
            bbox: null,
          })),
        },
        tin_sin_bonificar: {
          value: extracted.tin_sin_bonificar?.value ?? null,
          unit: "percent",
          confidence: extracted.tin_sin_bonificar?.confidence ?? 0,
          evidence: (extracted.tin_sin_bonificar?.evidence || []).map((e: any) => ({
            page: e.page,
            text: e.text,
            bbox: null,
          })),
        },
        tae: {
          value: extracted.tae?.value ?? null,
          unit: "percent",
          confidence: extracted.tae?.confidence ?? 0,
          evidence: (extracted.tae?.evidence || []).map((e: any) => ({
            page: e.page,
            text: e.text,
            bbox: null,
          })),
        },
        cuota_final: {
          value: extracted.cuota_final?.value ?? null,
          unit: "eur_per_month",
          confidence: extracted.cuota_final?.confidence ?? 0,
          evidence: (extracted.cuota_final?.evidence || []).map((e: any) => ({
            page: e.page,
            text: e.text,
            bbox: null,
          })),
        },
        bonificaciones: {
          count: extracted.bonificaciones?.count ?? 0,
          items: (extracted.bonificaciones?.items || []).map((item: any) => ({
            name: item.name || "",
            cost: {
              value: item.cost_value ?? null,
              unit: item.cost_unit || "eur_per_year",
              period: item.cost_period ?? null,
            },
            weight: {
              type: item.weight_type || "rate_reduction_pp",
              value: item.weight_value ?? null,
              unit: item.weight_unit || "pp",
              notes: item.weight_notes || "",
            },
            confidence: item.confidence ?? 0,
            evidence: (item.evidence || []).map((e: any) => ({
              page: e.page,
              text: e.text,
              bbox: null,
            })),
          })),
        },
        alternatives: (extracted.alternatives || []).map((alt: any) => ({
          scenario: alt.scenario || "",
          tin_bonificado: alt.tin_bonificado ?? null,
          tin_sin_bonificar: alt.tin_sin_bonificar ?? null,
          tae: alt.tae ?? null,
          cuota: alt.cuota ?? null,
          notes: alt.notes || "",
          evidence: (alt.evidence || []).map((e: any) => ({
            page: e.page,
            text: e.text,
            bbox: null,
          })),
        })),
        tipo_hipoteca: extracted.tipo_hipoteca || "fija",
        needs_review: extracted.needs_review ?? false,
        review_notes: extracted.review_notes || [],
      },
    };

    // Validation
    const { extraction: ext } = result;
    const reviewNotes = [...ext.review_notes];

    if (ext.tae.value !== null && ext.tin_bonificado.value !== null && ext.tae.value < ext.tin_bonificado.value) {
      reviewNotes.push("Inconsistencia: TAE es menor que TIN bonificado");
      result.extraction.needs_review = true;
    }
    if (
      ext.tin_bonificado.value !== null &&
      ext.tin_sin_bonificar.value !== null &&
      ext.tin_bonificado.value > ext.tin_sin_bonificar.value
    ) {
      reviewNotes.push("Inconsistencia: TIN bonificado es mayor que TIN sin bonificar");
      result.extraction.needs_review = true;
    }
    if (ext.bonificaciones.count !== ext.bonificaciones.items.length) {
      reviewNotes.push(
        `Inconsistencia: count (${ext.bonificaciones.count}) ≠ items.length (${ext.bonificaciones.items.length})`
      );
      ext.bonificaciones.count = ext.bonificaciones.items.length;
    }

    result.extraction.review_notes = reviewNotes;

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
