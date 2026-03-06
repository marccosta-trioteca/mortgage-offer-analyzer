import { useState, useCallback } from "react";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PdfUploadZone } from "@/components/PdfUploadZone";
import { PdfViewer } from "@/components/PdfViewer";
import { TextPasteZone } from "@/components/TextPasteZone";
import { ResultsPanel } from "@/components/ResultsPanel";
import { ModelProgress, type ModelStatus } from "@/components/ModelProgress";
import { AnalysisHistory, type ComparisonItem } from "@/components/AnalysisHistory";
import { ComparisonView, type ComparisonRecord } from "@/components/ComparisonView";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Loader2, FileSearch, Upload, ClipboardPaste } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { MortgageAnalysisResult } from "@/types/mortgage";

const INITIAL_MODELS: ModelStatus[] = [
  { label: "Gemini 3 Flash", status: "running" },
  { label: "Gemini Pro", status: "running" },
  { label: "Gemini Flash", status: "running" },
];

interface AnalysisResultEntry {
  file: File;
  result: MortgageAnalysisResult;
}

async function analyzeFile(
  file: File,
  onModelUpdate: (index: number, status: string) => void,
  onProgress: (value: number) => void
): Promise<MortgageAnalysisResult> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const body = { pdf_base64: btoa(binary), file_name: file.name, mime_type: file.type };

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-mortgage`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok || !resp.body) {
    const errText = await resp.text();
    let errMsg = "Error en el análisis";
    try { errMsg = JSON.parse(errText).error || errMsg; } catch {}
    throw new Error(errMsg);
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let sseBuffer = "";
  let finalResult: MortgageAnalysisResult | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    sseBuffer += decoder.decode(value, { stream: true });

    let newlineIndex: number;
    while ((newlineIndex = sseBuffer.indexOf("\n\n")) !== -1) {
      const block = sseBuffer.slice(0, newlineIndex);
      sseBuffer = sseBuffer.slice(newlineIndex + 2);

      let eventType = "";
      let eventData = "";
      for (const line of block.split("\n")) {
        if (line.startsWith("event: ")) eventType = line.slice(7).trim();
        if (line.startsWith("data: ")) eventData = line.slice(6).trim();
      }
      if (!eventType || !eventData) continue;

      try {
        const parsed = JSON.parse(eventData);
        if (eventType === "model_complete") {
          onModelUpdate(parsed.index, parsed.status === "success" ? "success" : "error");
          onProgress(Math.min(85, 20 + parsed.index * 25));
        }
        if (eventType === "progress" && parsed.phase === "consensus") onProgress(90);
        if (eventType === "result") { finalResult = parsed; onProgress(100); }
        if (eventType === "error") throw new Error(parsed.error || "Error");
      } catch (e: any) {
        if (e.message && !e.message.includes("JSON")) throw e;
      }
    }
  }

  if (!finalResult) throw new Error("No se recibió resultado del análisis");
  return finalResult;
}

async function analyzeText(
  text: string,
  onModelUpdate: (index: number, status: string) => void,
  onProgress: (value: number) => void
): Promise<MortgageAnalysisResult> {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-mortgage`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ text }),
  });

  if (!resp.ok || !resp.body) {
    const errText = await resp.text();
    let errMsg = "Error en el análisis";
    try { errMsg = JSON.parse(errText).error || errMsg; } catch {}
    throw new Error(errMsg);
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let sseBuffer = "";
  let finalResult: MortgageAnalysisResult | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    sseBuffer += decoder.decode(value, { stream: true });

    let newlineIndex: number;
    while ((newlineIndex = sseBuffer.indexOf("\n\n")) !== -1) {
      const block = sseBuffer.slice(0, newlineIndex);
      sseBuffer = sseBuffer.slice(newlineIndex + 2);

      let eventType = "";
      let eventData = "";
      for (const line of block.split("\n")) {
        if (line.startsWith("event: ")) eventType = line.slice(7).trim();
        if (line.startsWith("data: ")) eventData = line.slice(6).trim();
      }
      if (!eventType || !eventData) continue;

      try {
        const parsed = JSON.parse(eventData);
        if (eventType === "model_complete") {
          onModelUpdate(parsed.index, parsed.status === "success" ? "success" : "error");
          onProgress(Math.min(85, 20 + parsed.index * 25));
        }
        if (eventType === "progress" && parsed.phase === "consensus") onProgress(90);
        if (eventType === "result") { finalResult = parsed; onProgress(100); }
        if (eventType === "error") throw new Error(parsed.error || "Error");
      } catch (e: any) {
        if (e.message && !e.message.includes("JSON")) throw e;
      }
    }
  }

  if (!finalResult) throw new Error("No se recibió resultado del análisis");
  return finalResult;
}

