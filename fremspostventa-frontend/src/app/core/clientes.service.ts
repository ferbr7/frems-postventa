import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/enviroment';


export interface Cliente {
  idcliente: number;
  nombre: string;
  apellido: string;
  email: string | null;
  telefono: string;
  direccion: string;
  fechaingreso: string;   // ISO 'YYYY-MM-DD' desde el back
  ultimacompra: string | null;
  compras: number;
}

@Injectable({ providedIn: 'root' })
export class ClientesService {
  private http = inject(HttpClient);
  private readonly API = `${environment.apiUrl}`;

  list(opts: { search?: string; page?: number; size?: number; order?: 'recientes' | 'antiguos' } = {}): Observable<{
    ok: boolean; page: number; size: number; total: number; items: Cliente[];
  }> {
    let params = new HttpParams()
      .set('page', String(opts.page ?? 1))
      .set('size', String(opts.size ?? 5))
      .set('order', opts.order ?? 'recientes');

    if (opts.search?.trim()) params = params.set('search', opts.search.trim());

    return this.http.get<{ ok: boolean; page: number; size: number; total: number; items: Cliente[] }>(
      `${this.API}/clientes`,
      { params }
    );
  }

  get(id: number): Observable<{ ok: boolean; cliente: Cliente }> {
    return this.http.get<{ ok: boolean; cliente: Cliente }>(`${this.API}/clientes/${id}`);
  }

  create(payload: Partial<Cliente> & { telefono: string; nombre: string; apellido: string }): Observable<any> {
    return this.http.post(`${this.API}/clientes`, payload);
  }

  update(id: number, payload: Partial<Cliente>): Observable<any> {
    return this.http.put(`${this.API}/clientes/${id}`, payload);
  }
}
