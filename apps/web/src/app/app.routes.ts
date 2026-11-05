import { Routes } from '@angular/router';
import { authGuard } from './identity/auth.guard';
import { Login } from './identity/login';
import { Session } from './identity/session';

export const routes: Routes = [
  { path: 'login', component: Login },
  { path: '', component: Session, canActivate: [authGuard], pathMatch: 'full' },
  { path: '**', redirectTo: '' },
];
