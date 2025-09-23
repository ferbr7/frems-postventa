import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = 'http://localhost:4000/api/auth';

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
  ) { }

  login(userOrEmail: string, password: string) {
    const body = userOrEmail.includes('@')
      ? { username: userOrEmail, password }
      : { username: userOrEmail, password };

    return this.http.post<{ ok: boolean; token: string; user: any }>(
      `${this.api}/login`,
      body
    ).pipe(
      tap(res => { if (res.ok && res.token) localStorage.setItem('token', res.token); })
    );
  }

  token() { return isPlatformBrowser(this.platformId) ? localStorage.getItem('token') : null; }
  logout() { if (isPlatformBrowser(this.platformId)) localStorage.removeItem('token'); }
}
