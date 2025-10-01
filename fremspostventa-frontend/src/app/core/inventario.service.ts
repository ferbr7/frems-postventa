import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class InventarioService {
  private http = inject(HttpClient);
  private readonly API = 'http://localhost:4000/api/inventario';

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
