import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { AuthService, Role } from './auth.service';

export const roleGuard = (allowed: Role[]): CanActivateFn => {
  return (): boolean | UrlTree => {
    const auth = inject(AuthService);
    const router = inject(Router);
    return allowed.includes(auth.role) ? true : router.parseUrl('/home');
  };
};
