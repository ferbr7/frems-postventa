import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/enviroment';

@Injectable({ providedIn: 'root' })
export class InventarioService {
  private http = inject(HttpClient);
  private readonly API = `${environment.apiUrl}/inventario`;

  crearEntrada(payload: {
    idproducto: number;
    cantidad: number;
    preciocosto: number;
    fechaentrada?: string;  
    proveedor?: string | null;
    idusuario?: number | null;
  }) {
    return this.http.post<{ ok: boolean }>(`${this.API}/entradas`, payload);
  }
}
