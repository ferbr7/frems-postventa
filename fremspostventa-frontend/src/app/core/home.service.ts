import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/enviroment';

@Injectable({ providedIn: 'root' })
export class HomeService {
  private http = inject(HttpClient);
  private API = `${environment.apiUrl}/home`;

  kpis(): Observable<{ ok: boolean; kpis: {
    ventasHoy: number; ventasTrend: string;
    clientesActivos: number; alertasPendientes: number;
  } }> {
    return this.http.get<{ ok: boolean; kpis: any }>(`${this.API}/kpis`);
  }

  activity(limit = 5): Observable<{ ok: boolean; items: Array<{ id: number; when: string; what: string; type: string; who: string }> }> {
    const params = new HttpParams().set('limit', String(limit));
    return this.http.get<{ ok: boolean; items: any[] }>(`${this.API}/activity`, { params });
  }

  topProducts(params?: { days?: number; limit?: number; by?: 'units' | 'amount' }):
    Observable<{ ok: boolean; items: Array<{ idproducto: number; nombre: string; unidades: number; monto: number }> }> {

    const httpParams = new HttpParams()
      .set('days',  String(params?.days  ?? 90))
      .set('limit', String(params?.limit ?? 5))
      .set('by',    params?.by ?? 'units');

    return this.http.get<{ ok: boolean; items: Array<{ idproducto: number; nombre: string; unidades: number; monto: number }> }>(
      `${this.API}/top-products`,
      { params: httpParams }
    );
  }
}
