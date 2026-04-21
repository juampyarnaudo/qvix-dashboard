"use client";
import { useEffect, useState } from "react";

export function useTheme() {
  const [isLight, setIsLight] = useState(false);

  useEffect(() => {
    const check = () => setIsLight(document.documentElement.classList.contains("light"));
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return {
    isLight,
    chart: {
      grid: isLight ? "#e2e8f0" : "#334155",
      axis: isLight ? "#64748b" : "#94a3b8",
      tooltipBg: isLight ? "#ffffff" : "#1e293b",
      tooltipBorder: isLight ? "#e2e8f0" : "#334155",
      tooltipLabel: isLight ? "#0f172a" : "#e2e8f0",
      tooltipItem: isLight ? "#334155" : "#cbd5e1",
      legend: isLight ? "#475569" : "#94a3b8",
    },
  };
}
