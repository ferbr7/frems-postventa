import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';

export interface VentaListRow {
  idventa: number;
  fecha: string;          
  subtotal: number;
  descuentot: number;
  total: number;
  estado: 'registrada' | 'cancelada';
  cliente: string;
  usuario: string;
  totalProductos: number;
}

export interface VentaCreateResp {
  ok: boolean;
  idventa: number;
  total: number;
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class VentasService {
  private http = inject(HttpClient);
  private readonly API = 'http://localhost:4000/api/ventas';

  list(opts: {
    page?: number;
    size?: number;
    search?: string;
    fecha_from?: string; // 'yyyy-MM-dd'
    fecha_to?: string;   // 'yyyy-MM-dd'
    estado?: 'registrada'|'cancelada'|'all';
  } = {}) {
    let params = new HttpParams()
      .set('page', String(opts.page ?? 1))
      .set('size', String(opts.size ?? 5))
      .set('estado', opts.estado ?? 'all');

    if (opts.search?.trim())     params = params.set('search', opts.search.trim());
    if (opts.fecha_from)         params = params.set('fecha_from', opts.fecha_from);
    if (opts.fecha_to)           params = params.set('fecha_to', opts.fecha_to);

    return this.http.get<{ ok: boolean; page: number; size: number; total: number; items: VentaListRow[] }>(this.API, { params });
  }

  get(id: number) {
    return this.http.get(`${this.API}/${id}`);
  }

  create(payload: {
    fecha?: string;                // 'yyyy-MM-dd'
    idcliente?: number | null;
    idusuario?: number | null;     // si manejas auth luego…
    notas?: string | null;
    items: Array<{ idproducto: number; cantidad: number; precio: number; desc_pct?: number }>;
  }) {
    // mapea a lo que espera el backend
    const body = {
      fecha: payload.fecha,
      idcliente: payload.idcliente,
      idusuario: payload.idusuario,
      notas: payload.notas,
      items: payload.items.map(i => ({
        idproducto: i.idproducto,
        cantidad: i.cantidad,
        precio: i.precio,
        desc_pct: i.desc_pct ?? 0
      })),
    };
    return this.http.post<VentaCreateResp>(this.API, body);
  }
}
