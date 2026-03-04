import { Routes } from '@angular/router';
import { BuscadorComponent } from './components/buscador/buscador';

export const routes: Routes = [
    { path: '', component: BuscadorComponent, pathMatch: 'full' },
    { path: '**', redirectTo: '' }
];
