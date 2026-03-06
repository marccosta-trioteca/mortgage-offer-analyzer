import { useState, useCallback } from "react";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PdfUploadZone } from "@/components/PdfUploadZone";
import { PdfViewer } from "@/components/PdfViewer";
import { TextPasteZone } from "@/components/TextPasteZone";
import { ResultsPanel } from "@/components/ResultsPanel";
import { ModelProgress, type ModelStatus } from "@/components/ModelProgress";
import { AnalysisHistory } from "@/components/AnalysisHistory";
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

const Index = () => {
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [pastedText, setPastedText] = useState("");
  const [inputMode, setInputMode] = useState<"file" | "text">("file");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<MortgageAnalysisResult | null>(null);
  const [highlightedPage, setHighlightedPage] = useState<number | null>(null);
  const [highlightedText, setHighlightedText] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [modelStatuses, setModelStatuses] = useState<ModelStatus[]>(INITIAL_MODELS);

  const hasInput = inputMode === "file" ? !!file : pastedText.trim().length > 0;

  const handleFileSelect = useCallback((f: File) => {
    if (f.size > 20 * 1024 * 1024) {
      toast({ title: "Error", description: "El archivo excede 20MB", variant: "destructive" });
      return;
    }
    setFile(f);
    const isImage = f.type.startsWith("image/");
    setFileUrl(URL.createObjectURL(f) + (isImage ? "#image" : ""));
    setResult(null);
    setHighlightedPage(null);
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!hasInput) return;
    setIsAnalyzing(true);
    setProgress(10);
    setModelStatuses(INITIAL_MODELS.map((m) => ({ ...m, status: "running" })));

    try {
      let body: Record<string, string>;

      if (inputMode === "text") {
        body = { text: pastedText.trim() };
      } else {
        const buffer = await file!.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        body = { pdf_base64: btoa(binary), file_name: file!.name, mime_type: file!.type };
      }

      setProgress(20);

      // Use SSE streaming to get progress updates
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
        // Try to parse as JSON error
        const errText = await resp.text();
        let errMsg = "Error en el análisis";
        try {
          const errJson = JSON.parse(errText);
          errMsg = errJson.error || errMsg;
        } catch {}
        throw new Error(errMsg);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer2 = "";
      let finalResult: MortgageAnalysisResult | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer2 += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer2.indexOf("\n\n")) !== -1) {
          const block = buffer2.slice(0, newlineIndex);
          buffer2 = buffer2.slice(newlineIndex + 2);

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
              const { index, status: modelStatus } = parsed;
              setModelStatuses((prev) =>
                prev.map((m, i) =>
                  i === index ? { ...m, status: modelStatus === "success" ? "success" : "error" } : m
                )
              );
              // Update progress based on completed models
              setProgress((prev) => Math.min(prev + 25, 85));
            }

            if (eventType === "progress" && parsed.phase === "consensus") {
              setProgress(90);
            }

            if (eventType === "result") {
              finalResult = parsed as MortgageAnalysisResult;
              setProgress(100);
            }

            if (eventType === "error") {
              throw new Error(parsed.error || "Error en el análisis");
            }
          } catch (e: any) {
            if (e.message && !e.message.includes("JSON")) throw e;
          }
        }
      }

      if (finalResult) {
        setResult(finalResult);
        toast({ title: "Análisis completado" });
      } else {
        throw new Error("No se recibió resultado del análisis");
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
      setTimeout(() => setProgress(0), 1000);
    }
  }, [file, pastedText, inputMode, hasInput]);

  const handleConfirmAndSave = useCallback(async (editedResult: MortgageAnalysisResult) => {
    try {
      const { error } = await supabase.from("analyses").insert([{
        file_name: editedResult.document_meta.file_name,
        mime_type: file?.type || null,
        result: JSON.parse(JSON.stringify(editedResult)),
      }]);
      if (error) throw error;
      toast({ title: "Guardado", description: "Análisis guardado en el historial" });
    } catch (e: any) {
      console.error(e);
      toast({ title: "Error al guardar", description: e.message, variant: "destructive" });
    }
  }, [file]);

  const handleLoadFromHistory = useCallback((loadedResult: MortgageAnalysisResult, fileName: string) => {
    setResult(loadedResult);
    setInputMode("text");
  }, []);

  const handleShowEvidence = useCallback((page: number, text: string) => {
    setHighlightedPage(page);
    setHighlightedText(text);
  }, []);

  const handleClearText = () => {
    setPastedText("");
    setResult(null);
  };

  const showViewer = inputMode === "file" && fileUrl;
  const hasResult = !!result;

  const AnalyzingIndicator = () => (
    <div className="flex h-full items-center justify-center p-8">
      <div className="w-full max-w-xs space-y-4">
        <ModelProgress models={modelStatuses} />
      </div>
    </div>
  );

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b px-4 py-2.5">
        <div className="flex items-center gap-2">
          <FileSearch className="h-5 w-5 text-primary" />
          <h1 className="text-base font-bold text-foreground">Analizador de Hipotecas</h1>
        </div>
        <div className="flex items-center gap-2">
          <AnalysisHistory onLoad={handleLoadFromHistory} />
          {hasInput && (
            <Button onClick={handleAnalyze} disabled={isAnalyzing} size="sm">
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  Analizando...
                </>
              ) : (
                "Analizar"
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
          // Initial state: show upload + text tabs centered
          <div className="flex h-full items-center justify-center p-8">
            <div className="w-full max-w-lg">
              <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as "file" | "text")}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="file" className="gap-1.5">
                    <Upload className="h-3.5 w-3.5" />
                    Subir archivo
                  </TabsTrigger>
                  <TabsTrigger value="text" className="gap-1.5">
                    <ClipboardPaste className="h-3.5 w-3.5" />
                    Pegar texto
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="file" className="mt-4">
                  <PdfUploadZone onFileSelect={handleFileSelect} isLoading={isAnalyzing} />
                </TabsContent>
                <TabsContent value="text" className="mt-4">
                  <TextPasteZone value={pastedText} onChange={setPastedText} onClear={handleClearText} disabled={isAnalyzing} />
                </TabsContent>
              </Tabs>
            </div>
          </div>
        ) : inputMode === "text" ? (
          // Text mode: split between text area and results
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
              {result ? (
                <ResultsPanel result={result} onShowEvidence={handleShowEvidence} />
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
          // File mode with viewer
          <ResizablePanelGroup direction="horizontal">
            <ResizablePanel defaultSize={55} minSize={30}>
              <div className="h-full flex flex-col">
                <div className="px-4 py-2 border-b">
                  <PdfUploadZone onFileSelect={handleFileSelect} isLoading={isAnalyzing} fileName={file?.name} />
                </div>
                <div className="flex-1 overflow-hidden">
                  <PdfViewer fileUrl={fileUrl!} highlightedPage={highlightedPage} highlightedText={highlightedText} />
                </div>
              </div>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={45} minSize={25}>
              {result ? (
                <ResultsPanel result={result} onShowEvidence={handleShowEvidence} />
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
