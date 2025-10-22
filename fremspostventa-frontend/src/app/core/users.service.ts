import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/enviroment';

export interface UsuarioDTO {
  idusuario: number;
  nombre: string;
  apellido: string;
  email: string;
  username: string;
  activo: boolean;
  fechaalta: string;
  idrol: number;
  roles?: { nombre: string };
}

@Injectable({ providedIn: 'root' })
export class UsersService {
  private api = `${environment.apiUrl}/usuarios`;

  constructor(private http: HttpClient) { }

  get(id: number) {
    return this.http.get<{ ok: boolean; user: UsuarioDTO }>(`${this.api}/${id}`);
  }

  create(payload: any) {
    return this.http.post<{ ok: boolean; user: UsuarioDTO }>(this.api, payload);
  }

  update(id: number, payload: any) {
    return this.http.put<{ ok: boolean; user: UsuarioDTO }>(`${this.api}/${id}`, payload);
  }

  changePassword(id: number, newPassword: string) {
    return this.http.patch<{ ok: boolean; message: string }>(`${this.api}/${id}/password`, { newPassword });
  }

  changeState(id: number, activo: boolean) {
    return this.http.patch<{ ok: boolean; user: Pick<UsuarioDTO, 'idusuario' | 'activo'> }>(`${this.api}/${id}/estado`, { activo });
  }

  remove(id: number) {
    return this.http.delete<{ ok: boolean; message: string }>(`${this.api}/${id}`);
  }
  list(p: { page: number; limit: number; search?: string }) {
    const params: any = { page: p.page, limit: p.limit };
    if (p.search) params.search = p.search;
    return this.http.get(`${this.api}`, { params });
  }

  setEstado(id: number, activo: boolean) {
    return this.http.patch(`${this.api}/${id}/estado`, { activo });
  }
}
