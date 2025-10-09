// src/app/core/recs.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

/* ===== Tipos compartidos ===== */

export type RecEstado = 'pendiente' | 'enviada' | 'descartada' | 'vencida';

/** Item para el listado (/api/recs) */
export interface RecListItem {
  id: number;
  fecha: string;
  next_action_at: string | null;
  estado: RecEstado;
  cliente: {
    id: number;
    nombre: string;
    telefono?: string | null;
    email?: string | null;
  };
  preview: string;
  opciones: Array<{
    nombre: string;
    sku?: string | null;
    medida?: string | null;
  }>;
}

export interface RecsListResp {
  ok: boolean;
  page: number;
  size: number;
  total: number;
  items: RecListItem[];
}

/** Detalle de recomendación (/api/recs/:id y /api/recs/generate) */
export interface RecDetail {
  idrecomendacion: number;
  fechageneracion: string;
  estado: RecEstado;
  next_action_at: string | null;
  justificacion: string | null;
  clientes: {
    idcliente: number;
    nombre: string;
    apellido: string | null;
    telefono: string | null;
    email: string | null;
  } | null;
  recomendaciones_detalle: Array<{
    prioridad: number;
    score: number | string;
    razon?: string | null;
    productos: {
      idproducto: number;
      nombre: string;
      sku: string | null;
      medida: string | null;
      categoria: string | null;
      precioventa: number | string | null;
      stock: number | null;
    } | null;
  }>;
}

/* ===== Servicio ===== */

@Injectable({ providedIn: 'root' })
export class RecsService {
  private http = inject(HttpClient);
  private readonly API = 'http://localhost:4000/api/recs';

  /** Listado paginado de recomendaciones */
  list(opts: {
    page?: number;
    size?: number;
    search?: string;
    estado?: RecEstado | 'all';
  } = {}): Observable<RecsListResp> {
    let params = new HttpParams()
      .set('page', String(opts.page ?? 1))
      .set('size', String(opts.size ?? 10));
    if (opts.search?.trim()) params = params.set('search', opts.search.trim());
    if (opts.estado) params = params.set('estado', opts.estado);
    return this.http.get<RecsListResp>(this.API, { params });
  }

  /** Detalle por id */
  get(id: number): Observable<{ ok: boolean; rec: RecDetail }> {
    return this.http.get<{ ok: boolean; rec: RecDetail }>(`${this.API}/${id}`);
  }

  /** Posponer N días */
  defer(id: number, days: number): Observable<{ ok: boolean; id: number; next_action_at: string }> {
    return this.http.post<{ ok: boolean; id: number; next_action_at: string }>(
      `${this.API}/${id}/defer`,
      { days }
    );
  }

  /** Descartar recomendación */
  discard(id: number): Observable<{ ok: boolean; id: number; estado: RecEstado }> {
    return this.http.post<{ ok: boolean; id: number; estado: RecEstado }>(
      `${this.API}/${id}/discard`,
      {}
    );
  }

  /** Generar manualmente (desde Clientes → botón IA) */
  generate(payload: {
    idcliente: number;
    top_n?: number;
    alert_vendedores?: boolean;
  }): Observable<{ ok: boolean; rec: RecDetail }> {
    return this.http.post<{ ok: boolean; rec: RecDetail }>(
      `${this.API}/generate`,
      payload
    );
  }

  /* ===== Opcionales útiles ===== */

  /** Refrescar la MV de candidatos (si lo querés disparar desde el front) */
  refreshCandidates(): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(`${this.API}/refresh`, {});
  }

  /** Ver candidatos (solo para debug/admin) */
  candidates(idcliente?: number): Observable<{ ok: boolean; items: Array<{ idcliente: number; reason: string }> }> {
    let params = new HttpParams();
    if (idcliente) params = params.set('idcliente', String(idcliente));
    return this.http.get<{ ok: boolean; items: Array<{ idcliente: number; reason: string }> }>(
      `${this.API}/candidates`,
      { params }
    );
  }

  markSent(id: number) {
    return this.http.post<{ ok: boolean; id: number; estado: RecEstado; next_action_at: string | null }>(
      `${this.API}/${id}/sent`,
      {}
    );
  }
}

