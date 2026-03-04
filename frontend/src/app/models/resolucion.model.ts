export interface Beneficiario {
    nro_cargo?: string | null;
    fecha_cargo?: Date | string | null;
    dni_administrado?: string | null;
    nombre_administrado?: string;
    asunto_resumen?: string;
    estado_notificacion?: string;
    fecha_notificacion?: Date | string | null;
    tipo_notificacion?: string;
    notificador_responsable?: string;
    entidad_ie?: string;
    correo_electronico?: string;
    observaciones?: string;
}

export interface Resolucion {
    _id?: string;
    nro_rd: string;
    anio_ejercicio?: string;
    fecha_rd?: Date | string | null;
    nro_expediente?: string;
    area_emisora?: string;
    beneficiarios: Beneficiario[];
    createdAt?: string;
    updatedAt?: string;
}

export interface BusquedaResponse {
    total: number;
    resultados: Resolucion[];
}

// Interfaz aplanada visualmente para representar cada fila en la Tabla de Angular
export interface FilaResolucion {
    _id?: string;
    nro_cargo?: string;
    fecha_cargo?: Date | string | null;
    nro_rd: string;
    fecha_rd?: Date | string | null;
    anio?: string;
    asunto?: string;
    area?: string;
    expediente?: string;
    receptor?: string;
    dni?: string | null;
    estado?: string;
    fecha_not?: Date | string | null;
    notificador?: string;
    observacion?: string;
}
