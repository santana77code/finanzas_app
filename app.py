from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from sqlalchemy import extract
import os
from database import engine, Base, get_db
import models
import auth
from typing import Optional, Dict, Any
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from datetime import datetime, timedelta

# Inicializar Base de Datos (crea sql_app.db o tablas en Postgres)
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Finanzas App Engine Pro")

class RecordInput(BaseModel):
    tipo: str = Field(..., description="Tipo de registro: Ingreso, Gasto o Ahorro")
    categoria: str = Field(..., description="Categoría asignada")
    descripcion: str = Field("", description="Descripción opcional")
    monto: float = Field(..., gt=0, description="Cantidad de dinero")

class UserCreate(BaseModel):
    username: str
    password: str

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

@app.get("/")
def read_root() -> FileResponse:
    # Dashboard o redirect si no está logueado
    return FileResponse(os.path.join(BASE_DIR, "static", "index.html"))

@app.get("/login")
def read_login() -> FileResponse:
    # Nuevo archivo login.html
    return FileResponse(os.path.join(BASE_DIR, "static", "login.html"))

# ---- Auth Routes ----
@app.post("/api/register")
def register_user(user: UserCreate, db: Session = Depends(get_db)):
    db_user = auth.get_user(db, username=user.username)
    if db_user:
        raise HTTPException(status_code=400, detail="El usuario ya existe")
    hashed_password = auth.get_password_hash(user.password)
    new_user = models.User(username=user.username, hashed_password=hashed_password)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"message": "Usuario creado exitosamente"}

@app.post("/api/login")
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = auth.get_user(db, username=form_data.username)
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

# ---- App Routes (Protegidas) ----
@app.post("/api/record")
def create_record(record: RecordInput, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if record.tipo not in ["Ingreso", "Gasto", "Ahorro"]:
        raise HTTPException(status_code=400, detail="Tipo inválido")
    
    nuevo_registro = models.Record(
        tipo=record.tipo,
        categoria=record.categoria,
        descripcion=record.descripcion,
        monto=record.monto,
        owner_id=current_user.id
    )
    db.add(nuevo_registro)
    db.commit()
    db.refresh(nuevo_registro)
    return {"status": "success", "message": "Registro guardado correctamente"}

@app.delete("/api/record/{registro_id}")
def delete_record(registro_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    registro = db.query(models.Record).filter(models.Record.id == registro_id, models.Record.owner_id == current_user.id).first()
    if not registro:
        raise HTTPException(status_code=404, detail="Registro no encontrado")
    db.delete(registro)
    db.commit()
    return {"status": "success", "message": "Registro eliminado"}

@app.get("/api/summary")
def get_monthly_summary(mes: Optional[int] = None, anio: Optional[int] = None, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if not mes or not anio:
        now = datetime.now()
        mes = now.month
        anio = now.year
        
    registros = db.query(models.Record).filter(
        models.Record.owner_id == current_user.id,
        extract('month', models.Record.fecha) == mes,
        extract('year', models.Record.fecha) == anio
    ).all()
    
    resumen = {"Ingreso": 0.0, "Gasto": 0.0, "Ahorro": 0.0, "Balance_Disponible": 0.0}
    for r in registros:
        if r.tipo in resumen:
            resumen[r.tipo] += r.monto
            
    resumen["Balance_Disponible"] = resumen["Ingreso"] - resumen["Gasto"]
    return {
        "mes": mes,
        "anio": anio,
        "resumen": resumen
    }

@app.get("/api/recent")
def get_recent(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    registros = db.query(models.Record).filter(models.Record.owner_id == current_user.id).order_by(models.Record.fecha.desc()).limit(10).all()
    
    return {"registros": [
        {
            "id": r.id,
            "Tipo": r.tipo,
            "Categoria": r.categoria,
            "Descripcion": r.descripcion,
            "Monto": r.monto,
            "Fecha": r.fecha.strftime("%Y-%m-%d %H:%M:%S")
        } for r in registros
    ]}

@app.get("/api/records_by_month")
def get_records_by_month(mes: Optional[int] = None, anio: Optional[int] = None, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if not mes or not anio:
        now = datetime.now()
        mes = now.month
        anio = now.year
        
    registros = db.query(models.Record).filter(
        models.Record.owner_id == current_user.id,
        extract('month', models.Record.fecha) == mes,
        extract('year', models.Record.fecha) == anio
    ).order_by(models.Record.fecha.desc()).all()
    
    return {"registros": [
        {
            "id": r.id,
            "Tipo": r.tipo,
            "Categoria": r.categoria,
            "Descripcion": r.descripcion,
            "Monto": r.monto,
            "Fecha": r.fecha.strftime("%Y-%m-%d %H:%M:%S")
        } for r in registros
    ]}

app.mount("/static", StaticFiles(directory=os.path.join(BASE_DIR, "static")), name="static")

if __name__ == "__main__":
    import uvicorn
    print("Iniciando el motor de Finanzas (Versión Cloud/Profesional)...")
    print("Accede a http://localhost:8000 en tu navegador")
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
