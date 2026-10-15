export type PeriodMode = "all" | "day" | "month" | "year" | "range";

export interface Period {
  from?: string;
  to?: string;
}

export interface PeriodState {
  mode: PeriodMode;
  day: string;
  month: string;
  year: string;
  from: string;
  to: string;
}

export const today = () => new Date().toLocaleDateString("sv-SE");

export function initialPeriodState(mode: PeriodMode): PeriodState {
  const day = today();
  return { mode, day, month: day.slice(0, 7), year: day.slice(0, 4), from: "", to: "" };
}

export function periodRange(state: PeriodState): Period {
  switch (state.mode) {
    case "day":
      return state.day ? { from: state.day, to: state.day } : {};
    case "month": {
      if (!/^\d{4}-\d{2}$/.test(state.month)) return {};
      const [year, month] = state.month.split("-").map(Number) as [number, number];
      const lastDay = new Date(year, month, 0).getDate();
      return { from: `${state.month}-01`, to: `${state.month}-${String(lastDay).padStart(2, "0")}` };
    }
    case "year": {
      const year = String(state.year);
      return /^\d{4}$/.test(year) ? { from: `${year}-01-01`, to: `${year}-12-31` } : {};
    }
    case "range":
      return { from: state.from || undefined, to: state.to || undefined };
    default:
      return {};
  }
}
