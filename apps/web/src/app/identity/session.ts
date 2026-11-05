import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';

@Component({
  selector: 'app-session',
  template: `
    <h1>Inventario PyME</h1>
    <p>Sesión iniciada como <strong>{{ auth.user()?.username }}</strong>.</p>
    <p>Rol: {{ auth.user()?.role }}</p>
    @if (error()) { <p role="alert">{{ error() }}</p> }
    <button type="button" (click)="logout()" [disabled]="busy()">Cerrar sesión</button>
  `,
})
export class Session {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly busy = signal(false);
  readonly error = signal('');

  async logout() {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      await this.auth.logout();
      await this.router.navigateByUrl('/login');
    } catch {
      this.error.set('No se pudo cerrar la sesión. Intentá nuevamente.');
    } finally {
      this.busy.set(false);
    }
  }
}
