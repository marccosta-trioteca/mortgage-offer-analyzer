import { useState, useCallback } from "react";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { PdfUploadZone } from "@/components/PdfUploadZone";
import { PdfViewer } from "@/components/PdfViewer";
import { ResultsPanel } from "@/components/ResultsPanel";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Loader2, FileSearch } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { MortgageAnalysisResult } from "@/types/mortgage";

const Index = () => {
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<MortgageAnalysisResult | null>(null);
  const [highlightedPage, setHighlightedPage] = useState<number | null>(null);
  const [highlightedText, setHighlightedText] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const handleFileSelect = useCallback((f: File) => {
    if (f.size > 20 * 1024 * 1024) {
      toast({ title: "Error", description: "El archivo excede 20MB", variant: "destructive" });
      return;
    }
    setFile(f);
    setFileUrl(URL.createObjectURL(f));
    setResult(null);
    setHighlightedPage(null);
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!file) return;
    setIsAnalyzing(true);
    setProgress(10);

    try {
      // Read file as base64
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);

      setProgress(30);

      const { data, error } = await supabase.functions.invoke("analyze-mortgage", {
        body: { pdf_base64: base64, file_name: file.name, mime_type: file.type },
      });

      setProgress(90);

      if (error) throw new Error(error.message || "Error en el análisis");
      if (data?.error) throw new Error(data.error);

      setResult(data as MortgageAnalysisResult);
      setProgress(100);

      toast({ title: "Análisis completado" });
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
  }, [file]);

  const handleShowEvidence = useCallback((page: number, text: string) => {
    setHighlightedPage(page);
    setHighlightedText(text);
  }, []);

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b px-4 py-2.5">
        <div className="flex items-center gap-2">
          <FileSearch className="h-5 w-5 text-primary" />
          <h1 className="text-base font-bold text-foreground">Analizador de Hipotecas</h1>
        </div>
        {file && (
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
      </header>

      {/* Progress bar */}
      {isAnalyzing && (
        <Progress value={progress} className="h-1 rounded-none" />
      )}

      {/* Main content */}
      <div className="flex-1 overflow-hidden">
        {!fileUrl ? (
          <div className="flex h-full items-center justify-center p-8">
            <div className="w-full max-w-md">
              <PdfUploadZone onFileSelect={handleFileSelect} isLoading={isAnalyzing} />
            </div>
          </div>
        ) : (
          <ResizablePanelGroup direction="horizontal">
            <ResizablePanel defaultSize={55} minSize={30}>
              <div className="h-full flex flex-col">
                <div className="px-4 py-2 border-b">
                  <PdfUploadZone
                    onFileSelect={handleFileSelect}
                    isLoading={isAnalyzing}
                    fileName={file?.name}
                  />
                </div>
                <div className="flex-1 overflow-hidden">
                  <PdfViewer
                    fileUrl={fileUrl}
                    highlightedPage={highlightedPage}
                    highlightedText={highlightedText}
                  />
                </div>
              </div>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={45} minSize={25}>
              {result ? (
                <ResultsPanel result={result} onShowEvidence={handleShowEvidence} />
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground text-sm p-8 text-center">
                  {isAnalyzing ? (
                    <div className="space-y-3">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                      <p>Analizando documento...</p>
                      <p className="text-xs">Extrayendo texto y procesando con IA</p>
                    </div>
                  ) : (
                    <p>Haz clic en "Analizar" para extraer los datos de la hipoteca</p>
                  )}
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
