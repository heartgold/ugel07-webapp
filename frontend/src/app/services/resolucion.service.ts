import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BusquedaResponse, Resolucion } from '../models/resolucion.model';
import { environment } from '../../environments/environment';

@Injectable({
    providedIn: 'root'
})
export class ResolucionService {
    private apiUrl = environment.apiUrl;

    constructor(private http: HttpClient) { }

    buscar(filtros: any): Observable<BusquedaResponse> {
        let params = new HttpParams();

        // Filtros Antiguos
        if (filtros.tipoBusqueda === 'nro_rd' && filtros.termino) {
            params = params.set('tipoBusqueda', 'nro_rd').set('nro_rd', filtros.termino);
        } else if (filtros.tipoBusqueda === 'dni' && filtros.termino) {
            params = params.set('tipoBusqueda', 'dni').set('dni', filtros.termino);
        } else if (filtros.termino) {
            params = params.set('termino', filtros.termino);
        }

        // Nuevos Filtros Combos
        if (filtros.anio) params = params.set('anio', filtros.anio);
        if (filtros.mes) params = params.set('mes', filtros.mes);
        if (filtros.area) params = params.set('area', filtros.area);

        return this.http.get<BusquedaResponse>(`${this.apiUrl}/buscar`, { params });
    }

    crear(resolucion: Resolucion): Observable<any> {
        return this.http.post<any>(this.apiUrl, resolucion);
    }

    actualizar(id: string, resolucion: Resolucion): Observable<any> {
        return this.http.put<any>(`${this.apiUrl}/${id}`, resolucion);
    }

    eliminar(id: string): Observable<any> {
        return this.http.delete<any>(`${this.apiUrl}/${id}`);
    }

    obtenerSiguienteCargo(anio: string): Observable<{ siguiente_cargo: string }> {
        return this.http.get<{ siguiente_cargo: string }>(`${this.apiUrl}/siguiente-cargo`, {
            params: { anio }
        });
    }

    status(): Observable<any> {
        return this.http.get('/api/status');
    }
}
