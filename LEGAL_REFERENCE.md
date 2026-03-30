# LEGAL_REFERENCE.md — Referencia legal LAASSP y Reglamento

## Marco normativo aplicable

**Ley:** Ley de Adquisiciones, Arrendamientos y Servicios del Sector Publico
Publicada en el DOF el 16 de abril de 2025. Abroga la LAASSP del 4 de enero de 2000.

**Reglamento:** Reglamento de la Ley de Adquisiciones, Arrendamientos y Servicios del Sector Publico
(Texto vigente al momento de la construccion del sistema. Nota: el Art. 45 del Reglamento fue reformado el 27-03-2026.)

---

## Definiciones clave del Reglamento relevantes para el sistema (Art. 2)

| Termino | Definicion resumida | Mapeo en el sistema |
|---|---|---|
| Area contratante | Unidad administrativa facultada para realizar procedimientos de contratacion | Perfil `area_contratante` |
| Area requirente | Unidad administrativa que solicita o utilizara el bien o servicio | Parte del flujo interno; no es un perfil separado en el MVP |
| Area tecnica | Elabora especificaciones tecnicas y evalua propuestas tecnicas | Funcion del AT en el sistema |
| Administrador del contrato | Servidor publico responsable de dar seguimiento al cumplimiento del contrato | Funcion del AT en etapa de entregas |
| Bitacora | Modulo de la Plataforma para registro y seguimiento de contratos | Analogia al expediente digital del procedimiento en el sistema |

---

## Tipos de procedimiento de contratacion (Art. 35 LAASSP)

El sistema implementa los tres procedimientos del Art. 35 aplicables a dependencias:

| Fraccion | Procedimiento | Slug en sistema |
|---|---|---|
| I | Licitacion publica | `licitacion_publica_*` |
| II | Invitacion a cuando menos tres personas | `invitacion_tres_personas` |
| III | Adjudicacion directa | `adjudicacion_directa` |

Los procedimientos de las fracciones IV a VII son exclusivos de Hacienda como contratante consolidador y no aplican al SSA.

---

## Caracteres de la licitacion publica (Art. 39 LAASSP)

| Caracter | Slug en sistema |
|---|---|
| Nacional — solo empresas mexicanas, 65% contenido nacional | `licitacion_publica_nacional` |
| Internacional bajo cobertura de tratados | `licitacion_publica_internacional_tratados` |
| Internacional abierta (libre) | `licitacion_publica_internacional_libre` |

---

## Supuestos de excepcion a la licitacion publica (Art. 54 LAASSP + Art. 109 Reglamento)

Cuando el tipo es `invitacion_tres_personas` o `adjudicacion_directa`, el sistema requiere seleccionar el supuesto del Art. 54. El Reglamento (Art. 109) detalla como acreditar cada supuesto:

| Fraccion | Supuesto resumido | Como acreditarlo |
|---|---|---|
| I | Proveedor unico, patente exclusiva u obra de arte | Investigacion de mercado + 3 escritos de empresas del ramo que confirmen inexistencia, o analisis del area requirente |
| II | Caso fortuito o fuerza mayor que ponga en riesgo orden social, economia, servicios publicos, salubridad, seguridad o ambiente | Dictaminacion del area requirente |
| III | Circunstancias que provoquen perdidas o costos adicionales cuantificados | Investigacion de mercado que acredite mejores condiciones; aplica cuando hay proveedor con contrato vigente en otra dependencia adjudicado por LP |
| IV | Fines exclusivamente militares o para la armada, o riesgo a la seguridad nacional | Dictaminacion del area requirente. Los requerimientos administrativos no caen en este supuesto |
| V | Caso fortuito o fuerza mayor que impida obtener bienes/servicios por LP a tiempo | Nexo causal directo entre el caso fortuito y la imposibilidad. Basta solicitudes de cotizacion inmediatas. La falta de planeacion NO es fuerza mayor |
| VI | Rescision de contrato previo | Dictaminacion del area requirente |
| VII | Licitacion declarada desierta | Solo si se mantienen los mismos requisitos que causaron desechamiento en la LP declarada desierta |
| VIII | Bienes de marca determinada justificada | Acreditar inexistencia de marcas alternativas o razon tecnica/juridica que obliga a la marca especifica |
| IX | Bienes perecederos, granos, alimentos basicos; bienes usados o reconstruidos | Dictaminacion del area requirente |
| X | Servicios de consultorias, asesorias, estudios o investigaciones | Ver tipos de consultoria abajo |
| XI | Campesinos o grupos marginados, cooperativas o sector social | Capacidad individual de personas fisicas del grupo puede sumarse |
| XII | Bienes para comercializacion directa o procesos productivos propios | Dictaminacion del area requirente |
| XIII | Bienes de personas en liquidacion, disolucion o intervencion judicial | |
| XIV | Servicios de persona fisica realizados por ella misma con un solo especialista | |
| XV | Servicios de mantenimiento sin posibilidad de precisar alcance | Adjuntar relacion estimada de bienes y precios |
| XVI | Diseno y fabricacion de prototipo | Derecho exclusivo a favor de la Federacion por maximo 5 anos |
| XVII | Equipos especializados y sustancias para proyectos de investigacion cientifica | |
| XVIII | Bienes y servicios para instalaciones nucleares | |
| XIX | Adquisiciones a fabricantes con mejores condiciones de mercado | Dictaminacion del area requirente |

