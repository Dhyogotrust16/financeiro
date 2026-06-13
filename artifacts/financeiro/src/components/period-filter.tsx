import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, CalendarDays, X } from "lucide-react";

const MONTHS = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

export interface PeriodValue {
  month: number; // 1-12
  year: number;
}

interface PeriodFilterProps {
  value: PeriodValue | null;
  onChange: (v: PeriodValue | null) => void;
}

export function periodToDates(p: PeriodValue): { startDate: string; endDate: string } {
  const mm = String(p.month).padStart(2, "0");
  const lastDay = new Date(p.year, p.month, 0).getDate();
  return {
    startDate: `${p.year}-${mm}-01`,
    endDate: `${p.year}-${mm}-${String(lastDay).padStart(2, "0")}`,
  };
}

export function PeriodFilter({ value, onChange }: PeriodFilterProps) {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  function prev() {
    const base = value ?? { month: currentMonth, year: currentYear };
    if (base.month === 1) onChange({ month: 12, year: base.year - 1 });
    else onChange({ month: base.month - 1, year: base.year });
  }

  function next() {
    const base = value ?? { month: currentMonth, year: currentYear };
    if (base.month === 12) onChange({ month: 1, year: base.year + 1 });
    else onChange({ month: base.month + 1, year: base.year });
  }

  function goToCurrentMonth() {
    onChange({ month: currentMonth, year: currentYear });
  }

  const label = value
    ? `${MONTHS[value.month - 1]} ${value.year}`
    : "Todos os períodos";

  const isCurrentMonth =
    value?.month === currentMonth && value?.year === currentYear;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1 rounded-lg border bg-background px-1 py-1">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={prev}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="min-w-[110px] text-center text-sm font-medium px-1 select-none">
          {label}
        </span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={next}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {!isCurrentMonth && (
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-1.5 text-xs"
          onClick={goToCurrentMonth}
        >
          <CalendarDays className="h-3.5 w-3.5" />
          Mês atual
        </Button>
      )}

      {value && (
        <Button
          variant="ghost"
          size="sm"
          className="h-9 gap-1 text-xs text-muted-foreground"
          onClick={() => onChange(null)}
        >
          <X className="h-3.5 w-3.5" />
          Todos
        </Button>
      )}
    </div>
  );
}
