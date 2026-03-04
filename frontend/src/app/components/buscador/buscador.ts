import { Component, Inject, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatPaginatorModule, MatPaginator } from '@angular/material/paginator';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatSelectModule } from '@angular/material/select';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatDialogModule, MatDialog, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';

import { Observable } from 'rxjs';
import { map, startWith } from 'rxjs/operators';

import { BusquedaResponse, Resolucion, Beneficiario, FilaResolucion } from '../../models/resolucion.model';
import { ResolucionService } from '../../services/resolucion.service';
import { ResolucionFormComponent } from '../resolucion-form/resolucion-form.component';

@Component({
  selector: 'app-buscador',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatTableModule,
    MatPaginatorModule,
    MatIconModule,
    MatCardModule,
    MatSelectModule,
    MatAutocompleteModule,
    MatDialogModule,
    MatBadgeModule,
    MatTooltipModule
  ],
  providers: [ResolucionService],
  templateUrl: './buscador.html',
  styleUrls: ['./buscador.css']
})
export class BuscadorComponent implements OnInit {
  termino: string = '';
  tipoBusqueda: 'nro_rd' | 'dni' | 'asunto' = 'nro_rd';

  // Filtros Avanzados
  filtroAnio: string = '';
  filtroMes: string = '';
  areaControl = new FormControl('');

  anios: string[] = Array.from({ length: 10 }, (_, i) => (2016 + i).toString()); // 2016 a 2025
  meses = [
    { value: '1', name: 'Enero' }, { value: '2', name: 'Febrero' }, { value: '3', name: 'Marzo' },
    { value: '4', name: 'Abril' }, { value: '5', name: 'Mayo' }, { value: '6', name: 'Junio' },
    { value: '7', name: 'Julio' }, { value: '8', name: 'Agosto' }, { value: '9', name: 'Setiembre' },
    { value: '10', name: 'Octubre' }, { value: '11', name: 'Noviembre' }, { value: '12', name: 'Diciembre' }
  ];

  areasPredefinidas: string[] = ['Personal', 'Gestión Institucional', 'Administración', 'Infraestructura', 'AGA', 'ASG', 'Tramite Documentario'];
  filteredAreas: Observable<string[]>;

  buscando: boolean = false;
  mensajeError: string = '';

  // Data Source y Filtros de Columna
  dataSource = new MatTableDataSource<FilaResolucion>();

  @ViewChild(MatPaginator) paginator!: MatPaginator;

  // Nombres de las columnas de data requeridas
  columnasAMostrar: string[] = [
    'nro_cargo', 'fecha_cargo', 'nro_rd', 'fecha_rd', 'anio', 'asunto', 'area', 'expediente', 'receptor', 'dni',
    'estado', 'fecha_not', 'notificador', 'observacion', 'acciones'
  ];

  // Copia oculta de los JSON puros originales (Resoluciones anidadas con beneficiarios)
  resolucionesOriginales: Resolucion[] = [];

  constructor(
    private resolucionService: ResolucionService,
    public dialog: MatDialog
  ) {
    this.filteredAreas = this.areaControl.valueChanges.pipe(
      startWith(''),
      map(value => this._filterArea(value || ''))
    );
  }

  ngOnInit() {
    // Inicialización general
  }

  private _filterArea(value: string): string[] {
    const filterValue = value.toLowerCase();
    return this.areasPredefinidas.filter(option => option.toLowerCase().includes(filterValue));
  }

  limpiarFiltrosGenerales() {
    this.termino = '';
    this.tipoBusqueda = 'nro_rd';
    this.filtroAnio = '';
    this.filtroMes = '';
    this.areaControl.setValue('');
    this.dataSource.data = [];
    this.resolucionesOriginales = [];
    this.mensajeError = '';
  }

