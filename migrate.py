import os
import pandas as pd
from database import engine, SessionLocal
import models
from auth import get_password_hash

def migrate_excel_to_db():
    print("Iniciando migración de Excel a la Base de Datos...")
    
    # Ensure tables exist
    models.Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    # 1. Check if admin user exists, if not, create one
    admin_user = db.query(models.User).filter(models.User.username == "admin").first()
    if not admin_user:
        print("Creando usuario administrador por defecto (admin / admin)...")
        admin_user = models.User(
            username="admin", 
            hashed_password=get_password_hash("admin")
        )
        db.add(admin_user)
        db.commit()
        db.refresh(admin_user)
    
    excel_path = "finanzas.xlsx"
    if not os.path.exists(excel_path):
        print(f"No se encontró {excel_path}. Migración omitida.")
        return
        
    # 2. Leer hojas y cargar a base de datos
    sheets = ["Ingresos", "Gastos", "Ahorros"]
    count = 0
    
    for sheet in sheets:
        try:
            df = pd.read_excel(excel_path, sheet_name=sheet)
            tipo = sheet[:-1] # Remover la 's' final para tener Ingreso, Gasto, Ahorro
            
            for _, row in df.iterrows():
                try:
                    fecha_val = pd.to_datetime(row["Fecha"]) if pd.notnull(row["Fecha"]) else None
                    if fecha_val:
                        nuevo_registro = models.Record(
                            tipo=tipo,
                            categoria=str(row["Categoria"]),
                            descripcion=str(row["Descripcion"]) if pd.notnull(row["Descripcion"]) else "",
                            monto=float(row["Monto"]),
                            fecha=fecha_val,
                            owner_id=admin_user.id
                        )
                        db.add(nuevo_registro)
                        count += 1
                except Exception as e:
                    print(f"Error procesando fila en {sheet}: {e}")
                    
        except ValueError:
            print(f"Hoja {sheet} no encontrada en Excel.")
        except Exception as e:
            print(f"Error general en {sheet}: {e}")

    db.commit()
    db.close()
    print(f"¡Migración completada con éxito! Se migraron {count} registros.")
    print("Inicia sesión en la aplicación con tu usuario 'admin' y contraseña 'admin'.")

if __name__ == "__main__":
    migrate_excel_to_db()