### Tipos de servicios de consultoria (Reglamento Art. 109, frac. IX)

Relevante cuando el AC selecciona el supuesto X del Art. 54. El sistema debe permitir capturar cual aplica:

- **Estandarizados**: soluciones para problemas comunes, recurrentes o de complejidad menor.
- **Personalizados o a la medida**: soluciones ex profeso para problemas especificos no comunes.
- **Especializados**: trabajos de alta especializacion para problemas complejos de alto impacto.

---

## Investigacion de mercado (Reglamento Arts. 45-53)

El SSA no gestiona la investigacion de mercado directamente, pero la justificacion del procedimiento debe hacer referencia a ella.

Puntos clave:
- Es obligatoria previa a cualquier procedimiento (Art. 35 LAASSP parr. sexto).
- Debe consultar al menos **dos fuentes** (Art. 47 Reglamento).
- Fuente **obligatoria**: informacion de contratos en la Plataforma de los ultimos 3 anos.
- Fuentes complementarias: solicitudes de cotizacion, organismos especializados, camaras, internet.
- El resultado debe cargarse en la Plataforma dentro de los **5 dias habiles** siguientes a su emision (Art. 45 reformado 27-03-2026).

El contenido minimo de la investigacion de mercado (Art. 52 Reglamento):
1. Objetivos de la adquisicion.
2. Fuentes de informacion utilizadas.
3. Existencia de los bienes o servicios.
4. Numero de potenciales proveedores con capacidad de cumplir.
5. Nacionalidad de los potenciales proveedores.
6. Pais de origen de los bienes y grado de contenido nacional.
7. Mediana y promedio de precios.
8. Estratificacion de los potenciales proveedores.

---

## Documento de excepcion a la licitacion (Reglamento Art. 108)

Cuando el AC registra un procedimiento con excepcion a LP, el campo `justificacionTipo` debe contener al menos (en este orden):

1. Descripcion de bienes o servicios y especificaciones tecnicas.
2. Plazos y condiciones de entrega.
3. Resultado de la investigacion de mercado y su analisis.
4. Procedimiento propuesto, fundamentando el supuesto del Art. 54 aplicable.
5. Monto estimado y forma de pago.
6. Nombre de la persona propuesta (adjudicacion directa) o nombres de los invitados (invitacion 3 personas).
7. Acreditacion de los criterios de eficiencia, eficacia, economia, imparcialidad, transparencia y honradez.

El sistema debe incluir un campo estructurado en el formulario de justificacion que guie al AC punto por punto.

---

## Plazos legales clave para el sistema de alertas

### Licitacion publica (Art. 42 LAASSP / Art. 87 Reglamento)

| Tipo de LP | Plazo minimo entre publicacion y apertura |
|---|---|
| Internacional bajo cobertura de tratados | 40 dias naturales (reducible a 10 dias en urgencia justificada) |
| Internacional libre | 20 dias naturales |
| Nacional | 15 dias naturales |
| Reduccion justificada (nacional) | No menos de 10 dias naturales |

### Invitacion a cuando menos tres personas (Art. 56 LAASSP / Art. 114 Reglamento)

- No inferior a **5 dias naturales** desde entrega de la ultima invitacion.
- Si hay junta de aclaraciones: al menos **3 dias naturales** entre la junta y la apertura de propuestas.

### Adjudicacion directa (Arts. 57-58 LAASSP / Art. 112 Reglamento)

- Cotizante sostiene su cotizacion por no menos de **20 dias habiles**.
- Firma del contrato: **15 dias habiles** siguientes a la notificacion de adjudicacion.
- En caso fortuito o fuerza mayor (fracs. II y V Art. 54): puede iniciarse el suministro con la notificacion; el contrato debe formalizarse en **15 dias habiles**.

### Aceptacion de bienes entregados (Art. 72 LAASSP)

- La dependencia acepta o rechaza bienes en no mas de **10 dias habiles** de haberlos recibido.
- Esos 10 dias no se contabilizan en el plazo de pago.

### Pago al proveedor (Art. 73 LAASSP / Arts. 134-135 Reglamento)

