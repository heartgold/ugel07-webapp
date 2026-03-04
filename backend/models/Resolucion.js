const mongoose = require('mongoose');

const beneficiarioSchema = new mongoose.Schema({
  nro_cargo: { type: String, default: null },
  fecha_cargo: { type: Date, default: null },
  dni_administrado: { type: String, default: null },
  nombre_administrado: { type: String },
  asunto_resumen: { type: String },
  estado_notificacion: { type: String },
  fecha_notificacion: { type: Date, default: null },
  tipo_notificacion: { type: String },
  notificador_responsable: { type: String },
  entidad_ie: { type: String },
  correo_electronico: { type: String },
  observaciones: { type: String }
}, { _id: false });

const resolucionSchema = new mongoose.Schema({
  nro_rd: { type: String, required: true },
  anio_ejercicio: { type: String },
  fecha_rd: { type: Date, default: null },
  nro_expediente: { type: String },
  area_emisora: { type: String },
  beneficiarios: [beneficiarioSchema]
}, { timestamps: true });

module.exports = mongoose.model('Resolucion', resolucionSchema);
