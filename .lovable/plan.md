

## Mortgage PDF Analyzer — Implementation Plan

### Overview
A stateless tool where users upload a Spanish mortgage offer PDF, which gets processed by a Lovable Cloud edge function (text extraction + LLM analysis), and results are displayed alongside an embedded PDF viewer with evidence highlighting.

---

### Page 1: Upload & Analysis View

**Left Panel — PDF Viewer**
- Drag & drop zone for PDF upload (accepts single PDF, max 20MB)
- After upload, render the PDF using `react-pdf` (pdf.js wrapper) page by page
- Evidence highlighting: overlay semi-transparent colored rectangles on pages where extracted data was found
- Clicking "ver evidencia" on any field scrolls to and highlights the relevant page/text

**Right Panel — Results**
- Loading state with progress indicator during analysis
- Extracted fields displayed as editable cards:
  - TIN bonificado (%), TIN sin bonificar (%), TAE (%), Cuota final (€/mes)
  - Each with confidence badge (0–1 scale, color-coded: green ≥0.8, yellow ≥0.5, red <0.5)
  - "Ver evidencia" link per field
- Bonificaciones section: list of extracted bonifications with name, cost, weight/impact
- Alternatives section (if multiple scenarios detected)
- Review warnings banner if `needs_review: true`
- Export buttons: "Exportar JSON" + "Copiar al portapapeles"

---

### Backend — Edge Function (`analyze-mortgage`)

1. **Receive PDF** as base64 in request body
2. **Extract text** from PDF using pdf-parse (npm) for embedded text
3. **Send extracted text to Lovable AI** (Gemini) with a structured prompt that:
   - Identifies sections (Condiciones, Tipo de interés, Bonificaciones, etc.)
   - Extracts TIN/TAE/cuota/bonificaciones using Spanish keyword patterns
   - Returns the exact JSON schema specified, with evidence (page + text)
   - Uses tool calling for structured output
4. **Validate** extracted data (TAE ≥ TIN, bonificado ≤ sin bonificar, count matches items)
5. **Return** the structured JSON response

---

### Key Technical Decisions
- **PDF rendering**: `react-pdf` library for the embedded viewer
- **PDF text extraction**: `pdf-parse` in the edge function (Deno-compatible)
- **LLM**: Lovable AI (Gemini) via edge function for structured extraction with tool calling
- **No OCR in v1**: Text-based PDFs only (most bank offers are digital). OCR noted as future enhancement.
- **No auth/persistence**: Stateless — upload, analyze, export

---

### Design
- Clean, professional UI with a split-pane layout (resizable)
- Spanish language interface to match the mortgage domain
- Confidence indicators with intuitive color coding
- Toast notifications for errors and completion

