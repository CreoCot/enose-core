## API Usage

### Authentication

Pass API key using the `X-API-Key` header:

```http
X-API-Key: example_api_key
```

---

### Generate Report

**Endpoint**

```http
POST /reports
```

**Content-Type**

```text
application/json
```

The request body must match the `ReportRequest` schema.

### Example

```bash
curl -X POST http://localhost:5050/reports \
  -H "Content-Type: application/json" \
  -H "Accept: application/pdf" \
  -H "X-API-Key: example_api_key" \
  --data @report.json \
  --output report.pdf
```

### Request Schema

```json
{
  "header": {
    "name": "Lemon oil",
    "device": "eNose-01",
    "object": "Lemon oil",
    "date": "2026-07-05T16:53:39"
  },
  "timestamps": [0, 1, 2],
  "sensors": [
    {
      "id": 1,
      "name": "SID0001",
      "initial": 9965895,
      "values": [9965894.78, 9965894.63, 9965894.42],
      "features": {
        "max_abs": 4.12,
        "max_signed": -4.12,
        "time_to_max": 2.0,
        "end_value": -4.12,
        "auc": -8.43,
        "slope_init": -0.22,
        "drop_from_max": 0.0,
        "noise_std": 0.05
      }
    }
  ],
  "interpretation": "Detected lemon oil with high confidence."
}
```

### Response

On success, the service returns a PDF document.

**Content-Type**

```text
application/pdf
```

The response includes the `Content-Disposition` header so the generated report can be downloaded.

---

### Example Report

**Endpoint**

```http
GET /example
```

Returns a sample PDF bundled with the service.

### Example

```bash
curl -X GET http://localhost:5050/example \
  -H "Accept: application/pdf" \
  --output example.pdf
```

### Response

**Content-Type**

```text
application/pdf
```

**Filename**

```text
example.pdf
```
