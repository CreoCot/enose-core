import pathlib
from fastapi import FastAPI, HTTPException, UploadFile, File

from apps.parser.app.parsers.csv_parser import parse_csv
from apps.parser.app.parsers.xml_parser import parse_xml
from apps.parser.app.parsers.xlsx_parser import parse_xlsx
from apps.parser.app.schemas import ParsedMeasurement

app = FastAPI(
    title="E-Nose Parser Service",
    description="Stateless сервис для конвертации файлов (CSV, XML, XLSX) в единый формат JSON",
)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "parser-pure"}


@app.post("/measurements/parse", response_model=ParsedMeasurement, status_code=200)
async def parse_measurement_file(file: UploadFile = File(...)) -> ParsedMeasurement:
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

        return parsed

    except ValueError as exc:
        raise HTTPException(422, f"Ошибка разбора структуры файла: {exc}")
    except Exception as exc:
        raise HTTPException(500, f"Внутренняя ошибка при чтении файла: {exc}")
