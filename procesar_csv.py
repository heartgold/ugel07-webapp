import pandas as pd
import os
import glob
import re

directorio = 'd:/PROYECTO_UGEL/excels_originales'
archivo_salida = os.path.join(directorio, 'MAESTRO_RESOLUCIONES_UGEL_07.csv')

# Diccionario de Mapeo
mapeo = {
    'RD': 'nro_rd', 'NRO RD': 'nro_rd', 'N° DE RD': 'nro_rd', 'NRO RESOLUCION': 'nro_rd',
    'FECHA': 'fecha_rd', 'FECHA RD': 'fecha_rd', 'FECHA DE RD': 'fecha_rd', 'FECHA RESOLUCION': 'fecha_rd',
    'N° DE CARGO': 'nro_cargo', 'NRO DE CARGO': 'nro_cargo', 'NRO CARGO': 'nro_cargo', 'CARGO': 'nro_cargo',
    'FECHA DE CARGO': 'fecha_cargo', 'FECHA CARGO': 'fecha_cargo',
    'INTERESADO': 'nombre_administrado', 'ADMINISTRADO': 'nombre_administrado', 'TITULAR RESOLUCION': 'nombre_administrado',
    'DNI': 'dni_administrado', 'NRO DOCUMENTO': 'dni_administrado', 'NRO DOCUMENTO IDENTIDAD': 'dni_administrado',
    'ARTICULO': 'asunto_resumen', 'ARTICULO 1': 'asunto_resumen', 'ASUNTO': 'asunto_resumen',
    'ESTADO': 'estado_notificacion',
    'FECHA DE NOTIF': 'fecha_notificacion', 'FECHA NOTIFICACION': 'fecha_notificacion',
    'MODO': 'tipo_notificacion', 'TIPO NOTIF.': 'tipo_notificacion',
    'NRO EXPEDIENTE': 'nro_expediente', 'NRO DE EXPEDIENTE - E SINAD': 'nro_expediente'
}

columnas_finales = [
    'nro_cargo', 'fecha_cargo', 'anio_ejercicio', 'nro_rd', 'fecha_rd', 'nro_expediente', 'dni_administrado', 
    'nombre_administrado', 'asunto_resumen', 'area_emisora', 'estado_notificacion', 
    'fecha_notificacion', 'tipo_notificacion', 'notificador_responsable', 
    'entidad_ie', 'correo_electronico', 'observaciones'
]

def extraer_anio_de_nombre(nombre_archivo):
    match = re.search(r'(20\d{2})', os.path.basename(nombre_archivo))
    if match:
        return match.group(1)
    return pd.NA

def leer_csv_seguro(archivo):
    for encoding in ['utf-8', 'latin1', 'cp1252']:
        for sep in [',', ';', '\t']:
            try:
                df = pd.read_csv(archivo, dtype=str, encoding=encoding, sep=sep)
                if len(df.columns) > 1:
                    return df
            except Exception:
                pass
            
    # Fallback
    try:
        return pd.read_csv(archivo, dtype=str, encoding='latin1')
    except Exception as e:
        print(f"Error irrecoverable leyendo {os.path.basename(archivo)}: {e}")
        return None

def procesar_archivos():
    archivos_csv = glob.glob(os.path.join(directorio, '*.csv'))
    dataframes = []

    for archivo in archivos_csv:
        if os.path.basename(archivo) == 'MAESTRO_RESOLUCIONES_UGEL_07.csv':
            continue
            
        df = leer_csv_seguro(archivo)
        if df is None or df.empty:
            print(f"Advertencia: Archivo vacío o ilegible {os.path.basename(archivo)}")
            continue
            
        try:
            # Obtener y limpiar columnas validas (ignorar Unnamed x)
            cols_validas = [c for c in df.columns if str(c).strip() and not str(c).upper().startswith("UNNAMED")]
            df = df[cols_validas].copy()
            
            # Limpiar uppercase y duplicados
            nuevas_columnas = []
            vistas = set()
            for c in df.columns:
                c_limpio = str(c).strip().upper()
                if c_limpio not in vistas:
                    vistas.add(c_limpio)
                    nuevas_columnas.append(c_limpio)
                else:
                    nuevas_columnas.append(f"DUPLICADO_{c_limpio}_{len(nuevas_columnas)}")
            df.columns = nuevas_columnas
            
            # Remover las artificiales que pusimos para evitar duplicados reales
            df = df.loc[:, [c for c in df.columns if not c.startswith("DUPLICADO_")]]

            # Aplicar mapeo
            df = df.rename(columns=mapeo)
            
            # Remover duplicados luego de mapear
            df = df.loc[:, ~df.columns.duplicated()]
            
            # Año
            anio_archivo = extraer_anio_de_nombre(archivo)
            if 'ANIO' in df.columns:
                df['anio_ejercicio'] = df['ANIO'].fillna(anio_archivo)
            elif 'AÑO' in df.columns:
                df['anio_ejercicio'] = df['AÑO'].fillna(anio_archivo)
            else:
                df['anio_ejercicio'] = anio_archivo

            for col in columnas_finales:
                if col not in df.columns:
                    df[col] = pd.NA
                    
            df = df[columnas_finales]
            dataframes.append(df)
            print(f"Procesado con éxito: {os.path.basename(archivo)} ({len(df)} filas)")
            
        except Exception as e:
            print(f"Error procesando {os.path.basename(archivo)}: {e}")

    if dataframes:
        df_maestro = pd.concat(dataframes, ignore_index=True)
        
        if 'dni_administrado' in df_maestro.columns:
            df_maestro['dni_administrado'] = df_maestro['dni_administrado'].astype(str).str.replace(' ', '', regex=False)
            df_maestro['dni_administrado'] = df_maestro['dni_administrado'].replace(['#N/A', '#N/A ', 'nan', '<NA>'], pd.NA)
            
        for date_col in ['fecha_rd', 'fecha_notificacion']:
            if date_col in df_maestro.columns:
                df_maestro[date_col] = pd.to_datetime(df_maestro[date_col], errors='coerce', dayfirst=True).dt.strftime('%Y-%m-%d')
                
        df_maestro.to_csv(archivo_salida, index=False, encoding='utf-8')
        print(f"\n¡Éxito! Archivo maestro guardado en: {archivo_salida}")
        print(f"Total de registros consolidados: {len(df_maestro)}")
    else:
        print("No se encontraron datos para procesar.")

if __name__ == '__main__':
    procesar_archivos()
