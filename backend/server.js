require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const Resolucion = require('./models/Resolucion');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/ugel07_db';

// Middlewares básicos
app.use(cors());
app.use(express.json());

// Ruta de prueba
app.get('/api/status', (req, res) => {
    res.json({ status: 'ok', message: 'Servidor principal funcionando correctamente' });
});

// Ruta de búsqueda principal y combinada
app.get('/api/resoluciones/buscar', async (req, res) => {
    try {
        const { nro_rd, dni, anio, mes, area, termino, tipoBusqueda } = req.query;
        let query = {};
        const andConditions = [];

        // Búsqueda específica antigua por Nro RD o DNI
        if (tipoBusqueda === 'nro_rd' && nro_rd) {
            const baseNumber = nro_rd.replace(/^0+/, '') || '0';
            andConditions.push({ nro_rd: { $regex: new RegExp(`\\b0*${baseNumber}\\b`, 'i') } });
        } else if (tipoBusqueda === 'dni' && dni) {
            andConditions.push({ 'beneficiarios.dni_administrado': dni });
        }

        // Filtro por Año exacto
        if (anio) {
            andConditions.push({ anio_ejercicio: anio });
        }

        // Filtro por Mes (extrayendo el mes de fecha_rd)
        if (mes) {
            // mes viene como '1'..'12'. En MongoDB $month de un Date va de 1 a 12.
            andConditions.push({
                $expr: { $eq: [{ $month: "$fecha_rd" }, parseInt(mes, 10)] }
            });
        }

        // Búsqueda parcial en Área Emisora
        if (area) {
            andConditions.push({ area_emisora: { $regex: new RegExp(area, 'i') } });
        }

        // Búsqueda de término en el asunto del primer beneficiario (o de cualquiera)
        if (termino && (!tipoBusqueda || (tipoBusqueda !== 'nro_rd' && tipoBusqueda !== 'dni'))) {
            andConditions.push({ 'beneficiarios.asunto_resumen': { $regex: new RegExp(termino, 'i') } });
        } else if (termino && tipoBusqueda) {
            // En caso que el front envie termino como nro_rd o dni
            if (tipoBusqueda === 'nro_rd') {
                const baseNumber = termino.replace(/^0+/, '') || '0';
                andConditions.push({ nro_rd: { $regex: new RegExp(`\\b0*${baseNumber}\\b`, 'i') } });
            } else if (tipoBusqueda === 'dni') {
                andConditions.push({ 'beneficiarios.dni_administrado': termino });
            }
        }

        if (andConditions.length > 0) {
            query = { $and: andConditions };
        }

        // Ejecutar búsqueda en BD y retornar resultados
        // Aumentado a 5000 para prevenir que falten registros al usuario
        const resultados = await Resolucion.find(query).limit(5000);
        res.json({
            total: resultados.length,
            resultados: resultados
        });

    } catch (error) {
        console.error('Error en ruta de búsqueda:', error);
        res.status(500).json({ error: 'Error interno del servidor al buscar resoluciones' });
    }
});

// Obtener el siguiente nro_cargo disponible para un año dado
app.get('/api/resoluciones/siguiente-cargo', async (req, res) => {
    try {
        const { anio } = req.query;
        if (!anio) {
            return res.status(400).json({ error: 'El parámetro "anio" es requerido' });
        }

        // Buscar todos los documentos del año indicado
        const docs = await Resolucion.find({ anio_ejercicio: anio }, { 'beneficiarios.nro_cargo': 1 });

        let maxCargo = 0;
        docs.forEach(doc => {
            doc.beneficiarios.forEach(b => {
                if (b.nro_cargo) {
                    const num = parseInt(b.nro_cargo, 10);
                    if (!isNaN(num) && num > maxCargo) {
                        maxCargo = num;
                    }
                }
            });
        });

        const siguienteCargo = (maxCargo + 1).toString();
        res.json({ siguiente_cargo: siguienteCargo });

    } catch (error) {
        console.error('Error al obtener siguiente cargo:', error);
        res.status(500).json({ error: 'Error interno al calcular el siguiente nro_cargo' });
    }
});

// ----- NUEVAS RUTAS CRUD -----

// 1. Crear una nueva Resolución
app.post('/api/resoluciones', async (req, res) => {
    try {
        const nuevaResolucion = new Resolucion(req.body);
        const resultado = await nuevaResolucion.save();
        res.status(201).json({ message: 'Resolución creada con éxito', data: resultado });
    } catch (error) {
        console.error('Error al crear resolución:', error);
        res.status(500).json({ error: 'Error al intentar crear la resolución en BD' });
    }
});

// 2. Modificar una Resolución o sus beneficiarios (por id de la RD)
app.put('/api/resoluciones/:id', async (req, res) => {
    try {
        const idResolucion = req.params.id;
        // Para asegurar que estamos inyectando fecha y no strings puros si existen (opcional, mongoose lo auto-castings a veces)
        const updateData = req.body;

        // findByIdAndUpdate: Encuentra por ID (_id autogenerado por MongoDB) y sustituye sus valores
        const resultado = await Resolucion.findByIdAndUpdate(
            idResolucion,
            { $set: updateData },
            { new: true, runValidators: true } // new: true devuelve el objeto modificado, no el original
        );

        if (!resultado) {
            return res.status(404).json({ error: 'La Resolución especificada no existe' });
        }

        res.json({ message: 'Resolución actualizada correctamente', data: resultado });
    } catch (error) {
        console.error('Error al actualizar resolución:', error);
        res.status(500).json({ error: 'Fallo crítico actualizando resolución' });
    }
});

// 3. Borrar una Resolución completa (Opcional, por si se crea una repetida por error)
app.delete('/api/resoluciones/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const resultado = await Resolucion.findByIdAndDelete(id);

        if (!resultado) {
            return res.status(404).json({ error: 'Resolución no encontrada' });
        }

        res.json({ message: 'Resolución eliminada con éxito' });
    } catch (error) {
        console.error('Error al borrar resolución', error);
        res.status(500).json({ error: 'Error interno o de servidor borrando documento' });
    }
});


// Inicializar Conexión Base de Datos y arrancar Servidor
mongoose.connect(MONGO_URI)
    .then(() => {
        console.log(`Conexión exitosa a MongoDB en: ${MONGO_URI}`);
        app.listen(PORT, () => {
            console.log(`🚀 Servidor ejecutándose en el puerto ${PORT}`);
            console.log(`Prueba: http://localhost:${PORT}/api/status`);
        });
    })
    .catch(err => {
        console.error('No se pudo conectar a la base de datos:', err);
    });
