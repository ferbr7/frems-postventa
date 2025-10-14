import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { AuthService } from './auth.service';
import { catchError, map, of } from 'rxjs';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // Sin token → a login
  if (!auth.isLoggedIn) return router.parseUrl('/login');

  // Con token pero sin usuario en memoria → rehidratar /me
  if (!auth.user) {
    return auth.me().pipe(
      map(() => true),
      catchError(() => of(router.parseUrl('/login')))
    );
  }

  return true;
};
