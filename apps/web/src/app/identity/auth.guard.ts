import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  try {
    return await auth.restore() || router.createUrlTree(['/login']);
  } catch {
    return router.createUrlTree(['/login'], { queryParams: { unavailable: '1' } });
  }
};