  buscar() {
    this.buscando = true;
    this.mensajeError = '';

    const filtros = {
      tipoBusqueda: this.tipoBusqueda,
      termino: this.termino.trim(),
      anio: this.filtroAnio,
      mes: this.filtroMes,
      area: this.areaControl.value || ''
    };

    this.resolucionService.buscar(filtros).subscribe({
      next: (res: BusquedaResponse) => {
        // Almacenar el maestro original para Edición
        this.resolucionesOriginales = res.resultados;

        // Transformación Visual Inmediata
        this.dataSource.data = res.resultados.flatMap(rd => {

          // FILTRO INTELIGENTE LOCAL
          let beneficiariosFiltrados = rd.beneficiarios;
          if (filtros.tipoBusqueda === 'dni' && filtros.termino) {
            beneficiariosFiltrados = rd.beneficiarios.filter(b => b.dni_administrado === filtros.termino);
          }

          return beneficiariosFiltrados.map(b => ({
            _id: rd._id, // Enlace del registro padre
            nro_cargo: b.nro_cargo || 'S/C',
            fecha_cargo: b.fecha_cargo || null,
            nro_rd: rd.nro_rd,
            fecha_rd: rd.fecha_rd || null,
            anio: rd.anio_ejercicio,
            asunto: rd.beneficiarios[0]?.asunto_resumen || '',
            area: rd.area_emisora,
            expediente: rd.nro_expediente,
            receptor: b.nombre_administrado,
            dni: b.dni_administrado,
            estado: b.estado_notificacion,
            fecha_not: b.fecha_notificacion,
            notificador: b.notificador_responsable,
            observacion: b.observaciones
          }));
        });

        // Enlazar paginador
        this.dataSource.paginator = this.paginator;

        this.buscando = false;

        if (this.dataSource.data.length === 0) {
          this.mensajeError = 'No se encontraron resultados para los filtros indicados.';
        }
      },
      error: (err) => {
        console.error('Error en búsqueda:', err);
        this.mensajeError = 'Error de conexión con el servidor. Intente más tarde.';
        this.buscando = false;
        this.dataSource.data = [];
      }
    });
  }

  abrirFormulario(fila?: FilaResolucion) {
    let resolucionOriginal: Resolucion | null = null;
    let beneficiarioIndex = -1;

    if (fila && fila._id) {
      // Clonación Profunda del objeto padre (Resolucion)
      resolucionOriginal = JSON.parse(JSON.stringify(this.resolucionesOriginales.find(r => r._id === fila._id) || null));

      if (resolucionOriginal) {
        // Encontrar el índice del beneficiario clickeado para editar solo ese
        beneficiarioIndex = resolucionOriginal.beneficiarios.findIndex((b: any) => b.dni_administrado === fila.dni);
      }
    }

    const dialogRef = this.dialog.open(ResolucionFormComponent, {
      width: '1000px', // Ampliado para evitar scroll horizontal interno de los inputs
      maxWidth: '95vw',
      maxHeight: '90vh',
      data: {
        resolucion: resolucionOriginal,
        editarUnicoIndex: beneficiarioIndex >= 0 ? beneficiarioIndex : undefined
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        if (resolucionOriginal && resolucionOriginal._id) {
          // ========= ES EDICIÓN ==========
          let payload = result;

          if (beneficiarioIndex >= 0) {
            const objetoMerged = JSON.parse(JSON.stringify(resolucionOriginal));

            // Actualizar Datos Padre (Generales de la Resolución)
            objetoMerged.nro_rd = result.nro_rd;
            objetoMerged.anio_ejercicio = result.anio_ejercicio;
            objetoMerged.fecha_rd = result.fecha_rd;
            objetoMerged.nro_expediente = result.nro_expediente;
            objetoMerged.area_emisora = result.area_emisora;

            // Actualizar Beneficiarios sin borrar al resto
            if (result.beneficiarios && result.beneficiarios.length > 0) {
              // El Formulario devolvió al beneficiario editado en la posición 0
              objetoMerged.beneficiarios[beneficiarioIndex] = result.beneficiarios[0];

              // Si desde el formulario agregaron MÁS beneficiarios, se concatenan
              for (let i = 1; i < result.beneficiarios.length; i++) {
                objetoMerged.beneficiarios.push(result.beneficiarios[i]);
              }
            } else {
              // Si elimino el array del formulario, significa Borrar beneficiario
              objetoMerged.beneficiarios.splice(beneficiarioIndex, 1);
            }

            payload = objetoMerged;
          }

          this.resolucionService.actualizar(resolucionOriginal._id, payload).subscribe({
            next: () => this.buscar(),
            error: (err) => {
              this.mensajeError = 'Error conectando para modificar documento en Base de Datos.';
              console.error(err);
            }
          });
        } else {
          // ========= ES CREACIÓN (NUEVA RD) ==========
          this.resolucionService.crear(result).subscribe({
            next: () => this.buscar(),
            error: (err) => {
              this.mensajeError = 'Error insertando la nueva resolución global';
              console.error(err);
            }
          });
        }
      }
    });
  }
}
