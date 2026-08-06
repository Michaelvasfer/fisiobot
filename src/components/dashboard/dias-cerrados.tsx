'use client'

// Editor de días cerrados: fechas puntuales en las que el centro no atiende
// (feriados, cierres, motivos). La plantilla semanal sigue intacta; solo se
// bloquean estos días. Acepta "15 de agosto" o "2026-08-15".
import { useState } from 'react'
import { CalendarX2, Plus, X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

interface DiasCerradosProps {
  dias: string[]
  onChange: (nuevos: string[]) => void
}

export function DiasCerrados({ dias, onChange }: DiasCerradosProps) {
  const [nuevo, setNuevo] = useState('')

  const agregar = () => {
    const v = nuevo.trim()
    if (!v || dias.includes(v)) return
    onChange([...dias, v])
    setNuevo('')
  }

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 dark:bg-rose-950/30">
            <CalendarX2 className="h-4 w-4 text-rose-600 dark:text-rose-400" />
          </div>
          <div>
            <CardTitle className="text-sm font-semibold">Días cerrados</CardTitle>
            <CardDescription className="text-[11px]">
              Fechas puntuales en las que no se atiende (feriados, cierres). La plantilla semanal sigue igual.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        <div className="flex gap-2">
          <Input
            value={nuevo}
            onChange={(e) => setNuevo(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') agregar() }}
            placeholder="ej: 15 de agosto o 2026-08-15"
            className="text-xs h-9 rounded-xl flex-1"
          />
          <Button
            size="sm"
            className="rounded-xl text-xs gap-1.5 bg-gradient-to-r from-teal-500 to-teal-600"
            onClick={agregar}
            disabled={!nuevo.trim()}
          >
            <Plus className="h-3.5 w-3.5" /> Agregar
          </Button>
        </div>
        {dias.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">
            No hay días cerrados: el centro atiende todos los días de la plantilla.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {dias.map((d) => (
              <Badge key={d} variant="secondary" className="text-xs px-3 py-1.5 gap-1.5">
                {d}
                <button
                  onClick={() => onChange(dias.filter((x) => x !== d))}
                  className="ml-1 rounded-full hover:text-rose-500 transition-colors"
                  title="Quitar"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
