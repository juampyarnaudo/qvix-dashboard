export type Servicio = "GOTV" | "ViewTV";

export interface DataRow {
  servicio: Servicio;
  organizacion: string;
  fecha: string; // ISO string "YYYY-MM-DD"
  stb: number;
  movil: number;
}

export interface OrgStats {
  organizacion: string;
  datos: {
    fecha: string;
    stb: number;
    movil: number;
    stbDiff?: number;
    movilDiff?: number;
  }[];
}

export interface Summary {
  organizacion: string;
  ultimaFecha: string;
  stbActual: number;
  movilActual: number;
  stbTotal: number;
  movilTotal: number;
  stbTendencia: "sube" | "baja" | "estable";
  movilTendencia: "sube" | "baja" | "estable";
  stbDiffUltimo?: number;
  movilDiffUltimo?: number;
}

export interface Totales {
  fecha: string;
  stb: number;
  movil: number;
}
