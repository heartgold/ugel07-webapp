require('dotenv').config();
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const mongoose = require('mongoose');
const moment = require('moment'); // Importando moment para manejo flexible de fechas
const Resolucion = require('./models/Resolucion');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/ugel07_db';
const CSV_FILE = path.join(__dirname, '..', 'MAESTRO_RESOLUCIONES_UGEL_07.csv');

// Formatos comunes posibles en los CSV exportados
const dateFormats = [
    'YYYY-MM-DD', 'DD/MM/YYYY', 'MM/DD/YYYY', 'D/M/YYYY', 'M/D/YYYY',
    'DD-MM-YYYY', 'MM-DD-YYYY', 'YYYY/MM/DD'
];

// Función para parsear fechas flexible usando Moment.js
function parseDate(dateStr) {
    if (!dateStr || dateStr.trim() === '' || dateStr.toLowerCase() === 'nan' || dateStr === '<NA>' || dateStr === '#N/A') return null;

    // Moment intentará parsear con los múltiples formatos estrictamente
    const parsed = moment(dateStr.trim(), dateFormats, true);

    if (parsed.isValid()) {
        return parsed.toDate();
    }

    // Si no coincide con un formato estricto, intenta el formato universal del fallback
    const fallback = moment(dateStr.trim());
    return fallback.isValid() ? fallback.toDate() : null;
}

// Función para parsear DNI
function parseDNI(dniStr) {
    if (!dniStr) return null;
    dniStr = dniStr.trim();
    if (dniStr === '#N/A' || dniStr === '' || dniStr.toLowerCase() === 'nan' || dniStr === '<NA>') return null;
    return dniStr;
}

// Función para normalizar Nro RD (siempre string de 4 dígitos usando padStart)
function parseNroRd(rdStr) {
    if (!rdStr) return '';
    rdStr = rdStr.toString().trim();
    // Eliminar posibles ceros ya existentes a la izquierda para tener siempre una base limpia
    const baseStr = rdStr.replace(/^0+/, '');
    // Luego aplicar padStart para que siempre sean 4 caracteres, por ejemplo "1" -> "0001", "34" -> "0034"
    return baseStr.padStart(4, '0');
}

async function importarDatos() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Conectado a MongoDB.');

        // BORRADO LIMPIO - Eliminando la colección entera antes de reimporar
        console.log('Borrando colección de resoluciones anterior...');
        await mongoose.connection.db.collection('resolucions').drop().catch(err => {
            console.log('No existía o no se pudo hacer drop a la colección:', err.message);
        });
        console.log('Colección antigua limpiada exitosamente (db.resoluciones.drop()).\n');

        const mapResoluciones = new Map();
        let rowsProcesadas = 0;

        console.log('Leyendo archivo CSV y normalizando datos...');
        fs.createReadStream(CSV_FILE)
            .pipe(csv())
            .on('data', (row) => {
                rowsProcesadas++;

                // La llave única debe ser nro_rd (ya limpio) + anio_ejercicio
                const raw_rd = row['nro_rd'] ? row['nro_rd'] : '';
                const anio_ejercicio = row['anio_ejercicio'] ? row['anio_ejercicio'].trim() : '';

                // Ignorar filas vacías de RD
                if (!raw_rd) return;

                // Normalizar Nro de RD
                const nro_rd = parseNroRd(raw_rd);
                const llave = `${nro_rd}_${anio_ejercicio}`;

                // Obtener datos del beneficiario
                const beneficiario = {
                    nro_cargo: row['nro_cargo']?.trim() || null,
                    fecha_cargo: parseDate(row['fecha_cargo']),
                    dni_administrado: parseDNI(row['dni_administrado']),
                    nombre_administrado: row['nombre_administrado'],
                    asunto_resumen: row['asunto_resumen'],
                    estado_notificacion: row['estado_notificacion'],
                    fecha_notificacion: parseDate(row['fecha_notificacion']),
                    tipo_notificacion: row['tipo_notificacion'],
                    notificador_responsable: row['notificador_responsable'],
                    entidad_ie: row['entidad_ie'],
                    correo_electronico: row['correo_electronico'],
                    observaciones: row['observaciones']
                };

                if (mapResoluciones.has(llave)) {
                    // Si existe, agrega el beneficiario
                    mapResoluciones.get(llave).beneficiarios.push(beneficiario);
                } else {
                    // Si no existe, crea base con array
                    mapResoluciones.set(llave, {
                        nro_rd: nro_rd,
                        anio_ejercicio: anio_ejercicio,
                        fecha_rd: parseDate(row['fecha_rd']),
                        nro_expediente: row['nro_expediente'],
                        area_emisora: row['area_emisora'],
                        beneficiarios: [beneficiario]
                    });
                }
            })
            .on('end', async () => {
                console.log(`Leídas ${rowsProcesadas} filas del CSV.`);
                console.log(`Resoluciones únicas (Normalizadas) a procesar: ${mapResoluciones.size}`);

                const docs = Array.from(mapResoluciones.values());

                // Preparando conteo de beneficiarios
                let totalBeneficiarios = 0;
                docs.forEach(d => totalBeneficiarios += d.beneficiarios.length);

                console.log(`Re-Guardando en MongoDB Atlas en lotes, por favor espere...`);
                try {
                    const batchSize = 500;
                    for (let i = 0; i < docs.length; i += batchSize) {
                        const batch = docs.slice(i, i + batchSize);
                        await Resolucion.insertMany(batch, { ordered: false });
                        console.log(`Progreso: ${Math.min(i + batchSize, docs.length)} / ${docs.length} resoluciones subidas...`);
                    }
                    console.log(`\nImportación Exitosa Completada!`);
                    console.log(`=====================================`);
                    console.log(`Resoluciones Únicas (Creadas): ${docs.length}`);
                    console.log(`Total Beneficiarios Procesados: ${totalBeneficiarios}`);
                    console.log(`=====================================`);
                } catch (dbErr) {
                    console.error('Error insertando en la base de datos:', dbErr.message);
                } finally {
                    mongoose.disconnect();
                    console.log('Desconectado de MongoDB.');
                }
            })
            .on('error', (err) => {
                console.error('Error leyendo el CSV:', err);
                mongoose.disconnect();
            });

    } catch (error) {
        console.error('Error en proceso de conexión/importación:', error);
        process.exit(1);
    }
}

importarDatos();
