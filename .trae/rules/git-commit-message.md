---
alwaysApply: true
---

# Reglas de Commits

## Formato

```
<tipo>(<alcance>): <descripción>
```

Ejemplo:
```
feat(auth): agregar login con dos factores
fix(carrito): corregir cálculo de impuestos
docs(readme): actualizar instrucciones
```

---

## Tipos Válidos

| Tipo | Uso |
|------|-----|
| feat | Nueva funcionalidad |
| fix | Corrección de bug |
| docs | Cambios en documentación |
| style | Formato de código |
| refactor | Refactorización sin cambio lógico |
| perf | Mejora de rendimiento |
| test | Agregar/modificar tests |
| ci | CI/CD o herramientas de build |
| chore | Mantenimiento, dependencias |
| revert | Revertir commit anterior |

---

## Reglas Obligatorias

SIEMPRE EN ESPAÑOL
- Imperativo presente: "agregar", "corregir", "actualizar" (no "agregado")
- Máximo 72 caracteres
- Sin punto final
- Minúscula inicial (salvo nombres propios)
- Un cambio lógico por commit

NO HACER
- Otros idiomas
- Emojis
- Commits genéricos ("update", "fix bug")
- Múltiples cambios en un commit

---

## Ejemplos

Correcto:
```
feat(perfil): agregar foto de usuario
fix(api): corregir validación de email
refactor(auth): extraer lógica de tokens
test(usuarios): aumentar cobertura
chore: actualizar dependencias
```

Incorrecto:
```
feat: agregada la foto               (sin alcance)
Fix bug en login                     (mayúscula, sin tipo)
feat(perfil): foto, email, bio       (múltiples cambios)
updated stuff                        (genérico, otro idioma)
```

---

## Cuerpo Detallado (Opcional)

Para cambios complejos, agrega después de una línea en blanco:

```
feat(pagos): implementar pago con tarjeta

- Validación de número de tarjeta
- Integración con Stripe
- Tokens de seguridad

Cierra #42
```

---

## Checklist Rápido

- [ ] ¿Español?
- [ ] ¿Tipo válido?
- [ ] ¿Imperativo presente?
- [ ] ¿Máx 72 caracteres?
- [ ] ¿Sin punto?
- [ ] ¿Un cambio?
