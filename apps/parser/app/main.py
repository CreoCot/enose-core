import os
import pathlib
from typing import Optional
from fastapi import FastAPI, HTTPException, UploadFile, File, Header, Depends

from .parsers.csv_parser import parse_csv
from .parsers.xml_parser import parse_xml
from .parsers.xlsx_parser import parse_xlsx
from .schemas import ParsedMeasurement
from .feature_service import extract_features

app = FastAPI(
    title="E-Nose Parser Service",
    description="Stateless сервис для конвертации файлов (CSV, XML, XLSX) в единый формат JSON",
)

PARSER_API_KEY = os.getenv("PARSER_API_KEY", "nothing")


async def verify_api_key(x_api_key: Optional[str] = Header(None)):
    """Middleware для проверки API ключа"""
    if x_api_key != PARSER_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")
    return True


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "parser-pure"}


@app.post("/measurements/parse", response_model=ParsedMeasurement, status_code=200)
async def parse_measurement_file(
    file: UploadFile = File(...), _: bool = Depends(verify_api_key)
) -> ParsedMeasurement:
    """
    Принимает файл, определяет его тип по расширению,
    парсит и возвращает стандартизированный JSON (ParsedMeasurement).
    Не имеет побочных эффектов, ничего не сохраняет в БД.
    """
    content = await file.read()
    ext = pathlib.Path(file.filename).suffix.lower()

    try:
        if ext == ".csv":
            parsed: ParsedMeasurement = parse_csv(content)
        elif ext == ".xml":
            parsed: ParsedMeasurement = parse_xml(content)
        elif ext == ".xlsx":
            parsed: ParsedMeasurement = parse_xlsx(content)
        else:
            raise HTTPException(400, f"Неподдерживаемый формат файла: {ext}")

        parsed.features = extract_features(parsed)
        return parsed

    except ValueError as exc:
        raise HTTPException(422, f"Ошибка разбора структуры файла: {exc}")
    except Exception as exc:
        raise HTTPException(500, f"Внутренняя ошибка при чтении файла: {exc}")
