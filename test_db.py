from excel_db import db
import json

print("Insertando registros de prueba...")
try:
    db.insert_record("Ingreso", "Salario", "Prueba salario", 5000)
    db.insert_record("Gasto", "Alimentación", "Prueba comida", 1500)
    db.insert_record("Ahorro", "Fondo Emergencia", "Prueba ahorro", 500)
    print("Registros creados")
except Exception as e:
    print(f"Error insertando: {e}")

print("\nObteniendo resumen:")
summary = db.get_summary()
print(summary)

print("\nObteniendo recientes:")
recent = db.get_recent_records()
print(json.dumps(recent, indent=2))
