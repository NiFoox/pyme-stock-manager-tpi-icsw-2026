import { inject, Injectable, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface AuthUser { id: string; username: string; role: 'ADMIN' | 'OPERATOR' }

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly current = signal<AuthUser | null>(null);
  readonly user = this.current.asReadonly();

  async restore(): Promise<boolean> {
    try {
      this.current.set(await firstValueFrom(this.http.get<AuthUser>('/api/auth/me')));
      return true;
    } catch (error) {
      this.current.set(null);
      if (error instanceof HttpErrorResponse && error.status === 401) return false;
      throw error;
    }
  }

  async login(username: string, password: string) {
    this.current.set(await firstValueFrom(this.http.post<AuthUser>('/api/auth/login', { username, password })));
  }

  async logout() {
    await firstValueFrom(this.http.post<void>('/api/auth/logout', {}));
    this.current.set(null);
  }
}