const Index = () => {
  // Multi-file state
  const [files, setFiles] = useState<File[]>([]);
  const [selectedFileIdx, setSelectedFileIdx] = useState<number>(0);
  const [pastedText, setPastedText] = useState("");
  const [inputMode, setInputMode] = useState<"file" | "text">("file");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState<AnalysisResultEntry[]>([]);
  const [singleResult, setSingleResult] = useState<MortgageAnalysisResult | null>(null);
  const [highlightedPage, setHighlightedPage] = useState<number | null>(null);
  const [highlightedText, setHighlightedText] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [modelStatuses, setModelStatuses] = useState<ModelStatus[]>(INITIAL_MODELS);
  const [comparison, setComparison] = useState<ComparisonRecord[] | null>(null);
  const [analyzingLabel, setAnalyzingLabel] = useState("");

  const hasInput = inputMode === "file" ? files.length > 0 : pastedText.trim().length > 0;

  const handleFileSelect = useCallback((f: File) => {
    if (f.size > 20 * 1024 * 1024) {
      toast({ title: "Error", description: "El archivo excede 20MB", variant: "destructive" });
      return;
    }
    setFiles([f]);
    setSelectedFileIdx(0);
    setResults([]);
    setSingleResult(null);
    setComparison(null);
    setHighlightedPage(null);
  }, []);

  const handleFilesSelect = useCallback((newFiles: File[]) => {
    const valid = newFiles.filter((f) => {
      if (f.size > 20 * 1024 * 1024) {
        toast({ title: "Error", description: `${f.name} excede 20MB`, variant: "destructive" });
        return false;
      }
      return true;
    });
    setFiles((prev) => [...prev, ...valid]);
    setResults([]);
    setSingleResult(null);
    setComparison(null);
  }, []);

  const handleRemoveFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setResults([]);
    setSingleResult(null);
    setComparison(null);
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!hasInput) return;
    setIsAnalyzing(true);
    setResults([]);
    setSingleResult(null);
    setComparison(null);

    try {
      if (inputMode === "text") {
        setProgress(10);
        setModelStatuses(INITIAL_MODELS.map((m) => ({ ...m, status: "running" })));
        setAnalyzingLabel("texto");

        const result = await analyzeText(
          pastedText.trim(),
          (idx, status) =>
            setModelStatuses((prev) =>
              prev.map((m, i) => (i === idx ? { ...m, status: status as any } : m))
            ),
          setProgress
        );

        setSingleResult(result);
        toast({ title: "Análisis completado" });
      } else if (files.length === 1) {
        // Single file — same as before
        setProgress(10);
        setModelStatuses(INITIAL_MODELS.map((m) => ({ ...m, status: "running" })));
        setAnalyzingLabel(files[0].name);

        const result = await analyzeFile(
          files[0],
          (idx, status) =>
            setModelStatuses((prev) =>
              prev.map((m, i) => (i === idx ? { ...m, status: status as any } : m))
            ),
          setProgress
        );

        setSingleResult(result);
        toast({ title: "Análisis completado" });
      } else {
        // Multiple files — analyze sequentially and auto-compare
        const allResults: AnalysisResultEntry[] = [];

        for (let fi = 0; fi < files.length; fi++) {
          const file = files[fi];
          setAnalyzingLabel(`${file.name} (${fi + 1}/${files.length})`);
          setProgress(0);
          setModelStatuses(INITIAL_MODELS.map((m) => ({ ...m, status: "running" })));

          try {
            const result = await analyzeFile(
              file,
              (idx, status) =>
                setModelStatuses((prev) =>
                  prev.map((m, i) => (i === idx ? { ...m, status: status as any } : m))
                ),
              setProgress
            );

            allResults.push({ file, result });
          } catch (e: any) {
            console.error(`Error analyzing ${file.name}:`, e);
            toast({
              title: `Error al analizar ${file.name}`,
              description: e.message,
              variant: "destructive",
            });
          }
        }

        setResults(allResults);

        if (allResults.length > 1) {
          // Auto-show comparison
          const compItems: ComparisonRecord[] = allResults.map((entry) => ({
            result: entry.result,
            fileName: entry.file.name,
          }));
          setComparison(compItems);
          toast({ title: `${allResults.length} análisis completados`, description: "Mostrando comparación" });
        } else if (allResults.length === 1) {
          setSingleResult(allResults[0].result);
          toast({ title: "Análisis completado" });
        }
      }
    } catch (e: any) {
      console.error(e);
      toast({
        title: "Error al analizar",
        description: e.message || "Error desconocido",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
      setAnalyzingLabel("");
      setTimeout(() => setProgress(0), 1000);
    }
  }, [files, pastedText, inputMode, hasInput]);

  const handleConfirmAndSave = useCallback(
    async (editedResult: MortgageAnalysisResult) => {
      try {
        const { error } = await supabase.from("analyses").insert([
          {
            file_name: editedResult.document_meta.file_name,
            mime_type: files[selectedFileIdx]?.type || null,
            result: JSON.parse(JSON.stringify(editedResult)),
          },
        ]);
        if (error) throw error;
        toast({ title: "Guardado", description: "Análisis guardado en el historial" });
      } catch (e: any) {
        console.error(e);
        toast({ title: "Error al guardar", description: e.message, variant: "destructive" });
      }
    },
    [files, selectedFileIdx]
  );

  const handleLoadFromHistory = useCallback((loadedResult: MortgageAnalysisResult, fileName: string) => {
    setSingleResult(loadedResult);
    setComparison(null);
    setInputMode("text");
  }, []);

  const handleCompareFromHistory = useCallback((items: [ComparisonItem, ComparisonItem]) => {
    setComparison(items);
    setSingleResult(null);
  }, []);

  const handleShowEvidence = useCallback((page: number, text: string) => {
    setHighlightedPage(page);
    setHighlightedText(text);
  }, []);

  const handleClearText = () => {
    setPastedText("");
    setSingleResult(null);
  };

  const currentFile = files[selectedFileIdx];
  const currentFileUrl = currentFile
    ? URL.createObjectURL(currentFile) + (currentFile.type.startsWith("image/") ? "#image" : "")
    : null;
  const showViewer = inputMode === "file" && currentFileUrl && files.length > 0;
  const activeResult = singleResult;
  const hasResult = !!activeResult;

  const AnalyzingIndicator = () => (
    <div className="flex h-full items-center justify-center p-8">
      <div className="w-full max-w-xs space-y-4">
        {analyzingLabel && (
          <p className="text-xs text-muted-foreground text-center truncate">{analyzingLabel}</p>
        )}
        <ModelProgress models={modelStatuses} />
      </div>
    </div>
  );

  // Comparison view (from multi-file or history)
  if (comparison) {
    return (
      <div className="flex h-screen flex-col bg-background">
        <ComparisonView items={comparison} onClose={() => setComparison(null)} />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b px-4 py-2.5">
        <div className="flex items-center gap-2">
          <FileSearch className="h-5 w-5 text-primary" />
          <h1 className="text-base font-bold text-foreground">Analizador de Hipotecas</h1>
        </div>
        <div className="flex items-center gap-2">
          <AnalysisHistory onLoad={handleLoadFromHistory} onCompare={handleCompareFromHistory} />
          {hasInput && (
            <Button onClick={handleAnalyze} disabled={isAnalyzing} size="sm">
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  Analizando{files.length > 1 ? ` (${files.length})` : ""}...
                </>
              ) : (
                <>Analizar{files.length > 1 ? ` (${files.length})` : ""}</>
              )}
            </Button>
          )}
        </div>
      </header>

      {/* Progress bar */}
      {isAnalyzing && <Progress value={progress} className="h-1 rounded-none" />}

      {/* Main content */}
      <div className="flex-1 overflow-hidden">
        {!showViewer && !hasResult && inputMode === "file" && !pastedText && !isAnalyzing ? (
          <div className="flex h-full items-center justify-center p-8">
            <div className="w-full max-w-lg">
              <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as "file" | "text")}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="file" className="gap-1.5">
                    <Upload className="h-3.5 w-3.5" />
                    Subir archivos
                  </TabsTrigger>
                  <TabsTrigger value="text" className="gap-1.5">
                    <ClipboardPaste className="h-3.5 w-3.5" />
                    Pegar texto
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="file" className="mt-4">
                  <PdfUploadZone
                    onFileSelect={handleFileSelect}
                    onFilesSelect={handleFilesSelect}
                    isLoading={isAnalyzing}
                    multiple
                    files={files}
                    onRemoveFile={handleRemoveFile}
                  />
                </TabsContent>
                <TabsContent value="text" className="mt-4">
                  <TextPasteZone value={pastedText} onChange={setPastedText} onClear={handleClearText} disabled={isAnalyzing} />
                </TabsContent>
              </Tabs>
            </div>
          </div>
        ) : inputMode === "text" ? (
          <ResizablePanelGroup direction="horizontal">
            <ResizablePanel defaultSize={55} minSize={30}>
              <div className="h-full flex flex-col">
                <div className="px-4 py-2 border-b">
                  <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as "file" | "text")}>
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="file" className="gap-1.5">
                        <Upload className="h-3.5 w-3.5" />
                        Archivo
                      </TabsTrigger>
                      <TabsTrigger value="text" className="gap-1.5">
                        <ClipboardPaste className="h-3.5 w-3.5" />
                        Texto
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
                <div className="flex-1 overflow-auto p-4">
                  <TextPasteZone value={pastedText} onChange={setPastedText} onClear={handleClearText} disabled={isAnalyzing} />
                </div>
              </div>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={45} minSize={25}>
              {activeResult ? (
                <ResultsPanel result={activeResult} onShowEvidence={handleShowEvidence} onConfirm={handleConfirmAndSave} />
              ) : isAnalyzing ? (
                <AnalyzingIndicator />
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground text-sm p-8 text-center">
                  <p>Haz clic en "Analizar" para extraer los datos de la hipoteca</p>
                </div>
              )}
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : (
          <ResizablePanelGroup direction="horizontal">
            <ResizablePanel defaultSize={55} minSize={30}>
              <div className="h-full flex flex-col">
                <div className="px-4 py-2 border-b">
                  <PdfUploadZone
                    onFileSelect={handleFileSelect}
                    onFilesSelect={handleFilesSelect}
                    isLoading={isAnalyzing}
                    multiple
                    files={files}
                    onRemoveFile={handleRemoveFile}
                  />
                </div>
                <div className="flex-1 overflow-hidden">
                  {currentFileUrl && (
                    <PdfViewer fileUrl={currentFileUrl} highlightedPage={highlightedPage} highlightedText={highlightedText} />
                  )}
                </div>
              </div>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={45} minSize={25}>
              {activeResult ? (
                <ResultsPanel result={activeResult} onShowEvidence={handleShowEvidence} onConfirm={handleConfirmAndSave} />
              ) : isAnalyzing ? (
                <AnalyzingIndicator />
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground text-sm p-8 text-center">
                  <p>Haz clic en "Analizar" para extraer los datos de la hipoteca</p>
                </div>
              )}
            </ResizablePanel>
          </ResizablePanelGroup>
        )}
      </div>
    </div>
  );
};

export default Index;