- No puede exceder **17 dias habiles** desde el envio y verificacion de la factura.
- Si la factura tiene errores: la dependencia tiene **3 dias habiles** para indicarlos; ese periodo **suspende** el computo de los 17 dias.

### Rescision administrativa (Art. 77 LAASSP / Arts. 144-145 Reglamento)

- El proveedor tiene **5 dias habiles** para exponer su defensa desde la comunicacion del incumplimiento.
- La dependencia resuelve en los **10 dias habiles** siguientes.
- El finiquito se formula dentro de los **20 dias naturales** siguientes a la notificacion de rescision.

### Terminacion anticipada (Art. 78 LAASSP / Art. 148 Reglamento)

- El dictamen debe elaborarse en **10 dias habiles** desde que se advierte la necesidad.
- La opinion del OIC es necesaria cuando el monto excede **250 veces el valor mensual de la UMA**.

---

## Penas convencionales y deducciones (Arts. 75-76 LAASSP / Arts. 141-143 Reglamento)

- La pena por atraso se calcula sobre el valor de los bienes/servicios entregados con atraso, **no** sobre el total del contrato.
- La suma de todas las penas no puede exceder el importe de la garantia de cumplimiento.
- Sin garantia de cumplimiento (supuestos exentos): el maximo es el **20% del monto entregado con atraso**.
- Las deducciones se calculan hasta la fecha en que se cumpla materialmente la obligacion.

Implicacion para el sistema: En la etapa de entregas, cuando una entrega tiene fecha real posterior a la estimada, el sistema puede mostrar una alerta sobre la procedencia de penas convencionales. El calculo no lo hace el sistema; el AT lo documenta en el campo de observaciones.

---

## Fraccionamiento prohibido (Reglamento Art. 111)

Se considera fraccionamiento cuando concurren todos estos elementos:

1. Todas las operaciones se fundamentan en el Art. 55 LAASSP (por monto) y la suma supera el limite.
2. Los bienes o servicios son exactamente los mismos.
3. Las operaciones se efectuan en un solo ejercicio fiscal.
4. El area contratante pudo haber previsto la contratacion en un solo procedimiento.
5. Son solicitados por la misma area requirente.

Implicacion para el sistema: El dashboard gerencial puede detectar patrones de posible fraccionamiento (mismo bien/servicio, mismo AC, mismo ejercicio fiscal) como una alerta visual informativa, sin bloquear la operacion.

---

## Modificaciones a contratos (Art. 74 LAASSP / Arts. 136-137 Reglamento)

- Maximo **20%** del monto o cantidad por partida originalmente pactada.
- No se pueden modificar precios, anticipos ni especificaciones que otorguen ventajas al proveedor.
- La modificacion del plazo solo procede por caso fortuito, fuerza mayor o causas atribuibles a la dependencia.
- Los contratos de arrendamiento o servicios pueden ampliarse hasta el **primer trimestre del ejercicio fiscal siguiente** si son indispensables para no interrumpir la operacion (Art. 137 Reglamento).

---

## Procedimientos urgentes — sustento legal

Los procedimientos marcados como urgentes en el sistema corresponden principalmente a:

- **Art. 54, frac. IV**: fines exclusivamente militares o para la armada, o riesgo a la seguridad nacional.
- **Art. 54, frac. V**: caso fortuito o fuerza mayor que no permite licitar en el tiempo requerido. La falta de planeacion **no** puede invocarse como fuerza mayor.
- **Art. 42 LAASSP / Art. 87 Reglamento**: reduccion de plazos en LP por causas supervenientes ajenas a la convocante.

En todos los casos, el campo `justificacionUrgencia` debe documentar el nexo causal entre la urgencia y el supuesto legal que la sustenta.

---

## Nota sobre la nueva LAASSP 2025

La ley vigente desde el 16 de abril de 2025 introduce cambios relevantes:

- Sustituye CompraNet por la Plataforma Digital de Contrataciones Publicas (Art. 81). La Plataforma tiene 18 meses para completar los modulos de contratacion y 30 meses en total (Transitorio Tercero). Mientras tanto, sigue aplicando CompraNet.
- Introduce el dialogo competitivo (Arts. 63-64) y la adjudicacion directa con negociacion (Arts. 60-61) como procedimientos exclusivos de Hacienda.
- Cambia la denominacion de la secretaria normativa a Secretaria Anticorrupcion y Buen Gobierno (Art. 5, frac. XVII).
- Crea el Comite de Contrataciones Estrategicas (Arts. 21-22) y el Registro Unico de Participantes (Art. 86).
- La Bitacora del Reglamento (Art. 2, frac. VI) es el equivalente normativo del expediente digital que gestiona el SSA.

Estos cambios no impactan el flujo interno del SSA, pero deben considerarse al redactar las justificaciones legales de los procedimientos.
