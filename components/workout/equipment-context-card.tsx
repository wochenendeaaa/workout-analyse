"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { EquipmentContextPayload } from "@/lib/equipment-context";
import { GYM_EQUIPMENT_PRESETS } from "@/lib/gym-equipment-presets";
import { cn } from "@/lib/utils";
import { Dumbbell } from "lucide-react";

type Props = {
  value: EquipmentContextPayload;
  onChange: (next: EquipmentContextPayload) => void;
  disabled?: boolean;
};

export function EquipmentContextCard({ value, onChange, disabled }: Props) {
  const selected = new Set(value.presetIds ?? []);

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange({ ...value, presetIds: [...next] });
  }

  return (
    <Card className="mb-10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Dumbbell className="size-5 text-primary" />
          Deine Ausstattung
        </CardTitle>
        <CardDescription>
          Wähle, was du zuhause oder im Gym hast. Tipps und Alternativübungen
          richten sich danach (z.&nbsp;B. Gewichtsbereich bei Kurzhanteln unten
          ergänzen).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <fieldset
          disabled={disabled}
          className="grid gap-2 sm:grid-cols-2"
          aria-label="Verfügbare Geräte und Gewichte"
        >
          {GYM_EQUIPMENT_PRESETS.map((p) => {
            const checked = selected.has(p.id);
            return (
              <label
                key={p.id}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-sm transition-colors hover:bg-muted/50",
                  disabled && "cursor-not-allowed opacity-60",
                  checked && "border-primary/50 bg-primary/5",
                )}
              >
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 shrink-0 rounded border-input accent-primary"
                  checked={checked}
                  onChange={() => toggle(p.id)}
                />
                <span className="leading-snug text-foreground">{p.label}</span>
              </label>
            );
          })}
        </fieldset>
        <div className="space-y-2">
          <label
            htmlFor="equipment-notes"
            className="text-sm font-medium text-foreground"
          >
            Freitext (Gewichte, Bandstärken, Einschränkungen)
          </label>
          <textarea
            id="equipment-notes"
            placeholder="z. B. Kurzhanteln 2–20 kg, keine Langhantel, niedrige Deckenhöhe …"
            value={value.notes ?? ""}
            onChange={(e) => onChange({ ...value, notes: e.target.value })}
            disabled={disabled}
            rows={3}
            maxLength={2000}
            className={cn(
              "flex min-h-[4.5rem] w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm",
              "placeholder:text-muted-foreground",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          />
          <p className="text-xs text-muted-foreground">
            {(value.notes ?? "").length}/2000 Zeichen
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
