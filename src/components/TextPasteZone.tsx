import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ClipboardPaste, X } from "lucide-react";

interface TextPasteZoneProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  disabled?: boolean;
}

export function TextPasteZone({ value, onChange, onClear, disabled }: TextPasteZoneProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <ClipboardPaste className="h-4 w-4 text-primary" />
          Pegar texto de hipoteca
        </div>
        {value && (
          <Button variant="ghost" size="sm" onClick={onClear} disabled={disabled} className="h-6 px-2 text-xs">
            <X className="h-3 w-3 mr-1" />
            Limpiar
          </Button>
        )}
      </div>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Pega aquí el texto de la oferta hipotecaria..."
        className="min-h-[200px] resize-y text-sm"
        disabled={disabled}
      />
      <p className="text-xs text-muted-foreground">
        Pega el contenido completo de la oferta hipotecaria para extraer los datos automáticamente.
      </p>
    </div>
  );
}
