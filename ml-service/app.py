from fastapi import FastAPI
from model import train_model

app = FastAPI()
model = train_model()

