import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';

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
  private api = 'http://localhost:4000/api/usuarios';

  constructor(private http: HttpClient) {}

  list(opts: { page?:number; limit?:number; search?:string; idrol?:number; activo?:boolean } = {}) {
    let p = new HttpParams();
    Object.entries(opts).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') p = p.set(k, String(v));
    });
    return this.http.get<{ ok:boolean; page:number; limit:number; total:number; items:UsuarioDTO[] }>(this.api, { params: p });
  }

  get(id: number) {
    return this.http.get<{ ok:boolean; user:UsuarioDTO }>(`${this.api}/${id}`);
  }

  create(payload: any) {
    return this.http.post<{ ok:boolean; user:UsuarioDTO }>(this.api, payload);
  }

  update(id:number, payload:any) {
    return this.http.put<{ ok:boolean; user:UsuarioDTO }>(`${this.api}/${id}`, payload);
  }

  changePassword(id:number, newPassword:string) {
    return this.http.patch<{ ok:boolean; message:string }>(`${this.api}/${id}/password`, { newPassword });
  }

  changeState(id:number, activo:boolean) {
    return this.http.patch<{ ok:boolean; user: Pick<UsuarioDTO,'idusuario'|'activo'> }>(`${this.api}/${id}/estado`, { activo });
  }

  remove(id:number) {
    return this.http.delete<{ ok:boolean; message:string }>(`${this.api}/${id}`);
  }
}
