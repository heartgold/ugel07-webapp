import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { Resolucion, Beneficiario } from '../../models/resolucion.model';
import { ResolucionService } from '../../services/resolucion.service';

@Component({
    selector: 'app-resolucion-form',
    standalone: true,
    imports: [
        CommonModule, ReactiveFormsModule, MatDialogModule, MatButtonModule,
        MatInputModule, MatFormFieldModule, MatIconModule, MatSelectModule,
        MatAutocompleteModule, MatDatepickerModule, MatNativeDateModule
    ],
    templateUrl: './resolucion-form.component.html',
    styleUrls: ['./resolucion-form.component.css']
})
export class ResolucionFormComponent implements OnInit {
    form: FormGroup;
    esNueva: boolean;
    cargandoCargo: boolean = false;

    // Opciones precargadas para selectores rápidos
    areasPredefinidas: string[] = [
        'Area de Recursos Humanos', 'Area de Gestion de la Educacion Basica Regular y Especial',
        'Area de Administracion', 'Area de Planificacion y Presupuesto',
        'Area de Secretaria General', 'Area de Asesoria Juridica'
    ];

    estadosPredefinidos: string[] = ['PENDIENTE DE NOTIFICACION', 'NOTIFICADO'];

    constructor(
        private fb: FormBuilder,
        private resolucionService: ResolucionService,
        public dialogRef: MatDialogRef<ResolucionFormComponent>,
        @Inject(MAT_DIALOG_DATA) public data: { resolucion: Resolucion | null, editarUnicoIndex?: number }
    ) {
        this.esNueva = !data.resolucion;
        const res = data.resolucion;

        // Conversión segura de Fechas del Padre
        const parseDateSeguro = (fecha: any) => fecha ? new Date(fecha) : null;

        this.form = this.fb.group({
            _id: [res?._id || ''],
            nro_rd: [res?.nro_rd || '', Validators.required],
            anio_ejercicio: [res?.anio_ejercicio || new Date().getFullYear().toString(), Validators.required],
            fecha_rd: [parseDateSeguro(res?.fecha_rd)],
            nro_expediente: [res?.nro_expediente || ''],
            area_emisora: [res?.area_emisora || ''],
            beneficiarios: this.fb.array([])
        });

        if (res && res.beneficiarios) {
            if (data.editarUnicoIndex !== undefined && data.editarUnicoIndex >= 0) {
                this.agregarBeneficiario(res.beneficiarios[data.editarUnicoIndex]);
            } else {
                res.beneficiarios.forEach(b => this.agregarBeneficiario(b));
            }
        } else {
            this.agregarBeneficiario();
        }
    }

    ngOnInit(): void {
        // Si es un registro nuevo, cargar el siguiente nro_cargo automáticamente
        if (this.esNueva) {
            this.cargarSiguienteCargo();

            // Reaccionar a cambios en el año para recalcular el cargo
            this.form.get('anio_ejercicio')?.valueChanges.subscribe(anio => {
                if (anio && anio.length === 4) {
                    this.cargarSiguienteCargo();
                }
            });
        }
    }

    /**
     * Consulta el backend para obtener el siguiente nro_cargo del año seleccionado
     * y rellena automáticamente los campos de los beneficiarios.
     */
    cargarSiguienteCargo(): void {
        const anio = this.form.get('anio_ejercicio')?.value;
        if (!anio) return;

        this.cargandoCargo = true;
        this.resolucionService.obtenerSiguienteCargo(anio.toString()).subscribe({
            next: (resp) => {
                let baseCargo = parseInt(resp.siguiente_cargo, 10);
                const bens = this.beneficiarios;
                for (let i = 0; i < bens.length; i++) {
                    bens.at(i).patchValue({ nro_cargo: (baseCargo + i).toString() });
                }
                this.cargandoCargo = false;
            },
            error: (err) => {
                console.error('No se pudo obtener el siguiente cargo:', err);
                this.cargandoCargo = false;
            }
        });
    }

    get beneficiarios(): FormArray {
        return this.form.get('beneficiarios') as FormArray;
    }

    crearBeneficiarioFormGroup(b?: Beneficiario): FormGroup {
        const parseDateSeguro = (fecha: any) => fecha ? new Date(fecha) : null;

        return this.fb.group({
            nro_cargo: [b?.nro_cargo || ''],
            fecha_cargo: [parseDateSeguro(b?.fecha_cargo)],
            dni_administrado: [b?.dni_administrado || ''],
            nombre_administrado: [b?.nombre_administrado || ''],
            asunto_resumen: [b?.asunto_resumen || ''],
            estado_notificacion: [b?.estado_notificacion || 'PENDIENTE DE NOTIFICACION'],
            fecha_notificacion: [parseDateSeguro(b?.fecha_notificacion)],
            tipo_notificacion: [b?.tipo_notificacion || ''],
            notificador_responsable: [b?.notificador_responsable || ''],
            entidad_ie: [b?.entidad_ie || ''],
            correo_electronico: [b?.correo_electronico || ''],
            observaciones: [b?.observaciones || '']
        });
    }

    agregarBeneficiario(b?: Beneficiario): void {
        this.beneficiarios.push(this.crearBeneficiarioFormGroup(b));

        // Si es registro nuevo y ya tenemos un cargo base, asignar el siguiente consecutivo
        if (this.esNueva && !b && this.beneficiarios.length > 1) {
            const primerCargo = parseInt(this.beneficiarios.at(0).get('nro_cargo')?.value || '0', 10);
            if (primerCargo > 0) {
                const nuevoCargo = (primerCargo + this.beneficiarios.length - 1).toString();
                this.beneficiarios.at(this.beneficiarios.length - 1).patchValue({ nro_cargo: nuevoCargo });
            }
        }
    }

    removerBeneficiario(index: number): void {
        this.beneficiarios.removeAt(index);
    }

    guardar(): void {
        if (this.form.valid) {
            this.dialogRef.close(this.form.value);
        } else {
            this.form.markAllAsTouched();
        }
    }

    cancelar(): void {
        this.dialogRef.close();
    }
}
