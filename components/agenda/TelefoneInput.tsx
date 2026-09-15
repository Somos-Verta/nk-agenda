"use client";

import { CheckIcon } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { digitosNacionais, mascararTelefone, validarTelefone } from "@/lib/parse";
import { cn } from "@/lib/utils";

/**
 * Campo de telefone com máscara `(62) 98765-4321` enquanto digita (aceita colar em qualquer formato) e validação
 * de DDD, tamanho e 9º dígito. O erro aparece ao sair do campo ou assim que o número fica "completo" e ainda
 * está errado; o ✓ confirma que o número vai ser aceito.
 */
export function TelefoneInput({ id, value, onChange, required, className }: {
  id: string;
  /** valor já mascarado (o que aparece no campo) */
  value: string;
  onChange: (mascarado: string) => void;
  required?: boolean;
  className?: string;
}) {
  const [tocado, setTocado] = useState(false);
  const v = validarTelefone(value);
  const mostrarErro = value !== "" && !v.ok && (tocado || digitosNacionais(value).length >= 10);
  return (
    <div className={cn("grid gap-1", className)}>
      <div className="relative">
        <Input
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          maxLength={20}
          value={value}
          onChange={(e) => onChange(mascararTelefone(e.target.value))}
          onBlur={() => setTocado(true)}
          placeholder="(62) 98765-4321"
          required={required}
          aria-invalid={mostrarErro || undefined}
          aria-describedby={mostrarErro ? `${id}-erro` : undefined}
          className={cn("tabular-nums", v.ok && "pr-8")}
        />
        {v.ok && <CheckIcon className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-livre" aria-label="Telefone válido" />}
      </div>
      {mostrarErro && !v.ok && <p id={`${id}-erro`} className="text-xs text-lotado">{v.motivo}</p>}
    </div>
  );
}
