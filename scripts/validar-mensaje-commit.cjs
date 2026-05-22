#!/usr/bin/env node
'use strict'

const fs = require('fs')

const archivo = process.argv[2]
if (!archivo) {
  console.error('Error: falta la ruta del archivo del mensaje de commit (commit-msg).')
  process.exit(1)
}

let contenido = ''
try {
  contenido = fs.readFileSync(archivo, 'utf8')
} catch {
  console.error('Error: no se pudo leer el archivo del mensaje de commit.')
  process.exit(1)
}

const titulo = (contenido.split('\n')[0] || '').trim()
if (!titulo) process.exit(0)

if (/^Merge\b/.test(titulo) || /^Revert\b/.test(titulo)) process.exit(0)

const MAX = 72
const tipos = new Set(['feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'ci', 'chore', 'revert'])

const emojiRegex = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u

function fallar(motivo) {
  console.error('\nCommit rechazado: mensaje inválido.\n')
  console.error(`Motivo: ${motivo}\n`)
  console.error('Formato esperado:')
  console.error('  <tipo>(<alcance>): <descripcion>')
  console.error('  <tipo>: <descripcion>\n')
  console.error('Ejemplos correctos:')
  console.error('  feat(auth): agregar login con dos factores')
  console.error('  fix(api): corregir validación de correo')
  console.error('  chore: actualizar dependencias\n')
  process.exit(1)
}

if (titulo.length > MAX) fallar(`máximo ${MAX} caracteres (tiene ${titulo.length}).`)
if (titulo.endsWith('.')) fallar('sin punto final.')
if (emojiRegex.test(titulo)) fallar('sin emojis.')

const m = titulo.match(/^([a-z]+)(\(([^)]+)\))?: (.+)$/)
if (!m) fallar('no cumple el formato <tipo>(<alcance>): <descripcion>.')

const tipo = m[1]
const alcance = m[3]
const descripcion = m[4]

if (!tipos.has(tipo)) fallar(`tipo inválido "${tipo}".`)

if (alcance && !/^[a-z0-9][a-z0-9_\-\/]*$/.test(alcance)) {
  fallar('alcance inválido: usa minúsculas, números, guiones y guion_bajo.')
}

if (/^[A-ZÁÉÍÓÚÑÜ]/.test(descripcion)) {
  const permiteAcronimo = /^(SSA|API|JWT|OAuth|MongoDB|PDF|Excel)\b/.test(descripcion)
  if (!permiteAcronimo) fallar('la descripción debe iniciar en minúscula (salvo nombres propios).')
}

const ingles =
  /\b(update|updated|updating|add|added|adding|remove|removed|refactor|cleanup|bump|wip|tmp|stuff|things|bug|fixed?|fixes?|improve(d)?|implement(ed)?|create(d)?|change(d)?|misc)\b/i
if (ingles.test(descripcion)) {
  fallar('la descripción parece estar en inglés. Usa verbos en español (agregar, corregir, actualizar, etc.).')
}

process.exit(0)
