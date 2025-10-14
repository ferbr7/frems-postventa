import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { tap, map, catchError } from 'rxjs/operators';

/** Ajusta si tus roles se llaman distinto en backend */
export type Role = 'admin' | 'vendedor';

export interface UserInfo {
  idusuario: number;
  nombre: string;
  apellido: string;
  email: string | null;
  /** Puede venir como string directo o anidado (roles?.nombre); lo normalizamos abajo */
  rol?: Role | string | null;
  roles?: { nombre: string } | null;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = 'http://localhost:4000/api/auth';

  private userSubject = new BehaviorSubject<UserInfo | null>(this.readUserFromLS());
  /** Observable para quien prefiera suscribirse */
  user$ = this.userSubject.asObservable();

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  // ======= Auth base =======
  login(userOrEmail: string, password: string) {
    const body = { username: userOrEmail, password };
    return this.http.post<{ ok: boolean; token: string; user: UserInfo }>(
      `${this.api}/login`,
      body
    ).pipe(
      tap(res => {
        if (res.ok && res.token) this.setToken(res.token);
        if (res?.user) this.setUser(res.user);
      })
    );
  }

  /** Pega al backend para traer el usuario actual (si el token es válido) */
  me(): Observable<UserInfo | null> {
    if (!this.isLoggedIn) return of(null);
    return this.http.get<{ ok: boolean; user: UserInfo }>(`${this.api}/me`).pipe(
      map(r => r?.ok ? r.user : null),
      tap(u => this.setUser(u)),
      catchError(() => {
        // Token inválido / expirado
        this.logout();
        return of(null);
      })
    );
  }

  // ======= Storage helpers =======
  get token(): string | null {
    return isPlatformBrowser(this.platformId) ? localStorage.getItem('token') : null;
  }
  private setToken(t: string) {
    if (isPlatformBrowser(this.platformId)) localStorage.setItem('token', t);
  }

  private readUserFromLS(): UserInfo | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    try { return JSON.parse(localStorage.getItem('me') || 'null'); } catch { return null; }
  }
  private writeUserToLS(u: UserInfo | null) {
    if (!isPlatformBrowser(this.platformId)) return;
    if (u) localStorage.setItem('me', JSON.stringify(u));
    else localStorage.removeItem('me');
  }

  setUser(u: UserInfo | null) {
    // Normaliza el rol para que siempre sea 'admin' | 'vendedor'
    if (u) {
      const raw = (u.rol || u.roles?.nombre || '').toString().toLowerCase();
      (u as any).rol = (raw === 'admin') ? 'admin' : 'vendedor';
    }
    this.userSubject.next(u);
    this.writeUserToLS(u);
  }

  logout() {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem('token');
      localStorage.removeItem('me');
    }
    this.userSubject.next(null);
  }

  // ======= Conveniencias para UI =======
  get isLoggedIn(): boolean { return !!this.token; }

  get role(): Role {
    const u = this.userSubject.value;
    const raw = (u?.rol || u?.roles?.nombre || '').toString().toLowerCase();
    return raw === 'admin' ? 'admin' : 'vendedor';
  }

  get initials(): string {
    const u = this.userSubject.value;
    const i1 = (u?.nombre || '').trim().charAt(0) || '';
    const i2 = (u?.apellido || '').trim().charAt(0) || '';
    return (i1 + i2).toUpperCase() || 'U';
  }

  /** Acceso sincrónico al usuario (útil para guards) */
  get user(): UserInfo | null { return this.userSubject.value; }
}
