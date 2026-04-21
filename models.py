from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timedelta
from database import Base

def get_colombia_time():
    # Retorna la hora de Colombia (UTC-5)
    return datetime.utcnow() - timedelta(hours=5)

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)

    # Relación con registros de finanzas
    records = relationship("Record", back_populates="owner")


class Record(Base):
    __tablename__ = "records"

    id = Column(Integer, primary_key=True, index=True)
    tipo = Column(String, index=True) # Ingreso, Gasto, Ahorro
    categoria = Column(String, index=True)
    descripcion = Column(String)
    monto = Column(Float)
    fecha = Column(DateTime, default=get_colombia_time)
    
    owner_id = Column(Integer, ForeignKey("users.id"))

    owner = relationship("User", back_populates="records")
