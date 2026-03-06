export interface Evidence {
  page: number;
  text: string;
  bbox: [number, number, number, number] | null;
}

export interface ExtractionField {
  value: number | null;
  unit: string;
  confidence: number;
  evidence: Evidence[];
}

export interface BonificacionCost {
  value: number | null;
  unit: string;
  period: string | null;
}

export interface BonificacionWeight {
  type: string;
  value: number | null;
  unit: string;
  notes: string;
}

export interface Bonificacion {
  name: string;
  cost: BonificacionCost;
  weight: BonificacionWeight;
  confidence: number;
  evidence: Evidence[];
}

export interface Alternative {
  scenario: string;
  tin_bonificado: number | null;
  tin_sin_bonificar: number | null;
  tae: number | null;
  cuota: number | null;
  notes: string;
  evidence: Evidence[];
}

export interface FieldConsensusDetail {
  status: "full" | "partial" | "none";
  models_agreed: string[];
  value?: number | null;
}

export interface ConsensusInfo {
  status: "full" | "partial" | "none";
  details: {
    tin_bonificado: FieldConsensusDetail;
    tin_sin_bonificar: FieldConsensusDetail;
    tae: FieldConsensusDetail;
    cuota_final: FieldConsensusDetail;
    tipo_hipoteca: FieldConsensusDetail;
  };
  models_used: string[];
  models_failed: string[];
}

export interface MortgageAnalysisResult {
  document_meta: {
    file_name: string;
    pages: number;
    language: string;
  };
  extraction: {
    tin_bonificado: ExtractionField;
    tin_sin_bonificar: ExtractionField;
    tae: ExtractionField;
    cuota_final: ExtractionField;
    bonificaciones: {
      count: number;
      items: Bonificacion[];
    };
    alternatives: Alternative[];
    tipo_hipoteca: "fija" | "variable" | "mixta";
    needs_review: boolean;
    review_notes: string[];
  };
  consensus?: ConsensusInfo;
}
