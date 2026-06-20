import os
import pathlib
import httpx
from fastapi import FastAPI, HTTPException, UploadFile, File

from parsers.csv_parser import parse_csv
from parsers.xml_parser import parse_xml
from parsers.xlsx_parser import parse_xlsx

from shared.schemas import ParsedMeasurement

app = FastAPI(title="E-Nose Importer API (Parser)")

# URL микросервиса БД читаем из переменных окружения
DB_API_URL = os.environ.get("DB_API_URL", "http://db_api:8000")

@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "importer"}

@app.post("/measurements/import", status_code=201)
async def import_measurement_file(file: UploadFile = File(...)):
    """
    Принимает файл, парсит его и отправляет в микросервис db_api.
    """
    content = await file.read()
    ext = pathlib.Path(file.filename).suffix.lower()

    # 1. Парсинг файла
    try:
        if ext == ".csv":
            parsed: ParsedMeasurement = parse_csv(content)
        elif ext == ".xml":
            parsed: ParsedMeasurement = parse_xml(content)
        elif ext == ".xlsx":
            parsed: ParsedMeasurement = parse_xlsx(content)
        else:
            raise HTTPException(400, f"Неподдерживаемый формат файла: {ext}")
    except ValueError as exc:
        raise HTTPException(422, f"Ошибка разбора файла: {exc}")
    except Exception as exc:
        raise HTTPException(500, f"Внутренняя ошибка парсера: {exc}")

    # 2. Отправка распарсенных данных в db_api
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{DB_API_URL}/measurements/ingest",
                # Сериализуем Pydantic модель в JSON
                json={"parsed": parsed.model_dump(mode="json")},
                timeout=30.0 # Таймаут побольше, т.к. вставка больших файлов может занять время
            )
            
        # Проверяем, успешно ли db_api сохранил данные
        if response.status_code not in (200, 201):
            raise HTTPException(
                status_code=response.status_code, 
                detail=f"Ошибка сохранения в db_api: {response.text}"
            )
            
        return response.json()
        
    except httpx.RequestError as exc:
        raise HTTPException(503, f"Микросервис БД (db_api) недоступен: {exc}")