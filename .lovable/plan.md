

## Soporte para hipotecas mixtas

### Problema
Cuando la oferta es de una **hipoteca mixta** (parte fija + parte variable), el sistema debe extraer específicamente:
- El **TIN del periodo fijo** (no el variable)
- La **cuota bonificada** (no la sin bonificar)

Actualmente el prompt no distingue entre tipos de hipoteca ni prioriza estos valores para mixtas.

### Cambios

**1. Actualizar el system prompt** (`supabase/functions/analyze-mortgage/index.ts`, líneas 9-30)

Añadir reglas específicas para hipotecas mixtas:
- Detectar si la oferta es mixta (palabras clave: "hipoteca mixta", "periodo fijo", "periodo variable", "tramo fijo", "tramo variable")
- Devolver un nuevo campo `tipo_hipoteca` ("fija", "variable", "mixta")
- Cuando sea mixta: el `tin_bonificado` debe ser el TIN del **tramo fijo**, y la `cuota_final` debe ser la **cuota bonificada** del tramo fijo
- Poner el tramo variable en `alternatives`

**2. Añadir campo `tipo_hipoteca` al schema de tool calling** (mismo archivo, dentro de `parameters.properties`)

Nuevo campo:
```
tipo_hipoteca: {
  type: "string",
  enum: ["fija", "variable", "mixta"],
  description: "Tipo de hipoteca detectado"
}
```

**3. Actualizar tipos TypeScript** (`src/types/mortgage.ts`)

Añadir `tipo_hipoteca: "fija" | "variable" | "mixta"` al tipo `MortgageAnalysisResult.extraction`.

**4. Actualizar el ResultsPanel** (`src/components/ResultsPanel.tsx`)

Mostrar un badge/etiqueta con el tipo de hipoteca detectado (Fija / Variable / Mixta) en la cabecera de resultados.

**5. Propagar el campo en el response mapping** (líneas 258-345 del edge function)

Incluir `tipo_hipoteca` en el objeto `result.extraction`.

