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
curl -X POST http://localhost:8002/reports \
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
      "values": [9965894.78, 9965894.63, 9965894.42]
    }
  ],
  "interpretation": {
    "text": "Detected lemon oil with high confidence."
  }
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
curl -X GET http://localhost:8002/example \
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
