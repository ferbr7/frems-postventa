import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Producto {
  idproducto: number;
  sku: string;
  nombre: string;
  descripcion: string | null;
  categoria: string | null;
  medida: string | null;
  precioventa: number;
  stock: number;
  activo: boolean;
  fechaalta: string; 
  duracionestimadodias?: number | null;
}

@Injectable({ providedIn: 'root' })
export class ProductosService {
  private http = inject(HttpClient);
  private readonly API = 'http://localhost:4000/api';

  list(opts: {
    search?: string; page?: number; limit?: number;
    order?: 'recientes' | 'antiguos' | 'mod'; activo?: 'all' | 'true' | 'false';
  } = {}): Observable<{ ok: boolean; page: number; size: number; total: number; items: Producto[] }> {
    let params = new HttpParams()
      .set('page', String(opts.page ?? 1))
      .set('size', String(opts.limit ?? 5))
      .set('order', opts.order ?? 'mod')
      .set('activo', opts.activo ?? 'all');
    if (opts.search?.trim()) params = params.set('search', opts.search.trim());
    return this.http.get<{ ok: boolean; page: number; size: number; total: number; items: Producto[] }>(
      `${this.API}/productos`, { params }
    );
  }

  get(id: number) {
    return this.http.get<{ ok: boolean; producto: Producto }>(`${this.API}/productos/${id}`);
  }

  create(payload: Partial<Producto> & { sku: string; nombre: string; precioventa: number; stock: number }) {
    return this.http.post(`${this.API}/productos`, payload);
  }

  update(id: number, payload: Partial<Producto>) {
    return this.http.put(`${this.API}/productos/${id}`, payload);
  }

  setEstado(id: number, activo: boolean) {
    return this.update(id, { activo });
  }
}
